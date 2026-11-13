import * as THREE from 'three'
import { SongNode } from './types'

export const TEXTURE_SIZE  = 256    // px per atlas slot
export const TEXTURE_DEPTH = 256    // max unique artworks in the atlas
export const ATLAS_COLS    = 16     // 16x16 = 256 slots (4096x4096px canvas)
export const CRITICAL_TILES = 32    // number of tiles needed for the initial center camera view

/**
 * Optimizes image URLs by requesting the exact 256x256 square from Apple CDN,
 * reducing payload size by ~5x compared to 600x600.
 */
export function getOptimizedArtworkUrl(url: string, size: 100 | 256 | 600 = 256): string {
  if (!url) return ''
  if (url.includes('mzstatic.com')) {
    return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
  }
  return url
}

type SlotEntry = { url: string; promise: Promise<void> }

/**
 * Single owner of the artwork atlas (the only code that loads artwork into it).
 *
 * - Each slot is loaded at most once per (generation, url): concurrent callers share the
 *   same in-flight promise instead of issuing duplicate image requests.
 * - `generation` changes on every new chart (prepareCriticalVibe). Late image loads from a
 *   previous chart are discarded instead of being drawn into the new chart's slots.
 * - GPU texture uploads are coalesced: one after the critical set, then at most every 1.2 s.
 */
class AtlasManager {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private texture: THREE.CanvasTexture | null = null
  private slots = new Map<number, SlotEntry>()
  private generation = 0
  private criticalReady: Promise<void> = Promise.resolve()
  private dirty = false
  private lastFlushTime = 0
  private ensureRunning = false
  private ensureQueued: SongNode[] | null = null

  /**
   * Initializes or returns the singleton Canvas and CanvasTexture.
   * Safe to call repeatedly.
   */
  public init(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
    if (this.canvas && this.texture) {
      return { canvas: this.canvas, texture: this.texture }
    }

    if (typeof document === 'undefined') {
      // SSR fallback dummy
      const dummyTex = new THREE.Texture()
      return { canvas: null as any, texture: dummyTex as any }
    }

    const cvs = document.createElement('canvas')
    cvs.width = TEXTURE_SIZE * ATLAS_COLS
    cvs.height = TEXTURE_SIZE * ATLAS_COLS

    const ctx = cvs.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#121218' // Premium dark slate base
    ctx.fillRect(0, 0, cvs.width, cvs.height)

    const tex = new THREE.CanvasTexture(cvs)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.generateMipmaps = false
    tex.needsUpdate = true

    this.canvas = cvs
    this.ctx = ctx
    this.texture = tex

    return { canvas: cvs, texture: tex }
  }

  public getTexture(): THREE.CanvasTexture {
    return this.init().texture
  }

  /**
   * Loads one atlas slot. Returns the in-flight promise if the same URL is already
   * loading/loaded for this generation (no duplicate requests). The promise resolves
   * when the slot has been drawn (image or fallback); it never rejects.
   * `fallbackAfterMs`: draw a placeholder and resolve early if the image is slow
   * (the real image is still drawn later if it arrives within the same generation).
   */
  private loadSlot(index: number, song: SongNode, fallbackAfterMs?: number): Promise<void> {
    const slot = index % TEXTURE_DEPTH
    const url = song.albumArt ? getOptimizedArtworkUrl(song.albumArt, 256) : ''
    const existing = this.slots.get(slot)
    if (existing && existing.url === url) return existing.promise

    const gen = this.generation
    const color = song.color || '#333'
    const isCurrent = () => gen === this.generation && this.slots.get(slot) === entry
    const entry: SlotEntry = { url, promise: Promise.resolve() }
    entry.promise = new Promise<void>((resolve) => {
      if (!url) {
        this.drawFallbackSlot(slot, color)
        this.dirty = true
        resolve()
        return
      }
      let settled = false
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      const timer = fallbackAfterMs
        ? setTimeout(() => {
            if (!settled && isCurrent()) { this.drawFallbackSlot(slot, color); this.dirty = true }
            resolve()
          }, fallbackAfterMs)
        : null
      const finish = (ok: boolean) => {
        settled = true
        if (timer) clearTimeout(timer)
        if (isCurrent() && this.ctx) {
          const col = slot % ATLAS_COLS
          const row = Math.floor(slot / ATLAS_COLS)
          if (ok) {
            try {
              this.ctx.drawImage(img, col * TEXTURE_SIZE, row * TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_SIZE)
            } catch {
              this.drawFallbackSlot(slot, color)
            }
          } else {
            this.drawFallbackSlot(slot, color)
          }
          this.dirty = true
        }
        resolve()
      }
      img.onload = () => finish(true)
      img.onerror = () => finish(false)
      img.src = url
    })
    this.slots.set(slot, entry)
    return entry.promise
  }

  /** Mark the texture for GPU upload if anything was drawn (throttled unless forced). */
  private flush(force: boolean) {
    if (!this.texture || !this.dirty) return
    const now = performance.now()
    if (force || now - this.lastFlushTime > 1200) {
      this.texture.needsUpdate = true
      this.lastFlushTime = now
      this.dirty = false
    }
  }

  /**
   * Prepares the critical-tier artwork (first CRITICAL_TILES tracks) for a NEW chart.
   * Starts a new generation (stale loads from the previous chart are discarded), clears
   * the atlas, reports progress, and resolves when the critical set is drawn and flagged
   * for a single GPU upload.
   */
  public async prepareCriticalVibe(
    songs: SongNode[],
    onProgress: (ratio: number) => void
  ): Promise<void> {
    const { canvas, texture } = this.init()
    if (!canvas || !this.ctx) return

    this.generation++
    this.slots.clear()
    this.ctx.fillStyle = '#121218'
    this.ctx.fillRect(0, 0, canvas.width, canvas.height)
    this.dirty = true

    const totalCritical = Math.min(songs.length, CRITICAL_TILES)
    if (totalCritical === 0) {
      texture.needsUpdate = true
      this.dirty = false
      this.criticalReady = Promise.resolve()
      onProgress(1)
      return
    }

    let loadedCount = 0
    const promises: Promise<void>[] = []
    for (let i = 0; i < totalCritical; i++) {
      promises.push(
        this.loadSlot(i, songs[i], 3500).then(() => {
          loadedCount++
          onProgress(loadedCount / totalCritical)
        })
      )
    }
    const ready = Promise.all(promises).then(() => undefined)
    this.criticalReady = ready
    await ready

    // ONE GPU upload for the entire critical set
    this.flush(true)
    onProgress(1)
  }

  /**
   * Makes sure every slot for `songs` (up to TEXTURE_DEPTH) holds that song's artwork.
   * Idempotent and cheap to call repeatedly: already loaded/in-flight slots are skipped.
   * Waits for the current critical set first so background artwork never competes with it.
   * Used for background streaming after chart entry and for songs appended by search.
   */
  public async ensureSongs(songs: SongNode[]): Promise<void> {
    if (typeof document === 'undefined') return
    this.init()
    if (this.ensureRunning) { this.ensureQueued = songs; return }
    this.ensureRunning = true
    try {
      let current: SongNode[] | null = songs
      while (current) {
        this.ensureQueued = null
        await this.ensureOnce(current)
        current = this.ensureQueued
      }
    } finally {
      this.ensureRunning = false
    }
  }

  private async ensureOnce(songs: SongNode[]): Promise<void> {
    const gen = this.generation
    await this.criticalReady
    if (gen !== this.generation) return

    const max = Math.min(songs.length, TEXTURE_DEPTH)
    const todo: number[] = []
    for (let i = 0; i < max; i++) {
      const url = songs[i]?.albumArt ? getOptimizedArtworkUrl(songs[i].albumArt, 256) : ''
      const existing = this.slots.get(i)
      if (!existing || existing.url !== url) todo.push(i)
    }

    const BATCH_SIZE = 8
    for (let b = 0; b < todo.length; b += BATCH_SIZE) {
      if (gen !== this.generation) return
      await Promise.all(todo.slice(b, b + BATCH_SIZE).map((i) => this.loadSlot(i, songs[i])))
      this.flush(false)
      // Yield between batches to keep the frame loop smooth
      await new Promise((r) => setTimeout(r, 60))
    }
    if (gen === this.generation) this.flush(true)
  }

  /** Background streaming of the remaining artwork after the destination is visible. */
  public startBackgroundLoading(songs: SongNode[]): Promise<void> {
    return this.ensureSongs(songs)
  }

  private drawFallbackSlot(slot: number, colorHex: string) {
    if (!this.ctx) return
    const col = slot % ATLAS_COLS
    const row = Math.floor(slot / ATLAS_COLS)
    const x = col * TEXTURE_SIZE
    const y = row * TEXTURE_SIZE

    this.ctx.fillStyle = '#181824'
    this.ctx.fillRect(x, y, TEXTURE_SIZE, TEXTURE_SIZE)

    // Subtle accent line
    this.ctx.fillStyle = colorHex
    this.ctx.fillRect(x, y + TEXTURE_SIZE - 6, TEXTURE_SIZE, 6)
  }
}

export const atlasManager = new AtlasManager()
