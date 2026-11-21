import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchChart, fetchSongsByVibe } from '../lib/musicProvider.ts'
import { itunesClient } from '../lib/itunesClient.ts'
import { CURATED_TRACKS } from '../lib/curatedTracks.ts'

const NOW = Date.parse('2026-11-21T12:00:00Z')
const day = n => new Date(NOW - n * 86400000).toISOString()
const track = (id, extra = {}) => ({
  trackId: id, trackName: `Song ${id}`, artistName: `Artist ${id}`, collectionName: `Album ${id}`,
  artworkUrl100: `https://is1-ssl.mzstatic.com/${id}/100x100bb.jpg`, previewUrl: `https://audio-ssl.itunes.apple.com/${id}.m4a`,
  primaryGenreName: 'Pop', releaseDate: day(10), ...extra,
})
const chart = (ids, extra) => ids.map((id, i) => track(id, { chartRank: i + 1, ...extra?.(id, i) }))

test('charts lead with Apple chart songs; keyword search only tops up, newest first', async t => {
  t.mock.method(itunesClient, 'topSongs', async (cc) => cc === 'us' ? chart([1, 2, 3]) : chart([2, 4]))
  const searched = []
  t.mock.method(itunesClient, 'search', async (q) => { searched.push(q); return [track(100, { releaseDate: day(400) }), track(101, { releaseDate: day(5) })] })
  const { songs, complete } = await fetchChart('global-top-50', 256, 0, NOW)
  assert.equal(complete, true)
  assert.deepEqual(songs.slice(0, 4).map(s => s.source), ['chart', 'chart', 'chart', 'chart'])
  assert.equal(songs[0].id, '2', 'charting in two storefronts ranks first')
  assert.deepEqual(songs.filter(s => s.source === 'search').map(s => s.id), ['101', '100'])
  assert.ok(searched.every(q => q.includes('2026')), 'search terms use the current year, not a hardcoded one')
  assert.equal(new Set(songs.map(s => s.id)).size, songs.length)
})

test('songs without a preview or artwork never reach the wall', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => [track(1, { chartRank: 1 }), track(2, { chartRank: 2, previewUrl: undefined }), track(3, { chartRank: 3, artworkUrl100: undefined })])
  t.mock.method(itunesClient, 'search', async () => [])
  const songs = await fetchSongsByVibe('pop-rising', 256)
  assert.deepEqual(songs.map(s => s.id), ['1'])
})

test('regional charts accept only their language genre; the same song released twice appears once', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => [
    track(1, { chartRank: 1, primaryGenreName: 'Tamil', trackName: 'Magale (From "Baththa")', artistName: 'Sai Abhyankkar, Harini & Karthik Netha' }),
    track(2, { chartRank: 2, primaryGenreName: 'Telugu' }),
    track(3, { chartRank: 3, primaryGenreName: 'Bollywood' }),
    track(4, { chartRank: 4, primaryGenreName: 'Tamil', trackName: 'Karaoke Hits Vol 1' }),
  ])
  t.mock.method(itunesClient, 'search', async () => [])
  const songs = await fetchSongsByVibe('top-tamil', 256)
  const ids = new Set(songs.map(s => s.id))
  assert.ok(ids.has('1'))
  assert.ok(!ids.has('2') && !ids.has('3'), 'Telugu/Bollywood rejected from Top Tamil')
  assert.ok(!ids.has('4'), 'karaoke rejected')
  // "Magale (From \"Baththa\")" single vs the album's "Magale" (curated) → one entry
  assert.equal(songs.filter(s => /^Magale\b/.test(s.name)).length, 1)
  // all verified curated soundtracks are present
  const curated = CURATED_TRACKS['top-tamil'].length
  assert.ok(songs.length >= curated, `${songs.length} ≥ ${curated}`)
  assert.ok(songs.every(s => s.previewUrl && s.albumArt))
})

test('new-music charts drop releases older than their window', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => [track(1, { chartRank: 1, releaseDate: day(20) }), track(2, { chartRank: 2, releaseDate: day(400) })])
  t.mock.method(itunesClient, 'search', async () => [track(3, { releaseDate: day(500) }), track(4, { releaseDate: day(30) })])
  const { songs } = await fetchChart('new-music-friday', 256, 0, NOW)
  assert.deepEqual(songs.map(s => s.id).sort(), ['1', '4'])
})

test('refresh rotation changes the keyword batch and the songs leading the wall', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => chart(Array.from({ length: 60 }, (_, i) => i + 1), id => ({ artistName: `A${id}`, collectionName: `C${id}` })))
  const queries = []
  t.mock.method(itunesClient, 'search', async (q) => { queries.push(q); return [] })
  const first = await fetchChart('hip-hop-central', 256, 0, NOW)
  const second = await fetchChart('hip-hop-central', 256, 1, NOW)
  assert.notDeepEqual(first.songs.slice(0, 10).map(s => s.id), second.songs.slice(0, 10).map(s => s.id))
  assert.deepEqual(new Set(first.songs.map(s => s.id)), new Set(second.songs.map(s => s.id)), 'same chart, different arrangement')
  assert.equal(queries.length, 4)
  assert.notDeepEqual(queries.slice(0, 2), queries.slice(2, 4), 'refresh uses the next search batch')
})

test('a chart built while an Apple chart is unreachable is marked incomplete', async t => {
  let n = 0
  t.mock.method(itunesClient, 'topSongs', async () => { if (n++ === 0) throw new Error('rate limited'); return chart([1, 2]) })
  t.mock.method(itunesClient, 'search', async () => [])
  const { songs, complete } = await fetchChart('late-night', 256, 0, NOW)
  assert.equal(complete, false)
  assert.ok(songs.length > 0)
})

test("Dev's Universe stays the static creator collection", async () => {
  const { songs, complete } = await fetchChart('dev-special')
  assert.equal(complete, true)
  assert.equal(songs.length, 79)
})

test('versions of one recording collapse to one entry; old keyword results are not used as top-up', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => [
    track(1, { chartRank: 1, trackName: 'Levels (Radio Edit)', artistName: 'Avicii' }),
    track(2, { chartRank: 2, trackName: 'Levels', artistName: 'Avicii' }),
    track(3, { chartRank: 3, trackName: 'BAD TIMES (Long Version)', artistName: 'X' }),
    track(4, { chartRank: 4, trackName: 'BAD TIMES', artistName: 'X' }),
  ])
  t.mock.method(itunesClient, 'search', async () => [track(10, { releaseDate: day(3000) }), track(11, { releaseDate: day(100) })])
  const { songs } = await fetchChart('dance-hits', 256, 0, NOW)
  assert.deepEqual(songs.map(s => s.id), ['1', '3', '11'])
})

test('a curated song that also charts keeps its curated place (no album/artist cap)', async t => {
  const album = CURATED_TRACKS['top-tamil'].filter(c => c.collectionName.startsWith('Jailer 2 (Original'))
  t.mock.method(itunesClient, 'topSongs', async () => album.map((c, i) => ({ ...c, chartRank: i + 1 })))
  t.mock.method(itunesClient, 'search', async () => [])
  const songs = await fetchSongsByVibe('top-tamil', 256)
  const ids = new Set(songs.map(s => s.id))
  assert.deepEqual(album.filter(c => !ids.has(String(c.trackId))).map(c => c.trackName), [])
})

test('Top Hindi carries every Ramayana: Part 1 recording (songs and score) exactly once', async t => {
  t.mock.method(itunesClient, 'topSongs', async () => [])
  t.mock.method(itunesClient, 'search', async () => [])
  const songs = await fetchSongsByVibe('top-hindi', 256)
  const base = s => s.name.replace(/\s*[([].*$/, '').replace(/\s*-\s*hindi.*$/i, '').trim().toLowerCase()
  const titles = songs.map(base)
  const expected = ['jai jai ram', 'ravana tandav', "sita's aspiration", 'rama theme', 'ramayana', 'ramayana trailer theme',
    'mangal rang', 'judi jodi', 'shree hanuman chalisa', 'main ram', 'ram raja bhi hain aur tapasvi bhi hain', 'o ragho', 'awadh ke ram chale']
  for (const title of expected) assert.ok(titles.includes(title), `missing ${title}`)
  assert.equal(songs.filter(s => /^Ravana Tandav/.test(s.name)).length, 1, 'single and album Ravana Tandav collapse')
  assert.equal(songs.filter(s => /^Jai Jai Ram/.test(s.name)).length, 2, 'Jai Jai Ram + its orchestral score version')
  assert.equal(songs.length, 14)
})
