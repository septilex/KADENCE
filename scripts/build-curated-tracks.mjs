/**
 * Builds lib/curatedTracks.ts: hand-verified recent soundtracks that KADENCE always includes in a
 * chart (in addition to Apple's live chart). Every track is fetched from Apple's documented
 * iTunes Lookup API and must be in the chart's language genre, with a preview and artwork.
 *
 *   node scripts/build-curated-tracks.mjs
 *
 * Albums are taken from Apple's official tracklist (collection id); singles by track id.
 * Attribution notes record how each film was verified (see KADENCE_MUSIC_REFRESH_REPORT.md).
 */
import fs from 'node:fs'
import path from 'node:path'

const SOURCES = {
  'top-tamil': {
    language: 'Tamil',
    releases: [
      { film: 'Jailer 2', composer: 'Anirudh Ravichander', album: 6817733404 },
      { film: 'Jailer 2', composer: 'Anirudh Ravichander', tracks: [6827080210 /* Roddy Theme */, 6824855203 /* Tiger Muthuvel Pandian */, 6837340401 /* Unfinished Business (released 2026-11-21) */] },
      { film: 'Scene', composer: 'Sushin Shyam', album: 6831048832 },
      { film: 'Baththa', composer: 'Sai Abhyankkar', album: 6818555484 },
      {
        film: 'O.M: Operation Mole (earlier titled OM Chapter 1: Udhiram – The Blood Wood)',
        composer: 'Sai Abhyankkar',
        tracks: [
          6782026766, // The Wild Theme
          6827187668, // OM Special Duty
          6795543551, // Alaakaa Loova [Tamil]
          6797627328, // Alaakaa Loova Unplugged
          6809555827, // Siya Entry
          6824473553, // Veezha Veera [Tamil]
          6830749459, // Senjudare
          6832237877, // FA FA FA
        ],
      },
    ],
  },
  // Ramayana: Part 1 (2026) — every official Hindi release, songs and score/BGM alike. All are
  // ℗ 2026 Super Cassettes Industries (the film's label) in Apple's Bollywood genre; the Tamil,
  // Telugu, Kannada and Malayalam versions belong to those languages and are excluded here.
  'top-hindi': {
    language: 'Bollywood',
    releases: [
      // Official soundtrack EP: Jai Jai Ram, Ravana Tandav, Sita's Aspiration, Jai Jai Ram (Orchestral), Rama Theme
      { film: 'Ramayana: Part 1', composer: 'Hans Zimmer & A.R. Rahman', album: 6825357149 },
      {
        film: 'Ramayana: Part 1',
        composer: 'Hans Zimmer & A.R. Rahman',
        tracks: [
          6796798791, // Ramayana (The Introduction Theme)
          6796798465, // Rama Theme (single release)
          6797398144, // Ramayana Trailer Theme
          6811746468, // Jai Jai Ram (single release)
          6825073239, // Ravana Tandav - Hindi (single release)
          6826737455, // Mangal Rang
          6828305494, // Judi Jodi - HINDI
          6831158554, // Shree Hanuman Chalisa
        ],
      },
      {
        // Official T-Series "From Ramayana" singles with Kumar Vishwas lyrics, credited to other composers.
        film: 'Ramayana: Part 1',
        composer: 'Various (lyrics Kumar Vishwas)',
        tracks: [
          6825423396, // Main Ram
          6831979287, // Ram Raja Bhi Hain Aur Tapasvi Bhi Hain
          6835136043, // O Ragho
          6836762821, // Awadh Ke Ram Chale
        ],
      },
    ],
  },
}

const REJECT = /karaoke|ringtone|lyrical|8d audio|slowed|reverb|cover|tribute/i
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function lookup(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://itunes.apple.com/lookup?${query}&country=in`, { signal: AbortSignal.timeout(20000) })
    if (res.ok) return (await res.json()).results ?? []
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`lookup failed: ${query}`)
}

const out = {}
const rejected = []
for (const [vibe, { language, releases }] of Object.entries(SOURCES)) {
  const seen = new Set()
  out[vibe] = []
  for (const release of releases) {
    const results = release.album
      ? await lookup(`id=${release.album}&entity=song&limit=200`)
      : await lookup(`id=${release.tracks.join(',')}`)
    await sleep(3500)
    const tracks = results.filter(r => r.wrapperType === 'track' && r.kind === 'song')
    if (release.tracks) for (const id of release.tracks) if (!tracks.some(t => t.trackId === id)) rejected.push({ vibe, film: release.film, trackId: id, reason: 'not returned by iTunes Lookup (unavailable in the India storefront)' })
    for (const t of tracks) {
      const why = t.primaryGenreName !== language ? `language genre is "${t.primaryGenreName}", not ${language}`
        : !t.previewUrl ? 'no 30-second preview'
        : !t.artworkUrl100 ? 'no artwork'
        : REJECT.test(`${t.trackName} ${t.collectionName}`) ? 'derivative version (karaoke/lyrical/cover)'
        : seen.has(t.trackId) ? null : ''
      if (why === null) continue
      if (why) { rejected.push({ vibe, film: release.film, trackId: t.trackId, title: t.trackName, reason: why }); continue }
      seen.add(t.trackId)
      out[vibe].push({
        trackId: t.trackId, trackName: t.trackName, artistName: t.artistName, collectionName: t.collectionName,
        artworkUrl100: t.artworkUrl100, previewUrl: t.previewUrl, trackViewUrl: t.trackViewUrl,
        primaryGenreName: t.primaryGenreName, releaseDate: t.releaseDate,
        film: release.film, composer: release.composer,
      })
    }
  }
  console.log(`${vibe}: ${out[vibe].length} verified tracks`)
}
for (const r of rejected) console.log('  rejected', JSON.stringify(r))

const file = path.resolve('lib/curatedTracks.ts')
fs.writeFileSync(file, `// Generated by scripts/build-curated-tracks.mjs on ${new Date().toISOString().slice(0, 10)} from Apple's iTunes Lookup API.
// Do not edit by hand: change SOURCES in the script and re-run it.
import type { Vibe } from './types'
import type { ItunesTrack } from './itunesClient'

export interface CuratedTrack extends ItunesTrack {
  /** Film the track belongs to, as verified for the music refresh report. */
  film: string
  composer: string
}

export const CURATED_TRACKS: Partial<Record<Vibe, CuratedTrack[]>> = ${JSON.stringify(out, null, 2)}

/** Tracks considered and left out, with the reason (kept for the report). */
export const CURATED_REJECTED = ${JSON.stringify(rejected, null, 2)}
`)
console.log(`wrote ${path.relative(process.cwd(), file)}`)
