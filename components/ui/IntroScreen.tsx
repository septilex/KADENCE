'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { Vibe } from '@/lib/types'
import { useChartHover } from '@/hooks/useChartHover'

import { VIBE_CONFIGS } from '@/lib/vibeConfig'

interface IntroScreenProps {
  loadingProgress: number
  onVibeSelect: (vibe: Vibe) => void
}

// Loading phrases — cycle through these while the universe warms up
const LOADING_PHRASES = [
  'Mapping your sonic universe…',
  'Curating 1,000 tracks…',
  'Warming the starfield…',
  'Tuning the frequencies…',
  'Almost there…',
]

// ── Deterministic particle data (generated once, stable across renders) ──
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,           // 0–100 % left
  y: (i * 53 + 7)  % 100,           // 0–100 % top
  size: 1.5 + ((i * 13) % 3),       // 1.5–4.5 px
  duration: 4 + ((i * 7) % 8),      // 4–12 s
  delay: (i * 0.45) % 6,            // 0–6 s stagger
  driftY: 30 + ((i * 17) % 50),     // 30–80 px upward drift
}))

export function IntroScreen({ loadingProgress, onVibeSelect }: IntroScreenProps) {
  const [step, setStep]               = useState<'vibe' | 'loading'>('vibe')
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null)
  const [phraseIdx, setPhraseIdx]      = useState(0)

  // ── Chart Hover Preview ──
  const { hoveredVibe, previewIndex, handleHoverStart, handleHoverEnd, previews } = useChartHover()

  // Dynamic loading phrases per selected vibe
  const getLoadingPhrases = (v: Vibe | null) => {
    if (!v) return LOADING_PHRASES
    const labels: Record<Vibe, string[]> = {
      'global-top-50': ['Gathering global hits…', 'Tuning trending frequencies…', 'Almost there…'],
      'viral-50': ['Finding viral sounds…', 'Loading TikTok hits…', 'Almost there…'],
      'new-music-friday': ['Unboxing fresh drops…', 'Curating new releases…', 'Almost there…'],
      'hip-hop-central': ['Tuning rap frequencies…', 'Loading trap beats…', 'Almost there…'],
      'pop-rising': ['Gathering pop anthems…', 'Tuning upbeat frequencies…', 'Almost there…'],
      'dance-hits': ['Charging EDM buffers…', 'Pumping high-energy BPM…', 'Almost there…'],
      'mood-booster': ['Gathering feel-good hits…', 'Tuning happy frequencies…', 'Almost there…'],
      'late-night': ['Setting late-night mood…', 'Pouring smooth R&B…', 'Almost there…'],
      'workout': ['Charging high-energy tracks…', 'Pumping heavy BPM…', 'Almost there…'],
      'chill-hits': ['Weaving lo-fi dreams…', 'Filtering soft chords…', 'Almost there…'],
    }
    return labels[v] || LOADING_PHRASES
  }

  const currentPhrases = getLoadingPhrases(selectedVibe)

  // Cycle loading phrases every 2.2s
  useEffect(() => {
    if (step !== 'loading') return
    const id = setInterval(() => setPhraseIdx(p => (p + 1) % currentPhrases.length), 2200)
    return () => clearInterval(id)
  }, [step, currentPhrases])

  function handleVibeSelect(vibe: Vibe) {
    setSelectedVibe(vibe)
    setStep('loading')
    onVibeSelect(vibe)
  }

  const activeVibeData = VIBE_CONFIGS.find(v => v.id === hoveredVibe) ?? VIBE_CONFIGS.find(v => v.id === selectedVibe)

  return (
    <>
      {/* ── CSS keyframes for particles (GPU-compositor-only: transform+opacity) */}
      <style>{`
        @keyframes kadence-particle-float {
          0%,100% { transform: translateY(0px) scale(1);   opacity: 0.25; }
          50%      { transform: translateY(var(--drift)) scale(1.3); opacity: 0.7; }
        }
        .kadence-particle {
          animation: kadence-particle-float var(--dur) var(--delay) ease-in-out infinite;
          will-change: transform, opacity;
        }
        @keyframes kadence-pulse-ring {
          0%,100% { transform: scale(1);   opacity: 0.15; }
          50%      { transform: scale(1.18); opacity: 0.45; }
        }
        @keyframes kadence-progress-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent pointer-events-auto overflow-hidden"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* ── Floating particles (CSS-only, compositor thread) ─────────── */}
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className="kadence-particle absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              left:   `${p.x}%`,
              top:    `${p.y}%`,
              width:  `${p.size}px`,
              height: `${p.size}px`,
              ['--dur'   as string]: `${p.duration}s`,
              ['--delay' as string]: `${p.delay}s`,
              ['--drift' as string]: `-${p.driftY}px`,
            }}
          />
        ))}

        {/* ── Dynamic vibe background glow ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeVibeData && (
            <motion.div
              key={activeVibeData.id}
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div
                className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] bg-gradient-to-br ${activeVibeData.gradient} opacity-60`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Static ambient glows ─────────────────────────────────────── */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-950/15 blur-[100px] pointer-events-none" />

        <AnimatePresence mode="wait">

          {/* ────────────────── STEP 1: Vibe Selection ───────────────── */}
          {step === 'vibe' && (
            <motion.div
              key="step-vibe"
              className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-4xl w-full"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Logo */}
              <div className="flex flex-col items-center mt-16 mb-8 w-full px-4 overflow-visible">
                <h1
                  className="text-white leading-tight text-center select-none uppercase whitespace-nowrap flex justify-center items-baseline"
                  style={{ 
                    fontFamily: "'Syncopate', sans-serif", 
                    fontSize: 'clamp(4rem, 10.5vw, 12rem)', // Naturally wide font, so 10.5vw creates a massive span
                    letterSpacing: '-0.03em', // Tight, clean kerning
                    fontWeight: 700,
                    WebkitFontSmoothing: 'antialiased',
                  }}
                >
                  <span>K</span>
                  <span className="inline-block bg-white" style={{ width: '0.75em', height: '0.65em', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', margin: '0 0.04em' }} />
                  <span>DENCE</span>
                </h1>
                <p className="text-white/40 text-[10px] md:text-xs tracking-[0.6em] uppercase font-bold mt-2">Spotify Universe</p>
              </div>

              {/* Question */}
              <div className="text-center space-y-1">
                <h2
                  className="text-white text-2xl md:text-3xl font-light tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  What are you listening to?
                </h2>
                <p className="text-white/40 text-sm mt-2">Choose your editorial chart</p>
              </div>

              {/* Vibe grid */}
              <div className="grid gap-4 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {VIBE_CONFIGS.map((v, i) => {
                  const isActive = hoveredVibe === v.id || selectedVibe === v.id
                  return (
                    <motion.button
                      key={v.id}
                      id={`vibe-${v.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.5 }}
                      onHoverStart={() => handleHoverStart(v.id)}
                      onHoverEnd={handleHoverEnd}
                      onClick={() => handleVibeSelect(v.id)}
                      className="relative group flex flex-col justify-end p-4 rounded-[10px] overflow-hidden cursor-pointer text-left aspect-square outline-none"
                      style={{
                        backgroundColor: v.bgColor,
                        boxShadow: isActive ? `0 12px 24px -8px ${v.bgColor}` : 'none',
                        transform: isActive ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
                        filter: isActive ? 'brightness(1.08)' : 'brightness(1)',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
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
                        {isActive && previews[v.id] && previews[v.id].length > 0 && (
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
            </motion.div>
          )}

          {/* ────────────────── STEP 2: Loading / Universe Warming ───── */}
          {step === 'loading' && (
            <motion.div
              key="step-loading"
              className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-sm w-full text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.6 }}
            >
              {/* Pulsing vibe orb */}
              <div className="relative flex items-center justify-center w-16 h-16">
                {/* Outer pulse ring */}
                <div
                  className="absolute inset-0 rounded-full border border-white/20"
                  style={{ animation: 'kadence-pulse-ring 2.4s ease-in-out infinite' }}
                />
                {/* Second ring — offset phase */}
                <div
                  className="absolute inset-[-6px] rounded-full border border-white/10"
                  style={{ animation: 'kadence-pulse-ring 2.4s 0.8s ease-in-out infinite' }}
                />
                {/* Core dot */}
                <div className="w-3 h-3 rounded-full bg-white/70 blur-[1px]" />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <h2
                  className="text-white text-3xl font-black tracking-tighter"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Creating Your Universe
                </h2>

                {/* Animated phrase */}
                <div className="h-5 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phraseIdx}
                      className="text-white/40 text-xs tracking-widest uppercase absolute inset-0 flex items-center justify-center"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                    >
                      {currentPhrases[phraseIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress bar with shimmer */}
              <div className="w-full space-y-2">
                <div className="relative h-[2px] bg-white/8 rounded-full overflow-hidden">
                  {/* Fill */}
                  <motion.div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${activeVibeData ? activeVibeData.gradient : 'from-blue-500 to-purple-500'} rounded-full`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                  {/* Shimmer overlay — only visible while loading */}
                  {loadingProgress < 100 && (
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      style={{ animation: 'kadence-progress-shimmer 1.6s linear infinite' }}
                    />
                  )}
                </div>

                {/* Progress label */}
                <div className="flex items-center justify-between">
                  <p className="text-white/20 text-[10px] tracking-widest uppercase">
                    {loadingProgress < 60  ? 'Fetching tracks'    :
                     loadingProgress < 93  ? 'Loading artwork'    :
                     loadingProgress < 100 ? 'Warming universe'   : 'Ready'}
                  </p>
                  <p className="text-white/20 text-[10px] font-mono">
                    {Math.round(loadingProgress)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </>
  )
}
