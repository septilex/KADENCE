import { create } from 'zustand'
import type { Vibe } from '@/lib/types'
import { getChartColors, chartLoadingSrcSet, CHART_LOADING_SIZES } from '@/lib/chartLoadingArt'

/**
 * Chart-selection transition controller (one session at a time).
 *
 *   flash      chart colour expands from the click point (~400 ms)
 *   loading    chart artwork + visualiser; shown for at least MIN_LOADING_MS
 *   revealing  overlay fades out over the freshly rendered universe
 *
 * Sessions are keyed by the loadChart() request id, so a newer selection, Home, or an error
 * cancels the older session: its timers are cleared and its pending waits resolve `false`.
 * Only ChartTransitionOverlay, HeroBackgroundVideo and Universe subscribe to this store.
 */

export type TransitionPhase = 'idle' | 'flash' | 'loading' | 'revealing'
export type TransitionStatus = 'fetching' | 'artwork' | 'building' | 'entering'

export const FLASH_MS = 400
export const MIN_LOADING_MS = 2000
export const REVEAL_MS = 700
/** Safety net only: if the 3D view never reports a frame (e.g. WebGL failure), stop waiting. */
export const FIRST_FRAME_TIMEOUT_MS = 12000

interface TransitionState {
  phase: TransitionPhase
  vibe: Vibe | null
  request: number
  color: string
  deep: string
  origin: { x: number; y: number }
  status: TransitionStatus
  /** loadChart request whose universe must render one frame behind the overlay, or null. */
  warmRequest: number | null
}

export const useChartTransition = create<TransitionState>(() => ({
  phase: 'idle',
  vibe: null,
  request: 0,
  color: '#ffffff',
  deep: '#9a9aa8',
  origin: { x: 0, y: 0 },
  status: 'fetching',
  warmRequest: null,
}))

interface Session {
  request: number
  timers: Set<ReturnType<typeof setTimeout>>
  shown: Promise<boolean>
  firstFrame: Promise<boolean>
  resolveFirstFrame: (ok: boolean) => void
  cancel: () => void
}

let session: Session | null = null

// Where the last chart was picked from: pointer position for clicks/taps, screen centre for
// keyboard selections. A selection made within ORIGIN_TTL_MS of a pointerdown uses it.
const ORIGIN_TTL_MS = 1500
let lastPointer: { x: number; y: number; at: number } | null = null
let pointerListening = false
function listenForPointer() {
  if (pointerListening || typeof window === 'undefined') return
  pointerListening = true
  window.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY, at: performance.now() } }, { capture: true, passive: true })
}
listenForPointer()

function resolveOrigin(explicit?: { x: number; y: number }) {
  if (explicit) return explicit
  if (lastPointer && performance.now() - lastPointer.at < ORIGIN_TTL_MS) return { x: lastPointer.x, y: lastPointer.y }
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

const wait = (s: Session, ms: number) => new Promise<void>(resolve => {
  const t = setTimeout(() => { s.timers.delete(t); resolve() }, ms)
  s.timers.add(t)
})

/** Fetch + decode the chart's artwork (same srcset/sizes as the <img>, so one download). */
function decodeArtwork(vibe: Vibe): Promise<void> {
  const srcSet = chartLoadingSrcSet(vibe)
  if (!srcSet || typeof Image === 'undefined') return Promise.resolve()
  const img = new Image()
  img.decoding = 'async'
  img.sizes = CHART_LOADING_SIZES
  img.srcset = srcSet
  // A failed decode falls back to the colour backdrop rather than blocking the transition.
  return img.decode().catch(() => {})
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Start a transition for a loadChart() request. Supersedes any running session. */
export function startChartTransition(vibe: Vibe, request: number, origin?: { x: number; y: number }) {
  session?.cancel()
  const colors = getChartColors(vibe)
  let resolveFirstFrame: (ok: boolean) => void = () => {}
  const firstFrame = new Promise<boolean>(r => { resolveFirstFrame = r })
  let cancelled = false
  let resolveShown: (ok: boolean) => void = () => {}
  const s: Session = {
    request,
    timers: new Set(),
    shown: new Promise<boolean>(r => { resolveShown = r }),
    firstFrame,
    resolveFirstFrame,
    cancel: () => {
      cancelled = true
      s.timers.forEach(clearTimeout)
      s.timers.clear()
      resolveShown(false)
      resolveFirstFrame(false)
    },
  }
  session = s

  useChartTransition.setState({
    phase: 'flash', vibe, request, color: colors.primary, deep: colors.deep,
    origin: resolveOrigin(origin), status: 'fetching', warmRequest: null,
  })

  // Artwork appears once the flash has filled the screen AND the image is decoded. The
  // minimum loading time is counted from that moment.
  void Promise.all([wait(s, reducedMotion() ? 0 : FLASH_MS), decodeArtwork(vibe)]).then(async () => {
    if (cancelled || session !== s) return
    useChartTransition.setState({ phase: 'loading' })
    await wait(s, MIN_LOADING_MS)
    if (!cancelled) resolveShown(true)
  })
}

/** Loading-text stage; ignored for superseded requests. */
export function setChartTransitionStatus(request: number, status: TransitionStatus) {
  if (session?.request === request) useChartTransition.setState({ status })
}

/** Chart data and critical artwork are committed: let the universe render one frame. */
export function beginSceneWarmup(request: number) {
  const s = session
  if (s?.request !== request) return
  useChartTransition.setState({ warmRequest: request, status: 'building' })
  void wait(s, FIRST_FRAME_TIMEOUT_MS).then(() => {
    if (session === s) {
      console.warn('[KADENCE] 3D view did not report a frame in time; revealing anyway')
      s.resolveFirstFrame(true)
    }
  })
}

/** Called by the universe once a frame containing the new chart has been drawn. */
export function reportFirstFrame(request: number) {
  if (session?.request === request) session.resolveFirstFrame(true)
}

/**
 * Resolves true once the artwork has been visible for MIN_LOADING_MS and the universe has
 * rendered its first frame; false if this request was superseded or cancelled meanwhile.
 * With no session (e.g. a refresh) it resolves true immediately.
 */
export async function whenChartRevealable(request: number): Promise<boolean> {
  const s = session
  if (!s) return true
  if (s.request !== request) return false
  const [shown, frame] = await Promise.all([s.shown, s.firstFrame])
  return shown && frame && session === s
}

/** Fade the overlay out over the universe, then go idle. */
export function revealChartTransition(request: number) {
  const s = session
  if (s?.request !== request) return
  useChartTransition.setState({ phase: 'revealing', status: 'entering', warmRequest: null })
  void wait(s, REVEAL_MS).then(() => {
    if (session !== s) return
    session = null
    useChartTransition.setState({ phase: 'idle', vibe: null })
  })
}

/** Abort immediately (error, Home). With a request id, only that session is cancelled. */
export function cancelChartTransition(request?: number) {
  if (!session || (request !== undefined && session.request !== request)) return
  session.cancel()
  session = null
  useChartTransition.setState({ phase: 'idle', vibe: null, warmRequest: null })
}
