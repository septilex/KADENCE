'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Vibe } from '@/lib/types'
import { useChartHover, CATEGORY_PREVIEW_VIDEOS } from '@/hooks/useChartHover'
import { vibeService } from '@/lib/vibeService'

import { VIBE_CONFIGS, VibeConfig } from '@/lib/vibeConfig'
import { GlowingRingLoader } from './GlowingRingLoader'

interface IntroScreenProps {
  loadingProgress?: number
  onVibeSelect: (vibe: Vibe) => void
}

// ── 3D Bubble Pop Card for the 14 Homepage Editorial Grid Tracks ──
const HomepageVibeCard = memo(function HomepageVibeCard({
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
          id={`vibe-${vibe.id}`}
          onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }}
          className="kadence-3d-card relative group flex flex-col justify-end p-4 rounded-[20px] overflow-hidden cursor-pointer text-left outline-none w-full h-full select-none"
          style={{
            backgroundColor: vibe.bgColor,
            ['--card-shadow-rest' as string]: `0 24px 50px -6px ${vibe.bgColor}ee, 0 0 36px 6px ${vibe.bgColor}aa, inset 0 2px 4px rgba(255,255,255,0.75)`,
            ['--card-shadow-hover' as string]: `0 34px 70px -4px ${vibe.bgColor}, 0 0 60px 15px ${vibe.bgColor}, 0 0 95px 25px ${vibe.bgColor}99, inset 0 2px 5px rgba(255,255,255,0.9)`,
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
})

// ── 3D Bubble Pop Cue Button for Creator Collection ──
function CreatorCueCard({
  onClick,
  onHoverStart,
  onHoverEnd,
}: {
  onClick: () => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
}) {
  const cueRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const handlePointerEnter = () => {
    if (cueRef.current) {
      rectRef.current = cueRef.current.getBoundingClientRect()
    }
    onHoverStart?.()
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
    onHoverEnd?.()
  }

  return (
    <div
      className="kadence-dev-cue-wrapper mb-8 cursor-pointer w-full max-w-fit mx-auto"
      onClick={onClick}
    >
      <div
        ref={cueRef}
        className="kadence-dev-cue-pop cursor-pointer w-full h-full"
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <button
          type="button"
          id="explore-dev-universe-btn"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className="kadence-dev-cue-card relative group flex flex-col items-center justify-center gap-0.5 cursor-pointer rounded-[44px] px-12 py-4 select-none overflow-hidden outline-none w-full h-full"
          style={{
            background: 'linear-gradient(135deg, #FFF9A6 0%, #FFDF00 22%, #FFC400 52%, #FFA000 82%, #FF8F00 100%)',
          }}
        >
          {/* ✨ FORCE FULL BOUNDING BOX CLICK TARGET ✨ */}
          <div className="absolute inset-0 w-full h-full z-[999] cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }} />

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
      className="kadence-dev-sec2-wrapper w-full max-w-[440px] mx-auto cursor-pointer"
      style={{ zIndex: isHovered ? 70 : undefined }}
      onClick={() => onSelect(vibe.id)}
    >
      <div
        ref={cardRef}
        className="kadence-dev-sec2-pop w-full h-full cursor-pointer"
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }}
      >
        <button
          id={`vibe-${vibe.id}`}
          onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }}
          className="kadence-dev-sec2-card relative group flex flex-col justify-end p-8 rounded-[24px] overflow-hidden cursor-pointer text-left outline-none w-full h-[240px] border border-[#d4af37]/60 select-none"
          style={{
            backgroundColor: vibe.bgColor,
          }}
        >
          {/* ✨ FORCE FULL BOUNDING BOX CLICK TARGET ✨ */}
          <div className="absolute inset-0 w-full h-full z-[999] cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect(vibe.id); }} />

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

// ── Zoom/Crop Configuration for Hardcoded Letterbox Videos ─────────────────
// The 8 specified categories whose local 30s clips have baked-in letterbox bars.
// Applying targeted, minimal scale values crops out the black bars while preserving
// natural cinematic framing and 100% full-viewport coverage without distortion.
const ZOOMED_CATEGORIES = new Set([
  'Pop Rising',
  'Dance Hits',
  'Mood Booster',
  'Late Night',
  'Top Telugu',
  'Top Tamil',
  'Top Hindi',
  'Top K-Pop',
])

const CATEGORY_ZOOM_SCALES: Record<string, number> = {
  '/videos/Kiss Kiss Bang Bang_30s.mp4':    1.37, // 05 — Pop Rising (Omi Ba Pop / 2.40:1)
  '/videos/Yeshanagula_30s.mp4':            1.37, // 06 — Dance Hits (Yeshanagula / 2.40:1)
  '/videos/Sunflower_30s.mp4':             1.37, // 07 — Mood Booster (Sunflower / 2.39:1)
  '/videos/One Of The Girls_30s.mp4':       1.16, // 08 — Late Night (Roses / 2:1 Univisium)
  '/videos/God Mode_30s.mp4':               1.35, // Dev Special (God Mode / 2.40:1)
  "/videos/Baby Won't You Tell Me_30s.mp4": 1.35, // 11 — Top Telugu (Baby Don't You Love Me / 2.35:1)
  '/videos/Monica_30s.mp4':                1.37, // 12 — Top Tamil (Monica / 2.40:1)
  '/videos/Gehra Hua_30s.mp4':              1.38, // 13 — Top Hindi (Gehra Hua / 2.40:1)
  '/videos/Dynamite_30s.mp4':               1.35, // 14 — Top K-Pop (Dynamite / 2.35:1)
}

function getCategoryVideoScale(url: string | null): number {
  if (!url) return 1
  return CATEGORY_ZOOM_SCALES[url] ?? 1
}
// All unique video URLs for the persistent pool — computed once at module level.
// Used by CategoryVideoBackground to pre-create one <video> per category MP4.
const ALL_POOL_URLS: string[] = Object.values(CATEGORY_PREVIEW_VIDEOS).filter((v): v is string => Boolean(v))

// ── Full-Screen Category Video Background ─────────────────────────────────
// Persistent video pool: 15 <video> elements, each permanently bound to one MP4.
// On hover, we show/play the target and hide/pause the previous — no src swap,
// no re-initialization, no repeated decode. Videos start with preload="none"
// (zero network cost) and are promoted to preload="auto" lazily.
function CategoryVideoBackground({ url }: { url: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const poolRef = useRef<Map<string, HTMLVideoElement> | null>(null)
  const activeUrlRef = useRef<string | null>(null)
  const isAudioBlocked = useRef(false)

  // ── Create persistent video pool on mount ────────────────────────────────
  // Each video element is created once, permanently bound to its MP4 src.
  // Initial preload="none" means zero network requests at page load.
  useEffect(() => {
    const container = containerRef.current
    if (!container || poolRef.current) return

    const pool = new Map<string, HTMLVideoElement>()
    for (const videoUrl of ALL_POOL_URLS) {
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.preload = 'none'
      video.style.cssText = [
        'position:absolute',
        'top:0', 'left:0', 'width:100%', 'height:100%',
        'object-fit:cover',
        'display:none',
        `transform:translate3d(0,0,0) scale(${getCategoryVideoScale(videoUrl)})`,
        'transform-origin:center center',
      ].join(';')
      container.appendChild(video)
      pool.set(videoUrl, video)
    }
    poolRef.current = pool

    // ── Progressive background preloading ─────────────────────────────────
    // After 3s page idle, promote one video every 800ms from preload="none"
    // to preload="auto". This spreads network load over ~12 seconds and lets
    // the browser buffer initial frames without blocking initial page render.
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    const preloadDelay = setTimeout(() => {
      if (cancelled) return
      let idx = 0
      intervalId = setInterval(() => {
        // Skip videos already promoted by hover or earlier iterations
        while (idx < ALL_POOL_URLS.length) {
          const v = pool.get(ALL_POOL_URLS[idx])
          if (v && v.preload !== 'auto') break
          idx++
        }
        if (idx >= ALL_POOL_URLS.length) {
          if (intervalId) clearInterval(intervalId)
          return
        }
        const v = pool.get(ALL_POOL_URLS[idx])
        if (v) v.preload = 'auto'
        idx++
      }, 800)
    }, 3000)

    return () => {
      cancelled = true
      clearTimeout(preloadDelay)
      if (intervalId) clearInterval(intervalId)
      pool.forEach(video => {
        video.pause()
        video.removeAttribute('src')
        video.remove()
      })
      pool.clear()
      poolRef.current = null
    }
  }, [])

  // ── Handle hover target changes — fully imperative, zero React state ────
  useEffect(() => {
    const pool = poolRef.current
    if (!pool) return

    const prevUrl = activeUrlRef.current
    activeUrlRef.current = url

    // Pause and hide previous video immediately
    if (prevUrl && prevUrl !== url) {
      const prevVideo = pool.get(prevUrl)
      if (prevVideo) {
        prevVideo.pause()
        prevVideo.style.display = 'none'
      }
    }

    if (!url) return

    const video = pool.get(url)
    if (!video) return

    // Promote to eager preload on first hover (if background preload hasn't reached it)
    if (video.preload !== 'auto') {
      video.preload = 'auto'
    }

    // Show and play immediately — do NOT wait for canplay/canplaythrough.
    // The browser will render frames as soon as decoded data is available.
    video.style.display = 'block'
    video.currentTime = 0

    // Capture current target for stale-check in async catch
    const currentTarget = url
    if (isAudioBlocked.current) {
      video.muted = true
      video.play().catch(() => {})
    } else {
      video.muted = false
      const p = video.play()
      if (p && typeof p.catch === 'function') {
        p.catch((e) => {
          // If user already moved to a different category, don't retry —
          // the stale video was already paused by the newer hover
          if (activeUrlRef.current !== currentTarget) return
          if (e && e.name === 'NotAllowedError') {
            isAudioBlocked.current = true
          }
          video.muted = true
          video.play().catch(() => {})
        })
      }
    }
  }, [url])

  const isAnyActive = Boolean(url)

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[1] pointer-events-none overflow-hidden bg-black transition-opacity duration-300 ${isAnyActive ? 'opacity-100' : 'opacity-0'}`}
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
    />
  )
}

export function IntroScreen({ onVibeSelect }: IntroScreenProps) {
  const [step, setStep]               = useState<'vibe' | 'loading'>('vibe')
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null)

  // ── Chart Hover Preview ──
  const { hoveredVibe, activeVideoUrl, handleHoverStart, handleHoverEnd, signatureSongs } = useChartHover()

  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // ── Eager Background Prefetch ──
  // Pre-warm ALL vibe metadata (server + client cache) as soon as the intro mounts.
  // By the time the user clicks any card, the data is already cached → 0ms API delay.
  useEffect(() => {
    vibeService.prefetchAllVibes()
  }, [])

  const handleVibeSelect = useCallback((vibe: Vibe) => {
    setSelectedVibe(vibe)
    setStep('loading')
    onVibeSelect(vibe)
  }, [onVibeSelect])

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
    <motion.div
      key="intro-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
      className="fixed inset-0 z-30"
      style={{ pointerEvents: 'none' }}
    >
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
        className={`fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-300 ${activeVideoUrl ? 'opacity-0' : 'opacity-100'}`}
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
        <AnimatePresence>
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

      {/* ── Full-Screen Category Video Background (Phase 1: hover dwell → video) ── */}
      <CategoryVideoBackground url={activeVideoUrl} />

      {/* ── Native, Butter-Smooth 60/120 FPS Scroll Container ── */}
      <div
        ref={scrollWrapperRef}
        className={`fixed inset-0 z-50 bg-transparent overflow-y-auto overflow-x-hidden scrollbar-hide ${step === 'loading' ? 'pointer-events-none' : 'pointer-events-auto'}`}
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
                <p className={`text-white/40 text-[10px] md:text-xs tracking-[0.6em] uppercase font-bold mt-2 transition-opacity duration-300 ${activeVideoUrl ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>iTunes Universe</p>
              </div>

              {/* Question */}
              <div className={`text-center space-y-1 mb-2 transition-opacity duration-300 ${activeVideoUrl ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <h2
                  className="text-white text-2xl md:text-3xl font-light tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  What are you listening to?
                </h2>
                <p className="text-white/40 text-sm mt-2">Choose your editorial chart</p>
              </div>

              {/* Creator Collection Cue with 3D Bubble Pop & Magnetic Nav */}
              <div className={`transition-opacity duration-300 ${activeVideoUrl && hoveredVibe !== 'dev-special' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <CreatorCueCard
                  onClick={scrollToCreatorCollection}
                  onHoverStart={() => handleHoverStart('dev-special')}
                  onHoverEnd={handleHoverEnd}
                />
              </div>

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
              <div className={`transition-opacity duration-300 ${activeVideoUrl && hoveredVibe !== 'dev-special' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
              </div>
            </motion.div>
          )}

          {/* ────────────────── STEP 2: Loading / Universe Warming ───── */}
          {step === 'loading' && (
            <GlowingRingLoader key="step-loading" size={340} />
          )}

        </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
