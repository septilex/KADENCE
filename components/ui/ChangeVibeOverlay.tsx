'use client'
import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChartHover } from '@/hooks/useChartHover'

interface ChangeVibeOverlayProps {
  currentVibe: Vibe | null
  onSelectVibe: (vibe: Vibe) => void
  onClose: () => void
}

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
        <div className="grid gap-4 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {VIBE_CONFIGS.map((v, i) => {
            const isActive = currentVibe === v.id
            return (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i, duration: 0.4 }}
                onClick={() => {
                  onSelectVibe(v.id)
                  onClose()
                }}
                onHoverStart={() => handleHoverStart(v.id)}
                onHoverEnd={handleHoverEnd}
                className="relative group flex flex-col justify-end p-4 rounded-[10px] overflow-hidden cursor-pointer text-left aspect-square outline-none"
                style={{
                  backgroundColor: v.bgColor,
                  boxShadow: isActive ? `0 12px 24px -8px ${v.bgColor}` : 'none',
                  transform: isActive ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
                  filter: isActive ? 'brightness(1.08)' : 'brightness(1)',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                whileHover={!isActive ? {
                  scale: 1.04,
                  y: -4,
                  filter: 'brightness(1.08)',
                  boxShadow: `0 12px 24px -8px ${v.bgColor}`
                } : undefined}
              >
                {/* Geometric overlay pattern */}
                <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                
                {/* Large background number */}
                <span className="absolute top-[-14px] left-[-4px] text-[80px] font-black text-white opacity-10 tracking-tighter leading-none pointer-events-none select-none">
                  {v.number}
                </span>

                {/* Badge */}
                {v.badge && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-white/20 backdrop-blur-md text-[9px] font-bold text-white tracking-widest shadow-sm">
                    {v.badge}
                  </div>
                )}
                
                {/* Text */}
                <div className="relative z-10 w-full mt-auto translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <span
                    className="block text-white font-bold text-sm md:text-base leading-tight mb-1"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {v.label}
                  </span>
                  <span className="block text-white/60 text-[9px] uppercase font-bold tracking-wider leading-tight">
                    {v.sub}
                  </span>
                </div>

                {/* Song Preview Overlay */}
                <AnimatePresence>
                  {hoveredVibe === v.id && signatureSongs[v.id] && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-20 flex flex-col justify-end p-3 overflow-hidden bg-black/80"
                    >
                      <motion.img 
                        key={`img-${signatureSongs[v.id].id}`}
                        src={signatureSongs[v.id].albumArt} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]" 
                        alt=""
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 0.4, scale: 1 }}
                        transition={{ duration: 0.6 }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                      
                      <motion.div 
                        key={`info-${signatureSongs[v.id].id}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="relative z-10 flex items-end justify-between w-full"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-white font-bold text-xs truncate leading-tight">{signatureSongs[v.id].name}</p>
                          <p className="text-white/70 text-[10px] truncate mt-0.5">{signatureSongs[v.id].artist}</p>
                        </div>
                        <a
                          href={signatureSongs[v.id].spotifyUrl}
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
                      
                      {signatureSongs[v.id].previewUrl && (
                        <div className="relative z-10 w-full h-[2px] bg-white/20 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            key={`progress-${signatureSongs[v.id].id}`}
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
          })}
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
