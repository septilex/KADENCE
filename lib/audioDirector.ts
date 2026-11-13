import { useSongStore } from '@/store/songStore'
import { useAudioStore } from '@/store/audioStore'
import { logAudioDebug } from './audioDebug'

/**
 * Hover/selection → audio bridge, outside React.
 *
 * Previously `Home` subscribed to a derived `targetAudioUrl` and called playUrl() from an
 * effect, which re-rendered the whole page on every tile change (often inside the WebGL frame).
 * This module subscribes to the song store directly, so tile changes no longer render `Home`.
 *
 * Policy:
 *  - While Song Detail is open, the SELECTED song wins (hovering hidden tiles under the panel
 *    must not hijack playback). Otherwise the hovered song plays.
 *  - Hover-driven switches wait HOVER_DWELL_MS; tiles merely crossed during a sweep never start
 *    a download or play(). Selection changes act immediately.
 *  - A null target (pointer left the wall, chart switch in progress) keeps the current audio,
 *    exactly as before.
 */
export const HOVER_DWELL_MS = 150

type SongState = ReturnType<typeof useSongStore.getState>

function targetUrl(s: SongState): string | null {
  if (s.isChangingVibe) return null
  if (s.selectedSong) return s.selectedSong.previewUrl ?? null
  return s.hoveredSong?.previewUrl ?? null
}

let started = false

/** Starts the director once (client only). Returns a stop function. */
export function startAudioDirector(): () => void {
  if (started || typeof window === 'undefined') return () => {}
  started = true

  let lastTarget: string | null = targetUrl(useSongStore.getState())
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }

  const unsubscribe = useSongStore.subscribe((state, prev) => {
    if (
      state.hoveredSong === prev.hoveredSong &&
      state.selectedSong === prev.selectedSong &&
      state.isChangingVibe === prev.isChangingVibe
    ) return

    const target = targetUrl(state)
    if (target === lastTarget) return
    lastTarget = target
    clear()
    if (!target) return

    const play = () => {
      if (targetUrl(useSongStore.getState()) !== target) return
      if (useAudioStore.getState().currentUrl === target) return
      logAudioDebug('audioDirector → playUrl', target)
      useAudioStore.getState().playUrl(target)
    }

    if (state.selectedSong !== prev.selectedSong) play()
    else timer = setTimeout(() => { timer = null; play() }, HOVER_DWELL_MS)
  })

  return () => { clear(); unsubscribe(); started = false }
}
