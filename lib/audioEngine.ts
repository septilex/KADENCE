type Entry = { audio: HTMLAudioElement; ready: boolean; cleanup: () => void }
export interface AudioEngineCallbacks {
  playing: (playing: boolean) => void
  progress: (percent: number, duration: number) => void
  error: (message: string | null) => void
}

/** One lifecycle owner for playback, bounded preloading, and all media callbacks. */
export class AudioEngine {
  readonly pool = new Map<string, Entry>()
  private active: Entry | null = null
  private url: string | null = null
  private generation = 0
  private disposed = false
  private queue: string[] = []
  private progressTimer: ReturnType<typeof setInterval> | null = null
  static readonly MAX_POOL = 12
  static readonly PRELOAD_COUNT = 4
  static readonly PRELOAD_CONCURRENCY = 2
  constructor(private callbacks: AudioEngineCallbacks, private createAudio = () => new Audio()) {}

  private release(url: string) {
    const entry = this.pool.get(url)
    if (!entry) return
    this.pool.delete(url)
    entry.cleanup()
    entry.audio.pause()
    entry.audio.removeAttribute('src')
    entry.audio.load()
  }

  private get(url: string): Entry {
    const cached = this.pool.get(url)
    if (cached) { this.pool.delete(url); this.pool.set(url, cached); return cached }
    while (this.pool.size >= AudioEngine.MAX_POOL) {
      const oldest = [...this.pool].find(([, e]) => e !== this.active)
      if (!oldest) break
      this.release(oldest[0])
    }
    const audio = this.createAudio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.volume = 0.35
    const entry: Entry = { audio, ready: false, cleanup: () => {} }
    const ready = () => { clearTimeout(timeout); entry.ready = true; this.pump() }
    const error = () => {
      if (this.disposed || this.pool.get(url) !== entry) return
      if (this.active === entry) {
        this.generation++
        this.stopProgress()
        this.active = null
        this.callbacks.error('This preview could not be loaded. Try again or open the track on its music service.')
        this.callbacks.playing(false)
      }
      this.release(url)
      this.pump()
    }
    const ended = () => {
      if (this.active !== entry) return
      this.stopProgress()
      this.callbacks.progress(100, Number.isFinite(audio.duration) ? audio.duration : 0)
      this.callbacks.playing(false)
    }
    const metadata = () => { if (this.active === entry) this.reportProgress() }
    // Browsers need not fire canplaythrough. Bound every preload wait.
    const timeout = setTimeout(error, 12000)
    audio.addEventListener('loadeddata', ready, { once: true })
    audio.addEventListener('error', error)
    audio.addEventListener('ended', ended)
    audio.addEventListener('loadedmetadata', metadata)
    entry.cleanup = () => {
      clearTimeout(timeout)
      audio.removeEventListener('loadeddata', ready)
      audio.removeEventListener('error', error)
      audio.removeEventListener('ended', ended)
      audio.removeEventListener('loadedmetadata', metadata)
    }
    this.pool.set(url, entry)
    audio.src = url
    audio.load()
    return entry
  }

  preload(urls: string[]) {
    this.queue = [...new Set(urls.filter(Boolean))].slice(0, AudioEngine.PRELOAD_COUNT)
    const allowed = new Set(urls)
    for (const [url, entry] of this.pool) if (entry !== this.active && !allowed.has(url)) this.release(url)
    this.pump()
  }
  private pump() {
    if (this.disposed) return
    let loading = [...this.pool.values()].filter(e => !e.ready && e !== this.active).length
    while (this.queue.length && loading < AudioEngine.PRELOAD_CONCURRENCY) {
      const url = this.queue.shift()!
      if (!this.pool.has(url)) { this.get(url); loading++ }
    }
  }
  setSource(url: string | null, playing: boolean) {
    if (this.disposed) return
    this.generation++
    const previous = this.active
    previous?.audio.pause()
    this.stopProgress()
    if (previous && !previous.ready && this.url) this.release(this.url)
    this.url = url
    this.active = null
    this.callbacks.progress(0, 0)
    this.callbacks.error(null)
    if (!url) return
    this.active = this.get(url)
    this.active.audio.currentTime = 0
    if (playing) this.play()
  }
  setPlaying(playing: boolean) {
    if (this.disposed) return
    this.generation++
    if (!playing) { this.active?.audio.pause(); this.stopProgress(); return }
    if (!this.active && this.url) this.active = this.get(this.url)
    if (this.active) this.play()
  }
  private play() {
    const entry = this.active
    if (!entry) return
    const generation = ++this.generation
    this.callbacks.error(null)
    if (entry.audio.ended) entry.audio.currentTime = 0
    entry.audio.play().then(() => {
      if (this.disposed || this.active !== entry || generation !== this.generation) {
        if (this.active !== entry) entry.audio.pause()
        return
      }
      this.callbacks.playing(true)
      this.reportProgress()
      this.stopProgress()
      this.progressTimer = setInterval(() => this.reportProgress(), 125)
    }).catch((error: unknown) => {
      if (this.disposed || this.active !== entry || generation !== this.generation) return
      this.stopProgress()
      const name = (error as { name?: string }).name
      this.callbacks.error(name === 'NotAllowedError' ? 'Press play to enable audio previews.' : 'Preview unavailable. Try again or open the track on its music service.')
      this.callbacks.playing(false)
    })
  }
  seek(percent: number) {
    const audio = this.active?.audio
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(percent)) return
    audio.currentTime = Math.max(0, Math.min(100, percent)) / 100 * audio.duration
    this.reportProgress()
  }
  private reportProgress() {
    const audio = this.active?.audio
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) this.callbacks.progress(audio.currentTime / audio.duration * 100, audio.duration)
  }
  private stopProgress() { if (this.progressTimer) clearInterval(this.progressTimer); this.progressTimer = null }
  dispose() {
    this.disposed = true
    this.generation++
    this.stopProgress()
    this.queue = []
    this.active = null
    for (const url of this.pool.keys()) this.release(url)
  }
}
