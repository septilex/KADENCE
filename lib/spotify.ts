import { SpotifyTrack, SongNode, Vibe } from './types'

let cachedToken: string | null = null
let tokenExpiry: number = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('[DIAG:token] Using cached token, valid for', Math.round((tokenExpiry - Date.now()) / 1000), 's')
    return cachedToken
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  console.log('[DIAG:token] Requesting new token — clientId prefix:', clientId?.slice(0, 8) ?? 'MISSING')

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  console.log('[DIAG:token] Token response status:', res.status)
  if (!res.ok) {
    const errBody = await res.text()
    console.error('[DIAG:token] Token FAILED body:', errBody)
    throw new Error(`Spotify auth failed: ${res.status} — ${errBody}`)
  }
  const data = await res.json()
  console.log('[DIAG:token] Token OK — expires_in:', data.expires_in, 's')
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

async function spotifyFetch(endpoint: string): Promise<unknown> {
  const token = await getAccessToken()
  const url = `https://api.spotify.com/v1${endpoint}`
  console.log('[DIAG:fetch] GET', url.substring(0, 120))

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', // Disable cache for diagnostics
  })

  console.log('[DIAG:fetch] Response status:', res.status, '|', endpoint.substring(0, 80))

  const rawText = await res.text()
  console.log(`[DIAG:fetch] Raw response body (first 500 chars): ${rawText.substring(0, 500)}`)

  if (!res.ok) {
    console.error('[DIAG:fetch] FAIL body:', rawText.substring(0, 400))
    throw new Error(`Spotify API error: ${res.status} ${endpoint}`)
  }

  const json = JSON.parse(rawText)
  // Log top-level keys of the response to verify shape
  console.log('[DIAG:fetch] Response top-level keys:', Object.keys(json as object))
  return json
}

// ─── Genre-color mapping ───────────────────────────────────────────────────
const GENRE_COLORS: Record<string, string> = {
  pop: '#ff6b9d',
  rock: '#ff4757',
  'hip-hop': '#ffa502',
  electronic: '#00d2ff',
  jazz: '#c06c84',
  classical: '#f8b500',
  'r&b': '#a29bfe',
  metal: '#636e72',
  indie: '#55efc4',
  folk: '#fdcb6e',
  country: '#e17055',
  latin: '#fd79a8',
  soul: '#e84393',
  ambient: '#74b9ff',
  dance: '#0984e3',
  blues: '#6c5ce7',
  synthwave: '#9b59b6',
  industrial: '#5d4037',
  phonk: '#e74c3c',
}

function genreToColor(genres: string[]): string {
  for (const genre of genres) {
    for (const [key, color] of Object.entries(GENRE_COLORS)) {
      if (genre.toLowerCase().includes(key)) return color
    }
  }
  const colors = Object.values(GENRE_COLORS)
  return colors[Math.floor(Math.random() * colors.length)]
}

function trackToSongNode(track: SpotifyTrack, genres: string[] = []): SongNode {
  const albumArt =
    track.album.images.find(img => img.height && img.height >= 300)?.url ||
    track.album.images[0]?.url ||
    ''

  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    albumArt,
    previewUrl: track.preview_url,
    spotifyUrl: track.external_urls.spotify,
    popularity: track.popularity,
    genres,
    x: (Math.random() - 0.5) * 80,
    y: (Math.random() - 0.5) * 50,
    z: (Math.random() - 0.5) * 30,
    vx: 0,
    vy: 0,
    color: genreToColor(genres),
    scale: 0.5 + (track.popularity / 100) * 0.8,
  }
}

// ─── Vibe → Search Queries ─────────────────────────────────────────────────
const VIBE_QUERIES: Record<Vibe, { q: string; genre: string }[]> = {
  'global-top-50': [
    { q: 'year:2024 tag:hipster', genre: 'pop' },
    { q: 'genre:pop year:2024', genre: 'pop' },
    { q: 'genre:dance-pop year:2023-2024', genre: 'pop' },
  ],
  'viral-50': [
    { q: 'genre:pop-film year:2024', genre: 'pop' },
    { q: 'viral pop 2024', genre: 'pop' },
    { q: 'genre:electropop year:2024', genre: 'pop' },
  ],
  'new-music-friday': [
    { q: 'genre:indie-pop year:2024', genre: 'indie' },
    { q: 'genre:alt-pop year:2024', genre: 'indie' },
    { q: 'new release 2024 alternative', genre: 'indie' },
  ],
  'hip-hop-central': [
    { q: 'genre:hip-hop year:2023-2024', genre: 'hip-hop' },
    { q: 'genre:rap year:2024', genre: 'hip-hop' },
    { q: 'genre:trap year:2023-2024', genre: 'hip-hop' },
  ],
  'pop-rising': [
    { q: 'genre:pop year:2024', genre: 'pop' },
    { q: 'genre:teen-pop year:2024', genre: 'pop' },
    { q: 'genre:synth-pop year:2023-2024', genre: 'pop' },
  ],
  'dance-hits': [
    { q: 'genre:dance year:2023-2024', genre: 'dance' },
    { q: 'genre:edm year:2024', genre: 'electronic' },
    { q: 'genre:house year:2023-2024', genre: 'dance' },
  ],
  'mood-booster': [
    { q: 'genre:happy-hardcore year:2023-2024', genre: 'pop' },
    { q: 'feel good pop hits 2024', genre: 'pop' },
    { q: 'genre:funk year:2023-2024', genre: 'pop' },
  ],
  'late-night': [
    { q: 'genre:r-n-b year:2023-2024', genre: 'r&b' },
    { q: 'genre:soul year:2022-2024', genre: 'soul' },
    { q: 'genre:neo-soul year:2022-2024', genre: 'r&b' },
  ],
  'workout': [
    { q: 'genre:hip-hop year:2023-2024 workout', genre: 'hip-hop' },
    { q: 'genre:metal year:2022-2024', genre: 'rock' },
    { q: 'genre:hard-rock year:2022-2024', genre: 'rock' },
  ],
  'chill-hits': [
    { q: 'genre:chill year:2022-2024', genre: 'ambient' },
    { q: 'genre:lo-fi year:2022-2024', genre: 'ambient' },
    { q: 'genre:acoustic year:2022-2024', genre: 'indie' },
  ],
}

interface SearchResponse {
  tracks: {
    items: SpotifyTrack[]
    total: number
    next: string | null
  }
}

/**
 * Fetch tracks for a single search query.
 */
async function fetchSearchTracks(
  q: string,
  genre: string,
  maxTracks = 100
): Promise<SongNode[]> {
  console.log(`[DIAG:search] fetchSearchTracks — q="${q}" genre="${genre}" maxTracks=${maxTracks}`)
  try {
    const raw = await spotifyFetch(
      `/search?q=${encodeURIComponent(q)}&type=track&limit=10&offset=0&market=US`
    )

    // ── Shape verification ──────────────────────────────────────────────────
    const resp = raw as Record<string, unknown>
    console.log('[DIAG:search] raw response keys:', Object.keys(resp))

    const hasTracksKey = 'tracks' in resp
    console.log('[DIAG:search] has "tracks" key:', hasTracksKey)

    if (!hasTracksKey) {
      console.error('[DIAG:search] UNEXPECTED SHAPE — full response:', JSON.stringify(resp).substring(0, 500))
      return []
    }

    const tracksObj = resp['tracks'] as Record<string, unknown>
    console.log('[DIAG:search] tracks object keys:', Object.keys(tracksObj))
    console.log('[DIAG:search] tracks.total:', tracksObj['total'])
    console.log('[DIAG:search] tracks.items length:', Array.isArray(tracksObj['items']) ? (tracksObj['items'] as unknown[]).length : 'NOT AN ARRAY')

    const firstPage = raw as SearchResponse
    const allItems = [...firstPage.tracks.items]

    // Log first item structure to verify SpotifyTrack shape
    if (allItems.length > 0) {
      const sample = allItems[0]
      console.log('[DIAG:search] Sample track[0]:', {
        id: sample?.id,
        name: sample?.name,
        hasAlbum: !!sample?.album,
        albumImagesCount: sample?.album?.images?.length ?? 'n/a',
        hasExternalUrls: !!sample?.external_urls,
        popularity: sample?.popularity,
      })
    } else {
      console.warn('[DIAG:search] tracks.items is EMPTY for query:', q)
    }

    // Fetch additional pages in parallel if needed
    if (firstPage.tracks.total > 10 && maxTracks > 10) {
      const extraPages = Math.ceil(Math.min(firstPage.tracks.total - 10, maxTracks - 10) / 10)
      console.log('[DIAG:search] Fetching', extraPages, 'extra pages for q:', q)
      const offsets = Array.from({ length: extraPages }, (_, i) => (i + 1) * 10)

      const extraResults = await Promise.allSettled(
        offsets.map(offset =>
          spotifyFetch(
            `/search?q=${encodeURIComponent(q)}&type=track&limit=10&offset=${offset}&market=US`
          ) as Promise<SearchResponse>
        )
      )

      for (const result of extraResults) {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value.tracks.items)
        } else {
          console.error('[DIAG:search] Extra page REJECTED:', result.reason)
        }
      }
    }

    console.log('[DIAG:search] allItems before filter:', allItems.length)

    // Apply filter — log each rejection reason for first 5 tracks that fail
    let filteredOut = 0
    const filtered: SpotifyTrack[] = []
    for (const t of allItems) {
      const hasId = !!(t && t.id)
      const hasImages = !!(t?.album?.images?.length > 0)
      if (hasId && hasImages) {
        filtered.push(t)
      } else {
        if (filteredOut < 5) {
          console.warn('[DIAG:search] Filtered out track:', { id: t?.id, hasId, hasImages, imagesLength: t?.album?.images?.length })
        }
        filteredOut++
      }
    }

    console.log(`[DIAG:search] After filter: ${filtered.length} kept, ${filteredOut} dropped — q="${q}"`)

    const nodes = filtered.map(t => trackToSongNode(t, [genre]))
    console.log(`[DIAG:search] fetchSearchTracks RETURN: ${nodes.length} SongNodes — q="${q}"`)
    return nodes
  } catch (err) {
    console.error(`[DIAG:search] fetchSearchTracks THREW for q="${q}":`, err)
    return []
  }
}

/**
 * Fetch ~targetCount songs that match the given vibe.
 */
export async function fetchSongsByVibe(
  vibe: Vibe,
  targetCount: number = 1000,
  refreshOffset: number = 0
): Promise<SongNode[]> {
  console.log(`[DIAG:vibe] fetchSongsByVibe("${vibe}") START — targetCount=${targetCount} refreshOffset=${refreshOffset}`)

  const queries = VIBE_QUERIES[vibe]
  if (!queries || queries.length === 0) {
    console.error(`[DIAG:vibe] No queries defined for vibe: "${vibe}"`)
    return []
  }
  console.log(`[DIAG:vibe] Queries for "${vibe}":`, queries.map(q => q.q))

  // Rotate query order on refresh
  const rotated = [
    ...queries.slice(refreshOffset % queries.length),
    ...queries.slice(0, refreshOffset % queries.length),
  ]

  const tracksPerQuery = Math.ceil(targetCount / rotated.length)
  console.log(`[DIAG:vibe] tracksPerQuery=${tracksPerQuery} across ${rotated.length} queries`)

  const results = await Promise.allSettled(
    rotated.map(({ q, genre }) => fetchSearchTracks(q, genre, tracksPerQuery))
  )

  // Per-query result summary
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[DIAG:vibe] query[${i}] "${rotated[i].q}": FULFILLED → ${r.value.length} tracks`)
    } else {
      console.error(`[DIAG:vibe] query[${i}] "${rotated[i].q}": REJECTED →`, r.reason)
    }
  })

  const seenTrackIds = new Set<string>()
  const seenArtists = new Map<string, number>()
  const seenAlbums = new Map<string, number>()
  const songs: SongNode[] = []

  const batches = results
    .filter((r): r is PromiseFulfilledResult<SongNode[]> => r.status === 'fulfilled')
    .map(r => r.value)

  console.log(`[DIAG:vibe] Fulfilled batches: ${batches.length}, sizes:`, batches.map(b => b.length))

  const maxLen = Math.max(...batches.map(b => b.length), 0)
  console.log(`[DIAG:vibe] maxLen across all batches: ${maxLen}`)

  let droppedDuplicate = 0
  let droppedArtistCap = 0
  let droppedAlbumCap = 0

  for (let i = 0; i < maxLen && songs.length < targetCount; i++) {
    for (const batch of batches) {
      if (songs.length >= targetCount) break
      const song = batch[i]
      if (!song) continue
      if (seenTrackIds.has(song.id)) { droppedDuplicate++; continue }

      const artistKey = song.artist.toLowerCase()
      const albumKey = song.album.toLowerCase()
      if ((seenArtists.get(artistKey) ?? 0) >= 4) { droppedArtistCap++; continue }
      if ((seenAlbums.get(albumKey) ?? 0) >= 2) { droppedAlbumCap++; continue }

      seenTrackIds.add(song.id)
      seenArtists.set(artistKey, (seenArtists.get(artistKey) ?? 0) + 1)
      seenAlbums.set(albumKey, (seenAlbums.get(albumKey) ?? 0) + 1)
      songs.push(song)
    }
  }

  console.log(`[DIAG:vibe] Dedup stats — duplicates dropped: ${droppedDuplicate}, artist-capped: ${droppedArtistCap}, album-capped: ${droppedAlbumCap}`)
  console.log(`[DIAG:vibe] fetchSongsByVibe("${vibe}") RETURN: ${songs.length} tracks`)
  return songs
}

/**
 * Fetch just the #1 track for a vibe (useful for quick hover previews)
 */
export async function fetchTopSongByVibe(vibeId: Vibe): Promise<SongNode | null> {
  const queries = VIBE_QUERIES[vibeId]
  if (!queries || queries.length === 0) return null

  // Just grab 1 track from the very first query to be ultra-fast
  const qObj = queries[0]
  try {
    const raw = await spotifyFetch(
      `/search?q=${encodeURIComponent(qObj.q)}&type=track&limit=1&offset=0&market=US`
    )
    const resp = raw as SearchResponse
    const items = resp.tracks?.items || []
    if (items.length > 0) {
      // Find the first track with a preview URL if possible, otherwise just the first
      const best = items.find(t => t.preview_url) || items[0]
      return trackToSongNode(best, [qObj.genre])
    }
  } catch (e) {
    console.error('[DIAG:top] fetchTopSongByVibe error', e)
  }
  return null
}


export async function searchSongsByMood(query: string): Promise<SongNode[]> {
  try {
    const searchData = await spotifyFetch(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=10&market=US`
    ) as { tracks: { items: SpotifyTrack[] } }

    const seen = new Set<string>()
    const results: SongNode[] = []
    for (const t of searchData.tracks.items) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        results.push(trackToSongNode(t))
      }
    }
    return results
  } catch (err) {
    console.error('[Spotify] Search failed:', err)
    return []
  }
}

/**
 * Fetch a curated list of 8 tracks with valid previews for Chart Hover Rotation
 */
export async function fetchChartPreviews(vibeId: Vibe): Promise<SongNode[]> {
  const queries = VIBE_QUERIES[vibeId]
  if (!queries || queries.length === 0) return []

  // Grab up to 40 tracks from the primary query to ensure we find 8 good previews
  const qObj = queries[0]
  try {
    const raw = await spotifyFetch(
      `/search?q=${encodeURIComponent(qObj.q)}&type=track&limit=40&offset=0&market=US`
    )
    const resp = raw as SearchResponse
    const items = resp.tracks?.items || []
    
    // Filter strictly for valid preview URLs
    const validItems = items.filter(t => t.preview_url)
    
    // Shuffle the valid items (Fisher-Yates)
    for (let i = validItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = validItems[i]
      validItems[i] = validItems[j]
      validItems[j] = temp
    }
    
    // Select exactly 8 (or fewer if we couldn't find 8)
    const selected = validItems.slice(0, 8)
    
    return selected.map(t => trackToSongNode(t, [qObj.genre]))
  } catch (e) {
    console.error('[DIAG:previews] fetchChartPreviews error', e)
    return []
  }
}

