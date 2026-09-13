'use client'
import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { useEffect, useRef, memo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChartHover } from '@/hooks/useChartHover'

interface ChangeVibeOverlayProps {
  currentVibe: Vibe | null
  onSelectVibe: (vibe: Vibe) => void
  onClose: () => void
}

const ChangeVibeCard = memo(function ChangeVibeCard({
  vibe,
  index,
  isActive,
  isHovered,
  signatureSong,
  onHoverStart,
  onHoverEnd,
  onSelect
}: {
  vibe: any
  index: number
  isActive: boolean
  isHovered: boolean
  signatureSong: any
  onHoverStart: (id: Vibe) => void
  onHoverEnd: () => void
  onSelect: (id: Vibe) => void
}) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)

  const handlePointerEnter = () => {
    if (cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect()
    }
    onHoverStart(vibe.id)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = cardRef.current
    if (!el) return
    let rect = rectRef.current
    if (!rect) {
      rect = el.getBoundingClientRect()
      rectRef.current = rect
    }
    const clientX = e.clientX
    const clientY = e.clientY

    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (!el || !rectRef.current) return
      const currentRect = rectRef.current
      const px = (clientX - currentRect.left) / currentRect.width - 0.5
      const py = (clientY - currentRect.top) / currentRect.height - 0.5
      
      const tx = (px * 14).toFixed(1)
      const ty = (py * 14).toFixed(1)
      const rx = (-py * 20).toFixed(2)
      const ry = (px * 20).toFixed(2)

      el.style.setProperty('--tx', `${tx}px`)
      el.style.setProperty('--ty', `${ty}px`)
      el.style.setProperty('--rx', `${rx}deg`)
      el.style.setProperty('--ry', `${ry}deg`)
    })
  }

  const handlePointerLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    rectRef.current = null
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    onHoverEnd()
  }

  const glowColor = vibe.id === 'dev-special' ? vibe.accentColor : vibe.bgColor
  const isDarkVibe = vibe.id === 'dev-special'
  const textColor = isDarkVibe ? 'text-white' : 'text-black'
  const textSubColor = isDarkVibe ? 'text-white/80' : 'text-black/80'

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.4 }}
      onClick={() => onSelect(vibe.id)}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative group flex flex-col justify-end p-4 rounded-[12px] overflow-hidden cursor-pointer text-left aspect-square outline-none"
      style={{
        backgroundColor: vibe.bgColor,
        transformStyle: 'preserve-3d',
        transform: isActive 
          ? 'translate3d(var(--tx, 0px), calc(var(--ty, 0px) - 6px), 0px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale3d(1.05, 1.05, 1.05)' 
          : 'translate3d(var(--tx, 0px), var(--ty, 0px), 0px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale3d(1, 1, 1)',
        boxShadow: isActive ? `0 15px 40px -5px ${glowColor}, 0 0 20px ${glowColor}66` : 'none',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
      whileHover={!isActive ? {
        scale: 1.05,
        y: -6,
        boxShadow: `0 12px 30px -5px ${glowColor}, 0 0 15px ${glowColor}4D`
      } : undefined}
    >
      {/* Geometric overlay pattern */}
      <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '12px 12px' }} />
      
      {/* Large background number */}
      <span className={`absolute top-[-14px] left-[-4px] text-[80px] font-black tracking-tighter leading-none pointer-events-none select-none opacity-20 ${textColor}`}>
        {vibe.number}
      </span>

      {/* Badge */}
      {vibe.badge && (
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold tracking-widest shadow-sm text-white">
          {vibe.badge}
        </div>
      )}
      
      {/* Text */}
      <div className="relative z-10 w-full mt-auto translate-y-1 group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
        <span
          className={`block ${textColor} font-black text-sm md:text-base leading-tight mb-1`}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {vibe.label}
        </span>
        <span className={`block ${textSubColor} text-[9px] uppercase font-bold tracking-wider leading-tight`}>
          {vibe.sub}
        </span>
      </div>

      {/* Song Preview Overlay */}
      <AnimatePresence>
        {isHovered && signatureSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-20 flex flex-col justify-end p-3 overflow-hidden bg-black/80"
          >
            <motion.img 
              key={`img-${signatureSong.id}`}
              src={signatureSong.albumArt} 
              className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]" 
              alt=""
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 0.4, scale: 1 }}
              transition={{ duration: 0.6 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            
            <motion.div 
              key={`info-${signatureSong.id}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 flex items-end justify-between w-full"
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-white font-bold text-xs truncate leading-tight">{signatureSong.name}</p>
                <p className="text-white/70 text-[10px] truncate mt-0.5">{signatureSong.artist}</p>
              </div>
              <a
                href={signatureSong.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-full bg-[#ea4cc0] text-white flex items-center justify-center shrink-0 hover:scale-110 transition-transform shadow-md"
                title="Listen on iTunes"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 2.9v10.9a4.8 4.8 0 0 0-2.5-.7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5V6.1l-9 1.8v8.9a4.8 4.8 0 0 0-2.5-.7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5V4.2L21 2.9z"/>
                </svg>
              </a>
            </motion.div>
            
            {signatureSong.previewUrl && (
              <div className="relative z-10 w-full h-[2px] bg-white/20 rounded-full mt-2 overflow-hidden">
                <motion.div 
                  key={`progress-${signatureSong.id}`}
                  className="absolute top-0 left-0 bottom-0 bg-[#1db954]"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 10, ease: 'linear' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
})

export function ChangeVibeOverlay({ currentVibe, onSelectVibe, onClose }: ChangeVibeOverlayProps) {
  // Listen for Escape key to close the overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ── Chart Hover Preview ──
  const { hoveredVibe, handleHoverStart, handleHoverEnd, signatureSongs } = useChartHover()

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-3xl bg-black/75 pointer-events-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClose}
    >
      <motion.div
        className="relative z-50 flex flex-col items-center gap-8 px-6 py-10 max-w-4xl w-full"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            className="text-white text-3xl md:text-4xl font-black tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Switch Chart
          </h2>
          <p className="text-white/40 text-sm">
            All charts update live — no reload
          </p>
        </div>

        {/* Vibe Grid */}
        <div className="grid gap-4 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', perspective: '1000px' }}>
          {VIBE_CONFIGS.map((v, i) => (
            <ChangeVibeCard
              key={v.id}
              vibe={v}
              index={i}
              isActive={currentVibe === v.id}
              isHovered={hoveredVibe === v.id}
              signatureSong={signatureSongs[v.id]}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onSelect={(id) => {
                onSelectVibe(id)
                onClose()
              }}
            />
          ))}
        </div>

        {/* Back Button */}
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full border border-white/10 text-white/50 text-xs tracking-wider uppercase hover:border-white/20 hover:text-white/80 transition-all duration-300"
        >
          Dismiss
        </button>
      </motion.div>
    </motion.div>
  )
}
