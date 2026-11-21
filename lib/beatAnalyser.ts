import { beatDebug, updateBeatDebug, debugEnabled } from './beatDebug'
import { BassOnset } from './bassOnset'
import { emitBeat, isBeatSurfaceActive, subscribeBeatSurface } from './beatEvents'

/** Owned by AudioEngine. Existing media remains the sole decoder and player. */
export class BeatAnalyser {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sources = new Map<HTMLMediaElement, MediaElementAudioSourceNode>()
  private active: HTMLMediaElement | null = null
  private enabled = true
  private disposed = false
  private frame = 0
  private data = new Float32Array(1024)
  private detector = new BassOnset()
  private cleanup: (() => void) | null = null
  private unsubscribeSurface: () => void
  private motion: MediaQueryList | null = null
  constructor() {
    this.unsubscribeSurface = subscribeBeatSurface(this.refresh)
    if (typeof window === 'undefined') return
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.motion.addEventListener('change', this.refresh)
    document.addEventListener('visibilitychange', this.refresh)
    window.addEventListener('pointerdown', this.resume)
    window.addEventListener('keydown', this.resume)
  }
  private resume = () => {
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => {})
    this.refresh()
  }
  setEnabled(enabled: boolean) { this.enabled = enabled; this.refresh() }
  setActive(audio: HTMLMediaElement | null) {
    this.cleanup?.(); this.cleanup = null
    this.stop()
    for (const source of this.sources.values()) { try { if (this.analyser) source.disconnect(this.analyser) } catch {} }
    this.active = audio
    if (audio) {
      const events = ['playing', 'pause', 'ended', 'error', 'waiting', 'seeking', 'seeked', 'loadeddata', 'volumechange', 'emptied']
      for (const event of events) audio.addEventListener(event, this.refresh)
      this.cleanup = () => { for (const event of events) audio.removeEventListener(event, this.refresh) }
    }
    this.refresh()
  }
  private stop() { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.detector.reset(); emitBeat(0) }
  private refresh = () => {
    this.stop()
    const audio = this.active
    updateBeatDebug({ source: audio?.currentSrc || audio?.src || '', media: audio?.tagName || '', playing: !!audio && !audio.paused && !audio.ended && !audio.muted && audio.volume > 0, context: this.context?.state || 'not created', readable: false, bass: 0, flux: 0, threshold: 0, status: !isBeatSurfaceActive() ? 'homepage video not visible/playing' : !this.enabled ? 'disabled' : this.motion?.matches ? 'reduced motion' : 'waiting for audible ready media' })
    if (!isBeatSurfaceActive() || this.disposed || !audio || !this.enabled || typeof window === 'undefined' || document.hidden || this.motion?.matches || audio.muted || audio.volume === 0 || audio.paused || audio.ended || audio.seeking || audio.error || audio.readyState < 3) return
    // A successfully loaded anonymous-CORS resource is readable. Never reroute
    // opaque/no-CORS media, and never attach while a context is suspended.
    const url = audio.currentSrc || audio.src
    const sameOrigin = url && typeof location !== 'undefined' && new URL(url, location.href).origin === location.origin
    if (!sameOrigin && audio.crossOrigin !== 'anonymous') { updateBeatDebug({ status: 'blocked: cross-origin media was not loaded with CORS' }); return }
    try {
      const Context = window.AudioContext
      if (!Context) { updateBeatDebug({ status: 'Web Audio unavailable' }); return }
      if (!this.context) {
        this.context = new Context()
        this.analyser = this.context.createAnalyser()
        this.analyser.fftSize = 2048
        this.analyser.smoothingTimeConstant = 0
        this.context.addEventListener('statechange', this.refresh)
      }
      if (this.context.state !== 'running') { updateBeatDebug({ context: this.context.state, status: 'context suspended: click to enable' }); void this.context.resume().catch(() => {}); return }
      let source = this.sources.get(audio)
      if (!source) {
        source = this.context.createMediaElementSource(audio)
        this.sources.set(audio, source)
        source.connect(this.context.destination) // Audible path is never gated by analysis.
      }
      try { source.disconnect(this.analyser!) } catch {}
      source.connect(this.analyser!) // Side branch only; no second audible route.
      updateBeatDebug({ context: this.context.state, status: 'analysing', error: '' })
      const sample = (time: number) => {
        this.analyser!.getFloatFrequencyData(this.data)
        const strength = this.detector.sample(this.data, this.context!.sampleRate, 2048, time)
        if (debugEnabled()) updateBeatDebug({ readable: this.data.some(v => Number.isFinite(v) && v > -100), bass: this.detector.metrics.energy, flux: this.detector.metrics.flux, threshold: this.detector.metrics.threshold })
        if (strength) { updateBeatDebug({ beats: beatDebug.beats + 1 }); emitBeat(strength) }
        this.frame = requestAnimationFrame(sample)
      }
      this.frame = requestAnimationFrame(sample)
    } catch (error) { updateBeatDebug({ status: 'analysis error', error: String(error) }); console.warn('[KADENCE] Beat analysis unavailable', error) }
  }
  release(audio: HTMLMediaElement) {
    if (this.active === audio) this.setActive(null)
    this.sources.get(audio)?.disconnect(); this.sources.delete(audio)
  }
  dispose() {
    this.unsubscribeSurface()
    this.disposed = true; this.setActive(null)
    for (const source of this.sources.values()) source.disconnect()
    this.sources.clear()
    this.motion?.removeEventListener('change', this.refresh)
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.refresh)
      window.removeEventListener('pointerdown', this.resume); window.removeEventListener('keydown', this.resume)
    }
    this.context?.removeEventListener('statechange', this.refresh)
    void this.context?.close().catch(() => {})
  }
}
