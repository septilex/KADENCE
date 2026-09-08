import { SongNode, Vibe } from './types'
import { getOptimizedArtworkUrl } from './atlasManager'

interface CachedVibe {
  songs: SongNode[]
  timestamp: number
}

// Client-side in-memory cache TTL: 30 minutes
const CLIENT_CACHE_TTL = 30 * 60 * 1000

class VibeService {
  private clientCache = new Map<string, CachedVibe>()
  private inFlightFetches = new Map<string, Promise<SongNode[]>>()
  private prewarmedArtworks = new Set<string>()

  /**
   * Checks if a vibe's track metadata is already cached on the client.
   */
  public isCached(vibe: Vibe): boolean {
    const entry = this.clientCache.get(vibe)
    if (!entry) return false
    return Date.now() - entry.timestamp < CLIENT_CACHE_TTL
  }

  /**
   * Retrieves cached songs synchronously if available and fresh.
   */
  public getCachedSongs(vibe: Vibe): SongNode[] | null {
    const entry = this.clientCache.get(vibe)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CLIENT_CACHE_TTL) {
      this.clientCache.delete(vibe)
      return null
    }
    return entry.songs
  }

  /**
   * Fetches track list with automatic in-flight promise deduplication and caching.
   * If a fetch is already in flight for this vibe, returns the existing Promise.
   */
  public async fetchVibeSongs(vibe: Vibe, forceRefresh = false): Promise<SongNode[]> {
    if (!forceRefresh) {
      const cached = this.getCachedSongs(vibe)
      if (cached && cached.length > 0) {
        return cached
      }

      // In-flight deduplication: reuse running request
      const running = this.inFlightFetches.get(vibe)
      if (running) {
        return running
      }
    }

    const fetchPromise = (async () => {
      try {
        const qs = forceRefresh ? `?vibe=${vibe}&refresh=1` : `?vibe=${vibe}`
        const res = await fetch(`/api/songs${qs}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const songs = (data.songs || []) as SongNode[]

        if (songs.length > 0) {
          this.clientCache.set(vibe, { songs, timestamp: Date.now() })
        }
        return songs
      } catch (err) {
        console.warn(`[VibeService] Failed to load vibe ${vibe}:`, err)
        return []
      } finally {
        this.inFlightFetches.delete(vibe)
      }
    })()

    this.inFlightFetches.set(vibe, fetchPromise)
    return fetchPromise
  }

  /**
   * Intelligently prewarms a vibe in the background:
   * 1. Fetches metadata (reusing any in-flight fetch)
   * 2. Primes the browser HTTP cache for the critical 64 covers
   * Completely silent, non-blocking, and deduplicated.
   */
  public async prefetchVibe(vibe: Vibe): Promise<void> {
    try {
      const songs = await this.fetchVibeSongs(vibe)
      if (!songs || songs.length === 0) return

      // Prewarm the first 64 covers into the browser's HTTP disk cache
      const critical = songs.slice(0, 64)
      for (const song of critical) {
        if (!song.albumArt || this.prewarmedArtworks.has(song.albumArt)) continue
        this.prewarmedArtworks.add(song.albumArt)

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = getOptimizedArtworkUrl(song.albumArt, 256)
      }
    } catch {
      // Prefetch failures are non-critical and should fail silently
    }
  }

  public clearCache(): void {
    this.clientCache.clear()
    this.inFlightFetches.clear()
    this.prewarmedArtworks.clear()
  }
}

export const vibeService = new VibeService()
