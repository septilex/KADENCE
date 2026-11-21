import * as THREE from 'three'
import { SongNode } from './types'
import { getOptimizedArtworkUrl } from './artwork'
import { computeGrid, buildTileSlots, slotPriority } from './gridCalc'
export { getOptimizedArtworkUrl } from './artwork'

export const TEXTURE_SIZE  = 256    // px per atlas layer
export const TEXTURE_DEPTH = 256    // max unique artworks in the atlas
export const CRITICAL_TILES = 64    // artworks nearest the screen centre that gate the reveal

/** How long the reveal waits for the critical artworks before showing the wall anyway. */
const CRITICAL_TIMEOUT_MS = 2500
/** Parallel artwork downloads (the CDN is HTTP/2, so these multiplex on one connection). */
const LOAD_CONCURRENCY = 16
/** A download that takes longer than this stops blocking the queue (it may still land later). */
const SLOT_STALL_MS = 10000
/** Minimum gap between GPU uploads while artwork streams in. */
const FLUSH_INTERVAL_MS = 100

type SlotEntry = { url: string; promise: Promise<void> }

/**
 * Single owner of the artwork atlas (the only code that loads artwork into it).
 *
 * - The atlas is a mipmapped 2D-array texture: one 256² layer per artwork. Mipmaps are what
 *   keep the covers stable on screen; without them a 256 px cover drawn at ~50 px sparkles
 *   every time the wall moves by a fraction of a pixel.
 * - Artwork loads centre-out: slots are ordered by how close to the middle of the wall they
 *   first appear, and a fixed-size pool keeps LOAD_CONCURRENCY downloads in flight.
 * - Each slot is loaded at most once per (generation, url). `generation` changes on every new
 *   chart, so late images from a previous chart are never drawn into the new chart's slots.
 * - `revealTexture` holds, per slot, the time its artwork reached the GPU (-1 = not loaded).
 *   The wall shader shows a placeholder for unloaded slots and fades each cover in.
 */
export class AtlasManager {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private texture: THREE.DataArrayTexture | null = null
  private reveal: THREE.DataTexture | null = null
  private revealTimes = new Float32Array(TEXTURE_DEPTH).fill(-1)
  private pendingReveal = new Set<number>()
  private slots = new Map<number, SlotEntry>()
  private generation = 0
  private dirty = false
  private lastFlushTime = 0
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private preparingCritical = false
  private streaming: Promise<void> = Promise.resolve()

  /** Clock shared with the wall shader (seconds). */
  public now(): number {
    return performance.now() / 1000
  }

  /**
   * Initializes or returns the singleton scratch canvas and textures.
   * Safe to call repeatedly.
   */
  public init(): { canvas: HTMLCanvasElement; texture: THREE.DataArrayTexture; reveal: THREE.DataTexture } {
    if (this.canvas && this.texture && this.reveal) {
      return { canvas: this.canvas, texture: this.texture, reveal: this.reveal }
    }

    if (typeof document === 'undefined') {
      throw new Error('Artwork atlas is only available in the browser')
    }

    const cvs = document.createElement('canvas')
    cvs.width = TEXTURE_SIZE
    cvs.height = TEXTURE_SIZE

    const ctx = cvs.getContext('2d', { alpha: false, willReadFrequently: true })!
    ctx.fillStyle = '#121218'
    ctx.fillRect(0, 0, cvs.width, cvs.height)

    const tex = new THREE.DataArrayTexture(new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * TEXTURE_DEPTH * 4), TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_DEPTH)
    tex.colorSpace = THREE.NoColorSpace
    // Trilinear filtering + mipmaps: covers are drawn 3–5× smaller than their source.
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    // The GPU zero-fills new storage, so the first upload only needs to touch one layer
    // (an empty update set would upload the whole 64 MiB array).
    tex.addLayerUpdate(0)
    tex.needsUpdate = true

    const reveal = new THREE.DataTexture(this.revealTimes, TEXTURE_DEPTH, 1, THREE.RedFormat, THREE.FloatType)
    reveal.minFilter = THREE.NearestFilter
    reveal.magFilter = THREE.NearestFilter
    reveal.generateMipmaps = false
    reveal.needsUpdate = true

    this.canvas = cvs
    this.ctx = ctx
    this.texture = tex
    this.reveal = reveal

    return { canvas: cvs, texture: tex, reveal }
  }

  public getTexture(): THREE.DataArrayTexture {
    return this.init().texture
  }

  public getRevealTexture(): THREE.DataTexture {
    return this.init().reveal
  }

  /** Anisotropic filtering keeps covers sharp on the tilted tiles around the pointer. */
  public setAnisotropy(level: number) {
    const { texture } = this.init()
    const next = Math.max(1, Math.floor(level))
    if (texture.anisotropy === next) return
    texture.anisotropy = next
    if (texture.layerUpdates.size === 0) texture.addLayerUpdate(0)
    texture.needsUpdate = true
  }

  /**
   * Slot order for the current viewport, centre of the wall first. Mirrors the layout the
   * wall renderer builds (same grid maths, same deterministic shuffle).
   */
  private loadOrder(slotCount: number): number[] {
    if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) {
      return Array.from({ length: slotCount }, (_, i) => i)
    }
    const dims = computeGrid(slotCount, window.innerWidth, window.innerHeight)
    return slotPriority(buildTileSlots(dims.virtualCount, slotCount, dims.COLS), dims.COLS, dims.ROWS, slotCount)
  }

  /**
   * Loads one atlas slot. Returns the in-flight promise if the same URL is already
   * loading/loaded for this generation (no duplicate requests). The promise resolves when
   * the slot has been drawn (artwork, or a permanent fallback if the image failed) or the
   * download stalled; it never rejects.
   */
  private loadSlot(index: number, song: SongNode): Promise<void> {
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
        this.markDirty()
        resolve()
        return
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      // A stalled download must not hold a place in the queue forever.
      const stall = setTimeout(resolve, SLOT_STALL_MS)
      const finish = (ok: boolean) => {
        clearTimeout(stall)
        if (isCurrent() && this.ctx) {
          if (ok) {
            try {
              this.ctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
              this.commitSlot(slot)
            } catch {
              this.drawFallbackSlot(slot, color)
            }
          } else {
            this.drawFallbackSlot(slot, color)
          }
          this.markDirty()
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

  /** Schedule a GPU upload for whatever has been drawn since the last one. */
  private markDirty() {
    this.dirty = true
    if (this.preparingCritical) return
    if (this.flushTimer !== null) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, Math.max(0, FLUSH_INTERVAL_MS - (performance.now() - this.lastFlushTime)))
  }

  /** Hand the drawn layers to the renderer. `instant` skips the per-tile fade-in. */
  private flush(instant = false) {
    if (!this.texture || !this.dirty) return
    this.dirty = false
    this.lastFlushTime = performance.now()
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
    // A renderer may already have consumed the layer updates. Marking an empty update
    // set would re-upload the entire texture array.
    if (this.texture.layerUpdates.size > 0) this.texture.needsUpdate = true
    if (this.pendingReveal.size > 0) {
      // 0 = "revealed long ago" (no fade); otherwise the fade starts now.
      const t = instant ? 0 : this.now()
      for (const slot of this.pendingReveal) this.revealTimes[slot] = t
      this.pendingReveal.clear()
      if (this.reveal) this.reveal.needsUpdate = true
    }
  }

  /**
   * Starts a NEW chart: new generation (stale loads from the previous chart are discarded),
   * cleared atlas, and every artwork queued centre-out. Resolves when the CRITICAL_TILES
   * artworks nearest the screen centre are ready, or after CRITICAL_TIMEOUT_MS, whichever
   * comes first. The remaining artwork keeps streaming in afterwards.
   */
  public async prepareCriticalVibe(
    songs: SongNode[],
    onProgress: (ratio: number) => void
  ): Promise<void> {
    const { canvas, texture } = this.init()
    if (!canvas || !this.ctx) return

    this.generation++
    this.preparingCritical = true
    const gen = this.generation

    // Clear only layers used by the previous chart; other layers remain GPU-zeroed.
    const data = texture.image.data as Uint8Array
    for (const slot of this.slots.keys()) {
      const offset = slot * TEXTURE_SIZE * TEXTURE_SIZE * 4
      data.fill(0, offset, offset + TEXTURE_SIZE * TEXTURE_SIZE * 4)
      texture.addLayerUpdate(slot)
    }
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.slots.clear()
    this.pendingReveal.clear()
    this.revealTimes.fill(-1)
    if (this.reveal) this.reveal.needsUpdate = true
    this.dirty = true

    const slotCount = Math.min(songs.length, TEXTURE_DEPTH)
    if (slotCount === 0) {
      this.preparingCritical = false
      this.flush(true)
      onProgress(1)
      return
    }

    const order = this.loadOrder(slotCount)
    const totalCritical = Math.min(slotCount, CRITICAL_TILES)
    let loadedCount = 0
    let criticalDone: () => void = () => {}
    const critical = new Promise<void>((resolve) => { criticalDone = resolve })
    const timeout = setTimeout(criticalDone, CRITICAL_TIMEOUT_MS)

    this.streaming = this.runQueue(order, songs, gen, (position) => {
      // A newer chart took over: release whoever is awaiting this one.
      if (gen !== this.generation) { criticalDone(); return }
      // Once the deadline reveals the wall, late artwork is background work.
      // It must not put Home back into loading or re-render it for each cover.
      if (!this.preparingCritical) return
      if (position >= totalCritical) return
      loadedCount++
      onProgress(loadedCount / totalCritical)
      if (loadedCount === totalCritical) criticalDone()
    })

    await critical
    clearTimeout(timeout)
    if (gen !== this.generation) return
    this.preparingCritical = false

    // ONE GPU upload for everything that arrived while the wall was hidden; these covers are
    // simply there when the wall appears. Later arrivals fade in.
    this.flush(true)
    onProgress(1)
  }

  /**
   * Fixed-size download pool over `order` (slot indices, highest priority first).
   * `onSettled(position)` reports the queue position of every slot that finishes.
   */
  private async runQueue(
    order: number[],
    songs: SongNode[],
    gen: number,
    onSettled?: (position: number) => void
  ): Promise<void> {
    let next = 0
    const worker = async () => {
      while (next < order.length && gen === this.generation) {
        const position = next++
        const slot = order[position]
        if (songs[slot]) await this.loadSlot(slot, songs[slot])
        onSettled?.(position)
      }
    }
    await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, order.length) }, worker))
  }

  /**
   * Makes sure every slot for `songs` (up to TEXTURE_DEPTH) holds that song's artwork.
   * Idempotent and cheap to call repeatedly: slots already loaded or in flight are skipped.
   * Used after chart entry and for songs appended by search.
   */
  public async ensureSongs(songs: SongNode[]): Promise<void> {
    if (typeof document === 'undefined') return
    this.init()
    const gen = this.generation
    // Entry, NodeField and background loading all call this. Slot dedup alone
    // doesn't bound concurrency: separate queues used to start 16 new slots each.
    const task = this.streaming.then(async () => {
      if (gen !== this.generation) return
      const slotCount = Math.min(songs.length, TEXTURE_DEPTH)
      const todo = this.loadOrder(slotCount).filter((slot) => {
        const url = songs[slot]?.albumArt ? getOptimizedArtworkUrl(songs[slot].albumArt, 256) : ''
        const existing = this.slots.get(slot)
        return !existing || existing.url !== url
      })
      if (todo.length > 0) await this.runQueue(todo, songs, gen)
    })
    this.streaming = task
    await task
  }

  /** Background streaming of the remaining artwork after the destination is visible. */
  public startBackgroundLoading(songs: SongNode[]): Promise<void> {
    return this.ensureSongs(songs)
  }

  private commitSlot(slot: number) {
    if (!this.ctx || !this.texture) return
    const pixels = this.ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data
    ;(this.texture.image.data as Uint8Array).set(pixels, slot * TEXTURE_SIZE * TEXTURE_SIZE * 4)
    // Only these layers are uploaded (texSubImage3D, 256 KiB each).
    this.texture.addLayerUpdate(slot)
    this.pendingReveal.add(slot)
  }

  /** Permanent stand-in for a song with no artwork (or whose artwork failed to load). */
  private drawFallbackSlot(slot: number, colorHex: string) {
    if (!this.ctx) return
    this.ctx.fillStyle = '#181824'
    this.ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

    // Subtle accent line
    this.ctx.fillStyle = colorHex
    this.ctx.fillRect(0, TEXTURE_SIZE - 6, TEXTURE_SIZE, 6)
    this.commitSlot(slot)
  }
}

export const atlasManager = new AtlasManager()
