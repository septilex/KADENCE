import { SongNode, Vibe } from './types'
import { devSpecialData }             from './devSpecialData'
import { isPlaylistVibe, getPlaylistSongs } from './chartSource'

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
function getReleaseYear(track: any): number {
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
function scoreTeluguTrack(track: any): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  // ── Hard disqualifiers ── score made deeply negative so they never pass
  if (containsScript(combined, TAMIL_SCRIPT_RE) || containsScript(combined, DEVANAGARI_RE)) {
    console.log(`[TELUGU ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    console.log(`[TELUGU ✗ instrumental] "${name}"`);
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
    console.log(`[TELUGU ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
  }
  return score;
}

/** Score a track for Tamil authenticity. */
function scoreTamilTrack(track: any): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  if (containsScript(combined, TELUGU_SCRIPT_RE) || containsScript(combined, DEVANAGARI_RE)) {
    console.log(`[TAMIL ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    console.log(`[TAMIL ✗ instrumental] "${name}"`);
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
    console.log(`[TAMIL ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
  }
  return score;
}

/** Score a track for Hindi/Bollywood authenticity. */
function scoreHindiTrack(track: any): number {
  const name   = track.trackName   || '';
  const artist = track.artistName  || '';
  const album  = track.collectionName || '';
  const genre  = track.primaryGenreName || '';
  const combined = `${name} ${artist} ${album} ${genre}`;

  if (containsScript(combined, TELUGU_SCRIPT_RE) || containsScript(combined, TAMIL_SCRIPT_RE)) {
    console.log(`[HINDI ✗ wrong-script] "${name}" — ${artist}`);
    return -200;
  }
  const haystack = combined.toLowerCase();
  if (HARD_REJECT_KEYWORDS.some(kw => haystack.includes(kw))) {
    console.log(`[HINDI ✗ instrumental] "${name}"`);
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
    console.log(`[HINDI ✗ score=${score}] "${name}" — ${artist} — ${genre}`);
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
  // ── Regional charts: queries use verified artist / movie names only ──────────
  // All results are post-filtered by isTeluguTrack / isTamilTrack / isHindiTrack.
  'top-telugu': [
    // Blockbuster soundtracks
    { term: 'Pushpa Allu Arjun songs', genre: 'telugu' },
    { term: 'RRR Jr NTR Ram Charan songs', genre: 'telugu' },
    { term: 'Bahubali Telugu songs', genre: 'telugu' },
    { term: 'Uppena Telugu movie', genre: 'telugu' },
    { term: 'Samajavaragamana Sid Sriram', genre: 'telugu' },
    // Verified composers (Telugu-exclusive output)
    { term: 'Devi Sri Prasad Telugu', genre: 'telugu' },
    { term: 'SS Thaman Tollywood', genre: 'telugu' },
    { term: 'MM Keeravani Telugu', genre: 'telugu' },
    { term: 'Anup Rubens Telugu', genre: 'telugu' },
    { term: 'Thaman Tollywood hits', genre: 'telugu' },
    { term: 'Sid Sriram Tollywood', genre: 'telugu' },
    { term: 'Rahul Sipligunj Telugu', genre: 'telugu' },
  ],
  'top-tamil': [
    // Blockbuster soundtracks
    { term: 'Anirudh Ravichander Vikram', genre: 'tamil' },
    { term: 'Anirudh Ravichander Jawan', genre: 'tamil' },
    { term: 'AR Rahman Tamil Ponniyin Selvan', genre: 'tamil' },
    { term: 'Yuvan Shankar Raja Tamil', genre: 'tamil' },
    { term: 'GV Prakash Kumar Tamil', genre: 'tamil' },
    { term: 'Harris Jayaraj Tamil', genre: 'tamil' },
    { term: 'D Imman Tamil', genre: 'tamil' },
    { term: 'Santhosh Narayanan Tamil', genre: 'tamil' },
    { term: 'Sid Sriram Tamil songs', genre: 'tamil' },
    { term: 'Vijay Antony songs', genre: 'tamil' },
    { term: 'Hip Hop Tamizha', genre: 'tamil' },
    { term: 'Dhee Arivu Tamil', genre: 'tamil' },
  ],
  'top-hindi': [
    // Top Bollywood composers / directors
    { term: 'Arijit Singh Bollywood', genre: 'hindi' },
    { term: 'Pritam Bollywood soundtrack', genre: 'hindi' },
    { term: 'Vishal Shekhar Hindi', genre: 'hindi' },
    { term: 'Vishal Mishra songs', genre: 'hindi' },
    { term: 'Shankar Ehsaan Loy Bollywood', genre: 'hindi' },
    { term: 'Amit Trivedi Bollywood', genre: 'hindi' },
    { term: 'Sachin Jigar Bollywood', genre: 'hindi' },
    { term: 'Jubin Nautiyal songs', genre: 'hindi' },
    { term: 'Neha Kakkar Bollywood', genre: 'hindi' },
    { term: 'Shreya Ghoshal Hindi', genre: 'hindi' },
    { term: 'Atif Aslam Hindi', genre: 'hindi' },
    { term: 'B Praak Jaani Hindi', genre: 'hindi' },
  ],
  'top-kpop': [
    { term: 'BTS songs', genre: 'pop' },
    { term: 'BLACKPINK hits', genre: 'pop' },
    { term: 'Stray Kids', genre: 'pop' },
    { term: 'aespa kpop', genre: 'pop' },
    { term: 'NewJeans kpop', genre: 'pop' },
    { term: 'IVE kpop', genre: 'pop' },
    { term: 'Tomorrow X Together', genre: 'pop' },
    { term: 'TWICE kpop', genre: 'pop' },
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

/**
 * Like fetchItunesTracks but uses the India storefront (country=IN).
 * This surfaces more Indian regional music that may not be in the global catalogue.
 */
async function fetchItunesTracksIN(term: string, limit: number = 200): Promise<any[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&country=IN`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[musicProvider] iTunes IN fetch failed for term "${term}": ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error(`[musicProvider] Error fetching iTunes IN for term "${term}":`, error);
    return [];
  }
}

const REGIONAL_VIBES = new Set<Vibe>(['top-telugu', 'top-tamil', 'top-hindi']);

/** Maps each regional vibe to its confidence scorer. Returns score ≥ ACCEPT_THRESHOLD to include. */
const REGIONAL_SCORER: Partial<Record<Vibe, (t: any) => number>> = {
  'top-telugu': scoreTeluguTrack,
  'top-tamil':  scoreTamilTrack,
  'top-hindi':  scoreHindiTrack,
};

/** Fallback expansion queries fired when primary results yield < EXPANSION_THRESHOLD verified tracks. */
const REGIONAL_FALLBACK_QUERIES: Partial<Record<Vibe, { term: string; genre: string }[]>> = {
  'top-telugu': [
    { term: 'Tollywood soundtrack 2023', genre: 'telugu' },
    { term: 'Telugu film songs 2022',    genre: 'telugu' },
    { term: 'Mahesh Babu Telugu',        genre: 'telugu' },
    { term: 'Vijay Deverakonda songs',   genre: 'telugu' },
    { term: 'Anirudh Telugu movie',      genre: 'telugu' },
    { term: 'Mickey J Meyer Telugu',     genre: 'telugu' },
    { term: 'Bheems Ceciroleo',          genre: 'telugu' },
  ],
  'top-tamil': [
    { term: 'Kollywood soundtrack 2023',  genre: 'tamil' },
    { term: 'Tamil film songs 2022',      genre: 'tamil' },
    { term: 'Dhanush Tamil songs',        genre: 'tamil' },
    { term: 'Sivakarthikeyan Tamil',      genre: 'tamil' },
    { term: 'Rajinikanth Tamil movie',    genre: 'tamil' },
    { term: 'Sean Roldan Tamil',          genre: 'tamil' },
    { term: 'Ilaiyaraaja Tamil classics', genre: 'tamil' },
  ],
  'top-hindi': [
    { term: 'Bollywood songs 2023',        genre: 'hindi' },
    { term: 'Hindi film songs 2022',       genre: 'hindi' },
    { term: 'Darshan Raval hits',          genre: 'hindi' },
    { term: 'Pawandeep Rajan songs',       genre: 'hindi' },
    { term: 'Tanishk Bagchi Bollywood',    genre: 'hindi' },
    { term: 'Sachet Tandon Parampara',     genre: 'hindi' },
    { term: 'Kumar Sanu Bollywood',        genre: 'hindi' },
  ],
};

const EXPANSION_THRESHOLD = 80; // fire fallbacks if primary yields fewer than this many verified tracks

export async function fetchSongsByVibe(
  vibe: Vibe,
  targetCount: number = 1000,
  refreshOffset: number = 0
): Promise<SongNode[]> {
  // ── Static playlist intercepts (playlist-as-source-of-truth) ─────────────
  if (vibe === 'dev-special') return devSpecialData;

  if (isPlaylistVibe(vibe)) {
    const songs = getPlaylistSongs(vibe);
    if (songs && songs.length > 0) {
      console.log(`[musicProvider] ${vibe}: returning ${songs.length} static playlist tracks`);
      return songs;
    }
    // Data file empty — fall through to iTunes search as temporary fallback
    console.warn(`[musicProvider] ${vibe}: static data empty, falling back to iTunes search`);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const isRegional = REGIONAL_VIBES.has(vibe);
  const scorer     = REGIONAL_SCORER[vibe];
  const queries    = VIBE_QUERIES[vibe] || VIBE_QUERIES['global-top-50'];

  const rotated = [
    ...queries.slice(refreshOffset % queries.length),
    ...queries.slice(0, refreshOffset % queries.length),
  ];

  // Regional vibes use the India storefront; global vibes use the default.
  const fetcher = isRegional ? fetchItunesTracksIN : fetchItunesTracks;

  /**
   * Run a batch of query terms through iTunes, score every track, return
   * a flat array of { rawTrack, score, year } sorted best-first.
   */
  async function fetchAndScore(
    batch: { term: string; genre: string }[]
  ): Promise<{ track: any; score: number; year: number; genre: string }[]> {
    const promises = batch.map(q =>
      fetcher(q.term, 200).then(tracks => ({ tracks, genre: q.genre }))
    );
    const settled = await Promise.allSettled(promises);
    const scored: { track: any; score: number; year: number; genre: string }[] = [];

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { tracks, genre } = result.value;
      for (const t of tracks) {
        if (!t.trackId || !t.artworkUrl100) continue;
        const score = scorer ? scorer(t) : 100; // non-regional tracks always pass
        if (score >= ACCEPT_THRESHOLD) {
          scored.push({ track: t, score, year: getReleaseYear(t), genre });
        }
      }
    }

    // Sort: highest confidence score first, then newest first within same score band
    scored.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.year - a.year
    );
    return scored;
  }

  // ── Phase 1: primary queries ──────────────────────────────────────────────
  let candidates = await fetchAndScore(rotated);

  // ── Phase 2: expansion (regional only, if Phase 1 yields < threshold) ────
  if (isRegional && candidates.length < EXPANSION_THRESHOLD) {
    const fallbacks = REGIONAL_FALLBACK_QUERIES[vibe] ?? [];
    if (fallbacks.length > 0) {
      console.log(
        `[${vibe.toUpperCase()}] Only ${candidates.length} verified tracks after primary queries — firing ${fallbacks.length} fallback queries`
      );
      const extra = await fetchAndScore(fallbacks);
      candidates = [...candidates, ...extra];
      // Re-sort merged list
      candidates.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : b.year - a.year
      );
    }
  }

  // ── Deduplication & final assembly ───────────────────────────────────────
  const seenTrackIds = new Set<string>();
  const seenArtists  = new Map<string, number>();
  const seenAlbums   = new Map<string, number>();
  const songs: SongNode[] = [];

  const artistCap = isRegional ? 6 : 8;
  const albumCap  = isRegional ? 3 : 4;

  let totalRaw      = candidates.length;
  let totalAccepted = 0;
  let totalRejected = 0;

  // Capture top rejected for the audit log
  const rejectedSamples: string[] = [];

  for (const { track: t, genre } of candidates) {
    const trackIdStr = t.trackId.toString();
    if (seenTrackIds.has(trackIdStr)) continue;

    const artistKey = (t.artistName || '').toLowerCase();
    const albumKey  = (t.collectionName || '').toLowerCase();

    if ((seenArtists.get(artistKey) ?? 0) >= artistCap) {
      if (rejectedSamples.length < 5) rejectedSamples.push(`[dup-artist] "${t.trackName}" — ${t.artistName}`);
      totalRejected++;
      continue;
    }
    if ((seenAlbums.get(albumKey) ?? 0) >= albumCap) {
      if (rejectedSamples.length < 5) rejectedSamples.push(`[dup-album] "${t.trackName}" — ${t.artistName}`);
      totalRejected++;
      continue;
    }

    seenTrackIds.add(trackIdStr);
    seenArtists.set(artistKey, (seenArtists.get(artistKey) ?? 0) + 1);
    seenAlbums.set(albumKey,   (seenAlbums.get(albumKey)  ?? 0) + 1);

    songs.push(itunesToSongNode(t, [genre]));
    totalAccepted++;
  }

  // ── Purity / audit report (regional only) ────────────────────────────────
  if (isRegional) {
    const purity = totalRaw > 0
      ? ((totalAccepted / (totalAccepted + totalRejected)) * 100).toFixed(1)
      : 'N/A';
    const label = vibe.replace('top-', 'TOP ').toUpperCase();
    console.log(`
╔══════════════════════════════════════════════════╗
║  [${label}] PURITY REPORT
║  Accepted : ${totalAccepted}
║  Rejected : ${totalRejected}
║  Purity   : ${purity}%
╚══════════════════════════════════════════════════╝`);
    if (rejectedSamples.length > 0) {
      console.log(`  ↳ Sample dedup-rejected: ${rejectedSamples.join(' | ')}`);
    }
  }

  // Regional: no padding — quality > quantity
  if (isRegional) return songs;

  // Global: pad to targetCount with randomised duplicates
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
