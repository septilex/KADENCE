import { updateBeatDebug } from './beatDebug'
import { BeatAnalyser } from './beatAnalyser'

const events = ['playing', 'pause', 'ended', 'error', 'volumechange', 'waiting', 'emptied']
/** A single page-lifetime analyser arbitrates registered audible sources, never DOM-scans preloads. */
export class HomepageBeatAudio {
  private candidates = new Map<HTMLMediaElement, { priority: number; cleanup: () => void }>()
  private current: HTMLMediaElement | null = null
  constructor(private analyser = new BeatAnalyser()) {}
  private reconcile = () => {
    let chosen: HTMLMediaElement | null = null, priority = -Infinity
    for (const [media, entry] of this.candidates) {
      if (!media.paused && !media.ended && !media.muted && media.volume > 0 && !media.error && entry.priority >= priority) { chosen = media; priority = entry.priority }
    }
    if (chosen !== this.current) { this.current = chosen; this.analyser.setActive(chosen) }
    if (!chosen && this.candidates.size) {
      const media = [...this.candidates.keys()].at(-1)!
      updateBeatDebug({ source: media.currentSrc || media.src || '', media: media.tagName || '', playing: false, status: media.muted || media.volume === 0 ? 'media muted: click page to enable audio' : 'media paused, ended, or unavailable' })
    }
  }
  register(media: HTMLMediaElement, priority: number) {
    for (const event of events) media.addEventListener(event, this.reconcile)
    const entry = { priority, cleanup: () => { for (const event of events) media.removeEventListener(event, this.reconcile) } }
    this.candidates.set(media, entry); this.reconcile()
    return () => { if (this.candidates.get(media) !== entry) return; entry.cleanup(); this.candidates.delete(media); this.reconcile() }
  }
  release(media: HTMLMediaElement) { this.candidates.get(media)?.cleanup(); this.candidates.delete(media); this.reconcile(); this.analyser.release(media) }
  dispose() { for (const entry of this.candidates.values()) entry.cleanup(); this.candidates.clear(); this.current = null; this.analyser.dispose() }
}
let shared: HomepageBeatAudio | null = null
const service = () => shared ??= new HomepageBeatAudio()
export function registerHomepageAudio(media: HTMLMediaElement, priority: number) { return typeof window === 'undefined' ? () => {} : service().register(media, priority) }
export function releaseHomepageAudio(media: HTMLMediaElement) { shared?.release(media) }
export function createTrackBeatChannel() {
  let unregister: (() => void) | null = null
  return {
    setActive(media: HTMLAudioElement | null) { unregister?.(); unregister = media ? registerHomepageAudio(media, 1) : null },
    release(media: HTMLAudioElement) { releaseHomepageAudio(media) },
    dispose() { unregister?.(); unregister = null },
  }
}
