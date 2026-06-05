'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'
import { SongNode } from '@/lib/types'
import { useAudioStore } from '@/store/audioStore'

interface SongDetailProps {
  song: SongNode | null
  onClose: () => void
}

// Waveform bar heights — used for CSS animation, not Framer Motion loops
const WAVE_BARS = [4, 8, 12, 6, 14, 10, 5, 13, 7, 11, 9, 15, 6, 8, 12, 4, 10, 7, 13, 9]

// CSS-only waveform animation style — generated once at module level, zero JS per frame.
// Each bar uses animation-delay to stagger without creating individual JS animation loops.
const WAVEFORM_STYLE = WAVE_BARS.map((h, i) => `
  .kd-wave-bar:nth-child(${i + 1}) {
    min-height: 2px;
    animation: kd-wave-${i} ${(0.5 + (i % 5) * 0.08).toFixed(2)}s ${(i * 0.04).toFixed(2)}s ease-in-out infinite alternate;
  }
  @keyframes kd-wave-${i} {
    from { height: ${Math.round(h * 0.4)}px; }
    to   { height: ${h}px; }
  }
`).join('')

export function SongDetail({ song, onClose }: SongDetailProps) {
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
      {/* CSS-only waveform keyframes — injected once, no per-bar JS animation */}
      <style>{WAVEFORM_STYLE}</style>
      {song && (
        <>
          {/* ── Backdrop ─────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed inset-0 z-30 bg-black/40"
            style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* ── Drawer ───────────────────────────────────────── */}
          <motion.div
            key="drawer"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
            className="fixed left-0 top-0 bottom-0 z-40 w-full max-w-[340px] flex flex-col overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(8,8,12,0.97) 0%, rgba(4,4,8,0.99) 100%)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              boxShadow: `24px 0 60px -8px rgba(0,0,0,0.85), inset -1px 0 0 rgba(255,255,255,0.04)`,
            }}
            id="song-detail-drawer"
          >
            {/* ── Close button ─────────────────────────────── */}
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center
                rounded-full bg-white/8 text-white/50 hover:bg-white/15 hover:text-white
                transition-colors duration-150 cursor-pointer"
              id="close-detail-btn"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </motion.button>

            {/* ── Album art hero ────────────────────────────── */}
            <div className="relative flex-shrink-0 overflow-hidden" style={{ aspectRatio: '1/1' }}>
              {/* Color ambient glow behind art */}
              <motion.div
                className="absolute -inset-4 opacity-60 blur-2xl pointer-events-none"
                style={{ backgroundColor: song.color }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />

              {/* Premium image placeholder */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 1 }}
                animate={{ opacity: imageLoaded ? 0 : 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ background: `linear-gradient(145deg, ${song.color}40 0%, #050508 70%)` }}
              />

              {song.albumArt ? (
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
              ) : (
                <motion.div
                  className="w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  style={{ background: `radial-gradient(circle at 35% 40%, ${song.color}55, #050508 70%)` }}
                />
              )}

              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(4,4,8,1) 0%, transparent 100%)' }}
              />

              {/* Subtle color blend */}
              <div
                className="absolute inset-0 opacity-15 mix-blend-color pointer-events-none"
                style={{ backgroundColor: song.color }}
              />

              {/* Waveform while playing — pure CSS animation, zero JS per frame */}
              <AnimatePresence>
                {isPlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.3 }}
                    className="absolute bottom-3 left-0 right-0 flex items-end justify-center gap-[2px] px-6 pointer-events-none"
                    style={{ height: '24px' }}
                  >
                    {WAVE_BARS.map((h, i) => (
                      <div
                        key={i}
                        className="kd-wave-bar rounded-full flex-shrink-0"
                        style={{
                          width: '2px',
                          backgroundColor: song.color || '#1DB954',
                          height: `${h * 0.5}px`,
                          minHeight: '2px',
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Scrollable content ────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-4 space-y-5"
              style={{ scrollbarWidth: 'none' }}
            >

              {/* Song info — staggered entrance */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h2
                  className="text-white font-black tracking-tighter leading-[1.1] mb-1 pr-8"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.5rem, 5vw, 2.2rem)' }}
                >
                  {song.name}
                </h2>
                <p className="text-white/70 text-base tracking-wide">{song.artist}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-white/35 text-xs tracking-wide">{song.album}</p>
                  {!song.previewUrl && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-white/10 text-white/40">
                      No Preview
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Popularity bar */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/35 text-[10px] uppercase tracking-[0.15em]">Popularity</span>
                  <span className="text-white/50 text-[10px] font-mono">{song.popularity}%</span>
                </div>
                <div className="h-[2px] bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: song.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${song.popularity}%` }}
                    transition={{ delay: 0.4, duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                </div>
              </motion.div>

              {/* Audio preview player */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.45 }}
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: `linear-gradient(135deg, ${song.color}18, ${song.color}08)`,
                  border: `1px solid ${song.color}28`,
                  opacity: song.previewUrl ? 1 : 0.6,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Play / pause */}
                  <motion.button
                    onClick={song.previewUrl ? togglePlay : undefined}
                    id="preview-play-btn"
                    whileHover={song.previewUrl ? { scale: 1.08 } : {}}
                    whileTap={song.previewUrl ? { scale: 0.9 } : {}}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${song.previewUrl ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                    style={{
                      border: `1.5px solid ${song.color}70`,
                      backgroundColor: song.color + '28',
                      boxShadow: isPlaying && song.previewUrl ? `0 0 16px ${song.color}50` : 'none',
                    }}
                    disabled={!song.previewUrl}
                  >
                    {isPlaying && song.previewUrl ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    )}
                  </motion.button>

                  {/* Progress scrubber */}
                  <div className="flex-1 space-y-1">
                    <div
                      className={`h-[3px] bg-white/10 rounded-full overflow-hidden relative ${song.previewUrl ? 'cursor-pointer group' : 'cursor-not-allowed'}`}
                      onClick={song.previewUrl ? handleSeek : undefined}
                    >
                      <motion.div
                        className="h-full rounded-full origin-left"
                        style={{ width: `${song.previewUrl ? progress : 0}%`, backgroundColor: song.color }}
                        transition={{ duration: 0 }}
                      />
                      {/* Thumb dot */}
                      {song.previewUrl && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)', backgroundColor: song.color }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/25 text-[10px] font-mono">
                        {song.previewUrl ? formatTime((progress / 100) * duration) : '--:--'}
                      </span>
                      <span className="text-white/25 text-[10px]">
                        {song.previewUrl ? '30s preview' : 'Preview unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Genre tags */}
              {song.genres.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.4 }}
                  className="flex flex-wrap gap-1.5"
                >
                  {song.genres.map((g, i) => (
                    <motion.span
                      key={g}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.38 + i * 0.04, duration: 0.3 }}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase cursor-default"
                      style={{
                        border:          `1px solid ${song.color}45`,
                        color:           song.color,
                        backgroundColor: song.color + '14',
                      }}
                    >
                      {g}
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </div>

            {/* ── Open in Spotify CTA ───────────────────────── */}
            <motion.div
              className="flex-shrink-0 p-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.45 }}
            >
              <motion.a
                href={song.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="open-spotify-btn"
                whileHover={{ scale: 1.025, boxShadow: '0 6px 28px rgba(29,185,84,0.40)' }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl
                  bg-[#1DB954] text-black font-bold text-sm tracking-wide cursor-pointer
                  transition-colors duration-200 hover:bg-[#1ed760]"
                style={{ boxShadow: '0 4px 20px rgba(29,185,84,0.28)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Open in Spotify
              </motion.a>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
