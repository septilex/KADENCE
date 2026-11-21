import { getOptimizedArtworkUrl } from './artwork'

/**
 * Colours sampled from a song's album artwork, tuned to read on KADENCE's dark glass.
 *
 * The 100 px artwork variant is drawn into a 32×32 canvas once per cover; pixels are binned
 * by hue and weighted by vividness, so the palette follows the cover's dominant *colour*
 * rather than its (often black/grey) dominant pixels.
 */
export interface ArtworkPalette {
  /** Dominant vivid colour — the main fill. */
  primary: string
  /** Second colour (a distinct hue from the cover, or a neighbour of the primary). */
  secondary: string
  /** Light tint of the primary for highlights and the droplet core. */
  highlight: string
}

const SAMPLE = 32
const BINS = 18 // 20° hue bins

type Rgb = [number, number, number]

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const hueDistance = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

const NEUTRAL: ArtworkPalette = { primary: '#e9e9f2', secondary: '#9ea3b8', highlight: '#ffffff' }

/** Pure palette extraction from RGBA pixels (exported for tests). */
export function paletteFromPixels(data: ArrayLike<number>): ArtworkPalette {
  const weight = new Float64Array(BINS)
  const sums = Array.from({ length: BINS }, () => [0, 0, 0])
  let chromatic = 0, total = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
    const [h, s, l] = rgbToHsl(rgb)
    total++
    // Vivid, mid-lightness pixels count most; near-black/white/grey barely count.
    const w = Math.pow(s, 1.6) * (l < 0.1 || l > 0.94 ? 0.05 : 1 - Math.abs(l - 0.52) * 1.2)
    if (w <= 0.02) continue
    const bin = Math.floor(h / (360 / BINS)) % BINS
    weight[bin] += w
    sums[bin][0] += rgb[0] * w; sums[bin][1] += rgb[1] * w; sums[bin][2] += rgb[2] * w
    chromatic += w
  }
  if (!total || chromatic / total < 0.035) return NEUTRAL

  // Rank bins with their neighbours (circular), so a hue straddling a bin edge — notably red
  // across 0°/360° — is not split into two losers.
  const score = Array.from({ length: BINS }, (_, i) => weight[i] + 0.5 * (weight[(i + BINS - 1) % BINS] + weight[(i + 1) % BINS]))
  const order = Array.from({ length: BINS }, (_, i) => i).filter(i => weight[i] > 0).sort((a, b) => score[b] - score[a])
  const avg = (bin: number): [number, number, number] =>
    rgbToHsl([sums[bin][0] / weight[bin], sums[bin][1] / weight[bin], sums[bin][2] / weight[bin]])

  const [ph, ps] = avg(order[0])
  // Normalise for a dark translucent surface: vivid, mid-light.
  const primaryHsl: [number, number, number] = [ph, clamp(ps * 1.15, 0.55, 0.95), 0.6]

  // Second colour: the strongest remaining hue that is visibly different from the primary.
  const second = order.slice(1).sort((a, b) => weight[b] - weight[a])
    .find(b => weight[b] >= weight[order[0]] * 0.18 && hueDistance(avg(b)[0], ph) >= 15)
  const secondaryHsl: [number, number, number] = second !== undefined
    ? (() => { const [h, s] = avg(second); return [h, clamp(s * 1.1, 0.5, 0.92), 0.5] as [number, number, number] })()
    : [(ph + 24) % 360, clamp(primaryHsl[1] * 0.95, 0.5, 0.92), 0.44]

  return {
    primary: hslToHex(...primaryHsl),
    secondary: hslToHex(...secondaryHsl),
    highlight: hslToHex(ph, clamp(primaryHsl[1], 0.5, 0.9), 0.84),
  }
}

const cache = new Map<string, Promise<ArtworkPalette | null>>()

/** Palette for an artwork URL (cached). Resolves null if the image can't be read. */
export function getArtworkPalette(url: string): Promise<ArtworkPalette | null> {
  const src = getOptimizedArtworkUrl(url, 100)
  if (!src || typeof document === 'undefined') return Promise.resolve(null)
  const hit = cache.get(src)
  if (hit) return hit
  const promise = new Promise<ArtworkPalette | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE
        canvas.height = SAMPLE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
        resolve(paletteFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data))
      } catch {
        resolve(null) // cross-origin tainted or decode failure
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
  cache.set(src, promise)
  while (cache.size > 64) cache.delete(cache.keys().next().value!)
  return promise
}
