'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef } from 'react'
import { Vibe } from '@/lib/types'
import { useChartHover } from '@/hooks/useChartHover'

import { VIBE_CONFIGS, VibeConfig } from '@/lib/vibeConfig'
import { GlowingRingLoader } from './GlowingRingLoader'

interface IntroScreenProps {
  loadingProgress?: number
  onVibeSelect: (vibe: Vibe) => void
}

// ── 3D Bubble Pop Card for the 14 Homepage Editorial Grid Tracks ──
function HomepageVibeCard({
  vibe,
  index,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  vibe: VibeConfig
  index: number
  isHovered: boolean
  onHoverStart: (id: Vibe) => void
  onHoverEnd: () => void
  onSelect: (id: Vibe) => void
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const handlePointerEnter = () => {
    if (popRef.current) {
      rectRef.current = popRef.current.getBoundingClientRect()
    }
    onHoverStart(vibe.id)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = popRef.current
    if (!el) return
    let rect = rectRef.current
    if (!rect) {
      rect = el.getBoundingClientRect()
      rectRef.current = rect
    }
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Subtle magnetic attraction + responsive physical 3D tilt
    const tx = (px * 14).toFixed(1)
    const ty = (py * 14).toFixed(1)
    const rx = (-py * 20).toFixed(2)
    const ry = (px * 20).toFixed(2)
    const mx = ((px + 0.5) * 100).toFixed(1)
    const my = ((py + 0.5) * 100).toFixed(1)

    el.style.setProperty('--tx', `${tx}px`)
    el.style.setProperty('--ty', `${ty}px`)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--mx', `${mx}%`)
    el.style.setProperty('--my', `${my}%`)
  }

  const handlePointerLeave = () => {
    rectRef.current = null
    const el = popRef.current
    if (!el) return
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
    onHoverEnd()
  }

  return (
    <motion.div
      key={vibe.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.45 }}
      className="relative aspect-square kadence-3d-wrapper"
      style={{ zIndex: isHovered ? 70 : undefined }}
    >
      <div
        ref={popRef}
        className="w-full h-full kadence-3d-pop"
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <button
          id={`vibe-${vibe.id}`}
          onClick={() => onSelect(vibe.id)}
          className="kadence-3d-card relative group flex flex-col justify-end p-4 rounded-[20px] overflow-hidden cursor-pointer text-left outline-none w-full h-full select-none"
          style={{
            backgroundColor: vibe.bgColor,
            ['--card-shadow-rest' as string]: `0 24px 50px -6px ${vibe.bgColor}ee, 0 0 36px 6px ${vibe.bgColor}aa, inset 0 2px 4px rgba(255,255,255,0.75)`,
            ['--card-shadow-hover' as string]: `0 34px 70px -4px ${vibe.bgColor}, 0 0 60px 15px ${vibe.bgColor}, 0 0 95px 25px ${vibe.bgColor}99, inset 0 2px 5px rgba(255,255,255,0.9)`,
          }}
        >
          {/* Subtle glossy 3D sheen overlay following cursor */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.18) 38%, transparent 68%)',
            }}
          />

          {/* Geometric overlay pattern */}
          <div
            className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '12px 12px',
            }}
          />

          {/* Large background number */}
          <span className="absolute top-[-16px] left-[-4px] text-[96px] font-black text-black opacity-[0.35] tracking-tighter leading-none pointer-events-none select-none">
            {vibe.number}
          </span>

          {/* Badge */}
          {vibe.badge && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-[6px] backdrop-blur-md text-[10px] font-extrabold tracking-widest shadow-sm bg-black text-white pointer-events-none">
              {vibe.badge}
            </div>
          )}

          {/* Text */}
          <div className="relative z-10 w-full mt-auto pointer-events-none">
            <span
              className="block text-black font-[800] text-base md:text-[20px] leading-tight mb-1"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {vibe.label}
            </span>
            <span className="block text-black/90 text-[10px] uppercase font-bold tracking-wider leading-tight">
              {vibe.sub}
            </span>
          </div>
        </button>
      </div>
    </motion.div>
  )
}

// ── 3D Bubble Pop Cue Button for Creator Collection ──
function CreatorCueCard({ onClick }: { onClick: () => void }) {
  const cueRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const handlePointerEnter = () => {
    if (cueRef.current) {
      rectRef.current = cueRef.current.getBoundingClientRect()
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cueRef.current
    if (!el) return
    let rect = rectRef.current
    if (!rect) {
      rect = el.getBoundingClientRect()
      rectRef.current = rect
    }
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Subtle magnetic attraction + responsive 3D tilt
    const tx = (px * 16).toFixed(1)
    const ty = (py * 10).toFixed(1)
    const rx = (-py * 16).toFixed(2)
    const ry = (px * 16).toFixed(2)
    const mx = ((px + 0.5) * 100).toFixed(1)
    const my = ((py + 0.5) * 100).toFixed(1)

    el.style.setProperty('--tx', `${tx}px`)
    el.style.setProperty('--ty', `${ty}px`)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--mx', `${mx}%`)
    el.style.setProperty('--my', `${my}%`)
  }

  const handlePointerLeave = () => {
    rectRef.current = null
    const el = cueRef.current
    if (!el) return
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  }

  return (
    <div
      className="kadence-dev-cue-wrapper mb-8 cursor-pointer"
      onClick={onClick}
    >
      <div
        ref={cueRef}
        className="kadence-dev-cue-pop cursor-pointer"
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={onClick}
      >
        <button
          type="button"
          id="explore-dev-universe-btn"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className="kadence-dev-cue-card relative group flex flex-col items-center justify-center gap-0.5 cursor-pointer rounded-[44px] px-12 py-4 select-none overflow-hidden outline-none w-full"
          style={{
            background: 'linear-gradient(135deg, #FFF9A6 0%, #FFDF00 22%, #FFC400 52%, #FFA000 82%, #FF8F00 100%)',
          }}
        >
          {/* Subtle glossy 3D sheen overlay following cursor */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-85 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.2) 35%, transparent 65%)',
            }}
          />

          {/* Top gloss curve highlight */}
          <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-white/35 via-white/10 to-transparent rounded-t-[44px] pointer-events-none" />

          {/* CREATOR'S PICK with Silver Chrome metallic gradient and consistent ✦ sparkle */}
          <span className="kadence-chrome-text text-[11px] uppercase tracking-[0.26em] font-[900] pointer-events-none z-10 select-none">
            <span className="mr-1.5 text-[10px]">✦</span>CREATOR'S PICK
          </span>

          {/* Title: Explore Dev's Universe in pure #000000 bold */}
          <span
            className="text-[22px] font-[900] text-[#000000] tracking-tight pointer-events-none z-10 leading-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Explore Dev's Universe
          </span>

          {/* 80 HANDPICKED TRACKS with Silver Chrome metallic gradient */}
          <span className="kadence-chrome-text text-[11px] uppercase tracking-[0.22em] font-[800] pointer-events-none z-10 mt-0.5 select-none">
            80 Handpicked Tracks
          </span>
        </button>
      </div>
    </div>
  )
}

// ── 3D Bubble Pop Card for Section 2 Creator Collection (Dev's Special) ──
function CreatorCollectionCard({
  vibe,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  vibe: VibeConfig
  isHovered: boolean
  onHoverStart: (id: Vibe) => void
  onHoverEnd: () => void
  onSelect: (id: Vibe) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const handlePointerEnter = () => {
    if (cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect()
    }
    onHoverStart(vibe.id)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    let rect = rectRef.current
    if (!rect) {
      rect = el.getBoundingClientRect()
      rectRef.current = rect
    }
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Subtle magnetic attraction + responsive 3D tilt
    const tx = (px * 16).toFixed(1)
    const ty = (py * 12).toFixed(1)
    const rx = (-py * 20).toFixed(2)
    const ry = (px * 20).toFixed(2)
    const mx = ((px + 0.5) * 100).toFixed(1)
    const my = ((py + 0.5) * 100).toFixed(1)

    el.style.setProperty('--tx', `${tx}px`)
    el.style.setProperty('--ty', `${ty}px`)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--mx', `${mx}%`)
    el.style.setProperty('--my', `${my}%`)
  }

  const handlePointerLeave = () => {
    rectRef.current = null
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
    onHoverEnd()
  }

  return (
    <div
      className="kadence-dev-sec2-wrapper w-full max-w-[440px] mx-auto"
      style={{ zIndex: isHovered ? 70 : undefined }}
    >
      <div
        ref={cardRef}
        className="kadence-dev-sec2-pop w-full"
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <button
          id={`vibe-${vibe.id}`}
          onClick={() => onSelect(vibe.id)}
          className="kadence-dev-sec2-card relative group flex flex-col justify-end p-8 rounded-[24px] overflow-hidden cursor-pointer text-left outline-none w-full h-[240px] border border-[#d4af37]/60 select-none"
          style={{
            backgroundColor: vibe.bgColor,
          }}
        >
          {/* Subtle glossy 3D sheen overlay following cursor */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.4) 0%, rgba(212,175,55,0.15) 45%, transparent 70%)',
            }}
          />

          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-[#d4af37]/25 to-transparent -translate-x-full group-hover:animate-[kadence-progress-shimmer_1.5s_infinite] pointer-events-none" />

          {/* Geometric overlay pattern */}
          <div
            className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '12px 12px',
            }}
          />

          {/* Large background number */}
          <span className="absolute top-[-20px] left-[0px] text-[120px] font-black text-[#d4af37] opacity-[0.08] tracking-tighter leading-none pointer-events-none select-none">
            {vibe.number}
          </span>

          {/* Badge */}
          {vibe.badge && (
            <div className="absolute top-5 right-5 px-3 py-1 rounded-[8px] backdrop-blur-md text-[10px] font-bold tracking-widest shadow-sm bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 pointer-events-none">
              {vibe.badge}
            </div>
          )}

          {/* Text */}
          <div className="relative z-10 w-full mt-auto pointer-events-none">
            <span
              className="block text-white font-[800] text-xl md:text-2xl leading-tight mb-1"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {vibe.label}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/70 text-[10px] md:text-xs uppercase font-bold tracking-wider leading-tight">
                {vibe.sub}
              </span>
              <span className="text-[#d4af37] text-[10px] md:text-xs font-bold tracking-[0.1em] uppercase">
                • 80 handpicked tracks
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

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

export function IntroScreen({ onVibeSelect }: IntroScreenProps) {
  const [step, setStep]               = useState<'vibe' | 'loading'>('vibe')
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null)

  // ── Chart Hover Preview ──
  const { hoveredVibe, handleHoverStart, handleHoverEnd, signatureSongs } = useChartHover()

  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  function handleVibeSelect(vibe: Vibe) {
    setSelectedVibe(vibe)
    setStep('loading')
    onVibeSelect(vibe)
  }

  const scrollToCreatorCollection = () => {
    const section2 = document.getElementById('creator-collection-section')
    const container = scrollWrapperRef.current
    if (section2 && container) {
      const containerRect = container.getBoundingClientRect()
      const sectionRect = section2.getBoundingClientRect()
      const targetTop = container.scrollTop + (sectionRect.top - containerRect.top)
      container.scrollTo({ top: targetTop, behavior: 'smooth' })
    } else if (section2) {
      section2.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const activeVibeData = VIBE_CONFIGS.find(v => v.id === hoveredVibe) ?? VIBE_CONFIGS.find(v => v.id === selectedVibe)

  return (
    <>
      {/* ── CSS keyframes & 3D transforms (GPU-compositor-only) ── */}
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

        /* ── Metallic Silver Chrome Text Treatment ── */
        .kadence-chrome-text {
          background: linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 18%, #64748B 46%, #1E293B 52%, #94A3B8 75%, #FFFFFF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
          display: inline-flex;
          align-items: center;
          filter: drop-shadow(0 1px 0px rgba(255, 255, 255, 0.65)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
        }

        /* ── 3D Bubble Pop & Tilt for Homepage Grid Cards ── */
        .kadence-3d-wrapper {
          perspective: 850px;
          transform-style: preserve-3d;
          position: relative;
          z-index: 1;
          transition: z-index 0s 0.45s;
        }
        .kadence-3d-wrapper:hover,
        .kadence-3d-wrapper:focus-within {
          z-index: 60;
          transition: z-index 0s 0s;
        }

        .kadence-3d-pop {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
          transition: transform 0.45s cubic-bezier(0.34, 1.35, 0.64, 1);
        }
        .kadence-3d-wrapper:hover .kadence-3d-pop {
          will-change: transform;
          transform: translate3d(0, -14px, 60px) scale3d(1.16, 1.16, 1.16);
          transition: transform 0.32s cubic-bezier(0.34, 1.65, 0.64, 1);
        }

        .kadence-3d-card {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          box-shadow: var(--card-shadow-rest);
          transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.35s cubic-bezier(0.34, 1.5, 0.64, 1), filter 0.3s ease;
        }
        .kadence-3d-wrapper:hover .kadence-3d-card {
          will-change: transform, box-shadow, filter;
          transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.34, 1.5, 0.64, 1), filter 0.3s ease;
          box-shadow: var(--card-shadow-hover);
          filter: brightness(1.22);
        }

        /* ── 3D Bubble Pop & Magnetic Cue Button (Explore Dev's Universe) ── */
        .kadence-dev-cue-wrapper {
          perspective: 850px;
          transform-style: preserve-3d;
          position: relative;
          z-index: 20;
        }
        .kadence-dev-cue-pop {
          transform-style: preserve-3d;
          transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
          transition: transform 0.45s cubic-bezier(0.34, 1.35, 0.64, 1);
        }
        .kadence-dev-cue-wrapper:hover .kadence-dev-cue-pop {
          will-change: transform;
          transform: translate3d(0, -8px, 45px) scale3d(1.08, 1.08, 1.08);
          transition: transform 0.32s cubic-bezier(0.34, 1.65, 0.64, 1);
        }
        .kadence-dev-cue-card {
          transform-style: preserve-3d;
          transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          border: 1.5px solid rgba(255, 255, 255, 0.75);
          box-shadow: 
            0 10px 35px rgba(255, 180, 0, 0.45),
            0 0 45px 8px rgba(255, 215, 0, 0.35),
            0 0 16px 2px rgba(255, 240, 100, 0.5),
            inset 0 2px 3px rgba(255, 255, 255, 0.85),
            inset 0 -2px 3px rgba(180, 110, 0, 0.35);
          transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.35s ease, border-color 0.3s ease;
        }
        .kadence-dev-cue-wrapper:hover .kadence-dev-cue-card {
          will-change: transform, box-shadow, border-color;
          border-color: rgba(255, 255, 255, 0.95);
          box-shadow: 
            0 16px 55px 10px rgba(255, 180, 0, 0.75),
            0 0 70px 18px rgba(255, 215, 0, 0.6),
            0 0 28px 6px rgba(255, 245, 120, 0.85),
            inset 0 2px 4px rgba(255, 255, 255, 0.95),
            inset 0 -2px 4px rgba(180, 110, 0, 0.45);
          transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.3s ease;
        }

        /* ── 3D Bubble Pop & Magnetic Section 2 Card ── */
        .kadence-dev-sec2-wrapper {
          perspective: 1000px;
          transform-style: preserve-3d;
          position: relative;
          z-index: 10;
        }
        .kadence-dev-sec2-pop {
          width: 100%;
          transform-style: preserve-3d;
          transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
          transition: transform 0.5s cubic-bezier(0.34, 1.35, 0.64, 1);
        }
        .kadence-dev-sec2-wrapper:hover .kadence-dev-sec2-pop {
          will-change: transform;
          transform: translate3d(0, -14px, 60px) scale3d(1.10, 1.10, 1.10);
          transition: transform 0.35s cubic-bezier(0.34, 1.65, 0.64, 1);
        }
        .kadence-dev-sec2-card {
          transform-style: preserve-3d;
          transform: translate3d(var(--tx, 0px), var(--ty, 0px), 0px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          box-shadow: 0 15px 45px rgba(212, 175, 55, 0.4), 0 0 35px 6px rgba(212, 175, 55, 0.3);
          transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.35s ease, filter 0.3s ease;
        }
        .kadence-dev-sec2-wrapper:hover .kadence-dev-sec2-card {
          will-change: transform, box-shadow, filter;
          transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, filter 0.3s ease;
          box-shadow: 0 32px 85px rgba(212, 175, 55, 0.8), 0 0 75px 18px rgba(212, 175, 55, 0.6), inset 0 0 35px rgba(212, 175, 55, 0.35);
          filter: brightness(1.22);
        }
      `}</style>

      {/* ── Fixed Ambient Background Layer (Compositor-isolated, 0 scroll overhead) ── */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      >
        {/* Floating particles */}
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className={`kadence-particle absolute rounded-full pointer-events-none transition-colors duration-700 ${activeVibeData?.id === 'dev-special' ? 'bg-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.8)]' : 'bg-white/30'}`}
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

        {/* Dynamic vibe background glow */}
        <AnimatePresence mode="wait">
          {activeVibeData && (
            <motion.div
              key={activeVibeData.id}
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[45px] bg-gradient-to-br ${activeVibeData.gradient} opacity-50`}
                style={{ contain: 'paint' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Static ambient glows */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-blue-950/20 blur-[40px] pointer-events-none"
          style={{ contain: 'paint' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[280px] h-[280px] rounded-full bg-purple-950/15 blur-[35px] pointer-events-none"
          style={{ contain: 'paint' }}
        />
      </div>

      {/* ── Native, Butter-Smooth 60/120 FPS Scroll Container ── */}
      <div
        ref={scrollWrapperRef}
        className="fixed inset-0 z-50 bg-transparent pointer-events-auto overflow-y-auto overflow-x-hidden scrollbar-hide"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div ref={contentRef} className="w-full relative min-h-screen">
        <AnimatePresence>

          {/* ────────────────── STEP 1: Vibe Selection ───────────────── */}
          {step === 'vibe' && (
            <motion.div
              key="step-vibe-container"
              className="relative w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                <p className="text-white/40 text-[10px] md:text-xs tracking-[0.6em] uppercase font-bold mt-2">iTunes Universe</p>
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

              {/* Creator Collection Cue with 3D Bubble Pop & Magnetic Nav */}
              <CreatorCueCard onClick={scrollToCreatorCollection} />

              {/* Vibe grid — strict 7×2 on desktop with 3D Bubble Pop Hover */}
              <div className="grid gap-3 w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {VIBE_CONFIGS.filter(v => v.id !== 'dev-special').map((v, i) => (
                  <HomepageVibeCard
                    key={v.id}
                    vibe={v}
                    index={i}
                    isHovered={hoveredVibe === v.id}
                    onHoverStart={handleHoverStart}
                    onHoverEnd={handleHoverEnd}
                    onSelect={handleVibeSelect}
                  />
                ))}
              </div>
              </motion.div>

              </div>

              {/* Creator Collection Section - SECTION 2 with 3D Bubble Pop */}
              {(() => {
                const devSpecialVibe = VIBE_CONFIGS.find(v => v.id === 'dev-special')
                if (!devSpecialVibe) return null
                
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
                    
                      <CreatorCollectionCard
                        vibe={devSpecialVibe}
                        isHovered={hoveredVibe === devSpecialVibe.id}
                        onHoverStart={handleHoverStart}
                        onHoverEnd={handleHoverEnd}
                        onSelect={handleVibeSelect}
                      />
                    </motion.div>
                  </div>
                )
              })()}
            </motion.div>
          )}

          {/* ────────────────── STEP 2: Loading / Universe Warming ───── */}
          {step === 'loading' && (
            <GlowingRingLoader size={340} />
          )}

        </AnimatePresence>
        </div>
      </div>
    </>
  )
}
