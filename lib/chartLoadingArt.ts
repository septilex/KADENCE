import type { Vibe } from './types'
import { VIBE_CONFIGS } from './vibeConfig'

/**
 * Chart-selection loading artwork.
 *
 * Masters live in public/images/chart_loading/ exactly as supplied (PNG, 1672×941). The app
 * serves WebP derivatives generated from them by scripts/build-chart-loading-art.mjs into
 * public/images/chart_loading/optimized/<chart-id>-<width>.webp. Mapping is by chart ID,
 * never by array position.
 */

/** How the background moves, matched to what each painting depicts. */
export type ArtMotion =
  | 'arc'    // sweeping cosmic arcs / planet limb over cloud: drift along the arc
  | 'cloud'  // cloud banks: slow lateral drift with a gentle rise
  | 'vapor'  // gas, smoke and fire: slow breathing scale with a slight turn
  | 'peak'   // mountains: slow dolly-in toward the summit, mist moving across

export interface ChartLoadingArt {
  /** Master filename inside public/images/chart_loading/ (kept intact, never served). */
  master: string
  motion: ArtMotion
  /** object-position: keeps the painting's subject on screen when cropped (e.g. portrait). */
  focus: string
}

export const CHART_LOADING_DIR = '/images/chart_loading'
export const CHART_LOADING_WIDTHS = [960, 1672] as const

export const CHART_LOADING_ART: Record<Vibe, ChartLoadingArt | null> = {
  'global-top-50':    { master: 'Global Top 50 Loading.png',    motion: 'arc',   focus: '64% 62%' },
  'viral-50':         { master: 'Viral 50 Loading.png',         motion: 'arc',   focus: '70% 62%' },
  'new-music-friday': { master: 'New Music Friday Loading.png', motion: 'vapor', focus: '76% 50%' },
  'hip-hop-central':  { master: 'HipHop Central Loading.png',   motion: 'arc',   focus: '76% 58%' },
  'pop-rising':       { master: 'Pop Rising Loading.png',       motion: 'cloud', focus: '72% 64%' },
  'dance-hits':       { master: 'Dance Hits.png',               motion: 'arc',   focus: '74% 58%' },
  'mood-booster':     { master: 'Mood Booster.png',             motion: 'arc',   focus: '72% 62%' },
  'late-night':       { master: 'Late Night.png',               motion: 'vapor', focus: '82% 52%' },
  'workout':          { master: 'Workout.png',                  motion: 'vapor', focus: '66% 60%' },
  // The supplied file is spelled "Chill Hites.png" on disk; mapped to the real file.
  'chill-hits':       { master: 'Chill Hites.png',              motion: 'peak',  focus: '76% 56%' },
  'top-telugu':       { master: 'Top Telugu.png',               motion: 'peak',  focus: '80% 52%' },
  'top-tamil':        { master: 'Top Tamil.png',                motion: 'cloud', focus: '80% 64%' },
  'top-hindi':        { master: 'Top Hindi.png',                motion: 'cloud', focus: '66% 72%' },
  'top-kpop':         { master: 'Top K Pop.png',                motion: 'vapor', focus: '62% 72%' },
  // No artwork yet — the overlay renders its gold fallback.
  'dev-special':      null,
}

/** Served WebP derivative for a chart at one of CHART_LOADING_WIDTHS. */
export function chartLoadingSrc(vibe: Vibe, width: (typeof CHART_LOADING_WIDTHS)[number]): string {
  return `${CHART_LOADING_DIR}/optimized/${vibe}-${width}.webp`
}

/** srcset shared by the preloader and the <img>, so the browser picks (and caches) one file. */
export function chartLoadingSrcSet(vibe: Vibe): string | null {
  if (!CHART_LOADING_ART[vibe]) return null
  return CHART_LOADING_WIDTHS.map(w => `${chartLoadingSrc(vibe, w)} ${w}w`).join(', ')
}

export const CHART_LOADING_SIZES = '100vw'

const CONFIG = new Map(VIBE_CONFIGS.map(v => [v.id, v]))

/**
 * The chart's theme colours, from VIBE_CONFIGS. `primary` is the vivid tile colour (the same
 * rule Discover uses); Dev's Universe uses its gold accent because its bgColor is near-black.
 */
export function getChartColors(vibe: Vibe): { primary: string; deep: string; label: string; number: string } {
  const c = CONFIG.get(vibe)
  if (!c) return { primary: '#ffffff', deep: '#9a9aa8', label: 'KADENCE', number: '' }
  return {
    primary: vibe === 'dev-special' ? c.accentColor : c.bgColor,
    deep: vibe === 'dev-special' ? '#8a6a1c' : c.accentColor,
    label: c.label.replace(/^✨\s*/, ''),
    number: c.number,
  }
}
