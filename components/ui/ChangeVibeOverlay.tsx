'use client'
import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'
import { VIBE_CONFIGS, type VibeConfig } from '@/lib/vibeConfig'
import { useEffect, useRef, memo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChartHover } from '@/hooks/useChartHover'
import { GlassButton } from './GlassButton'

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
  vibe: VibeConfig
  index: number
  isActive: boolean
  isHovered: boolean
  signatureSong: (typeof import('@/lib/signatureSongs').SIGNATURE_SONGS)[Vibe]
  onHoverStart: (id: Vibe) => void
  onHoverEnd: () => void
  onSelect: (id: Vibe) => void
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)
  const isGold = vibe.id === 'dev-special'
  // Card fill and glow colour (Dev's Universe glows gold).
  const glow = isGold ? '#f5c542' : vibe.bgColor

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
      const mx = ((px + 0.5) * 100).toFixed(1)
      const my = ((py + 0.5) * 100).toFixed(1)

      el.style.setProperty('--tx', `${tx}px`)
      el.style.setProperty('--ty', `${ty}px`)
      el.style.setProperty('--rx', `${rx}deg`)
      el.style.setProperty('--ry', `${ry}deg`)
      el.style.setProperty('--mx', `${mx}%`)
      el.style.setProperty('--my', `${my}%`)
    })
  }

  const handlePointerLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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
      className="relative aspect-square kadence-3d-wrapper cursor-pointer"
      style={{ zIndex: isHovered ? 70 : undefined }}
      onClick={() => onSelect(vibe.id)}
    >
      <div
        ref={popRef}
        className="w-full h-full kadence-3d-pop cursor-pointer"
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }}
      >
        <button
          id={`vibe-modal-${vibe.id}`}
          onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }}
          className="kadence-3d-card relative group flex flex-col justify-end p-4 rounded-[20px] overflow-hidden cursor-pointer text-left outline-none w-full h-full select-none"
          style={{
            backgroundColor: glow,
            // Dev's Universe is the creator's pick: polished gold instead of its dark config colour.
            backgroundImage: isGold
              ? 'linear-gradient(135deg, #fff3b0 0%, #f7d46a 22%, #e0a92e 48%, #f9dc7a 70%, #b8860b 100%)'
              : undefined,
            ['--card-shadow-rest' as string]: isActive
              ? `0 34px 70px -4px ${glow}, 0 0 60px 15px ${glow}, 0 0 95px 25px ${glow}99, inset 0 2px 5px rgba(255,255,255,0.9)`
              : `0 24px 50px -6px ${glow}ee, 0 0 36px 6px ${glow}aa, inset 0 2px 4px rgba(255,255,255,0.75)`,
            ['--card-shadow-hover' as string]: `0 34px 70px -4px ${glow}, 0 0 60px 15px ${glow}, 0 0 95px 25px ${glow}99, inset 0 2px 5px rgba(255,255,255,0.9)`,
            filter: isActive ? 'brightness(1.15)' : 'brightness(1)',
            containerType: 'inline-size',
          }}
        >
          {/* ✨ FORCE FULL BOUNDING BOX CLICK TARGET ✨ */}
          <div className="absolute inset-0 w-full h-full z-[999] cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }} />

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

          {/* Large background number: sized from the card width (cqw) so it always fits inside
              the card, never bleeds off the edge, and stays clear of the title block. */}
          <span
            aria-hidden="true"
            className="absolute left-[14px] top-[10px] font-black text-black opacity-[0.3] pointer-events-none select-none"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '30cqw',
              lineHeight: 0.85,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
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
      {/* Flowing colour atmosphere (background only). Three oversized gradient sheets drift on
          slow, mutually prime CSS loops; `alternate` makes every loop reverse instead of resetting,
          so there is never a jump. Transform-only animation: the gradients rasterise once and the
          GPU just moves them. Unmounts with the overlay, so nothing runs while it is closed. */}
      <div aria-hidden="true" className="kcv-atmosphere pointer-events-none absolute inset-0 overflow-hidden">
        <div className="kcv-sheet kcv-sheet-a" />
        <div className="kcv-sheet kcv-sheet-b" />
        <div className="kcv-sheet kcv-sheet-c" />
        <div className="kcv-core" />
      </div>

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
          {/* Wide Syne title in plain white. */}
          <h2
            className="text-white text-3xl md:text-4xl uppercase select-none"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
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

        <GlassButton
          onClick={onClose}
          size="sm"
          contentClassName="px-6 py-2 text-white/80 hover:text-white text-xs tracking-wider uppercase font-medium"
        >
          Dismiss
        </GlassButton>
      </motion.div>

      {/* Replicate Homepage Card 3D CSS Classes for the Modal */}
      <style dangerouslySetInnerHTML={{
        __html: `
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

          /* ── Flowing colour atmosphere ──────────────────────────────────────────
             Softness comes from wide radial falloffs, not a blur filter, so nothing
             is re-blurred per frame. Sheets are 2x the viewport so their edges never
             come into view while they drift. */
          .kcv-atmosphere { z-index: 0; contain: strict; }
          .kcv-sheet {
            position: absolute;
            inset: -50%;
            will-change: transform;
            mix-blend-mode: screen;
            backface-visibility: hidden;
          }
          .kcv-sheet-a {
            opacity: 0.55;
            background:
              radial-gradient(28% 32% at 22% 30%, rgba(255, 106, 0, 0.85) 0%, rgba(255, 106, 0, 0) 100%),
              radial-gradient(30% 34% at 74% 26%, rgba(139, 0, 255, 0.8) 0%, rgba(139, 0, 255, 0) 100%),
              radial-gradient(26% 30% at 60% 76%, rgba(16, 200, 96, 0.7) 0%, rgba(16, 200, 96, 0) 100%);
            animation: kcv-drift-a 46s ease-in-out infinite alternate;
          }
          .kcv-sheet-b {
            opacity: 0.5;
            background:
              radial-gradient(30% 30% at 30% 72%, rgba(30, 77, 255, 0.85) 0%, rgba(30, 77, 255, 0) 100%),
              radial-gradient(26% 30% at 78% 64%, rgba(224, 16, 58, 0.8) 0%, rgba(224, 16, 58, 0) 100%),
              radial-gradient(24% 26% at 48% 22%, rgba(255, 179, 0, 0.6) 0%, rgba(255, 179, 0, 0) 100%);
            animation: kcv-drift-b 61s ease-in-out infinite alternate;
          }
          .kcv-sheet-c {
            opacity: 0.4;
            background:
              radial-gradient(26% 28% at 18% 52%, rgba(255, 0, 184, 0.75) 0%, rgba(255, 0, 184, 0) 100%),
              radial-gradient(28% 30% at 84% 40%, rgba(0, 179, 255, 0.75) 0%, rgba(0, 179, 255, 0) 100%);
            animation: kcv-drift-c 79s ease-in-out infinite alternate;
          }
          /* Keeps the middle dark so the menu and the coloured tiles stay readable. */
          .kcv-core {
            position: absolute;
            inset: 0;
            background: radial-gradient(60% 62% at 50% 50%, rgba(5, 5, 9, 0.82) 0%, rgba(5, 5, 9, 0.55) 48%, rgba(5, 5, 9, 0.12) 78%, rgba(5, 5, 9, 0) 100%);
          }
          /* Horizontal + diagonal travel; translate is a share of each sheet's own (2x) size. */
          @keyframes kcv-drift-a {
            0%   { transform: translate3d(-9%, -4%, 0) rotate(0deg); }
            50%  { transform: translate3d(4%, 5%, 0) rotate(8deg); }
            100% { transform: translate3d(10%, -3%, 0) rotate(-4deg); }
          }
          @keyframes kcv-drift-b {
            0%   { transform: translate3d(8%, 6%, 0) rotate(0deg); }
            50%  { transform: translate3d(-6%, -2%, 0) rotate(-10deg); }
            100% { transform: translate3d(-10%, 7%, 0) rotate(5deg); }
          }
          @keyframes kcv-drift-c {
            0%   { transform: translate3d(-4%, 8%, 0) rotate(0deg) scale(1); }
            50%  { transform: translate3d(7%, -6%, 0) rotate(12deg) scale(1.08); }
            100% { transform: translate3d(2%, 4%, 0) rotate(-6deg) scale(0.96); }
          }
          @media (prefers-reduced-motion: reduce) {
            .kcv-sheet { animation: none; }
          }
        `
      }} />
    </motion.div>
  )
}
