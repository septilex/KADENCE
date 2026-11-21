'use client'
import { memo, useMemo, useSyncExternalStore, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useChartTransition, FLASH_MS, REVEAL_MS, type TransitionStatus } from '@/store/chartTransitionStore'
import { useSongStore } from '@/store/songStore'
import {
  CHART_LOADING_ART, CHART_LOADING_SIZES, chartLoadingSrc, chartLoadingSrcSet, getChartColors,
  type ArtMotion,
} from '@/lib/chartLoadingArt'
import type { Vibe } from '@/lib/types'
import { ChartSpectrum } from './ChartSpectrum'

/**
 * Shared chart-selection transition (homepage tiles, Discover, Switch Chart, Profile):
 *
 *   flash      the chart colour expands from the click point (CSS transform only)
 *   loading    the chart's artwork, alive with slow drift / light / mist, under a central
 *              spectrum visualiser and app-rendered text
 *   revealing  everything fades out over the universe, which drew its first frame behind it
 *
 * Renders nothing while idle. Animations are CSS transforms/opacity (compositor) plus one
 * Canvas 2D loop inside ChartSpectrum; no blur, no backdrop-filter, no WebGL.
 */

const subscribeMotion = (notify: () => void) => {
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const getReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const STATUS_TEXT: Record<TransitionStatus, string> = {
  fetching: 'Gathering the chart',
  artwork: 'Bringing the covers into focus',
  building: 'Building your universe',
  entering: 'Entering',
}

export function ChartTransitionOverlay() {
  const active = useChartTransition(s => s.phase !== 'idle')
  return active ? <OverlayBody /> : null
}

function OverlayBody() {
  const { phase, vibe, request, color, deep, origin, status } = useChartTransition(useShallow(s => ({
    phase: s.phase, vibe: s.vibe, request: s.request, color: s.color, deep: s.deep, origin: s.origin, status: s.status,
  })))
  const reduced = useSyncExternalStore(subscribeMotion, getReducedMotion, () => false)
  if (!vibe) return null

  const shown = phase === 'loading' || phase === 'revealing'
  const leaving = phase === 'revealing'
  const { label, number } = getChartColors(vibe)

  return (
    <div
      className={`kt-root${leaving ? ' kt-root--out' : ''}${reduced ? ' kt-reduced' : ''}`}
      style={{ '--kt-color': color, '--kt-deep': deep, '--kt-reveal': `${REVEAL_MS}ms`, '--kt-flash': `${FLASH_MS}ms` } as CSSProperties}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label}`}
    >
      <ArtStage key={vibe} vibe={vibe} shown={shown} />

      <div className={`kt-center${shown ? ' kt-center--on' : ''}`}>
        <div className="kt-eyebrow">Now entering</div>
        <div className="kt-visual">
          <ChartSpectrum color={color} deep={deep} still={reduced} />
          <div className="kt-number" aria-hidden="true">{vibe === 'dev-special' ? '✦' : number}</div>
        </div>
        <div className="kt-title">{label}</div>
        <StatusLine status={status} />
      </div>

      {!reduced && <Flash key={request} origin={origin} color={color} deep={deep} fading={shown} />}

      <style jsx global>{`
        .kt-root { position: fixed; inset: 0; z-index: 200; overflow: hidden; pointer-events: auto;
          background: transparent; contain: strict; }
        .kt-root--out { opacity: 0; pointer-events: none; transition: opacity var(--kt-reveal) cubic-bezier(.4,0,.2,1); }

        /* ── Flash ─────────────────────────────────────────────── */
        .kt-flash, .kt-ring { position: absolute; border-radius: 50%; pointer-events: none; will-change: transform, opacity; }
        .kt-flash { animation: kt-expand var(--kt-flash) cubic-bezier(.65,0,.35,1) both; }
        .kt-flash--fade { opacity: 0; transition: opacity 650ms ease-out; }
        .kt-ring { border: max(2px, .3vmin) solid rgba(255,255,255,.9);
          animation: kt-ring calc(var(--kt-flash) * 1.15) cubic-bezier(.3,0,.2,1) both; }
        @keyframes kt-expand { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes kt-ring { 0% { transform: scale(0); opacity: 1; } 75% { opacity: .9; } 100% { transform: scale(1.02); opacity: 0; } }

        /* ── Artwork stage ─────────────────────────────────────── */
        .kt-stage { position: absolute; inset: 0; background: #050508; opacity: 0; }
        .kt-stage--on { opacity: 1; }
        .kt-reduced .kt-stage { transition: opacity 300ms ease-out; }
        .kt-drift, .kt-intro, .kt-img { position: absolute; inset: 0; }
        .kt-intro { transform: scale(1.12); transform-origin: var(--kt-focus); transition: transform 2800ms cubic-bezier(.16,1,.3,1); will-change: transform; }
        .kt-stage--on .kt-intro { transform: scale(1); }
        .kt-drift { transform-origin: var(--kt-focus); will-change: transform; animation: var(--kt-motion) ease-in-out infinite alternate both; }
        .kt-img { width: 100%; height: 100%; object-fit: cover; object-position: var(--kt-focus); user-select: none; }

        /* Motion presets, matched to the painting (all transform-only, slow, ≤ 2% travel). */
        @keyframes kt-arc   { from { transform: translate3d(-1.2%, -.8%, 0) scale(1.06); } to { transform: translate3d(1.3%, 1%, 0) scale(1.1); } }
        @keyframes kt-cloud { from { transform: translate3d(-1.7%, .5%, 0) scale(1.07); } to { transform: translate3d(1.5%, -.6%, 0) scale(1.09); } }
        @keyframes kt-vapor { from { transform: scale(1.06) rotate(-.5deg); } to { transform: translate3d(.6%, -.8%, 0) scale(1.11) rotate(.6deg); } }
        @keyframes kt-peak  { from { transform: translate3d(0, .8%, 0) scale(1.06); } to { transform: translate3d(-.6%, -.6%, 0) scale(1.12); } }

        /* Atmosphere: chart-coloured light that moves against the image (depth). */
        .kt-glow { position: absolute; pointer-events: none; mix-blend-mode: screen; will-change: transform, opacity; }
        .kt-glow--key { left: -20%; top: -30%; width: 75%; height: 90%;
          background: radial-gradient(closest-side, color-mix(in srgb, var(--kt-color) 70%, white) 0%, transparent 100%);
          animation: kt-key 9s ease-in-out infinite alternate both; }
        .kt-glow--fill { right: -18%; bottom: -26%; width: 70%; height: 85%;
          background: radial-gradient(closest-side, var(--kt-color) 0%, transparent 100%);
          animation: kt-fill 13s ease-in-out infinite alternate both; }
        @keyframes kt-key  { from { transform: translate3d(0,0,0) scale(1); opacity: .22; } to { transform: translate3d(4%, 3%, 0) scale(1.08); opacity: .42; } }
        @keyframes kt-fill { from { transform: translate3d(0,0,0) scale(1.05); opacity: .1; } to { transform: translate3d(-5%, -3%, 0) scale(.95); opacity: .26; } }
        .kt-sweep { position: absolute; inset: -10% -60%; pointer-events: none; mix-blend-mode: soft-light; will-change: transform;
          background: linear-gradient(112deg, transparent 42%, rgba(255,255,255,.22) 50%, transparent 58%);
          animation: kt-sweep 12s cubic-bezier(.45,0,.25,1) infinite; }
        @keyframes kt-sweep { 0% { transform: translate3d(-38%,0,0); } 60%, 100% { transform: translate3d(38%,0,0); } }
        .kt-mist { position: absolute; left: 0; bottom: -4%; width: 200%; height: 42%; pointer-events: none; mix-blend-mode: screen; opacity: .55; will-change: transform;
          background:
            radial-gradient(ellipse 22% 55% at 18% 100%, rgba(255,255,255,.16), transparent 70%),
            radial-gradient(ellipse 18% 45% at 52% 100%, rgba(255,255,255,.1), transparent 70%),
            radial-gradient(ellipse 25% 60% at 82% 100%, rgba(255,255,255,.14), transparent 70%);
          background-size: 50% 100%; background-repeat: repeat-x;
          animation: kt-mist 46s linear infinite; }
        @keyframes kt-mist { to { transform: translate3d(-50%,0,0); } }

        /* Legibility: vignette + soft scrim behind the visualiser (no blur). */
        .kt-shade { position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 50% 46%, rgba(4,4,10,.5) 0%, rgba(4,4,10,.26) 24%, transparent 46%),
            radial-gradient(ellipse at center, transparent 48%, rgba(3,3,8,.55) 100%),
            linear-gradient(to top, rgba(3,3,8,.5) 0%, transparent 32%); }

        /* Dev's Universe: gold fallback until bespoke artwork exists. */
        .kt-gold { position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 20% 16%, rgba(255,226,150,.42), transparent 62%),
            radial-gradient(ellipse 65% 55% at 84% 82%, rgba(212,175,55,.34), transparent 66%),
            radial-gradient(ellipse 50% 40% at 60% 40%, rgba(120,84,20,.35), transparent 70%),
            linear-gradient(135deg, #1c1407 0%, #0b0803 52%, #1f1606 100%); }
        .kt-gold-rings { position: absolute; inset: 0; opacity: .5;
          background: repeating-radial-gradient(circle at 50% 46%, rgba(212,175,55,.07) 0 1px, transparent 1px 26px); }
        .kt-gold-sheen { position: absolute; left: 50%; top: 46%; width: 220vmax; height: 220vmax; margin: -110vmax 0 0 -110vmax;
          mix-blend-mode: screen; will-change: transform; animation: kt-spin 70s linear infinite;
          background: conic-gradient(from 0deg, transparent 0 18%, rgba(255,215,120,.12) 24%, transparent 31% 66%, rgba(255,215,120,.09) 73%, transparent 80%); }
        @keyframes kt-spin { to { transform: rotate(360deg); } }

        /* ── Centre: visualiser + text ─────────────────────────── */
        .kt-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: clamp(6px, 1.4dvh, 14px); padding: 0 16px; text-align: center; pointer-events: none;
          opacity: 0; transform: scale(.94); transition: opacity 700ms ease-out 120ms, transform 1100ms cubic-bezier(.16,1,.3,1) 120ms; }
        .kt-center--on { opacity: 1; transform: scale(1); }
        .kt-root--out .kt-center { transform: scale(1.08); transition: transform var(--kt-reveal) cubic-bezier(.4,0,.2,1); }
        .kt-visual { position: relative; width: min(66vmin, 560px); aspect-ratio: 1; }
        .kt-number { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: min(11vmin, 92px); letter-spacing: -.02em; line-height: 1;
          color: var(--kt-color); text-shadow: 0 0 18px color-mix(in srgb, var(--kt-color) 60%, transparent); }
        .kt-eyebrow { font-family: 'Space Grotesk', sans-serif; font-size: clamp(10px, 1.1vw, 13px); font-weight: 600;
          letter-spacing: .42em; text-transform: uppercase; color: rgba(255,255,255,.72); margin-bottom: -2dvh; }
        .kt-title { font-family: 'Syne', sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
          font-size: clamp(22px, 3.6vw, 46px); line-height: 1.05; color: #fff; margin-top: -2dvh;
          text-shadow: 0 2px 24px rgba(0,0,0,.55); }
        .kt-status { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .kt-status-text { font-family: 'Space Grotesk', sans-serif; font-size: clamp(11px, 1.15vw, 14px); letter-spacing: .14em;
          text-transform: uppercase; color: rgba(255,255,255,.78); min-height: 1.4em; }
        .kt-status-text span { display: inline-block; animation: kt-status-in 420ms ease-out both; }
        @keyframes kt-status-in { from { opacity: 0; transform: translate3d(0,6px,0); } to { opacity: 1; transform: none; } }
        .kt-bar { width: min(240px, 52vw); height: 2px; border-radius: 2px; background: rgba(255,255,255,.16); overflow: hidden; }
        .kt-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--kt-deep), var(--kt-color));
          transform-origin: left center; transition: transform 600ms cubic-bezier(.16,1,.3,1); }

        /* Reduced motion: no flash, no drift, no light travel; the visualiser draws one still. */
        .kt-reduced .kt-drift, .kt-reduced .kt-glow, .kt-reduced .kt-sweep, .kt-reduced .kt-mist,
        .kt-reduced .kt-gold-sheen, .kt-reduced .kt-status-text span { animation: none; }
        .kt-reduced .kt-intro, .kt-reduced .kt-center { transition: opacity 300ms ease-out; transform: none; }
        .kt-reduced .kt-drift { transform: scale(1.04); }
      `}</style>
    </div>
  )
}

const MOTION_KEYFRAMES: Record<ArtMotion, string> = {
  arc: 'kt-arc 26s', cloud: 'kt-cloud 30s', vapor: 'kt-vapor 22s', peak: 'kt-peak 34s',
}

/** Background for one chart. Keyed by chart, so a newer selection gets a fresh stage. */
const ArtStage = memo(function ArtStage({ vibe, shown }: { vibe: Vibe; shown: boolean }) {
  const art = CHART_LOADING_ART[vibe]
  const style = {
    '--kt-focus': art?.focus ?? '50% 50%',
    '--kt-motion': MOTION_KEYFRAMES[art?.motion ?? 'arc'],
  } as CSSProperties
  return (
    <div className={`kt-stage${shown ? ' kt-stage--on' : ''}`} style={style} aria-hidden="true">
      <div className="kt-intro">
        <div className="kt-drift">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- already decoded by the controller; same srcset/sizes, so no second download
            <img className="kt-img" src={chartLoadingSrc(vibe, 1672)} srcSet={chartLoadingSrcSet(vibe) ?? undefined}
              sizes={CHART_LOADING_SIZES} alt="" decoding="async" draggable={false} />
          ) : (
            <>
              <div className="kt-gold" />
              <div className="kt-gold-rings" />
              <div className="kt-gold-sheen" />
            </>
          )}
        </div>
      </div>
      <div className="kt-glow kt-glow--key" />
      <div className="kt-glow kt-glow--fill" />
      <div className="kt-sweep" />
      {(art?.motion === 'peak' || art?.motion === 'cloud') && <div className="kt-mist" />}
      <div className="kt-shade" />
    </div>
  )
})

/** The colour flash: a disc covering the farthest screen corner, scaled up from the origin. */
const Flash = memo(function Flash({ origin, color, deep, fading }: { origin: { x: number; y: number }; color: string; deep: string; fading: boolean }) {
  const box = useMemo(() => {
    const w = window.innerWidth, h = window.innerHeight
    const r = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 2
    return { left: origin.x - r, top: origin.y - r, width: r * 2, height: r * 2 }
  }, [origin])
  return (
    <>
      <div className={`kt-flash${fading ? ' kt-flash--fade' : ''}`} style={{
        ...box,
        background: `radial-gradient(circle, #ffffff 0%, ${color} 7%, ${color} 55%, ${deep} 100%)`,
      }} />
      {!fading && <div className="kt-ring" style={box} />}
    </>
  )
})

function StatusLine({ status }: { status: TransitionStatus }) {
  const progress = useSongStore(s => s.loadingProgress)
  const shownProgress = status === 'entering' ? 100 : Math.max(4, Math.min(100, progress))
  return (
    <div className="kt-status">
      <div className="kt-status-text"><span key={status}>{STATUS_TEXT[status]}</span></div>
      <div className="kt-bar"><i style={{ transform: `scaleX(${shownProgress / 100})` }} /></div>
    </div>
  )
}
