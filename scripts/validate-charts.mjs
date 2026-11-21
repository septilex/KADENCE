/**
 * Live validation of every KADENCE chart against Apple (network required).
 *
 *   node --import ./scripts/test-loader.mjs scripts/validate-charts.mjs [outFile]
 *   KADENCE_VALIDATE_ONLY=top-hindi node --import ./scripts/test-loader.mjs scripts/validate-charts.mjs out.json
 *
 * Builds each chart with the production code (fetchChart), paced to stay inside Apple's
 * ~20 requests/minute, then checks: duplicate track ids, duplicate songs, preview and artwork
 * presence, that every preview/artwork URL responds, and regional language purity.
 * Writes a snapshot (default docs/music-refresh/charts-<date>.json). Exits 1 on any failure.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchChart } from '../lib/musicProvider.ts'
import { CURATED_TRACKS } from '../lib/curatedTracks.ts'

const VIBES = ['top-tamil', 'global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central', 'pop-rising', 'dance-hits',
  'mood-booster', 'late-night', 'workout', 'chill-hits', 'top-telugu', 'top-hindi', 'top-kpop', 'dev-special']
const LANGUAGE = { 'top-tamil': 'tamil', 'top-telugu': 'telugu', 'top-hindi': ['bollywood', 'hindi'], 'top-kpop': 'k-pop' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const date = new Date().toISOString().slice(0, 10)
const outFile = process.argv[2] || `docs/music-refresh/charts-${date}.json`

async function reachable(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
      if (res.ok) return true
      if (res.status === 405) return (await fetch(url, { headers: { Range: 'bytes=0-0' } })).ok
      if (res.status < 500 && res.status !== 429) return false
    } catch { /* retry */ }
    await sleep(800 * (attempt + 1))
  }
  return false
}
async function checkAll(urls) {
  const bad = []
  const queue = [...new Set(urls)]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let u; (u = queue.shift());) if (!(await reachable(u))) bad.push(u)
  }))
  return bad
}

const snapshot = { generatedAt: new Date().toISOString(), charts: {} }
let failures = 0
// Optional: KADENCE_VALIDATE_ONLY=top-hindi,top-tamil checks just those charts.
const ONLY = process.env.KADENCE_VALIDATE_ONLY?.split(',').map(v => v.trim()).filter(Boolean)
for (const vibe of VIBES.filter(v => !ONLY || ONLY.includes(v))) {
  const started = Date.now()
  const { songs, complete } = await fetchChart(vibe, 256, 0)
  const ids = songs.map(s => s.id)
  const songKeys = songs.map(s => `${s.name.toLowerCase().replace(/\s*[([].*$/, '').trim()}|${s.artist.toLowerCase().split(/,|&/)[0].trim()}`)
  const lang = LANGUAGE[vibe]
  const offLanguage = lang && vibe !== 'dev-special'
    ? songs.filter(s => !(Array.isArray(lang) ? lang : [lang]).includes(s.genres[0])).map(s => `${s.name} [${s.genres[0]}]`)
    : []
  const keyOf = (title, artist) => `${title.toLowerCase().replace(/s*[([].*$/, '').trim()}|${artist.toLowerCase().split(/,|&/)[0].trim()}`
  const present = new Set(songs.map(s => keyOf(s.name, s.artist)))
  const curatedMissing = (CURATED_TRACKS[vibe] ?? []).filter(t => !present.has(keyOf(t.trackName, t.artistName))).map(t => t.trackName)
  const noPreview = songs.filter(s => !s.previewUrl).map(s => s.name)
  const noArt = songs.filter(s => !s.albumArt).map(s => s.name)
  const badPreviews = await checkAll(songs.flatMap(s => s.previewUrl ? [s.previewUrl] : []))
  const badArt = await checkAll(songs.flatMap(s => s.albumArt ? [s.albumArt] : []))
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
  const dupSongs = songKeys.filter((k, i) => songKeys.indexOf(k) !== i)
  const sources = songs.reduce((m, s) => (m[s.source ?? 'static'] = (m[s.source ?? 'static'] ?? 0) + 1, m), {})
  const ages = songs.filter(s => s.releaseDate).map(s => (Date.now() - Date.parse(s.releaseDate)) / 86400000).sort((a, b) => a - b)
  const problems = { dupIds, dupSongs, offLanguage, curatedMissing, noPreview, noArt, badPreviews, badArt }
  const failed = Object.entries(problems).filter(([k, v]) => v.length && !(vibe === 'dev-special' && (k === 'dupSongs' || k === 'noPreview')))
  if (failed.length) failures++
  snapshot.charts[vibe] = {
    complete, count: songs.length, sources,
    playablePreviews: songs.length - noPreview.length - badPreviews.length,
    medianAgeDays: ages.length ? Math.round(ages[Math.floor(ages.length / 2)]) : null,
    releasedWithin90Days: ages.filter(a => a <= 90).length,
    releasedWithin365Days: ages.filter(a => a <= 365).length,
    problems,
    songs: songs.map(s => ({ id: s.id, title: s.name, artist: s.artist, album: s.album, genre: s.genres[0], releaseDate: s.releaseDate?.slice(0, 10) ?? null, source: s.source ?? 'static', chartRank: s.chartRank ?? null, previewUrl: s.previewUrl, artwork: s.albumArt })),
  }
  console.log(`${vibe.padEnd(17)} ${String(songs.length).padStart(3)} songs ${JSON.stringify(sources)} complete=${complete} ` +
    `median age ${snapshot.charts[vibe].medianAgeDays}d | ${failed.length ? 'FAIL ' + failed.map(([k, v]) => `${k}:${v.length}`).join(' ') : 'ok'}`)
  // Stay well inside Apple's request budget between charts (charts share cached feeds).
  if (vibe !== 'dev-special') await sleep(Math.max(0, 24000 - (Date.now() - started)))
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 1))
console.log(`snapshot → ${outFile}`)
process.exit(failures ? 1 : 0)
