import * as THREE from 'three'
import { SongNode } from './types'

export const TEXTURE_SIZE  = 256    // px per atlas slot
export const TEXTURE_DEPTH = 256    // max unique artworks in the atlas
export const ATLAS_COLS    = 16     // 16x16 = 256 slots (4096x4096px canvas)
export const CRITICAL_TILES = 64    // number of tiles needed for the initial center camera view

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

class AtlasManager {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private texture: THREE.CanvasTexture | null = null
  private loadedSlots = new Set<number>()
  private abortController: AbortController | null = null
  private lastFlushTime = 0

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
   * Prepares the critical-tier artwork (first 48-64 tracks) directly into the
   * texture atlas. Reports real-time loading progress and resolves ONLY when
   * all critical images are downloaded, decoded, drawn into the atlas, and
   * flagged for GPU upload.
   */
  public async prepareCriticalVibe(
    songs: SongNode[],
    onProgress: (ratio: number) => void
  ): Promise<void> {
    const { canvas, texture } = this.init()
    if (!canvas || !this.ctx) return

    // Cancel any ongoing background streaming
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()
    const { signal } = this.abortController

    // Reset loaded tracker and clear canvas with clean background
    this.loadedSlots.clear()
    this.ctx.fillStyle = '#121218'
    this.ctx.fillRect(0, 0, canvas.width, canvas.height)

    const totalCritical = Math.min(songs.length, CRITICAL_TILES)
    if (totalCritical === 0) {
      texture.needsUpdate = true
      onProgress(1)
      return
    }

    let loadedCount = 0

    // Load an individual slot directly into the canvas
    const loadSlotImage = (index: number, song: SongNode): Promise<void> => {
      return new Promise((resolve) => {
        if (!song.albumArt || signal.aborted) {
          loadedCount++
          onProgress(loadedCount / totalCritical)
          resolve()
          return
        }

        const img = new Image()
        img.crossOrigin = 'anonymous'
        const directUrl = getOptimizedArtworkUrl(song.albumArt, 256)

        // Safety timeout to guarantee the transition never hangs if an image stalls
        const timer = setTimeout(() => {
          if (!this.loadedSlots.has(index)) {
            this.drawFallbackSlot(index, song.color || '#333')
            this.loadedSlots.add(index)
            loadedCount++
            onProgress(loadedCount / totalCritical)
          }
          resolve()
        }, 3500)

        const onFinish = (success: boolean) => {
          clearTimeout(timer)
          if (signal.aborted) {
            resolve()
            return
          }

          if (success && this.ctx) {
            const slot = index % TEXTURE_DEPTH
            const col = slot % ATLAS_COLS
            const row = Math.floor(slot / ATLAS_COLS)
            try {
              this.ctx.drawImage(
                img,
                col * TEXTURE_SIZE,
                row * TEXTURE_SIZE,
                TEXTURE_SIZE,
                TEXTURE_SIZE
              )
              this.loadedSlots.add(slot)
            } catch {
              this.drawFallbackSlot(slot, song.color || '#333')
              this.loadedSlots.add(slot)
            }
          } else {
            this.drawFallbackSlot(index, song.color || '#333')
            this.loadedSlots.add(index)
          }

          loadedCount++
          onProgress(loadedCount / totalCritical)
          resolve()
        }

        img.onload = () => onFinish(true)
        img.onerror = () => onFinish(false)
        img.src = directUrl
      })
    }

    // Process critical images in parallel (browser HTTP/2 handles multiplexing cleanly)
    const promises: Promise<void>[] = []
    for (let i = 0; i < totalCritical; i++) {
      promises.push(loadSlotImage(i, songs[i]))
    }

    await Promise.all(promises)

    // Mark the texture for GPU upload ONCE for the entire critical set
    texture.needsUpdate = true
    this.lastFlushTime = performance.now()
    onProgress(1)
  }

  /**
   * Progressively streams the remaining secondary artwork (indices 64 to 255)
   * in the background after the destination screen is already active and usable.
   * Flushes texture updates at throttled intervals so the 60fps framerate is never interrupted.
   */
  public async startBackgroundLoading(songs: SongNode[]): Promise<void> {
    if (!this.canvas || !this.ctx || !this.texture) return
    const signal = this.abortController?.signal

    const maxSongs = Math.min(songs.length, TEXTURE_DEPTH)
    const remainingIndices: number[] = []

    for (let i = CRITICAL_TILES; i < maxSongs; i++) {
      if (!this.loadedSlots.has(i)) {
        remainingIndices.push(i)
      }
    }

    if (remainingIndices.length === 0) return

    const BATCH_SIZE = 8
    let dirty = false

    for (let b = 0; b < remainingIndices.length; b += BATCH_SIZE) {
      if (signal?.aborted) return

      const batch = remainingIndices.slice(b, b + BATCH_SIZE)
      await Promise.all(
        batch.map((index) => {
          return new Promise<void>((resolve) => {
            const song = songs[index]
            if (!song?.albumArt || signal?.aborted) {
              resolve()
              return
            }

            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.src = getOptimizedArtworkUrl(song.albumArt, 256)

            img.onload = () => {
              if (signal?.aborted || !this.ctx) {
                resolve()
                return
              }
              const slot = index % TEXTURE_DEPTH
              const col = slot % ATLAS_COLS
              const row = Math.floor(slot / ATLAS_COLS)
              try {
                this.ctx.drawImage(
                  img,
                  col * TEXTURE_SIZE,
                  row * TEXTURE_SIZE,
                  TEXTURE_SIZE,
                  TEXTURE_SIZE
                )
                this.loadedSlots.add(slot)
                dirty = true
              } catch {
                // Ignore background draw error
              }
              resolve()
            }

            img.onerror = () => resolve()
          })
        })
      )

      // Throttle GPU texture flushes to at most once every 1,200ms
      const now = performance.now()
      if (dirty && (now - this.lastFlushTime > 1200 || b + BATCH_SIZE >= remainingIndices.length)) {
        this.texture.needsUpdate = true
        this.lastFlushTime = now
        dirty = false
      }

      // Yield main thread between batches to keep animations buttery smooth
      await new Promise((r) => setTimeout(r, 60))
    }

    if (dirty && !signal?.aborted) {
      this.texture.needsUpdate = true
      this.lastFlushTime = performance.now()
    }
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
