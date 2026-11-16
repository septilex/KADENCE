import type { Vibe } from './types'
import type { LibrarySong, PlayRecord } from '@/store/libraryStore'

export interface TasteProfile {
  totalPlays: number
  uniqueSongs: number
  uniqueArtists: number
  /** Minutes of previews heard (30 s each). */
  minutes: number
  topSongs: PlayRecord[]
  topArtists: { name: string; plays: number; art: string }[]
  /** Share of plays per genre, largest first; shares sum to at most 1. */
  topGenres: { name: string; share: number }[]
  recent: PlayRecord[]
  favouriteVibe: Vibe | null
  /** One-line description derived from the numbers above. */
  archetype: string
}

export interface AutoPlaylist {
  id: string
  title: string
  subtitle: string
  songs: LibrarySong[]
}

const ARCHETYPES: [RegExp, string][] = [
  [/hip.?hop|rap|trap/i, 'Bar Collector'],
  [/k-?pop/i, 'Stan Commander'],
  [/dance|electro|house|edm|techno/i, 'Night Pilot'],
  [/r&b|soul/i, 'Velvet Mood'],
  [/rock|metal|punk|alternative/i, 'Loud Romantic'],
  [/indian|bollywood|tamil|telugu|hindi|punjabi|tollywood|kollywood/i, 'Desi Frequencies'],
  [/pop/i, 'Hook Hunter'],
  [/jazz|classical|ambient|instrumental/i, 'Deep Listener'],
]

/** iTunes genre names arrive in mixed case ("pop", "hip-hop/rap"); show them consistently. */
function genreLabel(genre: string): string {
  return genre.replace(/(^|[\s/&-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase())
}

export function buildTasteProfile(
  plays: Record<string, PlayRecord>,
  vibeVisits: Partial<Record<Vibe, number>>,
): TasteProfile {
  const records = Object.values(plays)
  const totalPlays = records.reduce((sum, r) => sum + r.count, 0)

  const artists = new Map<string, { name: string; plays: number; art: string }>()
  const genres = new Map<string, number>()
  for (const record of records) {
    const artist = artists.get(record.song.artist) ?? { name: record.song.artist, plays: 0, art: record.song.albumArt }
    artist.plays += record.count
    artists.set(record.song.artist, artist)
    const genre = record.song.genres[0] ? genreLabel(record.song.genres[0]) : ''
    if (genre) genres.set(genre, (genres.get(genre) ?? 0) + record.count)
  }

  const topGenres = [...genres]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, share: totalPlays ? count / totalPlays : 0 }))

  const favouriteVibe = (Object.entries(vibeVisits) as [Vibe, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  let archetype = 'New Arrival'
  if (totalPlays > 0) {
    const lead = topGenres[0]
    const match = lead && ARCHETYPES.find(([pattern]) => pattern.test(lead.name))
    // A listener with no dominant genre is described by their range instead.
    archetype = !lead ? 'Free Agent' : lead.share < 0.4 && topGenres.length >= 4 ? 'Genre Nomad' : match?.[1] ?? 'Signal Seeker'
  }

  return {
    totalPlays,
    uniqueSongs: records.length,
    uniqueArtists: artists.size,
    minutes: Math.round(totalPlays / 2),
    topSongs: [...records].sort((a, b) => b.count - a.count || b.lastPlayed - a.lastPlayed).slice(0, 5),
    topArtists: [...artists.values()].sort((a, b) => b.plays - a.plays).slice(0, 5),
    topGenres,
    recent: [...records].sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 20),
    favouriteVibe,
    archetype,
  }
}

/** Playlists KADENCE assembles from the listener's own activity (nothing is invented). */
export function buildAutoPlaylists(
  plays: Record<string, PlayRecord>,
  liked: Record<string, { song: LibrarySong; likedAt: number }>,
): AutoPlaylist[] {
  const records = Object.values(plays)
  const likedSongs = Object.values(liked).sort((a, b) => b.likedAt - a.likedAt).map((l) => l.song)
  const onRepeat = records.filter((r) => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 25).map((r) => r.song)
  const recent = [...records].sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 25).map((r) => r.song)

  const byGenre = new Map<string, PlayRecord[]>()
  for (const record of records) {
    const genre = record.song.genres[0] ? genreLabel(record.song.genres[0]) : ''
    if (genre) byGenre.set(genre, [...(byGenre.get(genre) ?? []), record])
  }
  const leadGenre = [...byGenre].sort((a, b) => b[1].length - a[1].length)[0]

  const playlists: AutoPlaylist[] = [
    { id: 'liked', title: 'Liked Songs', subtitle: 'Everything you hearted', songs: likedSongs },
    { id: 'on-repeat', title: 'On Repeat', subtitle: 'Played more than once', songs: onRepeat },
    { id: 'recent', title: 'Recently Played', subtitle: 'Your latest sessions', songs: recent },
  ]
  if (leadGenre && leadGenre[1].length >= 3) {
    playlists.push({
      id: 'genre-mix',
      title: `${leadGenre[0]} Mix`,
      subtitle: 'Your most played genre',
      songs: leadGenre[1].sort((a, b) => b.count - a.count).map((r) => r.song),
    })
  }
  return playlists.filter((p) => p.songs.length > 0)
}
