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

// ── Centralized Physics Settings ──────────────────────────────────────────
const PHYSICS = {
  // Global Surface Physics (The Giant Lake)
  mass: 1.0,                 // Inertia of the entire surface
  stiffness: 0.0015,         // Very soft spring returning the surface to perfectly flat/centered (0,0)
  damping: 0.035,            // Dissipates energy slowly over time
  velocityInfluence: 0.045,  // How much energy the cursor movement injects into the water
  maxDisplacement: 120,      // Max physical pan
  maxTilt: 12,               // Subtle 3D tilt caused by movement
  
  // Local Wave Propagation (The Ripples)
  waveStiffness: 0.015,
  waveDamping: 0.04,
  waveRadius: 700,           // Very wide spatial propagation
  waveDrag: 0.08,            // Local dragging by cursor
  zDepth: 0.25,              // Downward pressure
}

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
  // Pure physics state, no smooth positions needed
  const mouseRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0, active: false })
  const globalPhysicsRef = useRef({
    x: 0, y: 0, vx: 0, vy: 0, // Pan
    rx: 0, ry: 0, vrx: 0, vry: 0, // Tilt
    lastTime: typeof performance !== 'undefined' ? performance.now() : 0
  })
  const dispRef = useRef<{ x: number; y: number; z: number; scale: number; vx: number; vy: number; vz: number; vScale: number }[]>([])
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
    dispRef.current = Array.from({ length: dims.count }, () => ({
      x: 0, y: 0, z: 0, scale: 1,
      vx: 0, vy: 0, vz: 0, vScale: 0
    }))
    tileRefs.current = new Array(dims.count).fill(null)
  }, [dims.count])

  // ── Mouse tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const isFirst = !mouseRef.current.active
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
      if (isFirst) {
        mouseRef.current.lastX = e.clientX
        mouseRef.current.lastY = e.clientY
      }
      mouseRef.current.active = true
    }
    const onLeave = () => {
      mouseRef.current.active = false
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ── RAF warp loop ─────────────────────────────────────────────────────────
  // Physics-based fluid interaction
  useEffect(() => {
    if (dims.count === 0) return

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      const now = performance.now()
      const delta = now - globalPhysicsRef.current.lastTime
      globalPhysicsRef.current.lastTime = now
      // Cap dt to prevent physics explosions after tab switching/lag
      const dt = Math.min(Math.max(delta / 16.666, 0.1), 3)

      const gp = globalPhysicsRef.current
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Calculate mouse velocity for drag and wake effect
      if (mouseRef.current.active) {
        const mDx = mouseRef.current.x - mouseRef.current.lastX
        const mDy = mouseRef.current.y - mouseRef.current.lastY
        const rawVx = mDx / dt
        const rawVy = mDy / dt
        
        // Smooth the velocity slightly to avoid jitter
        mouseRef.current.vx += (rawVx - mouseRef.current.vx) * 0.2
        mouseRef.current.vy += (rawVy - mouseRef.current.vy) * 0.2
        
        // Cap max velocity to prevent chaotic spikes
        mouseRef.current.vx = Math.max(-60, Math.min(60, mouseRef.current.vx))
        mouseRef.current.vy = Math.max(-60, Math.min(60, mouseRef.current.vy))
        
        mouseRef.current.lastX = mouseRef.current.x
        mouseRef.current.lastY = mouseRef.current.y
      } else {
        mouseRef.current.vx *= 0.9
        mouseRef.current.vy *= 0.9
      }

      const mSpeed = Math.sqrt(mouseRef.current.vx**2 + mouseRef.current.vy**2)

      // ── 1. Global Surface Physics (The Giant Lake) ──
      
      // Cursor velocity injects ENERGY (force) into the system
      let extForceX = mouseRef.current.active ? (mouseRef.current.vx * PHYSICS.velocityInfluence) : 0
      let extForceY = mouseRef.current.active ? (mouseRef.current.vy * PHYSICS.velocityInfluence) : 0

      // The surface always wants to return to a calm, flat state (0,0)
      const springForceX = -PHYSICS.stiffness * gp.x
      const springForceY = -PHYSICS.stiffness * gp.y

      // F = ma -> a = F/m
      const accX = (extForceX + springForceX) / PHYSICS.mass
      const accY = (extForceY + springForceY) / PHYSICS.mass

      // Integrate acceleration to velocity
      gp.vx += accX * dt
      gp.vy += accY * dt

      // Apply viscous damping (fluid resistance)
      const dampingFactor = Math.pow(1 - PHYSICS.damping, dt)
      gp.vx *= dampingFactor
      gp.vy *= dampingFactor

      // Integrate velocity to position
      gp.x += gp.vx * dt
      gp.y += gp.vy * dt

      // Soft clamp max displacement
      const distFromCenter = Math.sqrt(gp.x**2 + gp.y**2)
      if (distFromCenter > PHYSICS.maxDisplacement) {
        const ratio = PHYSICS.maxDisplacement / distFromCenter
        gp.x *= ratio
        gp.y *= ratio
        // Absorb energy
        gp.vx *= 0.8
        gp.vy *= 0.8
      }

      // Tilt is a natural consequence of the surface's VELOCITY, not position
      const targetTiltX = -(gp.vy * 0.4) // Moving down (positive Y) tilts the top backwards (negative X)
      const targetTiltY = (gp.vx * 0.4)  // Moving right (positive X) tilts the right side backwards (positive Y)

      // Soft spring for tilt
      gp.rx += (targetTiltX - gp.rx) * 0.05 * dt
      gp.ry += (targetTiltY - gp.ry) * 0.05 * dt
      
      gp.rx = Math.max(-PHYSICS.maxTilt, Math.min(PHYSICS.maxTilt, gp.rx))
      gp.ry = Math.max(-PHYSICS.maxTilt, Math.min(PHYSICS.maxTilt, gp.ry))

      // Apply to container
      if (containerRef.current) {
        const gridEl = containerRef.current.firstElementChild as HTMLElement
        if (gridEl) {
          // Hardware accelerated 3D transform for the whole grid
          gridEl.style.transform = `translate3d(${gp.x.toFixed(2)}px, ${gp.y.toFixed(2)}px, 0) rotateX(${gp.rx.toFixed(2)}deg) rotateY(${gp.ry.toFixed(2)}deg)`
        }
      }

      // ── 2. Local Wave Propagation (The Ripples) ──
      const { cols } = gridRef.current
      const count = tileRefs.current.length

      // Use actual mouse position to calculate physical distance to tiles
      const mX = mouseRef.current.active ? mouseRef.current.x - gp.x : -9999
      const mY = mouseRef.current.active ? mouseRef.current.y - gp.y : -9999

      const waveDampingFactor = Math.pow(1 - PHYSICS.waveDamping, dt)
      const time = now * 0.001

      for (let i = 0; i < count; i++) {
        const el = tileRefs.current[i]
        if (!el) continue

        const col = i % cols
        const row = Math.floor(i / cols)

        const cx = col * TILE_PX - TILE_PX / 2
        const cy = row * TILE_PX - TILE_PX / 2

        const dx = cx - mX
        const dy = cy - mY
        const dist = Math.sqrt(dx * dx + dy * dy)

        const cur = dispRef.current[i]
        
        let forceX = 0
        let forceY = 0
        let forceZ = 0

        // Local spring: tiles always want to be perfectly flat (0,0,0)
        forceX += PHYSICS.waveStiffness * (0 - cur.x)
        forceY += PHYSICS.waveStiffness * (0 - cur.y)
        forceZ += PHYSICS.waveStiffness * (0 - cur.z)

        // Mouse injects force into nearby tiles, which travels outward
        if (mouseRef.current.active && dist < PHYSICS.waveRadius && dist > 0) {
          const t = 1 - dist / PHYSICS.waveRadius
          const strength = t * t * (3 - 2 * t) // Smooth cubic falloff
          
          // Cursor drags the local surface along with its velocity
          forceX += mouseRef.current.vx * PHYSICS.waveDrag * strength
          forceY += mouseRef.current.vy * PHYSICS.waveDrag * strength

          // Plunge depth based on cursor speed
          forceZ += (mSpeed * PHYSICS.zDepth * -strength)
        }

        // Integrate
        cur.vx += forceX * dt
        cur.vy += forceY * dt
        cur.vz += forceZ * dt

        // Dampen
        cur.vx *= waveDampingFactor
        cur.vy *= waveDampingFactor
        cur.vz *= waveDampingFactor

        // Move
        cur.x += cur.vx * dt
        cur.y += cur.vy * dt
        cur.z += cur.vz * dt

        // Extremely subtle scaling to show physical deformation without chaos
        cur.scale = 1 + (cur.z * 0.0015)

        el.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, ${cur.z.toFixed(2)}px) scale(${cur.scale.toFixed(3)})`
      }
    }

    // Reset timestamp before starting loop to avoid jump if mounted but inactive
    globalPhysicsRef.current.lastTime = performance.now()
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
      style={{ background: '#050508', perspective: '1200px' }}
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
          transformStyle: 'preserve-3d',
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
