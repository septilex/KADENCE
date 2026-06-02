import { SpotifyTrack, SongNode, Vibe } from './types'

let cachedToken: string | null = null
let tokenExpiry: number = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

async function spotifyFetch(endpoint: string): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 900 }, // 15 min cache
  })
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${endpoint}`)
  return res.json()
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

// ─── Vibe → Spotify parameters ────────────────────────────────────────────────
// Each vibe maps to seed genres + audio-feature targets so the recommendations
// feel emotionally consistent — not just random popular tracks.
export interface VibeProfile {
  seeds: string[]      // Spotify seed_genres (max 5 per request)
  energy?: number      // 0–1
  valence?: number     // 0–1, happiness
  tempo?: number       // BPM target
  acousticness?: number
  instrumentalness?: number
}

export const VIBE_PROFILES: Record<Vibe, VibeProfile> = {
  'global-top-50': {
    seeds: ['pop', 'dance', 'hip-hop', 'r-n-b'],
    energy: 0.72,
    valence: 0.65,
  },
  'viral-50': {
    seeds: ['pop', 'hip-hop', 'dance'],
    energy: 0.78,
    valence: 0.70,
  },
  'new-music-friday': {
    seeds: ['pop', 'indie', 'alternative'],
    energy: 0.60,
    valence: 0.60,
  },
  'hip-hop-central': {
    seeds: ['hip-hop', 'trap', 'rap'],
    energy: 0.80,
    valence: 0.55,
  },
  'pop-rising': {
    seeds: ['pop', 'indie-pop'],
    energy: 0.65,
    valence: 0.70,
  },
  'dance-hits': {
    seeds: ['edm', 'house', 'techno'],
    energy: 0.88,
    valence: 0.72,
  },
  'mood-booster': {
    seeds: ['pop', 'soul', 'funk'],
    energy: 0.75,
    valence: 0.88,
  },
  'late-night': {
    seeds: ['r-n-b', 'soul', 'jazz'],
    energy: 0.38,
    valence: 0.42,
  },
  'workout': {
    seeds: ['hip-hop', 'metal', 'rock'],
    energy: 0.92,
    valence: 0.60,
  },
  'chill-hits': {
    seeds: ['lo-fi', 'acoustic', 'ambient'],
    energy: 0.22,
    valence: 0.50,
  },
}

/**
 * Build the Spotify recommendations query string from a vibe profile.
 * Spotify allows max 5 seed items total (genres + artists + tracks combined).
 */
function buildRecsParams(profile: VibeProfile, seedSubset: string[]): string {
  const params = new URLSearchParams({
    seed_genres: seedSubset.join(','),
    limit: '50',
    market: 'US',
    min_popularity: '25',
  })
  if (profile.energy !== undefined) {
    params.set('target_energy', profile.energy.toFixed(2))
    params.set('min_energy', Math.max(0, profile.energy - 0.20).toFixed(2))
    params.set('max_energy', Math.min(1, profile.energy + 0.20).toFixed(2))
  }
  if (profile.valence !== undefined) {
    params.set('target_valence', profile.valence.toFixed(2))
    params.set('min_valence', Math.max(0, profile.valence - 0.25).toFixed(2))
    params.set('max_valence', Math.min(1, profile.valence + 0.25).toFixed(2))
  }
  if (profile.tempo !== undefined) {
    params.set('target_tempo', String(profile.tempo))
  }
  if (profile.acousticness !== undefined) {
    params.set('target_acousticness', profile.acousticness.toFixed(2))
  }
  if (profile.instrumentalness !== undefined) {
    params.set('target_instrumentalness', profile.instrumentalness.toFixed(2))
  }
  return params.toString()
}

/**
 * Fetch ~targetCount songs that match the given vibe.
 * Runs multiple recommendation requests in parallel — each seeded with a
 * different subset of the vibe's genres — then deduplicates and limits artist/album repetition.
 */
export async function fetchSongsByVibe(
  vibe: Vibe,
  targetCount: number = 1000,
  refreshOffset: number = 0
): Promise<SongNode[]> {
  const profile = VIBE_PROFILES[vibe]
  const seeds = profile.seeds
  const songs: SongNode[] = []

  // Split seeds into overlapping windows of max 3 to get variety, shifting by refreshOffset
  const batches: string[][] = []
  for (let i = 0; i < seeds.length; i++) {
    const shiftIdx = (i + refreshOffset) % seeds.length
    const window = [
      seeds[shiftIdx],
      seeds[(shiftIdx + 1) % seeds.length],
      seeds[(shiftIdx + 2) % seeds.length]
    ]
    batches.push([...new Set(window)])
  }

  // How many parallel requests do we need? Each returns up to 50 tracks.
  const requestsNeeded = Math.ceil(targetCount / 50)
  // Cycle through seed batches if we need more requests than we have unique batches
  const requests = Array.from({ length: requestsNeeded }, (_, i) => batches[i % batches.length])

  const results = await Promise.allSettled(
    requests.map(async (seedWindow) => {
      try {
        const qs = buildRecsParams(profile, seedWindow)
        const data = await spotifyFetch(`/recommendations?${qs}`) as { tracks: SpotifyTrack[] }
        return data.tracks.map(t => trackToSongNode(t, seedWindow))
      } catch {
        return []
      }
    })
  )

  const seenTrackIds = new Set<string>()
  const seenArtists = new Map<string, number>()
  const seenAlbums = new Map<string, number>()

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const song of result.value) {
      if (songs.length >= targetCount) break
      if (seenTrackIds.has(song.id)) continue

      // Anti-repetition: limit artist & album representation
      const artistKey = song.artist.toLowerCase()
      const albumKey = song.album.toLowerCase()
      const artistCount = seenArtists.get(artistKey) || 0
      const albumCount = seenAlbums.get(albumKey) || 0

      if (artistCount >= 3 || albumCount >= 2) {
        continue // skip this song to maintain diversity
      }

      seenTrackIds.add(song.id)
      seenArtists.set(artistKey, artistCount + 1)
      seenAlbums.set(albumKey, albumCount + 1)
      songs.push(song)
    }
  }

  return songs
}

export async function searchSongsByMood(query: string): Promise<SongNode[]> {
  // Map natural language to Spotify search params
  const moodMap: Record<string, { genres: string; energy?: string; valence?: string }> = {
    'late night': { genres: 'ambient,chill', energy: '0.3', valence: '0.3' },
    'sad': { genres: 'sad,blues', energy: '0.25', valence: '0.15' },
    'gym': { genres: 'metal,hip-hop', energy: '0.9', valence: '0.6' },
    'rage': { genres: 'metal,punk', energy: '0.95', valence: '0.3' },
    'happy': { genres: 'pop,dance', energy: '0.7', valence: '0.85' },
    'dreamy': { genres: 'ambient,indie', energy: '0.35', valence: '0.55' },
    'rainy': { genres: 'acoustic,folk', energy: '0.3', valence: '0.35' },
    'party': { genres: 'dance,edm', energy: '0.9', valence: '0.8' },
    'chill': { genres: 'chill,lo-fi', energy: '0.3', valence: '0.5' },
    'focus': { genres: 'classical,ambient', energy: '0.25', valence: '0.4' },
    'synthwave': { genres: 'electronic,synth-pop', energy: '0.6', valence: '0.5' },
    'jazz': { genres: 'jazz', energy: '0.45', valence: '0.6' },
    'workout': { genres: 'hip-hop,rock', energy: '0.85', valence: '0.65' },
    'romantic': { genres: 'r-n-b,soul', energy: '0.4', valence: '0.65' },
  }

  let params = 'seed_genres=pop&limit=50&market=US'

  for (const [keyword, mapping] of Object.entries(moodMap)) {
    if (query.toLowerCase().includes(keyword)) {
      const genre = mapping.genres.split(',')[0]
      params = `seed_genres=${genre}&limit=50&market=US`
      if (mapping.energy) params += `&target_energy=${mapping.energy}`
      if (mapping.valence) params += `&target_valence=${mapping.valence}`
      break
    }
  }

  try {
    const searchData = await spotifyFetch(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=30&market=US`
    ) as { tracks: { items: SpotifyTrack[] } }

    const searchResults = searchData.tracks.items.map(t => trackToSongNode(t))

    const recData = await spotifyFetch(`/recommendations?${params}`) as { tracks: SpotifyTrack[] }
    const recResults = recData.tracks.map(t => trackToSongNode(t))

    const seen = new Set<string>()
    const merged: SongNode[] = []
    for (const song of [...searchResults, ...recResults]) {
      if (!seen.has(song.id)) {
        seen.add(song.id)
        merged.push(song)
      }
    }

    return merged
  } catch (err) {
    console.error('Search failed:', err)
    return []
  }
}
