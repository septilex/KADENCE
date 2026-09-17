'use client'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'
import { SongNode } from '@/lib/types'
import { useAudioStore } from '@/store/audioStore'
import { useSongStore } from '@/store/songStore'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { GlassButton } from './GlassButton'
import { EditorialOverlay } from './EditorialOverlay'

function MagneticGlassCard({
  children,
  className,
  style,
  onClick,
  href,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  href?: string
}) {
  const cardRef = useRef<HTMLDivElement & HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { damping: 18, stiffness: 450, mass: 0.15 })
  const springY = useSpring(y, { damping: 18, stiffness: 450, mass: 0.15 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const pullX = (e.clientX - (rect.left + rect.width / 2)) * 0.22
    const pullY = (e.clientY - (rect.top + rect.height / 2)) * 0.22
    x.set(pullX)
    y.set(pullY)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  if (href) {
    return (
      <motion.a
        ref={cardRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ x: springX, y: springY, ...style }}
        whileHover={{
          scale: 1.03,
          boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.7), 0 0 24px rgba(255,255,255,0.4), 0 10px 25px rgba(0,0,0,0.3)',
        }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className={className}
      >
        {children}
      </motion.a>
    )
  }

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY, ...style }}
      whileHover={{
        scale: 1.03,
        boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.7), 0 0 20px rgba(255,255,255,0.35), 0 10px 25px rgba(0,0,0,0.3)',
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface LiquidScrubberProps {
  progress: number
  duration: number
  hasPreview: boolean
  onSeek: (pct: number) => void
  formatTime: (secs: number) => string
}

function LiquidScrubber({
  progress,
  duration,
  hasPreview,
  onSeek,
  formatTime,
}: LiquidScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubProgress, setScrubProgress] = useState(0)
  const lastXRef = useRef(0)

  // Motion values for magnetic liquid bubble
  const targetX = useMotionValue(0)
  const targetY = useMotionValue(0)
  const scaleX = useMotionValue(1)
  const scaleY = useMotionValue(1)
  const tilt = useMotionValue(0)

  // Spring physics for responsive, liquid iOS Glass inertia
  const springX = useSpring(targetX, { damping: 22, stiffness: 420, mass: 0.15 })
  const springY = useSpring(targetY, { damping: 18, stiffness: 380, mass: 0.12 })
  const springScaleX = useSpring(scaleX, { damping: 20, stiffness: 350, mass: 0.12 })
  const springScaleY = useSpring(scaleY, { damping: 20, stiffness: 350, mass: 0.12 })
  const springTilt = useSpring(tilt, { damping: 24, stiffness: 320, mass: 0.15 })

  // Keep targetX aligned with actual playback progress when not actively dragging
  useEffect(() => {
    if (!isScrubbing && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect()
      targetX.set((progress / 100) * rect.width)
    }
  }, [progress, isScrubbing, targetX])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasPreview || !trackRef.current) return
    e.preventDefault()
    setIsScrubbing(true)
    trackRef.current.setPointerCapture(e.pointerId)

    const rect = trackRef.current.getBoundingClientRect()
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const pct = (currentX / rect.width) * 100

    lastXRef.current = currentX
    setScrubProgress(pct)
    onSeek(pct)

    targetX.set(currentX)
    targetY.set(0)
    scaleX.set(1)
    scaleY.set(1)
    tilt.set(0)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const pct = (currentX / rect.width) * 100

    setScrubProgress(pct)
    onSeek(pct)

    // Follow cursor horizontally
    targetX.set(currentX)

    // Vertical magnetic elasticity (up to +/- 14px)
    const offsetY = e.clientY - (rect.top + rect.height / 2)
    targetY.set(Math.max(-14, Math.min(14, offsetY * 0.35)))

    // Subtle liquid velocity deformation (volume-preserving stretch)
    const dx = currentX - lastXRef.current
    lastXRef.current = currentX

    const stretch = Math.min(0.28, Math.abs(dx) * 0.02)
    scaleX.set(1 + stretch)
    scaleY.set(1 - stretch * 0.5)
    tilt.set(Math.max(-12, Math.min(12, dx * 0.8)))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return
    if (trackRef.current && trackRef.current.hasPointerCapture(e.pointerId)) {
      try {
        trackRef.current.releasePointerCapture(e.pointerId)
      } catch {
        // Safe fallback
      }
    }
    setIsScrubbing(false)
    targetY.set(0)
    scaleX.set(1)
    scaleY.set(1)
    tilt.set(0)
  }

  const currentPct = isScrubbing ? scrubProgress : progress

  return (
    <div className="space-y-2 mb-6 select-none">
      {/* Interactive track wrapper with comfortable touch/pointer target */}
      <div
        ref={trackRef}
        className={`relative py-3.5 -my-2 ${hasPreview ? 'cursor-pointer group' : 'cursor-not-allowed'} touch-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Base 8px Progress Track - Kept identical to default */}
        <div className="h-2 bg-white/15 border border-white/25 backdrop-blur-md rounded-full overflow-hidden relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] pointer-events-none">
          <div
            className="h-full rounded-full origin-left relative shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all ease-linear"
            style={{ width: `${hasPreview ? currentPct : 0}%`, backgroundColor: '#fff' }}
          >
            {/* Default resting hover indicator (hidden while liquid bubble is active) */}
            <div
              className={`absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.95)] transition-opacity ${
                isScrubbing ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          </div>
        </div>

        {/* Magnetic Liquid-Bubble: expands on press, follows cursor, springs back on release */}
        {hasPreview && (
          <motion.div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              x: springX,
              y: springY,
              pointerEvents: 'none',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={isScrubbing ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: isScrubbing ? 420 : 480,
              damping: isScrubbing ? 22 : 28,
              mass: 0.15,
            }}
            className="z-30 pointer-events-none"
          >
            <motion.div
              style={{
                scaleX: springScaleX,
                scaleY: springScaleY,
                rotate: springTilt,
              }}
              className="-translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none"
            >
              {/* Outer soft whitish liquid-glass bloom halo */}
              <div
                className="absolute -inset-2.5 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.15) 50%, transparent 72%)',
                  filter: 'blur(5px)',
                }}
              />

              {/* Main Liquid-Glass Bubble Pill */}
              <div
                className="relative w-8 h-6 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.20) 45%, rgba(255, 255, 255, 0.35) 100%)',
                  backdropFilter: 'blur(16px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                  border: '1.5px solid rgba(255, 255, 255, 0.75)',
                  boxShadow: `
                    inset 0 1.5px 2.5px rgba(255, 255, 255, 0.9),
                    inset 0 -1.5px 2px rgba(255, 255, 255, 0.3),
                    0 0 16px rgba(255, 255, 255, 0.45),
                    0 0 30px rgba(255, 255, 255, 0.2),
                    0 6px 16px rgba(0, 0, 0, 0.35)
                  `,
                }}
              >
                {/* Upper liquid reflection highlight sheen */}
                <div
                  className="absolute inset-x-1 top-0.5 h-[42%] rounded-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.1) 100%)',
                  }}
                />

                {/* Center luminous droplet core */}
                <div
                  className="w-2 h-2 rounded-full bg-white relative z-10"
                  style={{
                    boxShadow: '0 0 6px rgba(255, 255, 255, 0.95), 0 0 12px rgba(255, 255, 255, 0.6)',
                  }}
                />
              </div>

              {/* Floating Live Scrubber Time Tag above the bubble */}
              <div
                className="absolute -top-7 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider text-white backdrop-blur-xl pointer-events-none whitespace-nowrap border border-white/30"
                style={{
                  background: 'rgba(255, 255, 255, 0.24)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                {formatTime((currentPct / 100) * duration)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Time display */}
      <div className="flex justify-between text-[11px] font-mono text-white/60 tracking-wider font-medium">
        <span>{hasPreview ? formatTime((currentPct / 100) * duration) : '0:00'}</span>
        <span>{hasPreview ? '0:30' : '--:--'}</span>
      </div>
    </div>
  )
}

interface SongDetailProps {
  song: SongNode | null
  onClose: () => void
}

// Waveform bar heights — used for CSS animation, not Framer Motion loops
const WAVE_BARS = [4, 8, 12, 6, 14, 10, 5, 13, 7, 11, 9, 15, 6, 8, 12, 4, 10, 7, 13, 9]

// Static heights for the main 40-bar visualizer to prevent jitter on render
const MAIN_WAVE_HEIGHTS = [
  30, 45, 25, 60, 40, 75, 50, 85, 40, 65,
  35, 90, 55, 70, 45, 80, 50, 60, 35, 75,
  45, 85, 55, 70, 40, 65, 30, 80, 50, 60,
  35, 75, 45, 55, 30, 65, 40, 50, 25, 45
]

// CSS-only waveform animation style — generated once at module level, zero JS per frame.
const WAVEFORM_STYLE = WAVE_BARS.map((h, i) => `
  .kd-wave-bar:nth-child(${i + 1}) {
    min-height: 2px;
    animation: kd-wave-${i} ${(0.5 + (i % 5) * 0.08).toFixed(2)}s ${(i * 0.04).toFixed(2)}s ease-in-out infinite alternate;
  }
  @keyframes kd-wave-${i} {
    from { height: ${Math.round(h * 0.4)}px; }
    to   { height: ${h}px; }
  }
`).join('') + `
  @keyframes kd-pulse-wave {
    0% { transform: scaleY(0.75); }
    100% { transform: scaleY(1.2); }
  }
`

export function SongDetail({ song, onClose }: SongDetailProps) {
  const currentVibeId = useSongStore(s => s.currentVibe)
  const activeVibe = VIBE_CONFIGS.find(v => v.id === currentVibeId)

  const { isPlaying, progress, duration, togglePlay, seekTo } = useAudioStore()
  const [imageLoaded, setImageLoaded] = useState(false)

  // Reset image loaded on song change
  useEffect(() => {
    setImageLoaded(false)
  }, [song?.name])

  // Memoized to avoid recreating on every render — stable reference for event handlers
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * 100)
  }, [duration, seekTo])

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  return (
    <AnimatePresence>
      <style>{WAVEFORM_STYLE}</style>
      {song && (
        <>
          {/* ── Transparent Non-Blocking Backdrop ─────────────────── */}
          {/* We remove the dark blur so the cinematic background shines through, and we don't block interactions */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed inset-0 z-30 pointer-events-none"
          />

          <EditorialOverlay />

          {/* ── Logo Overlay (Outside Panel) ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="fixed left-[400px] top-0 h-16 flex items-center z-40 pointer-events-auto"
          >
            <img src="/kadence-horizontal-logo.png" alt="Kadence" className="h-[52px] drop-shadow-lg opacity-90 select-none pointer-events-none" />
          </motion.div>

          {/* ── Category Overlay (Outside Panel, Bottom) ── */}
          {activeVibe && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              className="fixed left-[400px] bottom-12 z-40 pointer-events-auto"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="px-6 py-3 rounded-full backdrop-blur-2xl border border-white/30 text-[12px] uppercase tracking-[0.25em] font-bold text-white cursor-default flex items-center gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_8px_24px_rgba(0,0,0,0.3)]"
                style={{
                  background: `linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)`,
                  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.6), 0 8px 24px -5px rgba(0,0,0,0.5), 0 0 20px ${song.color}40`,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: song.color, boxShadow: `0 0 8px ${song.color}` }} />
                <span>{activeVibe.label}</span>
              </motion.div>
            </motion.div>
          )}

          {/* ── Floating Cinematic Card (Whitish Liquid Glass Sidebar) ── */}
          <motion.div
            key="drawer"
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
            className="fixed left-4 top-4 bottom-4 z-40 w-full max-w-[360px] flex flex-col rounded-3xl overflow-hidden backdrop-blur-2xl"
            style={{
              background: `linear-gradient(165deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.05) 100%)`,
              border: '1px solid rgba(255,255,255,0.35)',
              boxShadow: `inset 0 1.5px 2px rgba(255,255,255,0.7), inset 0 -1px 1px rgba(255,255,255,0.15), 0 25px 60px -12px rgba(0,0,0,0.5), 0 0 35px rgba(255,255,255,0.1)`,
              backdropFilter: 'blur(30px) saturate(190%)',
              WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            }}
            id="song-detail-drawer"
          >
            {/* Top liquid specular highlight sheen */}
            <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-white/25 via-white/5 to-transparent pointer-events-none rounded-t-3xl z-0" />

            {/* ── Close button ─────────────────────────────── */}
            <div className="absolute top-5 right-5 z-50">
              <GlassButton
                id="close-detail-btn"
                onClick={onClose}
                size="iconSm"
                contentClassName="flex items-center justify-center text-white"
                title="Close"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </GlassButton>
            </div>

            {/* ── Scrollable Content Area ───────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col relative z-10 space-y-5 pt-6 pb-6" style={{ scrollbarWidth: 'none' }}>
              
              {/* ── Album Art Hero ────────────────────────────── */}
              <div className="relative flex-shrink-0 w-full px-5 pb-0">
                <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl" 
                     style={{ 
                       aspectRatio: '1/1', 
                       border: `1px solid rgba(255,255,255,0.35)`, 
                       boxShadow: `inset 0 1.5px 2px rgba(255,255,255,0.6), 0 20px 40px -10px rgba(0,0,0,0.5)` 
                     }}>
                  
                  {/* Image */}
                  <motion.img
                    key={song.albumArt}
                    src={song.albumArt}
                    alt={song.album}
                    className="w-full h-full object-cover"
                    initial={{ scale: 1.06, opacity: 0, filter: 'blur(12px)' }}
                    animate={{ 
                      scale: imageLoaded ? 1 : 1.06, 
                      opacity: imageLoaded ? 1 : 0,
                      filter: imageLoaded ? 'blur(0px)' : 'blur(12px)'
                    }}
                    transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    onLoad={() => setImageLoaded(true)}
                  />

                  {/* Gradient Overlay for Text Visibility */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 40%)' }} />

                  {/* Top Left Tag (e.g. Primary Genre) */}
                  {song.genres[0] && (
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xl border border-white/35 flex items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_12px_rgba(0,0,0,0.25)]">
                      <span className="text-[9px] font-bold tracking-widest text-white uppercase">{song.genres[0]}</span>
                    </div>
                  )}
                  
                  {/* Bottom Right: Now Playing Indicator */}
                  {isPlaying && song.previewUrl && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xl border border-white/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_12px_rgba(0,0,0,0.25)]">
                      <div className="flex items-end gap-[2px] h-3">
                        {WAVE_BARS.slice(0,4).map((h, i) => (
                          <div key={i} className="kd-wave-bar w-[2px] rounded-full" style={{ backgroundColor: '#fff', height: `${h * 0.4}px` }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold tracking-widest text-white uppercase">Now Playing</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Track Metadata ────────────────────────────── */}
              <div className="px-5 space-y-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <h2 className="text-white font-medium leading-tight mb-1 font-serif tracking-wide" 
                      style={{ fontSize: 'clamp(1.75rem, 6vw, 2.25rem)', color: '#fff', textShadow: `0 2px 10px rgba(0,0,0,0.5)` }}>
                    {song.name}
                  </h2>
                  <p className="text-white/80 text-sm tracking-wide font-light">{song.artist}</p>
                  <p className="text-white/50 text-xs tracking-wide font-light mt-0.5">{song.album}</p>
                </motion.div>

                {/* Genre Tags */}
                {song.genres.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2 pt-1">
                    {song.genres.map((g) => (
                      <span key={g} className="px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase border border-white/30 bg-white/15 backdrop-blur-xl text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.2)]">
                        {g}
                      </span>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* ── Audio Player / Waveform ───────────────────────── */}
              <motion.div className="px-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {/* ── Waveform Visualizer ── */}
                <div className="flex items-end justify-between h-10 mb-5 px-1 opacity-90 mix-blend-screen">
                  {MAIN_WAVE_HEIGHTS.map((h, i) => (
                    <div key={i} className="w-[3px] rounded-full origin-bottom" 
                         style={{
                           backgroundColor: i < (progress / 100) * 40 ? '#ffffff' : 'rgba(255,255,255,0.2)',
                           height: `${h}%`,
                           animation: `kd-pulse-wave ${0.4 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                           animationDelay: `${i * 0.05}s`,
                           animationPlayState: isPlaying ? 'running' : 'paused',
                           transition: 'background-color 0.2s',
                           boxShadow: i < (progress / 100) * 40 && isPlaying ? `0 0 8px rgba(255,255,255,0.6)` : 'none'
                         }} 
                    />
                  ))}
                </div>

                {/* ── Scrubber & Time ── */}
                <LiquidScrubber
                  progress={progress}
                  duration={duration}
                  hasPreview={!!song.previewUrl}
                  onSeek={seekTo}
                  formatTime={formatTime}
                />

                {/* ── Controls ── */}
                <div 
                  className="flex items-center justify-between px-1 pt-1 pb-2"
                  style={{ '--foreground': '#ffffff', '--background': '#ffffff' } as React.CSSProperties}
                >
                  {/* Shuffle Button */}
                  <GlassButton
                    size="iconSm"
                    contentClassName="flex items-center justify-center text-white/70 hover:text-white"
                    title="Shuffle"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
                    </svg>
                  </GlassButton>

                  {/* Previous Button */}
                  <GlassButton
                    size="icon"
                    contentClassName="flex items-center justify-center text-white/90"
                    title="Previous Track"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 20L9 12l10-8v16zM5 19h2V5H5v14z"/>
                    </svg>
                  </GlassButton>
                  
                  {/* Hero Play/Pause Button - Noticeably Larger */}
                  <GlassButton
                    onClick={song.previewUrl ? togglePlay : undefined}
                    size="iconXl"
                    disabled={!song.previewUrl}
                    className={!song.previewUrl ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_0_32px_rgba(255,255,255,0.45)]'}
                    contentClassName="flex items-center justify-center text-white"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying && song.previewUrl ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                        <rect x="5.5" y="4" width="4.5" height="16" rx="1.5"/>
                        <rect x="14" y="4" width="4.5" height="16" rx="1.5"/>
                      </svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white" className="ml-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                        <polygon points="5,3 20,12 5,21"/>
                      </svg>
                    )}
                  </GlassButton>
                  
                  {/* Next Button */}
                  <GlassButton
                    size="icon"
                    contentClassName="flex items-center justify-center text-white/90"
                    title="Next Track"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 4l10 8-10 8V4zM19 5h-2v14h2V5z"/>
                    </svg>
                  </GlassButton>

                  {/* Repeat Button */}
                  <GlassButton
                    size="iconSm"
                    contentClassName="flex items-center justify-center text-white/70 hover:text-white"
                    title="Repeat"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>
                    </svg>
                  </GlassButton>
                </div>
              </motion.div>
              
              {/* ── Footer Stats ────────────────────────────── */}
              <div className="px-5 space-y-4">
                <div className="flex items-center gap-3">
                  <MagneticGlassCard
                    className="flex-1 rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-xl transition-all duration-300 cursor-default"
                    style={{
                      background: `linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)`,
                      border: '1px solid rgba(255,255,255,0.35)',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="opacity-90 drop-shadow-sm"><path d="M3 18h3v-7H3v7zM8 18h3V6H8v12zM13 18h3v-9h-3v9zM18 18h3V11h-3v7z"/></svg>
                    <div>
                      <div className="text-white font-bold text-sm leading-none drop-shadow-sm">{song.popularity}%</div>
                      <div className="text-white/80 text-[8px] font-bold tracking-widest uppercase mt-1">Popularity</div>
                    </div>
                  </MagneticGlassCard>

                  <MagneticGlassCard
                    className="flex-1 rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-xl transition-all duration-300 cursor-default"
                    style={{
                      background: `linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)`,
                      border: '1px solid rgba(255,255,255,0.35)',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="opacity-90 drop-shadow-sm"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    <div>
                      <div className="text-white font-bold text-sm leading-none drop-shadow-sm">{song.previewUrl ? '30s' : '0s'}</div>
                      <div className="text-white/80 text-[8px] font-bold tracking-widest uppercase mt-1">Preview</div>
                    </div>
                  </MagneticGlassCard>
                </div>

                {/* Apple Music Button */}
                <MagneticGlassCard
                  href={song.spotifyUrl}
                  className="w-full flex items-center justify-between rounded-2xl p-3.5 cursor-pointer group backdrop-blur-xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.09) 100%)`,
                    border: '1px solid rgba(255,255,255,0.35)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Apple Logo SVG */}
                    <svg width="24" height="24" viewBox="0 0 384 512" fill="currentColor" className="text-white drop-shadow-md">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.3 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>
                    <div>
                      <div className="text-white/60 text-[10px] font-medium tracking-wide">Listen on</div>
                      <div className="text-white font-bold text-sm tracking-wide leading-none drop-shadow-md">Apple Music</div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60 group-hover:text-white transition-colors">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </MagneticGlassCard>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
