'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Lenis from 'lenis'
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
  const { hoveredVibe, handleHoverStart, handleHoverEnd, signatureSongs } = useChartHover()

  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)

  // ── Smooth Inertial Scrolling (Lenis) ──
  useEffect(() => {
    if (!scrollWrapperRef.current || !contentRef.current) return

    const lenis = new Lenis({
      wrapper: scrollWrapperRef.current,
      content: contentRef.current,
      lerp: 0.05, // Heavy, buttery smooth
      smoothWheel: true,
      wheelMultiplier: 0.9,
    })
    lenisRef.current = lenis

    let rafId: number
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

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
      'dev-special': ['The soundtrack behind Kadence…', 'Curated collection of tracks…', 'Powered late-night coding sessions…', 'Almost there…'],
      'top-telugu': ['Loading Tollywood blockbusters…', 'Tuning Telugu frequencies…', 'Fetching regional chart toppers…', 'Almost there…'],
      'top-tamil': ['Loading Kollywood hits…', 'Tuning Tamil frequencies…', 'Fetching chart toppers…', 'Almost there…'],
      'top-hindi': ['Loading Bollywood chart toppers…', 'Tuning desi frequencies…', 'Fetching Hindi hits…', 'Almost there…'],
      'top-kpop': ['Loading K-Pop universe…', 'Syncing Korean chart data…', 'Fetching the latest drops…', 'Almost there…'],
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
        ref={scrollWrapperRef as any}
        className="fixed inset-0 z-50 bg-transparent pointer-events-auto overflow-y-auto overflow-x-hidden scrollbar-hide"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* ── Floating particles (CSS-only, compositor thread) ─────────── */}
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className={`kadence-particle fixed rounded-full pointer-events-none transition-colors duration-700 ${activeVibeData?.id === 'dev-special' ? 'bg-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.8)]' : 'bg-white/30'}`}
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
              className="fixed inset-0 pointer-events-none"
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
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-950/15 blur-[100px] pointer-events-none" />

        <div ref={contentRef} className="w-full relative min-h-screen">
        <AnimatePresence mode="wait">

          {/* ────────────────── STEP 1: Vibe Selection ───────────────── */}
          {step === 'vibe' && (
            <motion.div
              key="step-vibe-container"
              className="relative w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              {/* EXACT ORIGINAL HERO LAYOUT - SECTION 1 */}
              <div className="relative w-full min-h-[100dvh] flex flex-col items-center justify-center pt-8 pb-16">
                <motion.div
                  className="z-10 flex flex-col items-center gap-10 px-4 max-w-[1200px] w-full mt-10"
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
              <div className="text-center space-y-1 mb-2">
                <h2
                  className="text-white text-2xl md:text-3xl font-light tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  What are you listening to?
                </h2>
                <p className="text-white/40 text-sm mt-2">Choose your editorial chart</p>
              </div>

              {/* Creator Collection Cue */}
              <div 
                className="flex flex-col items-center justify-center gap-1 cursor-pointer group z-20 transition-all duration-300 mb-8 bg-[#0A0A0A] border-[1.5px] border-[#D4AF37]/40 rounded-[40px] px-12 py-4 shadow-[0_0_40px_10px_rgba(212,175,55,0.15)] hover:-translate-y-[3px] hover:bg-[#111] hover:border-[#D4AF37] hover:shadow-[0_0_60px_15px_rgba(212,175,55,0.3)]"
                onClick={() => {
                  if (lenisRef.current) {
                    lenisRef.current.scrollTo('#creator-collection-section', {
                      duration: 1.8,
                      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
                    })
                  } else {
                    const section2 = document.getElementById('creator-collection-section');
                    if (section2) {
                      section2.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
              >
                <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#D4AF37]">
                  ✨ CREATOR'S PICK
                </span>
                <span className="text-[22px] font-[800] text-white tracking-tight mt-0.5 group-hover:text-[#D4AF37] transition-colors duration-300">
                  Explore Dev's Universe
                </span>
                <span className="text-[13px] text-white/50 font-semibold mt-0.5">
                  80 Handpicked Tracks
                </span>
              </div>

              {/* Vibe grid — strict 7×2 on desktop */}
              <div className="grid gap-3 w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {VIBE_CONFIGS.filter(v => v.id !== 'dev-special').map((v, i) => {
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
                      className="relative group flex flex-col justify-end p-4 rounded-[10px] overflow-hidden cursor-pointer text-left outline-none aspect-square"
                      style={{
                        backgroundColor: v.bgColor,
                        boxShadow: isActive 
                          ? `0 0 40px 10px ${v.bgColor}, inset 0 0 20px ${v.bgColor}` 
                          : `0 0 20px 2px ${v.bgColor}80, inset 0 0 10px ${v.bgColor}80`,
                        transform: isActive ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
                        filter: isActive ? 'brightness(1.15)' : 'brightness(1)',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      {/* Geometric overlay pattern */}
                      <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                      
                      {/* Large background number */}
                      <span className="absolute top-[-18px] left-[-6px] text-[100px] font-black text-black opacity-[0.35] tracking-tighter leading-none pointer-events-none select-none">
                        {v.number}
                      </span>

                      {/* Badge */}
                      {v.badge && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded backdrop-blur-md text-[10px] font-extrabold tracking-widest shadow-sm bg-black text-white">
                          {v.badge}
                        </div>
                      )}
                      
                      {/* Text */}
                      <div className="relative z-10 w-full mt-auto translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <span
                          className="block text-black font-[800] text-base md:text-[20px] leading-tight mb-1"
                          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                        >
                          {v.label}
                        </span>
                        <span className="block text-black/90 text-[10px] uppercase font-bold tracking-wider leading-tight">
                          {v.sub}
                        </span>
                      </div>

                      {/* Song Preview Overlay */}
                      <AnimatePresence>
                        {isActive && signatureSongs[v.id] && (
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
                                className="w-7 h-7 rounded-full bg-[#1db954] flex items-center justify-center shrink-0 hover:scale-110 transition-transform"
                                title="Listen Now on Spotify"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="black">
                                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.978-.335.076-.668-.135-.744-.47-.076-.335.135-.668.47-.744 3.856-.88 7.15-.506 9.822 1.13.295.18.387.563.206.855zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.344 1.334.367.227.487.708.26 1.08zm.105-2.833C14.852 8.94 9.773 8.77 6.83 9.664c-.475.144-.974-.124-1.118-.6-.144-.475.124-.974.6-1.118 3.39-1.03 9.002-.835 12.593 1.297.427.253.567.808.314 1.235-.252.427-.808.567-1.235.314z"/>
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
              </motion.div>

              </div>

              {/* Creator Collection Section - SECTION 2 */}
              {(() => {
                const devSpecialVibe = VIBE_CONFIGS.find(v => v.id === 'dev-special')
                if (!devSpecialVibe) return null
                const isActive = hoveredVibe === devSpecialVibe.id || selectedVibe === devSpecialVibe.id
                
                return (
                  <div id="creator-collection-section" className="w-full min-h-[80dvh] flex flex-col items-center justify-center pb-32 pt-40">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      className="flex flex-col items-center w-full px-6 max-w-4xl"
                    >
                      <div className="text-center mb-10">
                        <h3 className="text-[#d4af37] text-sm md:text-base font-bold tracking-[0.3em] uppercase mb-2">Creator Collection</h3>
                        <p className="text-white/40 text-xs tracking-widest uppercase">A personal universe curated by Dev</p>
                      </div>
                    
                    <motion.button
                      id={`vibe-${devSpecialVibe.id}`}
                      onHoverStart={() => handleHoverStart(devSpecialVibe.id)}
                      onHoverEnd={handleHoverEnd}
                      onClick={() => handleVibeSelect(devSpecialVibe.id)}
                      className="relative group flex flex-col justify-end p-8 rounded-[20px] overflow-hidden cursor-pointer text-left outline-none w-full max-w-[420px] h-[240px] border border-[#d4af37]/60 mx-auto shadow-2xl"
                      style={{
                        backgroundColor: devSpecialVibe.bgColor,
                        boxShadow: isActive
                          ? '0 0 80px rgba(212,175,55,0.7), inset 0 0 50px rgba(212,175,55,0.3)' 
                          : '0 0 30px rgba(212, 175, 55, 0.2)',
                        transform: isActive ? 'scale(1.03) translateY(-8px)' : 'scale(1)',
                        filter: isActive ? 'brightness(1.2)' : 'brightness(1)',
                        transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                      }}
                    >
                      {/* Animated shimmer overlay */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-[#d4af37]/25 to-transparent -translate-x-full group-hover:animate-[kadence-progress-shimmer_1.5s_infinite] pointer-events-none" />
                      
                      {/* Geometric overlay pattern */}
                      <div className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                      
                      {/* Large background number */}
                      <span className="absolute top-[-20px] left-[0px] text-[120px] font-black text-[#d4af37] opacity-[0.08] tracking-tighter leading-none pointer-events-none select-none">
                        {devSpecialVibe.number}
                      </span>

                      {/* Badge */}
                      {devSpecialVibe.badge && (
                        <div className="absolute top-5 right-5 px-3 py-1 rounded backdrop-blur-md text-[10px] font-bold tracking-widest shadow-sm bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40">
                          {devSpecialVibe.badge}
                        </div>
                      )}
                      
                      {/* Text */}
                      <div className="relative z-10 w-full mt-auto translate-y-2 group-hover:translate-y-0 transition-transform duration-400">
                        <span
                          className="block text-white font-bold text-lg md:text-xl leading-tight mb-1"
                          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                        >
                          {devSpecialVibe.label}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-white/70 text-[10px] md:text-xs uppercase font-bold tracking-wider leading-tight">
                            {devSpecialVibe.sub}
                          </span>
                          <span className="text-[#d4af37] text-[10px] md:text-xs font-bold tracking-[0.1em] uppercase">
                            • 80 handpicked tracks
                          </span>
                        </div>
                      </div>

                      {/* Song Preview Overlay */}
                      <AnimatePresence>
                        {isActive && signatureSongs[devSpecialVibe.id] && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 z-20 flex flex-col justify-end p-4 overflow-hidden bg-black/80"
                          >
                            <motion.img 
                              key={`img-${signatureSongs[devSpecialVibe.id].id}`}
                              src={signatureSongs[devSpecialVibe.id].albumArt} 
                              className="absolute inset-0 w-full h-full object-cover opacity-50 blur-[3px]" 
                              alt=""
                              initial={{ opacity: 0, scale: 1.1 }}
                              animate={{ opacity: 0.5, scale: 1 }}
                              transition={{ duration: 0.6 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                            
                            <motion.div 
                              key={`info-${signatureSongs[devSpecialVibe.id].id}`}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4 }}
                              className="relative z-10 flex items-end justify-between w-full"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-[#d4af37] font-bold text-sm truncate leading-tight">{signatureSongs[devSpecialVibe.id].name}</p>
                                <p className="text-white/80 text-xs truncate mt-0.5">{signatureSongs[devSpecialVibe.id].artist}</p>
                              </div>
                              <a
                                href={signatureSongs[devSpecialVibe.id].spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-8 h-8 rounded-full bg-[#1db954] flex items-center justify-center shrink-0 hover:scale-110 transition-transform shadow-lg"
                                title="Listen Now on Spotify"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="black">
                                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.978-.335.076-.668-.135-.744-.47-.076-.335.135-.668.47-.744 3.856-.88 7.15-.506 9.822 1.13.295.18.387.563.206.855zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.344 1.334.367.227.487.708.26 1.08zm.105-2.833C14.852 8.94 9.773 8.77 6.83 9.664c-.475.144-.974-.124-1.118-.6-.144-.475.124-.974.6-1.118 3.39-1.03 9.002-.835 12.593 1.297.427.253.567.808.314 1.235-.252.427-.808.567-1.235.314z"/>
                                </svg>
                              </a>
                            </motion.div>
                            
                            {signatureSongs[devSpecialVibe.id].previewUrl && (
                              <div className="relative z-10 w-full h-[2px] bg-white/20 rounded-full mt-3 overflow-hidden">
                                <motion.div 
                                  key={`progress-${signatureSongs[devSpecialVibe.id].id}`}
                                  className="absolute top-0 left-0 bottom-0 bg-[#d4af37]"
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
                    </motion.div>
                  </div>
                )
              })()}
            </motion.div>
          )}

          {/* ────────────────── STEP 2: Loading / Universe Warming ───── */}
          {step === 'loading' && (
            <div key="step-loading-container" className="absolute top-[50dvh] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center">
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
            </div>
          )}

        </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
