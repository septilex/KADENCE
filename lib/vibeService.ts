import { SongNode, Vibe } from './types'
import { getOptimizedArtworkUrl } from './artwork'

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
  /** Refresh count per chart; sent as `rotation` so each refresh is a new selection. */
  private rotations = new Map<string, number>()

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
    // A refresh asks the server for the next rotation of the chart (a different selection,
    // cached under its own URL), so it never gets the previous answer back. A refresh while a
    // normal load is in flight still starts its own request.
    if (forceRefresh) this.rotations.set(vibe, (this.rotations.get(vibe) ?? 0) + 1)
    const rotation = this.rotations.get(vibe) ?? 0
    const key = `${vibe}:${rotation}`
    const running = this.inFlightFetches.get(key)
    if (running) return running
    if (!forceRefresh) {
      const cached = this.getCachedSongs(vibe)
      if (cached && cached.length > 0) return cached
    }

    const fetchPromise = (async () => {
      try {
        const qs = rotation ? `?vibe=${vibe}&rotation=${rotation}` : `?vibe=${vibe}`
        const res = await fetch(`/api/songs${qs}`, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const songs = (data.songs || []) as SongNode[]

        if (songs.length > 0) {
          this.clientCache.set(vibe, { songs, timestamp: Date.now() })
        }
        return songs
      } catch (err) {
        console.warn(`[VibeService] Failed to load vibe ${vibe}:`, err)
        throw err
      } finally {
        this.inFlightFetches.delete(key)
      }
    })()

    this.inFlightFetches.set(key, fetchPromise)
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

      // Prewarm the first 12 covers into the browser's HTTP disk cache (reduced to prevent network saturation)
      const critical = songs.slice(0, 12)
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

  /**
   * Eagerly prefetches ALL vibe metadata in parallel (staggered).
   * This pre-warms both server cache (20min TTL) and client cache (30min TTL)
   * so that clicking any category card resolves instantly from cache.
   * Safe to call multiple times — deduplicates automatically.
   */
  public async prefetchAllVibes(): Promise<void> {
    const ALL_VIBES = [
      'global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central',
      'pop-rising', 'dance-hits', 'mood-booster', 'late-night',
      'workout', 'chill-hits', 'dev-special',
      'top-telugu', 'top-tamil', 'top-hindi', 'top-kpop',
    ] as const

    // Fire all fetches in parallel — vibeService deduplicates in-flight requests
    for (const vibe of ALL_VIBES) {
      if (!this.isCached(vibe)) await this.fetchVibeSongs(vibe, false).catch(() => {})
    }
  }

  public clearCache(): void {
    this.clientCache.clear()
    this.inFlightFetches.clear()
    this.prewarmedArtworks.clear()
  }
}

export const vibeService = new VibeService()
