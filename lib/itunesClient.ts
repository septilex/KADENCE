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
  /** 1-based position on the Apple chart this track came from (topSongs only). */
  chartRank?: number
}

export class MusicProviderError extends Error {}

const SEARCH_TTL = 30 * 60 * 1000
/** Apple's top-song charts update about once a day. */
const CHART_TTL = 2 * 60 * 60 * 1000
const STALE_LIMIT = 24 * 60 * 60 * 1000

type Parser = (data: unknown) => ItunesTrack[]

const STRING_KEYS = ['trackName', 'artistName', 'collectionName', 'artworkUrl100', 'previewUrl', 'trackViewUrl', 'primaryGenreName', 'releaseDate'] as const

/** iTunes Search API: { results: [...] } */
const parseSearch: Parser = data => {
  if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) throw new MusicProviderError('Invalid music provider response')
  return data.results.filter((track: unknown): track is ItunesTrack => {
    if (!track || typeof track !== 'object' || !('trackId' in track) || typeof track.trackId !== 'number') return false
    for (const key of STRING_KEYS) {
      const value = (track as Record<string, unknown>)[key]
      if (value !== undefined && typeof value !== 'string') return false
    }
    return true
  })
}

type Label = { label?: string; attributes?: Record<string, string> }
const label = (v: unknown): string | undefined => (v && typeof v === 'object' && typeof (v as Label).label === 'string' ? (v as Label).label : undefined)

/**
 * Apple's documented iTunes top-songs RSS (JSON): itunes.apple.com/{cc}/rss/topsongs/…/json.
 * Each entry carries the track id, metadata, artwork and the official 30 s preview URL.
 */
const parseChart: Parser = data => {
  const feed = data && typeof data === 'object' && 'feed' in data ? (data as { feed: unknown }).feed : null
  if (!feed || typeof feed !== 'object') throw new MusicProviderError('Invalid chart response')
  const raw = (feed as { entry?: unknown }).entry
  const entries: unknown[] = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  const tracks: ItunesTrack[] = []
  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return
    const e = entry as Record<string, unknown>
    const id = Number((e.id as Label | undefined)?.attributes?.['im:id'])
    if (!Number.isFinite(id) || id <= 0) return
    const links = Array.isArray(e.link) ? e.link as Label[] : e.link ? [e.link as Label] : []
    const preview = links.find(l => l.attributes?.['im:assetType'] === 'preview')?.attributes?.href
    const page = links.find(l => l.attributes?.rel === 'alternate')?.attributes?.href
    const images = Array.isArray(e['im:image']) ? e['im:image'] as Label[] : []
    const art = images.length ? label(images[images.length - 1]) : undefined
    const collection = e['im:collection'] as Record<string, unknown> | undefined
    tracks.push({
      trackId: id,
      trackName: label(e['im:name']),
      artistName: label(e['im:artist']),
      collectionName: collection ? label(collection['im:name']) : undefined,
      // Same URL scheme as the Search API, so artwork sizing stays uniform downstream.
      artworkUrl100: art?.replace(/\/\d+x\d+bb\.(png|jpg)$/, '/100x100bb.jpg'),
      previewUrl: preview,
      trackViewUrl: page,
      primaryGenreName: (e.category as Label | undefined)?.attributes?.term,
      releaseDate: label(e['im:releaseDate']),
      chartRank: i + 1,
    })
  })
  return tracks
}

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
    return this.get(url, parseSearch, SEARCH_TTL)
  }

  /** Apple's current top songs for a storefront, optionally within one genre (e.g. 1264 Tamil). */
  async topSongs(country: string, genre?: number, limit = 100): Promise<ItunesTrack[]> {
    const cc = country.toLowerCase().replace(/[^a-z]/g, '')
    const url = `https://itunes.apple.com/${cc}/rss/topsongs/limit=${Math.max(1, Math.min(200, limit))}${genre ? `/genre=${Math.floor(genre)}` : ''}/json`
    return this.get(url, parseChart, CHART_TTL)
  }

  private async get(url: string, parse: Parser, ttl: number): Promise<ItunesTrack[]> {
    const cached = this.cache.get(url)
    if (cached && this.now() - cached.time < ttl) return cached.tracks
    const running = this.pending.get(url)
    if (running) return running
    if (this.pending.size >= 32) throw new MusicProviderError('Music provider is busy')
    const promise = this.load(url, parse).then(tracks => {
      if (tracks.length) {
        this.cache.delete(url)
        this.cache.set(url, { tracks, time: this.now() })
        while (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!)
      }
      return tracks
    }).catch(error => {
      if (cached && this.now() - cached.time < STALE_LIMIT) return cached.tracks
      throw error
    }).finally(() => this.pending.delete(url))
    this.pending.set(url, promise)
    return promise
  }

  private async load(url: string, parse: Parser): Promise<ItunesTrack[]> {
    // Reserve the slot before awaiting; a release transfers it directly to a waiter.
    if (this.active >= 3) await new Promise<void>(resolve => this.waiters.push(resolve))
    else this.active++
    try {
      this.started = this.started.filter(t => this.now() - t < 60000)
      if (this.started.length >= 20) throw new MusicProviderError('Music provider rate limit reached')
      this.started.push(this.now())
      const res = await this.request(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new MusicProviderError(`Music provider returned ${res.status}`)
      return parse(await res.json())
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
