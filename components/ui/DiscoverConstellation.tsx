'use client'
/**
 * Discover — "Sonic Constellation".
 *
 * The fourteen charts are stars on a sky map, grouped into four constellations. Lines join
 * charts that sit close to each other musically; dashed lines are the bridges between
 * constellations. Dev's Universe is a separate golden star with its own orbit.
 *
 * Engineering notes (see the performance audit):
 *  - DOM + one SVG. No WebGL, no canvas, no requestAnimationFrame loop.
 *  - Mounted only while Discover is open (loaded with next/dynamic by HubPanels).
 *  - Pointer parallax writes two CSS variables from a rAF-throttled handler; it never sets
 *    React state. The only React state that changes during exploration is the focused star.
 *  - All looping motion is CSS, lives only while this component is mounted, and is disabled
 *    under prefers-reduced-motion.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { useLibraryStore } from '@/store/libraryStore'

const DISPLAY: CSSProperties = { fontFamily: "'Syne', sans-serif" }
const BODY: CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" }
const GOLD = '#d4af37'
/** Dark halo so labels stay readable where a line passes behind them. */
const HALO = '0 0 6px #07070d, 0 0 10px #07070d, 0 0 14px #07070d'

type ConstellationId = 'pulse' | 'forge' | 'drift' | 'home'
type Point = [x: number, y: number]

/** Constellations: name, what binds them, and where their label sits (wide / tall layout). */
const CONSTELLATIONS: Record<ConstellationId, { name: string; line: string; wide: Point; tall: Point }> = {
  pulse: { name: 'The Pulse', line: 'What the world is playing right now', wide: [38, 12], tall: [40, 7] },
  forge: { name: 'The Forge', line: 'High energy, built to move', wide: [80, 14], tall: [78, 37] },
  drift: { name: 'The Drift', line: 'Low light, slow tempo', wide: [15, 50], tall: [14, 39] },
  home: { name: 'Home Frequencies', line: 'Regional charts', wide: [80, 91], tall: [42, 66.5] },
}

/** Star positions in percent of the sky, for landscape (wide) and portrait (tall) screens. */
/** `up`: draw the label above the star in that layout, where the lines leave downwards. */
const STARS: { id: Vibe; group: ConstellationId; wide: Point; tall: Point; up?: { wide?: boolean; tall?: boolean } }[] = [
  { id: 'new-music-friday', group: 'pulse', wide: [26, 26], tall: [18, 17], up: { wide: true, tall: true } },
  { id: 'global-top-50', group: 'pulse', wide: [38, 35], tall: [38, 26] },
  { id: 'viral-50', group: 'pulse', wide: [50, 23], tall: [58, 15], up: { wide: true, tall: true } },
  { id: 'pop-rising', group: 'pulse', wide: [49, 43], tall: [74, 27] },
  { id: 'mood-booster', group: 'forge', wide: [57, 59], tall: [52, 40] },
  { id: 'dance-hits', group: 'forge', wide: [68, 38], tall: [76, 46] },
  { id: 'workout', group: 'forge', wide: [79, 25], tall: [86, 58], up: { wide: true } },
  { id: 'hip-hop-central', group: 'forge', wide: [88, 41], tall: [60, 58] },
  { id: 'late-night', group: 'drift', wide: [17, 62], tall: [16, 47] },
  { id: 'chill-hits', group: 'drift', wide: [31, 73], tall: [30, 59] },
  { id: 'top-hindi', group: 'home', wide: [66, 76], tall: [18, 73] },
  { id: 'top-telugu', group: 'home', wide: [77, 84], tall: [40, 78] },
  { id: 'top-tamil', group: 'home', wide: [87, 74], tall: [62, 73] },
  { id: 'top-kpop', group: 'home', wide: [91, 57], tall: [84, 70], up: { wide: true } },
]
const DEV: { wide: Point; tall: Point } = { wide: [46, 84], tall: [50, 91] }

/** Kinship lines. `bridge` joins two constellations and is drawn dashed. */
const LINKS: { a: Vibe; b: Vibe; bridge?: boolean }[] = [
  { a: 'new-music-friday', b: 'global-top-50' },
  { a: 'global-top-50', b: 'viral-50' },
  { a: 'global-top-50', b: 'pop-rising' },
  { a: 'viral-50', b: 'pop-rising' },
  { a: 'mood-booster', b: 'dance-hits' },
  { a: 'dance-hits', b: 'workout' },
  { a: 'workout', b: 'hip-hop-central' },
  { a: 'dance-hits', b: 'hip-hop-central' },
  { a: 'late-night', b: 'chill-hits' },
  { a: 'top-hindi', b: 'top-telugu' },
  { a: 'top-telugu', b: 'top-tamil' },
  { a: 'top-tamil', b: 'top-kpop' },
  { a: 'pop-rising', b: 'mood-booster', bridge: true },
  { a: 'chill-hits', b: 'mood-booster', bridge: true },
  { a: 'top-kpop', b: 'dance-hits', bridge: true },
  { a: 'late-night', b: 'new-music-friday', bridge: true },
]

type Target = Vibe // includes 'dev-special'

const subscribeTall = (notify: () => void) => {
  const media = matchMedia('(max-aspect-ratio: 5/6)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const getTall = () => matchMedia('(max-aspect-ratio: 5/6)').matches

const STYLES = `
.kdc-root { --px: 0; --py: 0; }
.kdc-layer { transition: transform .5s cubic-bezier(.16,1,.3,1); will-change: transform; }
.kdc-dust-a { background-image: radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.55) 50%, transparent 51%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,.4) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 45% 85%, rgba(255,255,255,.35) 50%, transparent 51%), radial-gradient(1px 1px at 88% 12%, rgba(255,255,255,.45) 50%, transparent 51%); background-size: 340px 340px; transform: translate3d(calc(var(--px) * 6px), calc(var(--py) * 6px), 0); }
.kdc-dust-b { background-image: radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,.3) 50%, transparent 51%), radial-gradient(1px 1px at 10% 75%, rgba(255,255,255,.25) 50%, transparent 51%), radial-gradient(1px 1px at 35% 48%, rgba(255,255,255,.2) 50%, transparent 51%); background-size: 210px 210px; transform: translate3d(calc(var(--px) * 14px), calc(var(--py) * 14px), 0); }
.kdc-map { transform: translate3d(calc(var(--px) * -10px), calc(var(--py) * -10px), 0); }
.kdc-line { stroke-dasharray: 1; stroke-dashoffset: 0; transition: stroke .35s ease, stroke-opacity .35s ease, stroke-width .35s ease; }
.kdc-star { transition: opacity .35s ease, transform .35s cubic-bezier(.16,1,.3,1); }
.kdc-core { transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease; }
.kdc-ring { transition: transform .45s cubic-bezier(.16,1,.3,1), opacity .35s ease; }
.kdc-star:focus-visible { outline: none; }
.kdc-star:focus-visible .kdc-ring { outline: 1px solid rgba(255,255,255,.9); outline-offset: 5px; }
@media (prefers-reduced-motion: no-preference) {
  .kdc-line { animation: kdc-draw 1.1s cubic-bezier(.16,1,.3,1) both; }
  .kdc-star { animation: kdc-rise .7s cubic-bezier(.16,1,.3,1) both; }
  .kdc-orbit { animation: kdc-spin 28s linear infinite; }
  .kdc-orbit-slow { animation: kdc-spin 46s linear infinite reverse; }
  .kdc-pulse { animation: kdc-pulse 2.4s ease-in-out infinite; }
}
@media (prefers-reduced-motion: reduce) { .kdc-layer, .kdc-map { transform: none !important; } }
@keyframes kdc-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes kdc-rise { from { opacity: 0; scale: .4; } }
@keyframes kdc-spin { to { transform: rotate(360deg); } }
@keyframes kdc-pulse { 0%, 100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.35); opacity: 0; } }
`

export default function DiscoverConstellation({ onVibeSelect, onClose }: { onVibeSelect: (vibe: Vibe) => void; onClose: () => void }) {
  const reducedMotion = useReducedMotion()
  const tall = useSyncExternalStore(subscribeTall, getTall, () => false)
  const openSearchWith = useLibraryStore((s) => s.openSearchWith)
  const vibeVisits = useLibraryStore((s) => s.vibeVisits)

  const rootRef = useRef<HTMLDivElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const starRefs = useRef(new Map<Target, HTMLButtonElement>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const [focused, setFocused] = useState<Target | null>(null)
  const [query, setQuery] = useState('')
  const [sky, setSky] = useState({ w: 0, h: 0 })
  const [entering, setEntering] = useState<{ id: Target; x: number; y: number; color: string } | null>(null)
  const [spinning, setSpinning] = useState(false)

  const byId = useMemo(() => new Map(VIBE_CONFIGS.map((v) => [v.id, v])), [])
  const position = useCallback((id: Target): Point => {
    if (id === 'dev-special') return tall ? DEV.tall : DEV.wide
    const star = STARS.find((s) => s.id === id)!
    return tall ? star.tall : star.wide
  }, [tall])

  const neighbours = useMemo(() => {
    const map = new Map<Target, Set<Target>>()
    for (const { a, b } of LINKS) {
      map.set(a, (map.get(a) ?? new Set()).add(b))
      map.set(b, (map.get(b) ?? new Set()).add(a))
    }
    return map
  }, [])

  const homeVibe = useMemo(() => {
    const top = (Object.entries(vibeVisits) as [Vibe, number][]).sort((a, b) => b[1] - a[1])[0]
    return top && top[0] !== 'dev-special' ? top[0] : null
  }, [vibeVisits])

  // Search: filters the sky by chart name, style line or constellation.
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return null
    const hit = new Set<Target>()
    for (const star of STARS) {
      const v = byId.get(star.id)
      const text = `${v?.label} ${v?.sub} ${CONSTELLATIONS[star.group].name}`.toLowerCase()
      if (text.includes(q)) hit.add(star.id)
    }
    if (`dev's universe devs creator dev`.includes(q)) hit.add('dev-special')
    return hit
  }, [q, byId])
  const firstMatch = matches ? [...STARS.map((s) => s.id as Target), 'dev-special' as Target].find((id) => matches.has(id)) ?? null : null

  // Measure the sky so the SVG lines live in real pixels (crisp strokes at any aspect ratio).
  useLayoutEffect(() => {
    const el = skyRef.current
    if (!el) return
    const measure = () => setSky({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Pointer parallax: two CSS variables, at most one write per frame, no React state.
  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        root.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
        root.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      })
    }
    root.addEventListener('pointermove', onMove, { passive: true })
    return () => { root.removeEventListener('pointermove', onMove); if (frame) cancelAnimationFrame(frame) }
  }, [reducedMotion])

  useEffect(() => {
    const pending = timers.current
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350)
    return () => { clearTimeout(t); pending.forEach(clearTimeout) }
  }, [])

  const colorOf = useCallback((id: Target) => (id === 'dev-special' ? GOLD : byId.get(id)?.bgColor ?? '#fff'), [byId])

  /** Enter a chart: the chosen star swells to fill the screen, then the chart loads. */
  const enter = useCallback((id: Target) => {
    if (entering) return
    if (reducedMotion) { onVibeSelect(id); return }
    const [x, y] = position(id)
    setFocused(id)
    setEntering({ id, x, y, color: colorOf(id) })
  }, [entering, reducedMotion, onVibeSelect, position, colorOf])

  /** Surprise Me: the highlight skips across the sky, slows, and lands on a chart. */
  const surprise = useCallback(() => {
    if (spinning || entering) return
    const pool = STARS.map((s) => s.id).filter((id) => id !== homeVibe)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (reducedMotion) { onVibeSelect(pick); return }
    setSpinning(true)
    setQuery('')
    const hops = Array.from({ length: 7 }, () => pool[Math.floor(Math.random() * pool.length)]).concat(pick)
    let at = 0
    hops.forEach((id, i) => {
      at += 90 + i * 28 // each hop a little slower than the last
      timers.current.push(setTimeout(() => setFocused(id), at))
    })
    timers.current.push(setTimeout(() => { setSpinning(false); enter(pick) }, at + 380))
  }, [spinning, entering, homeVibe, reducedMotion, onVibeSelect, enter])

  /** Arrow keys move to the nearest star in that direction. */
  const onStarKey = (e: ReactKeyboardEvent, from: Target) => {
    const dir: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = dir[e.key]
    if (!d) return
    e.preventDefault()
    const [fx, fy] = position(from)
    const aspect = sky.w && sky.h ? sky.w / sky.h : 1
    let best: Target | null = null
    let bestScore = Infinity
    for (const id of [...STARS.map((s) => s.id as Target), 'dev-special' as Target]) {
      if (id === from) continue
      const [x, y] = position(id)
      const dx = (x - fx) * aspect, dy = y - fy
      const along = dx * d[0] + dy * d[1]
      if (along <= 0.5) continue
      const across = Math.abs(dx * d[1] - dy * d[0])
      const score = along + across * 1.6
      if (score < bestScore) { bestScore = score; best = id }
    }
    if (best) starRefs.current.get(best)?.focus()
  }

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && q) { e.preventDefault(); if (firstMatch) enter(firstMatch); else openSearchWith(query.trim()) }
    if (e.key === 'ArrowDown') { e.preventDefault(); starRefs.current.get(firstMatch ?? 'global-top-50')?.focus() }
  }

  // What the readout describes: the focused star, else the first search match.
  const shown: Target | null = focused ?? firstMatch
  const shownVibe = shown ? byId.get(shown) ?? null : null
  const shownGroup = shown && shown !== 'dev-special' ? CONSTELLATIONS[STARS.find((s) => s.id === shown)!.group] : null
  const lit = focused ? neighbours.get(focused) : undefined

  const starOpacity = (id: Target) => {
    if (matches) return matches.has(id) ? 1 : 0.16
    if (!focused) return 1
    return id === focused ? 1 : lit?.has(id) ? 0.95 : 0.32
  }

  const px = (p: Point): Point => [(p[0] / 100) * sky.w, (p[1] / 100) * sky.h]

  return (
    <motion.div
      ref={rootRef}
      role="dialog" aria-modal="true" aria-label="Discover — sonic constellation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="kdc-root fixed inset-0 z-[120] overflow-hidden text-white"
      style={{ background: 'radial-gradient(120% 90% at 50% 38%, #10111f 0%, #07070d 55%, #020204 100%)' }}
    >
      <style>{STYLES}</style>

      {/* Depth: two star-dust layers that drift at different rates with the pointer */}
      <div aria-hidden="true" className="kdc-layer kdc-dust-a pointer-events-none absolute -inset-6 opacity-70" />
      <div aria-hidden="true" className="kdc-layer kdc-dust-b pointer-events-none absolute -inset-6 opacity-60" />
      {/* A single soft light that takes the colour of whatever is in focus */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] transition-[background-color,opacity] duration-700"
        style={{ backgroundColor: shown ? colorOf(shown) : '#3b3f8f', opacity: shown ? 0.16 : 0.1 }}
      />

      {/* ── Header: title · search · surprise · close ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pt-5 md:px-10 md:pt-8">
        <div className="mr-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.42em] text-white/40" style={BODY}>Discover</p>
          <h2 className="whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.1em] sm:text-lg md:text-xl md:tracking-[0.14em]" style={DISPLAY}>Sonic Constellation</h2>
        </div>

        <div className="order-3 w-full md:order-none md:w-[min(380px,34vw)]">
          <label className="flex items-center gap-2.5 border-b border-white/20 pb-2 transition-colors focus-within:border-white/70">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/45" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value.slice(0, 80))} onKeyDown={onSearchKey}
              placeholder="Find a chart, a mood, a song…" aria-label="Search charts and songs"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none" style={BODY}
            />
          </label>
          <div className="mt-1.5 flex h-4 items-center gap-3 text-[11px]" style={BODY} aria-live="polite">
            {q && (
              <>
                <span className="text-white/45">
                  {matches && matches.size > 0 ? `${matches.size} ${matches.size === 1 ? 'star' : 'stars'} lit · ↵ to enter` : 'No chart by that name'}
                </span>
                <button type="button" onClick={() => openSearchWith(query.trim())} className="truncate text-white/80 underline decoration-white/30 underline-offset-4 hover:decoration-white">
                  Search songs for “{query.trim()}”
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button" onClick={surprise} disabled={spinning || !!entering}
          className="group flex items-center gap-2.5 rounded-full border border-white/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85 transition-colors hover:border-white/70 hover:text-white disabled:opacity-50" style={BODY}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="transition-transform duration-500 group-hover:rotate-45">
            <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
          </svg>
          {spinning ? 'Choosing…' : 'Surprise me'}
        </button>
        <button type="button" onClick={onClose} aria-label="Close Discover" className="rounded-full border border-white/20 p-2.5 text-white/70 transition-colors hover:border-white/70 hover:text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      {/* ── The sky ── */}
      <div ref={skyRef} className="kdc-layer kdc-map absolute inset-x-0 bottom-[84px] top-[150px] md:bottom-[40px] md:top-[112px]">
        {sky.w > 0 && (
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${sky.w} ${sky.h}`}>
            {/* Dev's Universe: its own orbit, apart from the charts */}
            {(() => { const [x, y] = px(position('dev-special')); return (
              <g opacity={matches && !matches.has('dev-special') ? 0.2 : 1} style={{ transition: 'opacity .35s ease' }}>
                <ellipse cx={x} cy={y} rx={Math.min(150, sky.w * 0.2)} ry={Math.min(46, sky.h * 0.08)} fill="none" stroke={GOLD} strokeOpacity={focused === 'dev-special' ? 0.55 : 0.2} strokeWidth="1" style={{ transition: 'stroke-opacity .35s ease' }} />
                <ellipse cx={x} cy={y} rx={Math.min(96, sky.w * 0.13)} ry={Math.min(28, sky.h * 0.05)} fill="none" stroke={GOLD} strokeOpacity="0.14" strokeWidth="1" strokeDasharray="2 7" />
              </g>
            ) })()}
            {/* Graticule: two faint rings that give the sky a centre */}
            <ellipse cx={sky.w / 2} cy={sky.h / 2} rx={sky.w * 0.47} ry={sky.h * 0.46} fill="none" stroke="#fff" strokeOpacity="0.045" />
            <ellipse cx={sky.w / 2} cy={sky.h / 2} rx={sky.w * 0.3} ry={sky.h * 0.27} fill="none" stroke="#fff" strokeOpacity="0.04" strokeDasharray="1 9" />
            {LINKS.map(({ a, b, bridge }, i) => {
              const [x1, y1] = px(position(a)), [x2, y2] = px(position(b))
              const active = focused === a || focused === b
              const dim = matches ? !(matches.has(a) && matches.has(b)) : !!focused && !active
              return (
                <line
                  key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} pathLength={bridge ? undefined : 1}
                  className={bridge ? undefined : 'kdc-line'}
                  stroke={active ? colorOf(focused!) : '#ffffff'}
                  strokeOpacity={active ? 0.9 : dim ? 0.05 : bridge ? 0.14 : 0.24}
                  strokeWidth={active ? 1.4 : 1}
                  strokeDasharray={bridge ? '3 7' : undefined}
                  style={bridge ? { transition: 'stroke .35s ease, stroke-opacity .35s ease' } : { animationDelay: `${0.25 + i * 0.05}s` }}
                />
              )
            })}
          </svg>
        )}

        {/* Constellation names */}
        {(Object.keys(CONSTELLATIONS) as ConstellationId[]).map((id) => {
          const c = CONSTELLATIONS[id]
          const [x, y] = tall ? c.tall : c.wide
          const on = shownGroup === c
          return (
            <p
              key={id} aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.5em] transition-opacity duration-500 md:text-[10px]"
              style={{ ...BODY, left: `${x}%`, top: `${y}%`, opacity: on ? 0.85 : focused || matches ? 0.12 : 0.3 }}
            >
              {c.name}
            </p>
          )
        })}

        {/* Stars */}
        {STARS.map((star, i) => {
          const vibe = byId.get(star.id)
          if (!vibe) return null
          const [x, y] = tall ? star.tall : star.wide
          const on = focused === star.id
          const color = vibe.bgColor
          const up = !!(tall ? star.up?.tall : star.up?.wide)
          return (
            <button
              key={star.id} type="button"
              ref={(el) => { if (el) starRefs.current.set(star.id, el); else starRefs.current.delete(star.id) }}
              onClick={() => enter(star.id)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !spinning) setFocused(star.id) }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !spinning && !entering) setFocused((f) => (f === star.id ? null : f)) }}
              onFocus={() => { if (!spinning) setFocused(star.id) }}
              onBlur={() => { if (!spinning && !entering) setFocused((f) => (f === star.id ? null : f)) }}
              onKeyDown={(e) => onStarKey(e, star.id)}
              aria-label={`${vibe.label} — ${vibe.sub}. ${CONSTELLATIONS[star.group].name}.`}
              className={`kdc-star absolute flex w-[124px] items-center ${up ? 'flex-col-reverse' : 'flex-col'}`}
              style={{ left: `${x}%`, top: `${y}%`, transform: up ? 'translate(-50%, calc(-100% + 22px))' : 'translate(-50%, -22px)', opacity: starOpacity(star.id), animationDelay: `${0.12 + i * 0.045}s`, zIndex: on ? 3 : 1 }}
            >
              <span className="relative flex h-11 w-11 items-center justify-center">
                {on && <span className="kdc-pulse absolute h-7 w-7 rounded-full border" style={{ borderColor: color }} />}
                <span className="kdc-ring absolute h-7 w-7 rounded-full border" style={{ borderColor: color, opacity: on ? 0.9 : 0, transform: on ? 'scale(1)' : 'scale(0.4)' }} />
                <span
                  className="kdc-core h-[10px] w-[10px] rounded-full"
                  style={{ background: color, transform: on ? 'scale(1.5)' : 'scale(1)', boxShadow: on ? `0 0 0 3px ${color}33, 0 0 26px 6px ${color}99` : `0 0 12px 1px ${color}80` }}
                />
              </span>
              <span className={`${up ? '-mb-1' : '-mt-1'} text-center text-[11px] font-semibold leading-tight tracking-wide transition-colors duration-300 md:text-[13px] ${on ? 'text-white' : 'text-white/80'}`} style={{ ...BODY, textShadow: HALO }}>
                {vibe.label}
                {homeVibe === star.id && <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.25em] text-white/40">Your home</span>}
              </span>
            </button>
          )
        })}

        {/* Dev's Universe — the golden star */}
        {(() => {
          const [x, y] = position('dev-special')
          const on = focused === 'dev-special'
          return (
            <button
              type="button"
              ref={(el) => { if (el) starRefs.current.set('dev-special', el); else starRefs.current.delete('dev-special') }}
              onClick={() => enter('dev-special')}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !spinning) setFocused('dev-special') }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !spinning && !entering) setFocused((f) => (f === 'dev-special' ? null : f)) }}
              onFocus={() => { if (!spinning) setFocused('dev-special') }}
              onBlur={() => { if (!spinning && !entering) setFocused((f) => (f === 'dev-special' ? null : f)) }}
              onKeyDown={(e) => onStarKey(e, 'dev-special')}
              aria-label="Dev's Universe — the creator's handpicked tracks"
              className="kdc-star absolute flex w-[190px] flex-col items-center"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -22px)', opacity: starOpacity('dev-special'), animationDelay: '0.85s', zIndex: on ? 3 : 2 }}
            >
              <span className="relative flex h-11 w-11 items-center justify-center">
                <span className="kdc-orbit absolute h-10 w-10 rounded-full" style={{ border: `1px solid ${GOLD}55`, borderTopColor: GOLD }} />
                <span className="kdc-orbit-slow absolute h-[30px] w-[30px] rounded-full" style={{ border: `1px dashed ${GOLD}66` }} />
                <span className="kdc-core h-3.5 w-3.5 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, #fff6d0, ${GOLD} 60%, #7a5c12)`, transform: on ? 'scale(1.35)' : 'scale(1)', boxShadow: on ? `0 0 34px 8px ${GOLD}aa` : `0 0 18px 2px ${GOLD}77` }} />
              </span>
              <span className="mt-0.5 text-center" style={BODY}>
                <span className="block text-xs font-extrabold uppercase tracking-[0.28em]" style={{ ...DISPLAY, color: on ? '#f5e3a3' : GOLD }}>Dev’s Universe</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">Creator’s pick</span>
              </span>
            </button>
          )
        })()}

        {/* Entering: the chosen star swells until it becomes the screen */}
        {entering && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 h-6 w-6 rounded-full"
            style={{ left: `${entering.x}%`, top: `${entering.y}%`, x: '-50%', y: '-50%', background: `radial-gradient(circle, #fff 0%, ${entering.color} 35%, ${entering.color}00 72%)` }}
            initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 190, opacity: 1 }}
            transition={{ duration: 0.75, ease: [0.7, 0, 0.84, 0] }}
            onAnimationComplete={() => onVibeSelect(entering.id)}
          />
        )}
      </div>

      {/* ── Readout: what the focused star is ── */}
      <div className="pointer-events-none absolute inset-x-5 bottom-4 z-20 md:inset-x-auto md:bottom-9 md:left-10 md:w-[340px]" aria-live="polite">
        {shown && (shownVibe || shown === 'dev-special') ? (
          <div key={shown} className="flex items-end gap-4">
            <span className="text-5xl font-extrabold leading-none md:text-7xl" style={{ ...DISPLAY, color: 'transparent', WebkitTextStroke: `1px ${colorOf(shown)}` }}>
              {shown === 'dev-special' ? '✦' : shownVibe?.number}
            </span>
            <span className="min-w-0 pb-1" style={BODY}>
              <span className="block text-[9px] font-bold uppercase tracking-[0.35em] text-white/45">{shown === 'dev-special' ? 'A universe of its own' : shownGroup?.name}</span>
              <span className="block truncate text-lg font-bold md:text-xl" style={DISPLAY}>{shown === 'dev-special' ? 'Dev’s Universe' : shownVibe?.label}</span>
              <span className="block truncate text-xs text-white/55">{shown === 'dev-special' ? 'Handpicked by the creator' : shownVibe?.sub}</span>
            </span>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-white/40" style={BODY}>
            <span className="block font-bold uppercase tracking-[0.3em] text-white/55">14 charts · 4 constellations</span>
            Pick a star to enter its chart. Lines join charts that sound alike.
            <span className="hidden md:inline"> Arrow keys travel between stars.</span>
          </p>
        )}
      </div>
    </motion.div>
  )
}
