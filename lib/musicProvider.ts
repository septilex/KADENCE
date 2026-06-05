import { SongNode, Vibe } from './types'
import { devSpecialData } from './devSpecialData'

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

// Pseudo-random popularity based on string id (to keep it stable but random)
function generatePopularity(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const random = Math.abs(Math.sin(hash))
  return Math.floor(random * 70) + 30; // 30 to 100
}

function itunesToSongNode(track: any, vibeGenres: string[]): SongNode {
  const popularity = generatePopularity(track.trackId.toString());
  // Upgrade artwork quality
  const albumArt = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : '';
  const trackGenres = track.primaryGenreName ? [track.primaryGenreName.toLowerCase(), ...vibeGenres] : [...vibeGenres];
  
  return {
    id: track.trackId.toString(),
    name: track.trackName || 'Unknown Track',
    artist: track.artistName || 'Unknown Artist',
    album: track.collectionName || 'Unknown Album',
    albumArt,
    previewUrl: track.previewUrl || null,
    spotifyUrl: track.trackViewUrl || '', // Kept for frontend compatibility
    popularity,
    genres: trackGenres,
    x: (Math.random() - 0.5) * 80,
    y: (Math.random() - 0.5) * 50,
    z: (Math.random() - 0.5) * 30,
    vx: 0,
    vy: 0,
    color: genreToColor(trackGenres),
    scale: 0.5 + (popularity / 100) * 0.8,
  }
}

const VIBE_QUERIES: Record<Vibe, { term: string; genre: string }[]> = {
  'global-top-50': [
    { term: 'billboard hot 100', genre: 'pop' },
    { term: 'top hits 2024', genre: 'pop' },
    { term: 'viral hits', genre: 'pop' },
    { term: 'pop anthems', genre: 'pop' },
    { term: 'chart toppers', genre: 'pop' },
    { term: 'global pop', genre: 'pop' },
    { term: 'radio hits', genre: 'pop' },
    { term: 'number one hits', genre: 'pop' }
  ],
  'viral-50': [
    { term: 'tiktok viral', genre: 'pop' },
    { term: 'trending songs', genre: 'pop' },
    { term: 'viral music', genre: 'pop' },
    { term: 'internet hits', genre: 'pop' },
    { term: 'viral trends', genre: 'pop' },
    { term: 'viral dance', genre: 'pop' },
    { term: 'tiktok songs', genre: 'pop' },
    { term: 'popular on social', genre: 'pop' }
  ],
  'new-music-friday': [
    { term: 'new music alternative', genre: 'indie' },
    { term: 'latest indie', genre: 'indie' },
    { term: 'new releases', genre: 'indie' },
    { term: 'fresh finds', genre: 'indie' },
    { term: 'new alternative', genre: 'indie' },
    { term: 'new indie pop', genre: 'indie' },
    { term: 'alternative hits', genre: 'indie' },
    { term: 'indie pop 2024', genre: 'indie' }
  ],
  'hip-hop-central': [
    { term: 'rap hits', genre: 'hip-hop' },
    { term: 'hip hop 2024', genre: 'hip-hop' },
    { term: 'trap music', genre: 'hip-hop' },
    { term: 'hip hop bangers', genre: 'hip-hop' },
    { term: 'rap caviar', genre: 'hip-hop' },
    { term: 'modern rap', genre: 'hip-hop' },
    { term: 'hip hop classics', genre: 'hip-hop' },
    { term: 'drill music', genre: 'hip-hop' }
  ],
  'pop-rising': [
    { term: 'teen pop', genre: 'pop' },
    { term: 'synth pop', genre: 'pop' },
    { term: 'rising pop', genre: 'pop' },
    { term: 'future pop', genre: 'pop' },
    { term: 'alt pop', genre: 'pop' },
    { term: 'bedroom pop', genre: 'pop' },
    { term: 'hyperpop', genre: 'pop' },
    { term: 'indie pop hits', genre: 'pop' }
  ],
  'dance-hits': [
    { term: 'edm hits', genre: 'electronic' },
    { term: 'house music', genre: 'dance' },
    { term: 'club anthems', genre: 'dance' },
    { term: 'dance pop', genre: 'dance' },
    { term: 'electronic hits', genre: 'electronic' },
    { term: 'trance', genre: 'electronic' },
    { term: 'tech house', genre: 'dance' },
    { term: 'dubstep', genre: 'electronic' }
  ],
  'mood-booster': [
    { term: 'feel good music', genre: 'pop' },
    { term: 'happy songs', genre: 'pop' },
    { term: 'upbeat pop', genre: 'pop' },
    { term: 'cheerful hits', genre: 'pop' },
    { term: 'good vibes', genre: 'pop' },
    { term: 'sunny days', genre: 'pop' },
    { term: 'happy hits', genre: 'pop' },
    { term: 'feel good pop', genre: 'pop' }
  ],
  'late-night': [
    { term: 'r&b soul', genre: 'r&b' },
    { term: 'neo soul', genre: 'r&b' },
    { term: 'late night vibes', genre: 'r&b' },
    { term: 'chill r&b', genre: 'r&b' },
    { term: 'smooth r&b', genre: 'r&b' },
    { term: 'slow jams', genre: 'r&b' },
    { term: 'quiet storm', genre: 'r&b' },
    { term: 'rnb hits', genre: 'r&b' }
  ],
  'workout': [
    { term: 'workout motivation', genre: 'hip-hop' },
    { term: 'hard rock', genre: 'rock' },
    { term: 'heavy metal', genre: 'metal' },
    { term: 'gym hype', genre: 'electronic' },
    { term: 'pump up', genre: 'rock' },
    { term: 'workout playlist', genre: 'electronic' },
    { term: 'running music', genre: 'pop' },
    { term: 'high energy', genre: 'dance' }
  ],
  'chill-hits': [
    { term: 'lofi beats', genre: 'ambient' },
    { term: 'chillout', genre: 'ambient' },
    { term: 'acoustic relax', genre: 'indie' },
    { term: 'ambient study', genre: 'ambient' },
    { term: 'soft pop', genre: 'indie' },
    { term: 'mellow hits', genre: 'indie' },
    { term: 'chill vibes', genre: 'ambient' },
    { term: 'relaxing music', genre: 'ambient' }
  ],
  'dev-special': [
    { term: 'dev special', genre: 'pop' }
  ],
}

async function fetchItunesTracks(term: string, limit: number = 200): Promise<any[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[musicProvider] iTunes fetch failed for term "${term}": ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error(`[musicProvider] Error fetching iTunes for term "${term}":`, error);
    return [];
  }
}

export async function fetchSongsByVibe(
  vibe: Vibe,
  targetCount: number = 1000,
  refreshOffset: number = 0
): Promise<SongNode[]> {
  if (vibe === 'dev-special') {
    return devSpecialData;
  }

  const queries = VIBE_QUERIES[vibe] || VIBE_QUERIES['global-top-50'];
  
  const rotated = [
    ...queries.slice(refreshOffset % queries.length),
    ...queries.slice(0, refreshOffset % queries.length),
  ]

  const results: any[] = [];
  
  // Fetch multiple queries concurrently
  const fetchPromises = rotated.map(q => fetchItunesTracks(q.term, 200).then(tracks => ({ tracks, genre: q.genre })));
  const settled = await Promise.allSettled(fetchPromises);
  
  const seenTrackIds = new Set<string>();
  const seenArtists = new Map<string, number>();
  const seenAlbums = new Map<string, number>();
  const songs: SongNode[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const { tracks, genre } = result.value;
      for (const t of tracks) {
        if (!t.trackId || !t.artworkUrl100) continue;
        
        const trackIdStr = t.trackId.toString();
        if (seenTrackIds.has(trackIdStr)) continue;
        
        const artistKey = (t.artistName || '').toLowerCase();
        const albumKey = (t.collectionName || '').toLowerCase();
        
        // Strict deduplication limits
        if ((seenArtists.get(artistKey) ?? 0) >= 8) continue; // Allow slightly more artist tracks to reach 1000
        if ((seenAlbums.get(albumKey) ?? 0) >= 4) continue;

        seenTrackIds.add(trackIdStr);
        seenArtists.set(artistKey, (seenArtists.get(artistKey) ?? 0) + 1);
        seenAlbums.set(albumKey, (seenAlbums.get(albumKey) ?? 0) + 1);
        
        songs.push(itunesToSongNode(t, [genre]));
      }
    }
  }

  // To ensure we hit the targetCount (or at least 1000), if we are short, we can duplicate and scatter
  // But usually 8 queries * 200 = 1600 raw tracks. We should be close to 1000 unique.
  // In the event of shortness, we will duplicate a few and randomize positions.
  const finalSongs: SongNode[] = [...songs];
  let i = 0;
  while (finalSongs.length < targetCount && songs.length > 0) {
    const base = songs[i % songs.length];
    finalSongs.push({
      ...base,
      id: `${base.id}-dup-${finalSongs.length}`,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 50,
      z: (Math.random() - 0.5) * 30,
    });
    i++;
  }

  return finalSongs;
}

export async function searchSongsByMood(query: string): Promise<SongNode[]> {
  const tracks = await fetchItunesTracks(query, 50);
  const seen = new Set<string>();
  const results: SongNode[] = [];
  
  for (const t of tracks) {
    if (!t.trackId || !t.artworkUrl100) continue;
    const trackIdStr = t.trackId.toString();
    if (!seen.has(trackIdStr)) {
      seen.add(trackIdStr);
      results.push(itunesToSongNode(t, ['pop']));
    }
  }
  return results;
}

export async function fetchChartPreviews(vibeId: Vibe): Promise<SongNode[]> {
  if (vibeId === 'dev-special') {
    return devSpecialData.filter(s => s.previewUrl && s.albumArt).slice(0, 8);
  }

  const queries = VIBE_QUERIES[vibeId] || VIBE_QUERIES['global-top-50'];
  const tracks = await fetchItunesTracks(queries[0].term, 40);
  
  const validItems = tracks.filter((t: any) => t.previewUrl && t.artworkUrl100);
  
  // Shuffle
  for (let i = validItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = validItems[i]
    validItems[i] = validItems[j]
    validItems[j] = temp
  }
  
  return validItems.slice(0, 8).map((t: any) => itunesToSongNode(t, [queries[0].genre]));
}

export async function fetchTopSongByVibe(vibeId: Vibe): Promise<SongNode | null> {
  if (vibeId === 'dev-special') {
    return devSpecialData[0] || null;
  }

  const queries = VIBE_QUERIES[vibeId] || VIBE_QUERIES['global-top-50'];
  const tracks = await fetchItunesTracks(queries[0].term, 10);
  
  const valid = tracks.find((t: any) => t.previewUrl && t.artworkUrl100);
  if (valid) {
    return itunesToSongNode(valid, [queries[0].genre]);
  }
  return tracks.length > 0 ? itunesToSongNode(tracks[0], [queries[0].genre]) : null;
}
