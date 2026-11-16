export interface ItunesTrack {
  trackId: number
  trackName?: string
  artistName?: string
  collectionName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  primaryGenreName?: string
  releaseDate?: string
}

export class MusicProviderError extends Error {}

/** Bounded per-process cache and single-flight protection for Apple's search service. */
export class ItunesClient {
  private cache = new Map<string, { tracks: ItunesTrack[]; time: number }>()
  private pending = new Map<string, Promise<ItunesTrack[]>>()
  private started: number[] = []
  private active = 0
  private waiters: (() => void)[] = []
  constructor(private request: typeof fetch = fetch, private now = () => Date.now()) {}

  async search(term: string, limit = 200, country = 'US'): Promise<ItunesTrack[]> {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term.trim())}&entity=song&limit=${Math.max(1, Math.min(200, limit))}&country=${country}`
    const cached = this.cache.get(url)
    if (cached && this.now() - cached.time < 30 * 60 * 1000) return cached.tracks
    const running = this.pending.get(url)
    if (running) return running
    if (this.pending.size >= 32) throw new MusicProviderError('Music provider is busy')
    const promise = this.load(url).then(tracks => {
      if (tracks.length) {
        this.cache.delete(url)
        this.cache.set(url, { tracks, time: this.now() })
        while (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!)
      }
      return tracks
    }).catch(error => {
      if (cached && this.now() - cached.time < 24 * 60 * 60 * 1000) return cached.tracks
      throw error
    }).finally(() => this.pending.delete(url))
    this.pending.set(url, promise)
    return promise
  }

  private async load(url: string): Promise<ItunesTrack[]> {
    // Reserve the slot before awaiting; a release transfers it directly to a waiter.
    if (this.active >= 3) await new Promise<void>(resolve => this.waiters.push(resolve))
    else this.active++
    try {
      this.started = this.started.filter(t => this.now() - t < 60000)
      if (this.started.length >= 20) throw new MusicProviderError('Music provider rate limit reached')
      this.started.push(this.now())
      const res = await this.request(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new MusicProviderError(`Music provider returned ${res.status}`)
      const data: unknown = await res.json()
      if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) throw new MusicProviderError('Invalid music provider response')
      return data.results.filter((track: unknown): track is ItunesTrack => {
        if (!track || typeof track !== 'object' || !('trackId' in track) || typeof track.trackId !== 'number') return false
        for (const key of ['trackName', 'artistName', 'collectionName', 'artworkUrl100', 'previewUrl', 'trackViewUrl', 'primaryGenreName', 'releaseDate']) {
          const value = (track as Record<string, unknown>)[key]
          if (value !== undefined && typeof value !== 'string') return false
        }
        return true
      })
    } catch (error) {
      if (error instanceof MusicProviderError) throw error
      throw new MusicProviderError('Music provider request failed or timed out')
    } finally {
      const next = this.waiters.shift()
      if (next) next()
      else this.active--
    }
  }
}

export const itunesClient = new ItunesClient()
