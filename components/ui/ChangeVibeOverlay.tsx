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
  const { hoveredVibe, previewIndex, handleHoverStart, handleHoverEnd, previews } = useChartHover()

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
                  {hoveredVibe === v.id && previews[v.id] && previews[v.id].length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-20 flex flex-col justify-end p-3 overflow-hidden bg-black/80"
                    >
                      <motion.img 
                        key={`img-${previews[v.id][previewIndex].id}`}
                        src={previews[v.id][previewIndex].albumArt} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]" 
                        alt=""
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 0.4, scale: 1 }}
                        transition={{ duration: 0.6 }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                      
                      <motion.div 
                        key={`info-${previews[v.id][previewIndex].id}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="relative z-10 flex items-end justify-between w-full"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-white font-bold text-xs truncate leading-tight">{previews[v.id][previewIndex].name}</p>
                          <p className="text-white/70 text-[10px] truncate mt-0.5">{previews[v.id][previewIndex].artist}</p>
                        </div>
                        <a
                          href={previews[v.id][previewIndex].spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-full bg-[#1db954] flex items-center justify-center shrink-0 hover:scale-110 transition-transform"
                          title="Open in Spotify"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="black">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.978-.335.076-.668-.135-.744-.47-.076-.335.135-.668.47-.744 3.856-.88 7.15-.506 9.822 1.13.295.18.387.563.206.855zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.344 1.334.367.227.487.708.26 1.08zm.105-2.833C14.852 8.94 9.773 8.77 6.83 9.664c-.475.144-.974-.124-1.118-.6-.144-.475.124-.974.6-1.118 3.39-1.03 9.002-.835 12.593 1.297.427.253.567.808.314 1.235-.252.427-.808.567-1.235.314z"/>
                          </svg>
                        </a>
                      </motion.div>
                      
                      {previews[v.id][previewIndex].previewUrl && (
                        <div className="relative z-10 w-full h-[2px] bg-white/20 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            key={`progress-${previews[v.id][previewIndex].id}`}
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
