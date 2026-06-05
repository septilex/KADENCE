import { fetchSongsByVibe } from './lib/spotify'

async function run() {
  const songs = await fetchSongsByVibe('global-top-50', 1000)
  console.log('Total returned:', songs.length)
  
  const uniqueSongs = new Set(songs.map(s => s.id))
  console.log('Unique song IDs:', uniqueSongs.size)

  const uniqueAlbums = new Set(songs.map(s => s.album))
  console.log('Unique album names:', uniqueAlbums.size)

  const uniqueArtwork = new Set(songs.map(s => s.albumArt))
  console.log('Unique artworks:', uniqueArtwork.size)

  // See how many times the most frequent artwork appears
  const artCounts = new Map<string, number>()
  for (const s of songs) {
    artCounts.set(s.albumArt, (artCounts.get(s.albumArt) || 0) + 1)
  }
  const topArts = [...artCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  console.log('Top 5 most frequent artworks:')
  for (const [url, count] of topArts) {
    console.log(`  ${count}x: ${url}`)
  }
}

run().catch(console.error)
