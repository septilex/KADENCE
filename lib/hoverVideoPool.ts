import { releaseHomepageAudio } from './homepageBeatAudio'

/** Keep a few recently played decoders/buffers alive, without preloading the entire grid. */
export class HoverVideoPool {
  readonly videos = new Map<string, HTMLVideoElement>()
  static readonly LIMIT = 3

  constructor(private createVideo = () => document.createElement('video')) {}

  get(source: string): HTMLVideoElement {
    const cached = this.videos.get(source)
    if (cached) {
      this.videos.delete(source)
      this.videos.set(source, cached)
      return cached
    }
    while (this.videos.size >= HoverVideoPool.LIMIT) {
      this.release(this.videos.keys().next().value!)
    }
    const video = this.createVideo()
    video.playsInline = true
    video.loop = true
    video.preload = 'auto'
    video.src = source
    this.videos.set(source, video)
    return video
  }

  stop(source: string) {
    const video = this.videos.get(source)
    if (!video) return
    video.pause()
    video.style.opacity = '0'
    // A fly-by must not leave a large download competing with the next track.
    if (video.readyState < 2) this.release(source)
    else video.preload = 'metadata'
  }

  private release(source: string) {
    const video = this.videos.get(source)
    if (!video) return
    video.pause()
    releaseHomepageAudio(video)
    video.removeAttribute('src')
    video.load()
    video.remove()
    this.videos.delete(source)
  }

  dispose() {
    for (const source of this.videos.keys()) this.release(source)
  }
}
