import { SongNode, Vibe } from './types'
import { itunesClient, MusicProviderError, type ItunesTrack } from './itunesClient'
import { devSpecialData }             from './devSpecialData'
import { CURATED_TRACKS } from './curatedTracks'

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

// ── Regional Language Filters ─────────────────────────────────────────────────
// Strategy: Unicode script detection (strongest) + verified artist allowlists +
//           keyword heuristics in track/album/artist metadata.

/** Telugu Unicode block: U+0C00–U+0C7F */
const TELUGU_SCRIPT_RE = /[\u0C00-\u0C7F]/;
/** Tamil Unicode block: U+0B80–U+0BFF */
const TAMIL_SCRIPT_RE  = /[\u0B80-\u0BFF]/;
/** Devanagari (Hindi) Unicode block: U+0900–U+097F */
const DEVANAGARI_RE    = /[\u0900-\u097F]/;

/**
 * Artists/composers who work EXCLUSIVELY in Telugu.
 * Stored lowercase — matching uses .includes() against the lowercased artistName.
 */
const TELUGU_ARTIST_ALLOWLIST: readonly string[] = [
  // composers / music directors
  'devi sri prasad', 'ss thaman', 's thaman', 'thaman', 'anup rubens',
  'mickey j meyer', 'manisharma', 'mani sharma', 'chakri',
  'm m keeravani', 'keeravani', 'mm keeravani',
  'hesham abdul wahab',
  'bheems ceciroleo', 'shekar chandra',
  // playback singers
  'sid sriram', 'rahul sipligunj', 'harika narayan', 'mallikarjun',
  'anurag kulkarni', 'lipsika', 'ramya behara', 'geetha madhuri',
  'karthik', 'sp balasubrahmanyam', 'sp balu', 'balasubrahmanyam',
  'ranjith', 'praveen lakkaraju',
  // popular actors/stars (credited on soundtracks)
  'allu arjun', 'jr ntr', 'ram charan', 'prabhas', 'mahesh babu',
  'vijay deverakonda', 'vijay devarakonda', 'nani', 'ravi teja',
  'chiranjeevi', 'balakrishna', 'venkatesh', 'nagarjuna',
  // production companies / labels that release exclusively Telugu
  'lahari music telugu', 'aditya music', 'tips telugu',
];

/** Artists who work EXCLUSIVELY in Tamil */
const TAMIL_ARTIST_ALLOWLIST: readonly string[] = [
  // composers
  'ar rahman', 'a r rahman', 'anirudh ravichander', 'anirudh',
  'yuvan shankar raja', 'gv prakash', 'gv prakash kumar',
  'harris jayaraj', 'd imman', 'santhosh narayanan', 'vijay antony',
  'hip hop adhi', 'hip hop tamizha', 'sean roldan',
  'james vasanthan', 'karthik raja', 'ilayaraja', 'ilaiyaraaja',
  // singers
  'sid sriram', 'haricharan', 'naresh iyer', 'tippu', 'benny dayal',
  'karthik', 'vijay prakash', 'devan ekambaram',
  'chinmayi', 'shweta mohan', 'pooja av', 'vandana srinivasan',
  'dhee', 'arivu', 'yogi b', 'kayal chandran',
  // actors
  'rajinikanth', 'kamal haasan', 'vijay', 'ajith', 'suriya', 'vikram',
  'dhanush', 'simbu', 'sivakarthikeyan', 'karthi',
  // labels
  'sony music south', 'lahari music', 'think music', 'sun music',
];

/** Artists who work primarily in Hindi/Bollywood */
const HINDI_ARTIST_ALLOWLIST: readonly string[] = [
  // playback singers
  'arijit singh', 'atif aslam', 'jubin nautiyal', 'armaan malik',
  'mohit chauhan', 'sonu nigam', 'shaan', 'kk', 'kumar sanu',
  'udit narayan', 'alka yagnik', 'shreya ghoshal',
  'sunidhi chauhan', 'neha kakkar', 'tulsi kumar', 'palak muchhal',
  'monali thakur', 'jonita gandhi', 'shilpa rao', 'kavita seth',
  'hariharan', 'usha uthup',
  'lata mangeshkar', 'asha bhosle', 'kishore kumar',
  // composers / music directors (Bollywood-exclusive or primary)
  'pritam', 'shankar ehsaan loy', 'shankar-ehsaan-loy',
  'vishal-shekhar', 'vishal mishra', 'amit trivedi',
  'sachin-jigar', 'tanishk bagchi', 'payal dev',
  'mithoon', 'jeet gannguli', 'ankit tiwari', 'darshan raval',
  'b praak', 'jaani', 'pawandeep rajan', 'arunita kanjilal',
  'nucleya', 'badshah', 'yo yo honey singh', 'raftaar',
  'guru randhawa', 'diljit dosanjh', 'ap dhillon',
  // actors (credited)
  'salman khan', 'shah rukh khan', 'aamir khan', 'hrithik roshan',
  'ranbir kapoor', 'ranveer singh',
  // labels
  'zee music company', 'tseries', 't-series', 'yash raj films',
  'dharma productions', 'saregama',
];

// ── Shared utility helpers ────────────────────────────────────────────────────
function containsScript(text: string, re: RegExp): boolean {
  return re.test(text);
}

function artistInAllowlist(artist: string, list: readonly string[]): boolean {
  const lower = artist.toLowerCase();
  return list.some(known => lower.includes(known));
}

/** Texts that immediately disqualify a track regardless of language */
const HARD_REJECT_KEYWORDS: readonly string[] = [
  'instrumental', 'bgm', 'background score', 'theme music',
  'karaoke', 'ringtone', 'orchestra', 'jukebox',
];

/**
 * Artists who work in MULTIPLE languages — their presence alone is NOT
 * sufficient to verify language. They only contribute a small confidence
 * boost (+15) and require additional script/keyword confirmation.
 */
const MULTILINGUAL_ARTISTS: readonly string[] = [
  'ar rahman', 'a r rahman',   // Tamil + Hindi + Malayalam + Telugu
  'sid sriram',                // Tamil + Telugu
  'shreya ghoshal',            // All Indian languages
  'armaan malik',              // Hindi + Telugu + Tamil + Kannada
  'karthik',                   // Tamil + Telugu + Kannada
  'chinmayi',                  // Tamil + Telugu
  'haricharan',                // Tamil + Telugu + Hindi
  'benny dayal',               // Tamil + Hindi
  'udit narayan',              // Hindi + Tamil + Telugu
  'sonu nigam',                // Hindi + Tamil + Bengali
  'sp balasubrahmanyam',       // Telugu + Tamil + Hindi + Kannada
  'sp balu',
  'balasubrahmanyam',
  'hariharan',                 // Hindi + Tamil
];

function isMultilingual(artist: string): boolean {
  const lower = artist.toLowerCase();
  return MULTILINGUAL_ARTISTS.some(m => lower.includes(m));
}

/** Extract release year from iTunes releaseDate (e.g. "2023-04-15T07:00:00Z") */
function getReleaseYear(track: ItunesTrack): number {
  if (!track.releaseDate) return 2000;
  const y = parseInt(track.releaseDate.slice(0, 4), 10);
  return isNaN(y) ? 2000 : y;
}

/** Recency bonus: rewards recent tracks so charts stay current. */
function recencyBonus(year: number): number {
  const currentYear = new Date().getFullYear();
  if (year >= currentYear - 1) return 15;   // released in past 12-24 months
  if (year >= currentYear - 3) return 8;    // released 2–3 years ago
  if (year >= currentYear - 5) return 3;    // released 4–5 years ago
  return 0;                                  // older classic — no bonus
}

// ── Confidence scoring ────────────────────────────────────────────────────────
// Threshold: a track must score ≥ ACCEPT_THRESHOLD to enter the universe.
const ACCEPT_THRESHOLD = 40;

/**
 * Score a track for Telugu authenticity.
 * Returns a positive score (≥ ACCEPT_THRESHOLD = accept) or a negative / low
 * score (< ACCEPT_THRESHOLD = reject).
 */
function scoreTeluguTrack(track: ItunesTrack): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  // ── Hard disqualifiers ── score made deeply negative so they never pass
  if (containsScript(combined, TAMIL_SCRIPT_RE) || containsScript(combined, DEVANAGARI_RE)) {
    if (MUSIC_DEBUG) console.log(`[TELUGU ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    if (MUSIC_DEBUG) console.log(`[TELUGU ✗ instrumental] "${name}"`);
    return -200;
  }

  let score = 0;

  // ── Script signals (strongest) ────────────────────────────────────────────
  if (containsScript(name,   TELUGU_SCRIPT_RE)) score += 70; // track name in Telugu script
  else if (containsScript(artist + album, TELUGU_SCRIPT_RE)) score += 45;

  // ── Explicit keyword signals ──────────────────────────────────────────────
  if (haystack.includes('telugu') || haystack.includes('tollywood')) score += 45;
  else if (haystack.includes('andhra') || haystack.includes('aditya music')) score += 30;

  // ── Artist signals ────────────────────────────────────────────────────────
  if (isMultilingual(artist)) {
    // Multilingual artists only contribute a small boost — must be confirmed by script/keyword
    score += 15;
  } else if (artistInAllowlist(artist, TELUGU_ARTIST_ALLOWLIST)) {
    score += 35; // Telugu-exclusive artist — strong boost
  }

  // ── Recency bonus ─────────────────────────────────────────────────────────
  score += recencyBonus(getReleaseYear(track));

  if (score < ACCEPT_THRESHOLD) {
    if (MUSIC_DEBUG) console.log(`[TELUGU ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
  }
  return score;
}

/** Score a track for Tamil authenticity. */
function scoreTamilTrack(track: ItunesTrack): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  if (containsScript(combined, TELUGU_SCRIPT_RE) || containsScript(combined, DEVANAGARI_RE)) {
    if (MUSIC_DEBUG) console.log(`[TAMIL ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    if (MUSIC_DEBUG) console.log(`[TAMIL ✗ instrumental] "${name}"`);
    return -200;
  }

  let score = 0;

  if (containsScript(name,   TAMIL_SCRIPT_RE)) score += 70;
  else if (containsScript(artist + album, TAMIL_SCRIPT_RE)) score += 45;

  if (haystack.includes('tamil') || haystack.includes('kollywood')) score += 45;
  else if (haystack.includes('madras') || haystack.includes('think music') || haystack.includes('sony music south')) score += 30;

  if (isMultilingual(artist)) {
    score += 15;
  } else if (artistInAllowlist(artist, TAMIL_ARTIST_ALLOWLIST)) {
    score += 35;
  }

  score += recencyBonus(getReleaseYear(track));

  if (score < ACCEPT_THRESHOLD) {
    if (MUSIC_DEBUG) console.log(`[TAMIL ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
  }
  return score;
}

/** Score a track for Hindi/Bollywood authenticity. */
function scoreHindiTrack(track: ItunesTrack): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  if (containsScript(combined, TELUGU_SCRIPT_RE) || containsScript(combined, TAMIL_SCRIPT_RE)) {
    if (MUSIC_DEBUG) console.log(`[HINDI ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    if (MUSIC_DEBUG) console.log(`[HINDI ✗ instrumental] "${name}"`);
    return -200;
  }

  let score = 0;

  // Devanagari is the strongest Hindi signal
  if (containsScript(name,   DEVANAGARI_RE)) score += 70;
  else if (containsScript(artist + album, DEVANAGARI_RE)) score += 45;

  if (haystack.includes('bollywood') || haystack.includes('hindi')) score += 45;
  else if (
    haystack.includes('filmi') ||
    haystack.includes('zee music') ||
    haystack.includes('t-series') ||
    haystack.includes('tseries') ||
    haystack.includes('yash raj') ||
    haystack.includes('dharma')
  ) score += 30;

  if (isMultilingual(artist)) {
    score += 15;
  } else if (artistInAllowlist(artist, HINDI_ARTIST_ALLOWLIST)) {
    score += 35;
  }

  score += recencyBonus(getReleaseYear(track));

  if (score < ACCEPT_THRESHOLD) {
    if (MUSIC_DEBUG) console.log(`[HINDI ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
  }
  return score;
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

// ── Chart plans ──────────────────────────────────────────────────────────────
//
// Each KADENCE chart is built from three sources, in this order of authority:
//   1. chart    Apple's live top-songs charts (documented iTunes RSS, per storefront/genre).
//               Rank on these charts is the only popularity signal used.
//   2. curated  Hand-verified recent soundtracks (lib/curatedTracks.ts, built from the
//               iTunes Lookup API by scripts/build-curated-tracks.mjs).
//   3. search   iTunes keyword search, only to top a chart up to its size. Search order is
//               never treated as popularity; these songs sort after chart songs, newest first.

type ChartRef = readonly [storefront: string, genre?: number]

interface ChartPlan {
  /** Apple top-songs charts merged into this chart (genre ids: 14 Pop, 15 R&B/Soul,
   *  17 Dance, 18 Hip-Hop/Rap, 7 Electronic, 10 Singer/Songwriter, 20 Alternative,
   *  21 Rock, 51 K-Pop, 1263 Bollywood, 1264 Tamil, 1265 Telugu, 1266 Regional Indian). */
  charts: readonly ChartRef[]
  /** Storefront used for keyword top-up. */
  country: string
  /** Apple genre names accepted (regional / K-Pop charts). Anything else is rejected. */
  genres?: readonly string[]
  /** Hard limit on release age for chart and search songs ("new" charts). */
  maxAgeDays?: number
  /** Chart songs released within this window lead the chart; older hits follow them. */
  freshDays: number
  /** Keyword top-up, rotated on refresh. `{year}` becomes the current year. */
  queries: readonly string[]
  /** Genre tag attached to the songs. */
  genre: string
}

const ANGLO = ['us', 'gb', 'ca', 'au'] as const
const each = (genre?: number, stores: readonly string[] = ANGLO): ChartRef[] => stores.map(s => [s, genre] as const)

const CHART_PLANS: Record<Exclude<Vibe, 'dev-special'>, ChartPlan> = {
  'global-top-50': {
    charts: [...each(undefined, ['us', 'gb', 'ca', 'au', 'in'])], country: 'US', freshDays: 120, genre: 'pop',
    queries: ['top hits {year}', 'billboard hot 100 {year}', 'chart toppers {year}', 'global pop hits {year}', 'radio hits {year}', 'number one hits {year}'],
  },
  'viral-50': {
    charts: [...each(), ['us', 14], ['gb', 14]], country: 'US', maxAgeDays: 150, freshDays: 60, genre: 'pop',
    queries: ['viral hits {year}', 'tiktok viral {year}', 'trending songs {year}', 'viral dance {year}', 'internet hits {year}', 'viral pop {year}'],
  },
  'new-music-friday': {
    charts: [['us', 20], ['gb', 20], ['us', 10], ['us', 14]], country: 'US', maxAgeDays: 90, freshDays: 45, genre: 'indie',
    queries: ['new music {year}', 'new indie {year}', 'new alternative {year}', 'new releases {year}', 'indie pop {year}', 'fresh finds {year}'],
  },
  'hip-hop-central': {
    charts: each(18), country: 'US', freshDays: 180, genre: 'hip-hop',
    queries: ['rap {year}', 'hip hop {year}', 'trap {year}', 'drill {year}', 'rap hits {year}', 'hip hop bangers {year}'],
  },
  'pop-rising': {
    charts: each(14), country: 'US', freshDays: 365, genre: 'pop',
    queries: ['new pop {year}', 'pop {year}', 'rising pop {year}', 'alt pop {year}', 'bedroom pop {year}', 'hyperpop {year}'],
  },
  'dance-hits': {
    charts: [['us', 17], ['gb', 17], ['au', 17], ['us', 7], ['gb', 7]], country: 'US', freshDays: 180, genre: 'dance',
    queries: ['dance hits {year}', 'house music {year}', 'edm {year}', 'tech house {year}', 'club anthems {year}', 'melodic techno {year}'],
  },
  'mood-booster': {
    charts: [['us', 14], ['au', 14], ['us', 17]], country: 'US', freshDays: 365, genre: 'pop',
    queries: ['feel good {year}', 'happy songs {year}', 'upbeat pop {year}', 'good vibes {year}', 'summer hits {year}', 'feel good pop'],
  },
  'late-night': {
    charts: [['us', 15], ['gb', 15], ['ca', 15]], country: 'US', freshDays: 365, genre: 'r&b',
    queries: ['r&b {year}', 'slow jams {year}', 'neo soul {year}', 'late night r&b', 'chill r&b {year}', 'smooth r&b'],
  },
  'workout': {
    charts: [['us', 18], ['us', 21], ['us', 17], ['gb', 17]], country: 'US', freshDays: 365, genre: 'workout',
    queries: ['workout {year}', 'gym motivation {year}', 'hard rock {year}', 'running music {year}', 'phonk {year}', 'high energy {year}'],
  },
  'chill-hits': {
    charts: [['us', 10], ['gb', 10], ['ca', 10]], country: 'US', freshDays: 365, genre: 'ambient',
    queries: ['lofi {year}', 'chill {year}', 'acoustic chill {year}', 'soft pop {year}', 'chillout {year}', 'mellow acoustic'],
  },
  'top-telugu': {
    charts: [['in', 1265], ['in', 1266]], country: 'IN', genres: ['Telugu'], freshDays: 180, genre: 'telugu',
    queries: ['Telugu songs {year}', 'Tollywood {year}', 'Thaman Telugu {year}', 'Devi Sri Prasad Telugu', 'Telugu movie songs {year}', 'Sid Sriram Telugu'],
  },
  'top-tamil': {
    charts: [['in', 1264], ['in', 1266], ['in', 1262]], country: 'IN', genres: ['Tamil'], freshDays: 180, genre: 'tamil',
    queries: ['Tamil songs {year}', 'Kollywood {year}', 'Anirudh Ravichander {year}', 'Sai Abhyankkar', 'Tamil movie songs {year}', 'Think Indie Tamil'],
  },
  'top-hindi': {
    charts: [['in', 1263], ['in', 1262]], country: 'IN', genres: ['Bollywood', 'Hindi'], freshDays: 180, genre: 'hindi',
    queries: ['Bollywood {year}', 'Hindi songs {year}', 'Arijit Singh {year}', 'Bollywood movie songs {year}', 'Hindi romantic {year}', 'Pritam {year}'],
  },
  'top-kpop': {
    charts: each(51), country: 'US', genres: ['K-Pop'], freshDays: 365, genre: 'pop',
    queries: ['kpop {year}', 'BTS', 'BLACKPINK', 'Stray Kids', 'aespa', 'NewJeans'],
  },
}

const MUSIC_DEBUG = process.env.KADENCE_MUSIC_DEBUG === '1'
const DAY = 24 * 60 * 60 * 1000
/** Keyword queries per top-up; with chart feeds this keeps a cold chart well inside Apple's budget. */
const FILL_QUERIES = 2
/** Keyword results are not evidence of popularity, so top-up only adds recent releases. */
const FILL_MAX_AGE_DAYS = 730
/** Derivative uploads that are never chart material. */
const JUNK = /karaoke|ringtone|originally performed|made famous|in the style of|tribute to|8-?bit|lullaby version|music box version|\b(sped up|slowed( \+|\s&)? reverb|nightcore)\b/i

const REGIONAL_SCORER: Partial<Record<Vibe, (t: ItunesTrack) => number>> = {
  'top-telugu': scoreTeluguTrack,
  'top-tamil': scoreTamilTrack,
  'top-hindi': scoreHindiTrack,
}

interface Candidate {
  track: ItunesTrack
  source: 'chart' | 'curated' | 'search'
  /** Sum over merged charts of (1 − (rank−1)/chartLength): higher = higher and wider charting. */
  chartScore: number
  bestRank: number
  released: number
  /** In the verified curated list (kept whole, exempt from diversity caps), even if it also charts. */
  curated: boolean
}

function releaseTime(t: ItunesTrack): number {
  const time = t.releaseDate ? Date.parse(t.releaseDate) : NaN
  return Number.isFinite(time) ? time : 0
}

/**
 * One entry per song: single vs album, "(From …)" re-releases, and versions of one recording
 * (Radio Edit, Extended Mix, Long Version, Remaster, Remix, Rerecorded…) share a key, so the
 * best-charting version is kept. Bracketed text never names a different song.
 */
function songKey(t: ItunesTrack): string {
  const title = (t.trackName || '').toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/\s*-\s*(from|feat\.?|ft\.?|remaster(ed)?|radio edit|single version|live|hindi|tamil|telugu|kannada|malayalam)\b.*$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const artist = (t.artistName || '').toLowerCase().split(/,|&| feat\.?| ft\.?| x /)[0].trim()
  return `${title}|${artist}`
}

function popularityFor(c: Candidate, maxChartScore: number, now: number): number {
  // KADENCE "discovery score": derived from Apple chart position where one exists; otherwise a
  // modest value nudged by recency. It is not an external popularity figure.
  if (c.chartScore > 0) return Math.round(55 + 45 * Math.min(1, c.chartScore / Math.max(maxChartScore, 1e-6)))
  if (c.source === 'curated') return 60
  const ageDays = (now - c.released) / DAY
  return Math.round(30 + Math.max(0, 15 - ageDays / 30))
}

function itunesToSongNode(c: Candidate, genre: string, popularity: number): SongNode {
  const t = c.track
  const albumArt = t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : ''
  const genres = t.primaryGenreName ? [t.primaryGenreName.toLowerCase(), genre] : [genre]
  return {
    id: t.trackId.toString(),
    name: t.trackName || 'Unknown Track',
    artist: t.artistName || 'Unknown Artist',
    album: t.collectionName || 'Unknown Album',
    albumArt,
    previewUrl: t.previewUrl || null,
    spotifyUrl: t.trackViewUrl || '', // Apple Music link; field name kept for frontend compatibility
    popularity,
    genres,
    x: (Math.random() - 0.5) * 80,
    y: (Math.random() - 0.5) * 50,
    z: (Math.random() - 0.5) * 30,
    vx: 0,
    vy: 0,
    color: genreToColor(genres),
    scale: 0.5 + (popularity / 100) * 0.8,
    releaseDate: t.releaseDate,
    source: c.source,
    chartRank: Number.isFinite(c.bestRank) ? c.bestRank : undefined,
  }
}

/** Search queries for one rotation step: every query is reached across successive refreshes. */
function queryBatch(plan: ChartPlan, rotation: number, year: number): string[] {
  const n = plan.queries.length
  return Array.from({ length: Math.min(FILL_QUERIES, n) }, (_, i) => plan.queries[(rotation * FILL_QUERIES + i) % n].replace('{year}', String(year)))
}

/** Avoid runs of the same album/artist so a full soundtrack does not occupy one region of the wall. */
function spread<T>(items: T[], album: (x: T) => string, artist: (x: T) => string): T[] {
  const rest = [...items]
  const out: T[] = []
  while (rest.length) {
    const recent = out.slice(-3)
    let i = rest.findIndex(x => !recent.some(r => album(r) === album(x) || artist(r) === artist(x)))
    if (i < 0 || i > 12) i = 0 // never pull far ahead of its rank
    out.push(rest.splice(i, 1)[0])
  }
  return out
}

export interface ChartResult {
  songs: SongNode[]
  /** False when some upstream chart could not be read (the caller should cache it briefly). */
  complete: boolean
}

/**
 * Build a chart. `rotation` (0 for a first visit, +1 per refresh) selects the keyword top-up
 * batch and which songs lead the wall, so refreshing shows a genuinely different selection.
 */
export async function fetchChart(vibe: Vibe, targetCount = 256, rotation = 0, now = Date.now()): Promise<ChartResult> {
  if (vibe === 'dev-special') return { songs: devSpecialData, complete: true }
  const plan = CHART_PLANS[vibe] ?? CHART_PLANS['global-top-50']
  const target = Math.max(1, Math.min(targetCount, 256))
  const year = new Date(now).getFullYear()
  const scorer = REGIONAL_SCORER[vibe]
  const pool = new Map<number, Candidate>()

  const accept = (t: ItunesTrack, source: Candidate['source']): boolean => {
    if (!t.trackId || !t.artworkUrl100 || !t.previewUrl) return false // playable, with artwork
    if (source === 'curated') return true // verified at build time
    const text = `${t.trackName ?? ''} ${t.artistName ?? ''} ${t.collectionName ?? ''}`
    if (JUNK.test(text)) return false
    if (plan.genres && !plan.genres.includes(t.primaryGenreName ?? '')) return false
    if (scorer && scorer(t) <= -100) return false // wrong script / karaoke-instrumental compilations
    if (plan.maxAgeDays && now - releaseTime(t) > plan.maxAgeDays * DAY) return false
    if (source === 'search' && now - releaseTime(t) > FILL_MAX_AGE_DAYS * DAY) return false
    return true
  }
  const add = (t: ItunesTrack, source: Candidate['source'], chartWeight = 0) => {
    const existing = pool.get(t.trackId)
    if (existing) {
      existing.chartScore += chartWeight
      if (t.chartRank) existing.bestRank = Math.min(existing.bestRank, t.chartRank)
      if (source === 'curated') existing.curated = true
      if (source === 'chart' || (source === 'curated' && existing.source === 'search')) existing.source = existing.chartScore > 0 ? 'chart' : source
      return
    }
    pool.set(t.trackId, { track: t, source, chartScore: chartWeight, bestRank: t.chartRank ?? Infinity, released: releaseTime(t), curated: source === 'curated' })
  }

  // 1. Apple's live charts.
  const charts = await Promise.allSettled(plan.charts.map(([cc, genre]) => itunesClient.topSongs(cc, genre)))
  let chartFailures = 0
  for (const result of charts) {
    if (result.status !== 'fulfilled') { chartFailures++; continue }
    const length = result.value.length
    for (const t of result.value) if (accept(t, 'chart')) add(t, 'chart', 1 - ((t.chartRank ?? length) - 1) / Math.max(length, 1))
  }

  // 2. Verified curated releases.
  for (const t of CURATED_TRACKS[vibe] ?? []) if (accept(t, 'curated')) add(t, 'curated')

  // 3. Keyword top-up, only when the chart is short.
  if (pool.size < target) {
    const found = await Promise.allSettled(queryBatch(plan, rotation, year).map(q => itunesClient.search(q, 200, plan.country)))
    for (const result of found) {
      if (result.status !== 'fulfilled') continue
      for (const t of result.value) if (accept(t, 'search')) add(t, 'search')
    }
  }

  // One entry per song (single vs album versions), keeping the best-charting version.
  const bySong = new Map<string, Candidate>()
  for (const c of pool.values()) {
    const key = songKey(c.track)
    const kept = bySong.get(key)
    if (!kept) { bySong.set(key, c); continue }
    const better = c.chartScore > kept.chartScore || (c.chartScore === kept.chartScore && c.source === 'curated' && kept.source !== 'curated')
    const winner = better ? c : kept, loser = better ? kept : c
    winner.chartScore = Math.max(winner.chartScore, loser.chartScore)
    winner.bestRank = Math.min(winner.bestRank, loser.bestRank)
    winner.curated ||= loser.curated
    if (loser.source === 'curated' && winner.chartScore === 0) winner.source = 'curated'
    bySong.set(key, winner)
  }

  // Order: fresh chart hits and curated new releases → established chart hits → top-up.
  const fresh = (c: Candidate) => now - c.released <= plan.freshDays * DAY
  const tier = (c: Candidate) => c.source === 'search' ? 2 : (c.curated || fresh(c)) ? 0 : 1
  const CURATED_WEIGHT = 0.6 // a curated song that is not (yet) charting sits mid-way through the fresh tier
  const weight = (c: Candidate) => c.chartScore > 0 ? c.chartScore : c.source === 'curated' ? CURATED_WEIGHT : 0
  const ranked = [...bySong.values()].sort((a, b) =>
    tier(a) - tier(b) || weight(b) - weight(a) || b.released - a.released)

  // Diversity caps for chart/search songs; verified soundtracks are kept whole.
  const isRegional = !!plan.genres && vibe !== 'top-kpop'
  const artistCap = isRegional ? 8 : 6
  const albumCap = isRegional ? 4 : 3
  const artists = new Map<string, number>(), albums = new Map<string, number>()
  const capped = ranked.filter(c => {
    if (c.curated) return true
    const a = (c.track.artistName || '').toLowerCase().split(/,|&| feat/)[0].trim()
    const al = (c.track.collectionName || '').toLowerCase()
    if ((artists.get(a) ?? 0) >= artistCap || (albums.get(al) ?? 0) >= albumCap) return false
    artists.set(a, (artists.get(a) ?? 0) + 1)
    albums.set(al, (albums.get(al) ?? 0) + 1)
    return true
  })

  let ordered = spread(capped.slice(0, target), c => (c.track.collectionName || '').toLowerCase(), c => (c.track.artistName || '').toLowerCase().split(/,|&/)[0].trim())
  // Refresh: bring a different stretch of the chart to the centre of the wall.
  if (rotation > 0 && ordered.length > 1) {
    const window = Math.min(ordered.length, 96)
    const offset = (rotation * 29) % window
    ordered = [...ordered.slice(offset, window), ...ordered.slice(0, offset), ...ordered.slice(window)]
  }

  if (!ordered.length) throw new MusicProviderError('No tracks available from the music provider')
  const maxChartScore = Math.max(0, ...ordered.map(c => c.chartScore))
  const songs = ordered.map(c => itunesToSongNode(c, plan.genre, popularityFor(c, maxChartScore, now)))

  if (MUSIC_DEBUG) {
    const counts = { chart: 0, curated: 0, search: 0 }
    for (const s of songs) counts[s.source ?? 'search']++
    console.log(`[musicProvider] ${vibe} r${rotation}: ${songs.length} songs`, counts, `chart feeds failed: ${chartFailures}`)
  }
  return { songs, complete: chartFailures === 0 }
}

/** Chart songs for a vibe (see fetchChart). */
export async function fetchSongsByVibe(vibe: Vibe, targetCount = 256, rotation = 0): Promise<SongNode[]> {
  return (await fetchChart(vibe, targetCount, rotation)).songs
}

export async function searchSongsByMood(query: string): Promise<SongNode[]> {
  const tracks = await itunesClient.search(query, 50)
  const seen = new Set<string>()
  const results: SongNode[] = []
  for (const t of tracks) {
    if (!t.trackId || !t.artworkUrl100 || JUNK.test(`${t.trackName} ${t.artistName}`)) continue
    const key = songKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(itunesToSongNode({ track: t, source: 'search', chartScore: 0, bestRank: Infinity, released: releaseTime(t), curated: false }, 'pop', 50))
  }
  return results
}
