'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { SongNode } from '@/lib/types'

interface WallGridProps {
  songs: SongNode[]
  hoveredSong: SongNode | null
  selectedSong: SongNode | null
  onHover: (song: SongNode | null) => void
  onSelect: (song: SongNode) => void
  isDetailOpen?: boolean
  isRefreshing?: boolean
}

// ── Grid config ──────────────────────────────────────────────────────────────
// Tile size in px. 180px gives ~11 cols on 1920px wide.
// We overfill by 1 tile on each side so edges are always covered.
const TILE_PX = 180

// Warp effect constants (all GPU-composited via CSS transform)
const WARP_RADIUS = 280          // px — influence radius around cursor
const WARP_STRENGTH = 22         // px — max displacement magnitude
const WARP_LERP = 0.12           // spring speed (0–1 per frame)

export function WallGrid({
  songs,
  hoveredSong,
  selectedSong,
  onHover,
  onSelect,
  isRefreshing = false,
}: WallGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<(HTMLDivElement | null)[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const smoothRef = useRef({ x: -9999, y: -9999 })
  const dispRef = useRef<{ x: number; y: number }[]>([])
  const rafRef = useRef<number>(0)
  const gridRef = useRef({ cols: 0, rows: 0, count: 0 })
  const [dims, setDims] = useState({ cols: 0, rows: 0, count: 0 })

  // ── Compute grid dimensions to overfill viewport ─────────────────────────
  const computeDims = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Add 2 extra cols + rows to guarantee coverage at all times
    const cols = Math.ceil(vw / TILE_PX) + 2
    const rows = Math.ceil(vh / TILE_PX) + 2
    const count = cols * rows
    gridRef.current = { cols, rows, count }
    setDims({ cols, rows, count })
  }, [])

  useEffect(() => {
    computeDims()
    const ro = new ResizeObserver(computeDims)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [computeDims])

  // ── Initialize displacement buffer ───────────────────────────────────────
  useEffect(() => {
    dispRef.current = Array.from({ length: dims.count }, () => ({ x: 0, y: 0 }))
    tileRefs.current = new Array(dims.count).fill(null)
  }, [dims.count])

  // ── Mouse tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ── RAF warp loop ─────────────────────────────────────────────────────────
  // Pure GPU path: only CSS transform is touched, no layout properties.
  useEffect(() => {
    if (dims.count === 0) return

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      // Smooth mouse position with spring
      const sm = smoothRef.current
      const rm = mouseRef.current
      sm.x += (rm.x - sm.x) * WARP_LERP
      sm.y += (rm.y - sm.y) * WARP_LERP

      const { cols } = gridRef.current
      const count = tileRefs.current.length

      for (let i = 0; i < count; i++) {
        const el = tileRefs.current[i]
        if (!el) continue

        const col = i % cols
        const row = Math.floor(i / cols)

        // Tile center in screen space (offset grid is centered via CSS margin)
        const cx = col * TILE_PX - TILE_PX / 2
        const cy = row * TILE_PX - TILE_PX / 2

        const dx = cx - sm.x
        const dy = cy - sm.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        let tgtX = 0
        let tgtY = 0

        if (dist < WARP_RADIUS && dist > 0) {
          // Smooth falloff: 1 at centre → 0 at WARP_RADIUS
          const t = 1 - dist / WARP_RADIUS
          const strength = t * t * WARP_STRENGTH
          // Push tiles away from cursor (repulsion)
          tgtX = (dx / dist) * -strength
          tgtY = (dy / dist) * -strength
        }

        // Spring-lerp toward target
        const cur = dispRef.current[i] ?? { x: 0, y: 0 }
        cur.x += (tgtX - cur.x) * 0.14
        cur.y += (tgtY - cur.y) * 0.14

        // Only apply if meaningful (skip GPU upload for resting tiles)
        if (Math.abs(cur.x) > 0.05 || Math.abs(cur.y) > 0.05) {
          el.style.transform = `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px)`
        } else if (cur.x !== 0 || cur.y !== 0) {
          el.style.transform = 'none'
          cur.x = 0
          cur.y = 0
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dims.count])

  if (songs.length === 0 || dims.count === 0) {
    return <div className="absolute inset-0 bg-[#050508]" />
  }

  const { cols, rows, count } = dims

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#050508' }}
    >
      {/* Grid container — offset by half a tile so edges are always covered */}
      <div
        style={{
          position: 'absolute',
          // Offset left/top by one full tile so the grid bleeds off-screen on all edges
          left: `-${TILE_PX}px`,
          top: `-${TILE_PX}px`,
          width: `${cols * TILE_PX}px`,
          height: `${rows * TILE_PX}px`,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${TILE_PX}px)`,
          gridTemplateRows: `repeat(${rows}, ${TILE_PX}px)`,
          gap: '0px',
          willChange: 'transform',
        }}
      >
        {Array.from({ length: count }, (_, i) => {
          const song = songs[i % songs.length]
          const isHovered  = hoveredSong?.id === song.id
          const isSelected = selectedSong?.id === song.id

          return (
            <div
              key={`tile-${i}`}
              ref={el => { tileRefs.current[i] = el }}
              style={{
                width: TILE_PX,
                height: TILE_PX,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                willChange: 'transform',
                // Scale up on hover/select via CSS (GPU composited)
                transition: 'filter 0.2s ease, z-index 0s',
                zIndex: isSelected ? 3 : isHovered ? 2 : 1,
                filter: isSelected
                  ? 'brightness(1.4) saturate(1.3)'
                  : isHovered
                  ? 'brightness(1.15)'
                  : 'brightness(0.82)',
              }}
              onMouseEnter={() => onHover(song)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(song)}
            >
              <img
                src={song.albumArt || `https://picsum.photos/seed/k${i}/200/200`}
                alt={song.name}
                loading="eager"
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  // Crossfade when refreshing
                  opacity: isRefreshing ? 0.4 : 1,
                  transition: 'opacity 0.5s ease',
                  // Prevent img drag
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
              {/* Selected highlight ring */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px solid rgba(29,185,84,0.9)',
                    boxShadow: 'inset 0 0 20px rgba(29,185,84,0.3)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Edge vignette — cinematic dark frame that hides the bleed edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 30%, rgba(5,5,8,0.55) 100%),
            linear-gradient(to bottom, rgba(5,5,8,0.6) 0%, transparent 8%, transparent 92%, rgba(5,5,8,0.6) 100%),
            linear-gradient(to right, rgba(5,5,8,0.5) 0%, transparent 6%, transparent 94%, rgba(5,5,8,0.5) 100%)
          `,
          zIndex: 5,
        }}
      />
    </div>
  )
}
