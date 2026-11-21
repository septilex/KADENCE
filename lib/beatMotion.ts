import { beatDebug, updateBeatDebug } from './beatDebug'
import { registerHomepageAudio } from './homepageBeatAudio'
import { subscribeBeats, setBeatSurfaceActive } from './beatEvents'
/** The wrapper owns only the extra beat transform; the video's existing crop stays intact. */
export function bindBeatMotion(element: HTMLElement, video: HTMLVideoElement, priority = 0) {
  const owner = {}
  let unregisterAudio: (() => void) | null = null
  let animation: Animation | null = null
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  const update = () => {
    const visible = !video.paused && !video.ended && !document.hidden && !media.matches
    setBeatSurfaceActive(visible, owner)
    element.setAttribute?.('data-beat-surface', visible ? 'active' : 'inactive')
    if (visible && !unregisterAudio) unregisterAudio = registerHomepageAudio(video, priority)
    if (!visible) { unregisterAudio?.(); unregisterAudio = null }
  }
  video.addEventListener('playing', update); video.addEventListener('pause', update); video.addEventListener('ended', update)
  media.addEventListener('change', update); document.addEventListener('visibilitychange', update)
  update()
  const reset = () => { animation?.cancel(); animation = null }
  const unsubscribe = subscribeBeats(strength => {
    reset()
    if (!strength || video.paused || video.ended || media.matches || document.hidden || !element.animate) return
    const peak = 1.04 + Math.min(1, strength) * 0.035
    animation = element.animate([
      { transform: 'translate3d(0,0,0) scale(1)', offset: 0 },
      { transform: `translate3d(0,${-3 * strength}px,0) scale(${peak})`, offset: 0.22, easing: 'cubic-bezier(.16,1,.3,1)' },
      { transform: 'translate3d(0,0,0) scale(1)', offset: 1 },
    ], { duration: 310, easing: 'ease-out' })
    updateBeatDebug({ animations: beatDebug.animations + 1, surface: video.currentSrc || video.src || 'homepage video' })
    // No fill: completed effects release their transform and restore exact CSS rest.
  })
  media.addEventListener('change', reset)
  document.addEventListener('visibilitychange', reset)
  return () => { setBeatSurfaceActive(false, owner); unregisterAudio?.(); element.removeAttribute?.('data-beat-surface'); video.removeEventListener('playing', update); video.removeEventListener('pause', update); video.removeEventListener('ended', update); media.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); reset(); unsubscribe(); media.removeEventListener('change', reset); document.removeEventListener('visibilitychange', reset) }
}
