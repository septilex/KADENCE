/**
 * Some of the intro MP4s have black bars burned into the picture itself (cinema-ratio footage
 * placed inside a 16:9 frame), so `object-fit: cover` still leaves bars at the top and bottom.
 * This measures where the real picture is and returns how far to scale the <video> so the
 * picture, not the file, covers the screen. It runs once per video, on a small canvas.
 */

/** A row/column counts as bar when nothing in it gets brighter than this (0–255 luma). */
const BAR_LUMA = 22
/** Frames sampled per video; bars are judged over all of them so a dark scene is not mistaken for a bar. */
const SAMPLES = 3
const SAMPLE_GAP_MS = 140
const CANVAS_W = 256

export interface PictureBox {
  /** Fraction of the frame height / width that holds picture (1 = no bars). */
  h: number
  w: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Measures the picture area of a playing video. Resolves to null if it cannot be read. */
export async function measurePicture(video: HTMLVideoElement, isCancelled: () => boolean): Promise<PictureBox | null> {
  const vw = video.videoWidth, vh = video.videoHeight
  if (!vw || !vh || typeof document === 'undefined') return null
  const w = CANVAS_W
  const h = Math.max(2, Math.round((CANVAS_W * vh) / vw))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const rowMax = new Uint8Array(h)
  const colMax = new Uint8Array(w)
  try {
    for (let i = 0; i < SAMPLES; i++) {
      if (i > 0) await sleep(SAMPLE_GAP_MS)
      if (isCancelled() || video.paused || video.readyState < 2) return null
      ctx.drawImage(video, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = (y * w + x) * 4
          const luma = (data[p] * 54 + data[p + 1] * 183 + data[p + 2] * 19) >> 8
          if (luma > rowMax[y]) rowMax[y] = luma
          if (luma > colMax[x]) colMax[x] = luma
        }
      }
    }
  } catch {
    return null // canvas unreadable (e.g. cross-origin media): leave the video as it is
  }

  const extent = (max: Uint8Array) => {
    let first = 0, last = max.length - 1
    while (first < last && max[first] <= BAR_LUMA) first++
    while (last > first && max[last] <= BAR_LUMA) last--
    // Bars are symmetric in practice; use the larger one so neither edge shows.
    const bar = Math.max(first, max.length - 1 - last)
    return Math.max(0.2, (max.length - 2 * bar) / max.length)
  }
  return { h: extent(rowMax), w: extent(colMax) }
}

/**
 * Scale (>= 1) that makes the picture cover a viewport when the element uses `object-fit: cover`
 * and is centred. `cover` already crops the frame to the viewport shape, so a frame with bars
 * only needs extra scale where the picture is smaller than what `cover` leaves visible.
 */
export function coverScale(picture: PictureBox, videoW: number, videoH: number, viewW: number, viewH: number): number {
  if (!videoW || !videoH || !viewW || !viewH) return 1
  const frameAspect = videoW / videoH
  const viewAspect = viewW / viewH
  const visibleH = viewAspect > frameAspect ? frameAspect / viewAspect : 1
  const visibleW = viewAspect > frameAspect ? 1 : viewAspect / frameAspect
  const scale = Math.max(visibleH / picture.h, visibleW / picture.w, 1)
  // Below ~3% there is no visible bar; skip. A hair extra hides the anti-aliased edge.
  return scale < 1.03 ? 1 : Math.min(scale * 1.01, 3)
}
