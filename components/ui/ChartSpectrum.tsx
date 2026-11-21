'use client'
import { memo, useEffect, useRef } from 'react'

/**
 * Circular NCS-style spectrum for the chart-loading overlay (Canvas 2D, no WebGL).
 *
 * - 128 mirrored bars around a ring: lows at the top, highs falling away down both sides.
 * - The "music" is a deterministic 120 BPM pattern (kick on the lows, off-beat hats on the
 *   highs, slow wandering mids) with fast-attack / slow-release smoothing, so the bars move
 *   like a real analyser without touching the audio graph.
 * - Two interleaved waveform rings breathe inside the circle on the kick.
 * - All bars are one path, stroked twice (core + additive glow): ~5 draw calls per frame.
 *
 * The requestAnimationFrame loop exists only while this component is mounted (the overlay is
 * unmounted when idle). With reduced motion a single still frame is drawn.
 */

const BINS = 64 // per side
const BPM = 120

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`
/** Mix toward white so very dark accents still read on the scrim. */
const lift = ([r, g, b]: [number, number, number], k: number): [number, number, number] =>
  [Math.round(r + (255 - r) * k), Math.round(g + (255 - g) * k), Math.round(b + (255 - b) * k)]

export const ChartSpectrum = memo(function ChartSpectrum({ color, deep, still }: { color: string; deep: string; still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const primary = rgb(color)
    const base = rgb(deep)
    const tip = lift(primary, 0.55)
    const levels = new Float32Array(BINS)
    let size = 0
    let dpr = 1
    let frame = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      size = Math.max(1, Math.round(rect.width))
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
    }

    const target = (i: number, t: number) => {
      const f = i / (BINS - 1)
      const beat = (t * BPM) / 60
      const kick = Math.exp(-(beat % 1) * 5.5)
      const hat = Math.exp(-((beat + 0.5) % 1) * 9)
      const lows = kick * Math.pow(1 - f, 2.2) * 0.85
      const mids = 0.3
        + 0.17 * Math.sin(t * 2.3 + i * 0.47)
        + 0.12 * Math.sin(t * 4.1 - i * 0.29)
        + 0.08 * Math.sin(t * 0.9 + i * 1.31)
      const highs = hat * Math.pow(f, 1.6) * 0.42
      const v = (lows + mids * (1 - f * 0.55) + highs) * (0.82 + 0.18 * kick)
      return Math.min(1, Math.max(0.04, v))
    }

    const draw = (t: number) => {
      const w = size
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, w)
      const c = w / 2
      const r0 = w * 0.24
      const reach = w * 0.2
      const kick = Math.exp(-(((t * BPM) / 60) % 1) * 5.5)

      for (let i = 0; i < BINS; i++) {
        const goal = target(i, t)
        levels[i] += (goal - levels[i]) * (goal > levels[i] ? 0.5 : 0.11)
      }

      // Bars: one path for all 128, mirrored left/right, lows at the top.
      const gap = w * 0.018
      ctx.beginPath()
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < BINS; i++) {
          const a = -Math.PI / 2 + side * ((i + 0.5) / BINS) * Math.PI
          const cos = Math.cos(a), sin = Math.sin(a)
          const inner = r0 + gap
          const outer = inner + 2 + levels[i] * reach
          ctx.moveTo(c + cos * inner, c + sin * inner)
          ctx.lineTo(c + cos * outer, c + sin * outer)
        }
      }
      const grad = ctx.createRadialGradient(c, c, r0, c, c, r0 + gap + reach)
      grad.addColorStop(0, rgba(lift(base, 0.15), 0.95))
      grad.addColorStop(0.45, rgba(primary, 1))
      grad.addColorStop(1, rgba(tip, 1))
      ctx.lineCap = 'round'
      ctx.strokeStyle = grad
      ctx.lineWidth = ((Math.PI * 2 * r0) / (BINS * 2)) * 0.5
      ctx.globalAlpha = 1
      ctx.stroke()
      // Glow: the same path, wider and additive (no shadowBlur).
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.16 + kick * 0.08
      ctx.lineWidth *= 2.8
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      // Inner disc.
      const disc = ctx.createRadialGradient(c, c, 0, c, c, r0)
      disc.addColorStop(0, 'rgba(6,6,12,0.86)')
      disc.addColorStop(0.82, 'rgba(8,8,16,0.78)')
      disc.addColorStop(1, rgba(base, 0.5))
      ctx.beginPath()
      ctx.arc(c, c, r0, 0, Math.PI * 2)
      ctx.fillStyle = disc
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = rgba(primary, 0.9)
      ctx.stroke()

      // Waveform rings breathing inside the disc.
      for (let ring = 0; ring < 2; ring++) {
        const rr = r0 * (ring ? 0.7 : 0.82)
        const amp = r0 * (0.035 + kick * 0.05) * (ring ? 0.7 : 1)
        ctx.beginPath()
        for (let p = 0; p <= 96; p++) {
          const a = (p / 96) * Math.PI * 2
          const r = rr
            + amp * Math.sin(a * 6 + t * (ring ? -1.7 : 1.3))
            + amp * 0.6 * Math.sin(a * 11 - t * 2.4 + ring)
          const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r
          if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y)
        }
        ctx.closePath()
        ctx.lineWidth = ring ? 1 : 1.4
        ctx.strokeStyle = ring ? 'rgba(255,255,255,0.32)' : rgba(tip, 0.85)
        ctx.stroke()
      }

      // Orbit with a travelling light.
      const orbit = r0 + gap + reach + w * 0.035
      ctx.beginPath()
      ctx.arc(c, c, orbit, 0, Math.PI * 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = rgba(primary, 0.2)
      ctx.stroke()
      const oa = t * 0.7
      ctx.beginPath()
      ctx.arc(c, c, orbit, oa - 0.5, oa)
      ctx.lineWidth = 1.6
      ctx.strokeStyle = rgba(tip, 0.75)
      ctx.stroke()
    }

    resize()
    const onResize = () => { resize(); if (still) draw(1.2) }
    window.addEventListener('resize', onResize)

    if (still) {
      for (let i = 0; i < BINS; i++) levels[i] = target(i, 1.2)
      draw(1.2)
    } else {
      const start = performance.now()
      const loop = (now: number) => {
        draw((now - start) / 1000)
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [color, deep, still])

  return <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }} />
})
