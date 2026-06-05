/**
 * build-regional-charts.mjs
 *
 * Fetches 3 Spotify public playlist pages, extracts every track,
 * enriches each with artwork + preview from iTunes (4-layer fallback),
 * and writes static SongNode[] data files for each regional chart.
 *
 * Run:  node scripts/build-regional-charts.mjs
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Playlist sources ──────────────────────────────────────────────────────────
const PLAYLISTS = [
  {
    id:       'top-telugu',
    title:    'Top Telugu',
    language: 'telugu',
    url:      'https://open.spotify.com/playlist/1llHjtjECBo12ChwOGe38L',
    outFile:  path.join(__dirname, '../lib/teluguChartData.ts'),
    exportName: 'teluguChartData',
    genreTag: 'Telugu',
  },
  {
    id:       'top-tamil',
    title:    'Top Tamil',
    language: 'tamil',
    url:      'https://open.spotify.com/playlist/5lfuu0un8XjAtUdxwtqjm4',
    outFile:  path.join(__dirname, '../lib/tamilChartData.ts'),
    exportName: 'tamilChartData',
    genreTag: 'Tamil',
  },
  {
    id:       'top-hindi',
    title:    'Top Hindi',
    language: 'hindi',
    url:      'https://open.spotify.com/playlist/0i2S0eEdftTrmLKueMWUKX',
    outFile:  path.join(__dirname, '../lib/hindiChartData.ts'),
    exportName: 'hindiChartData',
    genreTag: 'Hindi',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function hashNumber(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function genreColor(genre) {
  const g = (genre || '').toLowerCase();
  if (g.includes('telugu') || g.includes('tollywood')) return '#059669';
  if (g.includes('tamil')  || g.includes('kollywood')) return '#dc2626';
  if (g.includes('hindi')  || g.includes('bollywood')) return '#f97316';
  if (g.includes('pop'))    return '#ff3366';
  if (g.includes('hip-hop') || g.includes('rap'))      return '#ff9933';
  if (g.includes('dance')  || g.includes('electronic')) return '#33ccff';
  if (g.includes('rock'))   return '#cc33ff';
  if (g.includes('r&b'))    return '#9933ff';
  return '#1db954';
}

function nodePhysics(idStr) {
  const h = hashNumber(idStr);
  const r1 = (h         % 1000) / 1000;
  const r2 = ((h >> 4)  % 1000) / 1000;
  const r3 = ((h >> 8)  % 1000) / 1000;
  return {
    x:  (r1 - 0.5) * 80,
    y:  (r2 - 0.5) * 50,
    z:  (r3 - 0.5) * 30,
    vx: (r1 - 0.5) * 0.4,
    vy: (r2 - 0.5) * 0.4,
    scale: 0.5 + r3 * 1.2,
  };
}

// ── Spotify scraper ───────────────────────────────────────────────────────────

/**
 * Fetch a Spotify public playlist page and extract track list from the
 * embedded __NEXT_DATA__ JSON or server-side state.
 * Returns [ { title, artist } ]
 */
async function scrapeSpotifyPlaylist(url) {
  console.log(`\n[Spotify] Fetching ${url} …`);

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Spotify returned ${res.status} for ${url}`);
  }

  const html = await res.text();

  // Strategy 1: parse __NEXT_DATA__ embedded JSON
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const tracks = extractTracksFromNextData(json);
      if (tracks.length > 0) {
        console.log(`[Spotify] __NEXT_DATA__ strategy: found ${tracks.length} tracks`);
        return tracks;
      }
    } catch (e) {
      console.warn('[Spotify] __NEXT_DATA__ parse failed:', e.message);
    }
  }

  // Strategy 2: look for Spotify API embedded state (older format)
  const spotifyStateMatch = html.match(/Spotify\.Entity\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (spotifyStateMatch) {
    try {
      const json = JSON.parse(spotifyStateMatch[1]);
      const tracks = extractTracksFromEntityState(json);
      if (tracks.length > 0) {
        console.log(`[Spotify] Entity strategy: found ${tracks.length} tracks`);
        return tracks;
      }
    } catch (_) {}
  }

  // Strategy 3: regex over raw HTML for JSON-LD or meta tags
  const tracks = extractTracksFromRawHTML(html);
  if (tracks.length > 0) {
    console.log(`[Spotify] Raw-HTML strategy: found ${tracks.length} tracks`);
    return tracks;
  }

  throw new Error(
    `Could not extract tracks from ${url}. ` +
    `Spotify may have updated their page structure. ` +
    `Try running the script again or check the playlist URL.`
  );
}

function extractTracksFromNextData(json) {
  const tracks = [];

  // Walk the props tree looking for playlist items
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    // Spotify Next.js page props structure
    if (obj.items && Array.isArray(obj.items)) {
      for (const item of obj.items) {
        const t = item?.track || item;
        if (t?.name && t?.artists) {
          tracks.push({
            title:  t.name,
            artist: t.artists.map(a => a.name).join(', '),
          });
        }
      }
    }
    // Recursive
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') walk(v);
    }
  }

  walk(json);
  return dedupeByTitle(tracks);
}

function extractTracksFromEntityState(json) {
  const tracks = [];
  const items = json?.tracks?.items || [];
  for (const item of items) {
    const t = item?.track;
    if (t?.name && t?.artists) {
      tracks.push({
        title:  t.name,
        artist: t.artists.map(a => a.name).join(', '),
      });
    }
  }
  return tracks;
}

function extractTracksFromRawHTML(html) {
  const tracks = [];

  // JSON-LD (schema.org/MusicPlaylist)
  const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const m of ldMatches) {
    try {
      const json = JSON.parse(m[1]);
      if (json['@type'] === 'MusicPlaylist' && Array.isArray(json.track)) {
        for (const t of json.track) {
          if (t.name) {
            tracks.push({
              title:  t.name,
              artist: t.byArtist?.name || '',
            });
          }
        }
      }
    } catch (_) {}
  }

  if (tracks.length > 0) return tracks;

  // Last resort: extract from meta og:description or title tags
  // (won't give full list, but better than nothing)
  const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (ogDesc) {
    console.warn('[Spotify] Only found og:description — track list will be incomplete');
  }

  return tracks;
}

function dedupeByTitle(tracks) {
  const seen = new Set();
  return tracks.filter(t => {
    const key = t.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── iTunes enrichment (4-layer) ───────────────────────────────────────────────

const PREVIEW_CACHE = new Map(); // term → previewUrl (avoids re-fetching)

/**
 * Normalize a title for fuzzy matching:
 * - lowercase
 * - remove punctuation
 * - strip remix/version suffixes
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s*[\(\[].*(remix|version|remaster|live|acoustic|feat\.?|ft\.?).*[\)\]]/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score an iTunes result against the desired title/artist.
 * Higher = better match. Returns 0 if completely wrong.
 */
function matchScore(result, wantedTitle, wantedArtist) {
  const rTitle  = normalizeTitle(result.trackName  || '');
  const rArtist = (result.artistName || '').toLowerCase();
  const wTitle  = normalizeTitle(wantedTitle);
  const wArtist = wantedArtist.toLowerCase();

  if (!rTitle) return 0;

  let score = 0;
  if (rTitle === wTitle)          score += 60;
  else if (rTitle.startsWith(wTitle) || wTitle.startsWith(rTitle)) score += 40;
  else if (rTitle.includes(wTitle) || wTitle.includes(rTitle))     score += 20;
  else return 0; // title doesn't match at all

  // Artist match bonus
  const mainArtist = wantedArtist.split(',')[0].trim().toLowerCase();
  if (rArtist.includes(mainArtist) || mainArtist.includes(rArtist)) score += 20;

  return score;
}

async function itunesSearch(term, limit = 5, country = 'IN', retries = 4) {
  if (PREVIEW_CACHE.has(term)) return PREVIEW_CACHE.get(term);

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&country=${country}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 403) {
        const wait = 3000 * Math.pow(2, attempt);
        console.log(`  Rate-limited. Waiting ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.results || [];
      PREVIEW_CACHE.set(term, results);
      return results;
    } catch (_) {
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  return [];
}

/**
 * 4-layer iTunes enrichment for a single track.
 * Returns the best matching iTunes result object or null.
 */
async function enrichTrack(title, artist) {
  const mainArtist = artist.split(',')[0].trim();

  const layers = [
    // Layer 1: title + full artist (India store)
    async () => {
      const results = await itunesSearch(`${title} ${artist}`, 5, 'IN');
      return bestMatch(results, title, artist);
    },
    // Layer 2: title + main artist only
    async () => {
      const results = await itunesSearch(`${title} ${mainArtist}`, 5, 'IN');
      return bestMatch(results, title, mainArtist);
    },
    // Layer 3: normalized title + main artist
    async () => {
      const norm = normalizeTitle(title);
      const results = await itunesSearch(`${norm} ${mainArtist}`, 5, 'IN');
      return bestMatch(results, title, mainArtist);
    },
    // Layer 4: title alone (broadest, most likely to get wrong artist)
    async () => {
      const results = await itunesSearch(title, 10, 'IN');
      return bestMatch(results, title, artist);
    },
  ];

  for (let i = 0; i < layers.length; i++) {
    const match = await layers[i]();
    if (match) {
      console.log(`    ✓ Layer ${i+1} match: "${match.trackName}" — ${match.artistName}${match.previewUrl ? ' [preview ✓]' : ' [no preview]'}`);
      return match;
    }
  }
  return null;
}

function bestMatch(results, wantedTitle, wantedArtist) {
  if (!results.length) return null;

  let best = null;
  let bestScore = 0;

  for (const r of results) {
    const s = matchScore(r, wantedTitle, wantedArtist);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }

  return bestScore >= 20 ? best : null;
}

// ── Main build function ───────────────────────────────────────────────────────

async function buildPlaylist(playlist) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Building: ${playlist.title.toUpperCase()}`);
  console.log(`  Playlist: ${playlist.url}`);
  console.log(`${'═'.repeat(60)}`);

  // Step 1: scrape Spotify
  let rawTracks;
  try {
    rawTracks = await scrapeSpotifyPlaylist(playlist.url);
  } catch (err) {
    console.error(`[ERROR] Spotify scrape failed: ${err.message}`);
    console.error(`  Writing empty data file as fallback.`);
    rawTracks = [];
  }

  console.log(`\n  Tracks extracted: ${rawTracks.length}`);

  if (rawTracks.length === 0) {
    console.warn(`\n  ⚠  No tracks found. Writing empty data file.`);
    writeDataFile(playlist, []);
    return;
  }

  // Step 2: enrich each track with iTunes
  const songs = [];
  let previewCount = 0;

  for (let i = 0; i < rawTracks.length; i++) {
    const { title, artist } = rawTracks[i];
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${rawTracks.length}] "${title}" — ${artist} … `);

    const track = await enrichTrack(title, artist);

    if (!track) {
      console.log('✗ not found on iTunes');
      continue;
    }

    const idStr      = track.trackId.toString();
    const popularity = 40 + (hashNumber(idStr) % 60);
    const genres     = [track.primaryGenreName || playlist.genreTag, playlist.genreTag];
    const physics    = nodePhysics(idStr);
    const albumArt   = (track.artworkUrl100 || '').replace('100x100bb', '600x600bb');

    if (track.previewUrl) previewCount++;

    songs.push({
      id:         idStr,
      name:       track.trackName,
      artist:     track.artistName,
      album:      track.collectionName || 'Unknown Album',
      albumArt,
      previewUrl: track.previewUrl || null,
      spotifyUrl: track.trackViewUrl || '',
      popularity,
      genres,
      color:      genreColor(genres[0]),
      scale:      physics.scale,
      x:          physics.x,
      y:          physics.y,
      z:          physics.z,
      vx:         physics.vx,
      vy:         physics.vy,
    });

    // Polite delay
    await sleep(250);
  }

  // Step 3: diagnostics
  const coverage = songs.length > 0
    ? ((previewCount / songs.length) * 100).toFixed(1)
    : '0.0';
  const missing = songs.length - previewCount;

  console.log(`\n╔${'═'.repeat(50)}╗`);
  console.log(`║  ${playlist.title.toUpperCase()} — BUILD REPORT`);
  console.log(`║  Songs Found     : ${songs.length} / ${rawTracks.length}`);
  console.log(`║  Preview Coverage: ${coverage}%`);
  console.log(`║  Missing Previews: ${missing}`);
  console.log(`╚${'═'.repeat(50)}╝`);

  // Step 4: write data file
  writeDataFile(playlist, songs);
}

function writeDataFile(playlist, songs) {
  const content =
`// Auto-generated — ${playlist.title} chart data
// Source: ${playlist.url}
// DO NOT EDIT MANUALLY. Re-run scripts/build-regional-charts.mjs to regenerate.
import { SongNode } from './types';

export const ${playlist.exportName}: SongNode[] = ${JSON.stringify(songs, null, 2)};
`;

  fs.writeFileSync(playlist.outFile, content, 'utf-8');
  console.log(`  ✓ Written to ${path.relative(process.cwd(), playlist.outFile)}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎵 KADENCE Regional Charts Builder');
  console.log('   Building from Spotify playlists + iTunes enrichment\n');

  for (const playlist of PLAYLISTS) {
    await buildPlaylist(playlist);
  }

  console.log('\n✅  All regional charts built.\n');
  console.log('Next steps:');
  console.log('  1. Verify lib/teluguChartData.ts, lib/tamilChartData.ts, lib/hindiChartData.ts');
  console.log('  2. Confirm preview coverage in the build report above');
  console.log('  3. Run: npx tsc --noEmit   (should pass with 0 errors)');
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
