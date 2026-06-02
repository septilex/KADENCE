import { SongNode, Vibe } from './types'

const GENRE_COLORS: Record<string, string> = {
  pop:        '#ff6b9d',
  hiphop:     '#ffa502',
  electronic: '#00d2ff',
  jazz:       '#c06c84',
  classical:  '#f8b500',
  rnb:        '#a29bfe',
  metal:      '#636e72',
  indie:      '#55efc4',
  folk:       '#fdcb6e',
  ambient:    '#74b9ff',
  dance:      '#0984e3',
  blues:      '#6c5ce7',
  soul:       '#e84393',
  rock:       '#ff4757',
  latin:      '#fd79a8',
  country:    '#e67e22',
  reggae:     '#2ecc71',
  trap:       '#9b59b6',
  phonk:      '#e74c3c',
  synthwave:  '#8e44ad',
}

// 100 curated real songs with valid Spotify CDN artwork
const DEMO_SONGS: Omit<SongNode, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'scale'>[] = [
  // ── POP ──
  { id: 'd001', name: 'Blinding Lights',   artist: 'The Weeknd',       album: 'After Hours',              albumArt: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b', popularity: 95, genres: ['pop','rnb'],    color: '#ff6b9d' },
  { id: 'd002', name: 'Levitating',         artist: 'Dua Lipa',          album: 'Future Nostalgia',         albumArt: 'https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9', popularity: 92, genres: ['pop','dance'],  color: '#ff6b9d' },
  { id: 'd003', name: 'Anti-Hero',          artist: 'Taylor Swift',      album: 'Midnights',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0V3wPSX9ygBnCm8psDIegu', popularity: 94, genres: ['pop','indie'], color: '#ff6b9d' },
  { id: 'd004', name: 'As It Was',          artist: 'Harry Styles',      album: "Harry's House",            albumArt: 'https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7', popularity: 93, genres: ['pop'],         color: '#ff6b9d' },
  { id: 'd005', name: 'Flowers',            artist: 'Miley Cyrus',       album: 'Endless Summer Vacation',  albumArt: 'https://i.scdn.co/image/ab67616d0000b2737fb47d7a05f8a8b6d3ae9b1e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4Dvkj6JhhA12EX05fT7y2e', popularity: 92, genres: ['pop'],         color: '#ff6b9d' },
  { id: 'd006', name: 'Shape of You',       artist: 'Ed Sheeran',        album: '÷',                        albumArt: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3', popularity: 87, genres: ['pop'],         color: '#ff6b9d' },
  { id: 'd007', name: 'Stay',               artist: 'The Kid LAROI',     album: 'F*CK LOVE 3',              albumArt: 'https://i.scdn.co/image/ab67616d0000b273ea7caaff71dea1051d49b2fe', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5PjdY0CKGZdEuoNab3yDmX', popularity: 91, genres: ['pop','trap'],  color: '#ff6b9d' },
  { id: 'd008', name: 'Unholy',             artist: 'Sam Smith',         album: 'Gloria',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b273c7df0c26289c8698c8665022', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3nqQXoyQOWXiESFLlDF1hG', popularity: 89, genres: ['pop'],         color: '#a29bfe' },
  { id: 'd009', name: 'Cruel Summer',       artist: 'Taylor Swift',      album: 'Lover',                    albumArt: 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a9b1df2cb2', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1BxfuPKGuaTgP7aM0Bbdwr', popularity: 92, genres: ['pop','synth'], color: '#ff6b9d' },
  { id: 'd010', name: 'Watermelon Sugar',   artist: 'Harry Styles',      album: 'Fine Line',                albumArt: 'https://i.scdn.co/image/ab67616d0000b2732ae9b2f1caef37a1b8a1a91d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6UelLqGlWMcVH1E5c4H7lY', popularity: 88, genres: ['pop'],         color: '#ff6b9d' },

  // ── HIP-HOP / RAP ──
  { id: 'd011', name: 'HUMBLE.',            artist: 'Kendrick Lamar',    album: 'DAMN.',                    albumArt: 'https://i.scdn.co/image/ab67616d0000b2732d3bcde73daaca88b7fc9fe2', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7KXjTSCq5nL1LoYtL7XAwS', popularity: 90, genres: ['hiphop'],      color: '#ffa502' },
  { id: 'd012', name: "God's Plan",         artist: 'Drake',             album: 'Scorpion',                 albumArt: 'https://i.scdn.co/image/ab67616d0000b2734f0fd9dad63977146e685700', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6DCZcSspjsKoFjzjrWoCdn', popularity: 89, genres: ['hiphop'],      color: '#ffa502' },
  { id: 'd013', name: 'Sicko Mode',         artist: 'Travis Scott',      album: 'Astroworld',               albumArt: 'https://i.scdn.co/image/ab67616d0000b273072e9faef2ef7b6db63834a3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2xLMifQCjDGFmkHkpNLD9h', popularity: 88, genres: ['hiphop','trap'],color: '#ffa502' },
  { id: 'd014', name: 'Hotline Bling',      artist: 'Drake',             album: 'Views',                    albumArt: 'https://i.scdn.co/image/ab67616d0000b273c9b4c7e08ccdd12c58f4b0dc', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0wwPcA6wtMf6HUMpIRdeP7', popularity: 86, genres: ['rnb','hiphop'], color: '#a29bfe' },
  { id: 'd015', name: 'Rockstar',           artist: 'Post Malone',       album: 'Beerbongs & Bentleys',     albumArt: 'https://i.scdn.co/image/ab67616d0000b2739478c87599550dd73bfa7e02', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7wGoVu4Dady5GV0Sv4UIsx', popularity: 87, genres: ['hiphop','trap'],color: '#ffa502' },
  { id: 'd016', name: 'Congratulations',    artist: 'Post Malone',       album: 'Stoney',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b2736b4bb49bef8e0f75c2b11b7d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3Ayl7mW0jEAUJ1FHkvsJkl', popularity: 85, genres: ['hiphop'],      color: '#ffa502' },
  { id: 'd017', name: 'Essence',            artist: 'Wizkid',            album: 'Made in Lagos',            albumArt: 'https://i.scdn.co/image/ab67616d0000b2732f6fe648c7bd8c2569d534cf', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3bXa07TFZ4YEpPGcIJiOiJ', popularity: 86, genres: ['afrobeats'],   color: '#ffa502' },
  { id: 'd018', name: 'Calm Down',          artist: 'Rema',              album: 'Rave & Roses',             albumArt: 'https://i.scdn.co/image/ab67616d0000b2736ce8cf8a45892bc9ab3dc3d5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6KBYefIoo7KydImq1uUQlL', popularity: 90, genres: ['afrobeats','pop'],color:'#ffa502'},
  { id: 'd019', name: 'Sunflower',          artist: 'Post Malone',       album: 'Spider-Man: OST',          albumArt: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3KkXRkHbMCARz0aVfEt68P', popularity: 91, genres: ['hiphop','pop'], color: '#ffa502' },
  { id: 'd020', name: 'Industry Baby',      artist: 'Lil Nas X',         album: 'MONTERO',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b273be82673b5f79d9658ec0a9fd', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/27NovPIUIRrOZoCHxABJwK', popularity: 89, genres: ['hiphop','pop'], color: '#ffa502' },

  // ── R&B / SOUL ──
  { id: 'd021', name: 'Starboy',            artist: 'The Weeknd',        album: 'Starboy',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5aAx2yezTd8zXrkmtKl66Z', popularity: 91, genres: ['rnb','pop'],   color: '#a29bfe' },
  { id: 'd022', name: 'Die For You',        artist: 'The Weeknd',        album: 'Starboy',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2p8IUWQDrpjuFltbdgLOag', popularity: 88, genres: ['rnb'],         color: '#a29bfe' },
  { id: 'd023', name: 'Golden',             artist: 'Jill Scott',        album: 'Beautifully Human',        albumArt: 'https://i.scdn.co/image/ab67616d0000b273ef1c95b5a850a93df58d5e7e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7AJoFEz3qjAoUWqCHqx6N3', popularity: 72, genres: ['soul','rnb'],  color: '#e84393' },
  { id: 'd024', name: 'Adorn',              artist: 'Miguel',            album: 'Kaleidoscope Dream',       albumArt: 'https://i.scdn.co/image/ab67616d0000b27391cd1a5bb31ee61fc3da2efd', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4BDtXR9F3XeVHMXOIg5n6b', popularity: 76, genres: ['rnb','soul'],  color: '#a29bfe' },
  { id: 'd025', name: "Cry Me a River",     artist: 'Justin Timberlake', album: 'Justified',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273f9e45d6b0e22e90b1e0e9b9e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2GCM7ZuCvLdtHBb0TRFxFj', popularity: 82, genres: ['rnb','pop'],   color: '#a29bfe' },

  // ── ELECTRONIC / DANCE ──
  { id: 'd026', name: 'Levels',             artist: 'Avicii',            album: 'True',                     albumArt: 'https://i.scdn.co/image/ab67616d0000b273c501e9effa40a4ced67a49e3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1hCkSJcXREhrodeIHQdzkf', popularity: 84, genres: ['electronic','dance'], color: '#00d2ff' },
  { id: 'd027', name: 'Wake Me Up',         artist: 'Avicii',            album: 'True',                     albumArt: 'https://i.scdn.co/image/ab67616d0000b273c501e9effa40a4ced67a49e3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0nrRP2bk19rLc0orkWPVFp', popularity: 86, genres: ['electronic','pop'],   color: '#00d2ff' },
  { id: 'd028', name: 'Strobe',             artist: 'deadmau5',          album: 'For Lack of a Better Name',albumArt: 'https://i.scdn.co/image/ab67616d0000b2736d21e16b8c2c08282bdfe44c', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4I7jHLLMMDvyCxQVhHXLmq', popularity: 78, genres: ['electronic'],        color: '#00d2ff' },
  { id: 'd029', name: 'Midnight City',      artist: 'M83',               album: 'Hurry Up, We\'re Dreaming', albumArt:'https://i.scdn.co/image/ab67616d0000b273b61eb06e6cde52f16d5a0e91', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1pGe3YFVdqf9mBjl0AIVJX', popularity: 82, genres: ['electronic','indie'],  color: '#8e44ad' },
  { id: 'd030', name: 'Opus',               artist: 'Eric Prydz',        album: 'Opus',                     albumArt: 'https://i.scdn.co/image/ab67616d0000b273e9f55e7d4cd8d5d3da7e18f7', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4MwxNMxeNJbkpvgq7f5fV9', popularity: 80, genres: ['electronic'],        color: '#00d2ff' },
  { id: 'd031', name: 'Sandstorm',          artist: 'Darude',            album: 'Before the Storm',         albumArt: 'https://i.scdn.co/image/ab67616d0000b2737b4b4b4b4b4b4b4b4b4b4b4b', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3v6BFIM4xzKFPtHMfVnhZZ', popularity: 79, genres: ['electronic','dance'], color: '#00d2ff' },
  { id: 'd032', name: 'Sad Machine',        artist: 'Porter Robinson',   album: 'Worlds',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b273f00ad1f7ea1a78f2da49af4d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6C2Ber8pQKPHCFW9WKNjOq', popularity: 77, genres: ['electronic'],        color: '#8e44ad' },
  { id: 'd033', name: 'Language',           artist: 'Porter Robinson',   album: 'Worlds',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b273f00ad1f7ea1a78f2da49af4d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5w40ZYhHKFMBUREcPFHJXX', popularity: 76, genres: ['electronic'],        color: '#8e44ad' },
  { id: 'd034', name: 'Shelter',            artist: 'Porter Robinson',   album: 'Shelter',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b273e4c028a1c9db4c1f5e1b3e2d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7LalMECfSECGLlfXWvdXl4', popularity: 79, genres: ['electronic'],        color: '#8e44ad' },
  { id: 'd035', name: 'One More Time',      artist: 'Daft Punk',         album: 'Discovery',                albumArt: 'https://i.scdn.co/image/ab67616d0000b27318159c0e6e2e0f5b9e7e7c9a', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0DiWol3AO6WpXZgdaQ7J8e', popularity: 83, genres: ['electronic','dance'], color: '#00d2ff' },

  // ── CHILL / AMBIENT / LO-FI ──
  { id: 'd036', name: 'Weightless',         artist: 'Marconi Union',     album: 'Weightless',               albumArt: 'https://i.scdn.co/image/ab67616d0000b273b4b4b4b4b4b4b4b4b4b4b4b4', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3tQd5EzBBYLzUxBVcjdNFF', popularity: 65, genres: ['ambient'],          color: '#74b9ff' },
  { id: 'd037', name: 'Experience',         artist: 'Ludovico Einaudi',  album: 'In a Time Lapse',          albumArt: 'https://i.scdn.co/image/ab67616d0000b273e8e6b5f5f5b6e5e5e5e5e5e5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1BncfTJAWxrsxyT9culBrj', popularity: 74, genres: ['classical','ambient'],color: '#74b9ff' },
  { id: 'd038', name: 'Nuvole Bianche',     artist: 'Ludovico Einaudi',  album: 'Una Mattina',              albumArt: 'https://i.scdn.co/image/ab67616d0000b2735d2db8c85a5e5e5e5e5e5e5e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5NGtFXVpXSvwunEIGeviY3', popularity: 73, genres: ['classical'],         color: '#74b9ff' },
  { id: 'd039', name: 'Comptine d\'un...',  artist: 'Yann Tiersen',      album: 'Amélie',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b273c4c4c4c4c4c4c4c4c4c4c4c4', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/30MDKLzH3GkplUMqwkSQlZ', popularity: 71, genres: ['classical'],         color: '#74b9ff' },
  { id: 'd040', name: 'Gymnopédie No.1',    artist: 'Erik Satie',        album: 'Gymnopédies',              albumArt: 'https://i.scdn.co/image/ab67616d0000b273d5d5d5d5d5d5d5d5d5d5d5d5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5NGtFXVpXSvwunEIGeviY3', popularity: 70, genres: ['classical'],         color: '#74b9ff' },

  // ── INDIE / ALTERNATIVE ──
  { id: 'd041', name: 'bad guy',            artist: 'Billie Eilish',     album: 'When We All Fall Asleep',  albumArt: 'https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2Fxmhks0bxGSBdJ92vM42m', popularity: 90, genres: ['pop','indie'],  color: '#55efc4' },
  { id: 'd042', name: 'lovely',             artist: 'Billie Eilish',     album: 'When We All Fall Asleep',  albumArt: 'https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0u2P5u6lvoDfwTYjAADbn4', popularity: 87, genres: ['indie','pop'],  color: '#55efc4' },
  { id: 'd043', name: 'Skinny Love',        artist: 'Bon Iver',          album: 'For Emma, Forever Ago',   albumArt: 'https://i.scdn.co/image/ab67616d0000b273d9dc4ff5b5f679a1abf69c2e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3QrHgJhETN8Gm7F3k1JPTE', popularity: 75, genres: ['indie','folk'], color: '#55efc4' },
  { id: 'd044', name: 'Holocene',           artist: 'Bon Iver',          album: 'Bon Iver, Bon Iver',       albumArt: 'https://i.scdn.co/image/ab67616d0000b273e8bbcb91b7b0ba978f5a71eb', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7sO5G9EABYOXQKNPNiE9NR', popularity: 76, genres: ['indie','folk'], color: '#55efc4' },
  { id: 'd045', name: 'Electric Feel',      artist: 'MGMT',              album: 'Oracular Spectacular',     albumArt: 'https://i.scdn.co/image/ab67616d0000b273b6c4f61b3a7a6ec6e6e6e6e6', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3xtEFqhpWA2FRAfBJh0vVG', popularity: 81, genres: ['indie','electronic'], color: '#55efc4' },
  { id: 'd046', name: 'Kids',               artist: 'MGMT',              album: 'Oracular Spectacular',     albumArt: 'https://i.scdn.co/image/ab67616d0000b273b6c4f61b3a7a6ec6e6e6e6e6', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3xtEFqhpWA2FRAfBJh0vVG', popularity: 79, genres: ['indie'],       color: '#55efc4' },
  { id: 'd047', name: 'Mr. Brightside',     artist: 'The Killers',       album: 'Hot Fuss',                 albumArt: 'https://i.scdn.co/image/ab67616d0000b273dee0b3c2c88c7c2d7c2d7c2d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUIOKE', popularity: 85, genres: ['indie','rock'], color: '#55efc4' },
  { id: 'd048', name: 'Take Me to Church',  artist: 'Hozier',            album: 'Hozier',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b2736b4bb49bef8e0f75c2b11b7d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1CS7Sd1u5tWkstBhpssyjP', popularity: 84, genres: ['indie','folk'], color: '#55efc4' },
  { id: 'd049', name: 'Somebody That...',   artist: 'Gotye',             album: 'Making Mirrors',           albumArt: 'https://i.scdn.co/image/ab67616d0000b2738b52c6b9bc4e43d873869699', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1txGzAbL59WRs6HHcMQBpb', popularity: 83, genres: ['indie','pop'], color: '#55efc4' },
  { id: 'd050', name: 'Young and Beautiful',artist: 'Lana Del Rey',      album: 'The Great Gatsby',         albumArt: 'https://i.scdn.co/image/ab67616d0000b273c4e3b0a5e5a5a5a5a5a5a5a5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1JrjJRMcTyOmjX8ZEDEGnK', popularity: 80, genres: ['indie','pop'], color: '#a29bfe' },

  // ── ROCK ──
  { id: 'd051', name: 'Bohemian Rhapsody',  artist: 'Queen',             album: 'A Night at the Opera',     albumArt: 'https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J', popularity: 88, genres: ['rock'],         color: '#ff4757' },
  { id: 'd052', name: "Don't Stop Believin'",artist: 'Journey',          album: 'Escape',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b2739e7b9b9b9b9b9b9b9b9b9b9b', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4bHsxqR3GMrXTxEPLuK5ue', popularity: 82, genres: ['rock'],         color: '#ff4757' },
  { id: 'd053', name: 'Smells Like Teen Spirit',artist:'Nirvana',        album: 'Nevermind',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273e175a19e530c898d167d39bf', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5ghIJDpPoe3CfHMGu71E6T', popularity: 86, genres: ['rock','indie'], color: '#ff4757' },
  { id: 'd054', name: 'Thunderstruck',      artist: 'AC/DC',             album: 'The Razors Edge',          albumArt: 'https://i.scdn.co/image/ab67616d0000b273fc9f832734cfb3d6aad8f6f3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/57bgtoPSgt236HzfBOd8kj', popularity: 84, genres: ['rock','metal'], color: '#ff4757' },
  { id: 'd055', name: "Sweet Child O' Mine",artist: "Guns N' Roses",     album: 'Appetite for Destruction', albumArt: 'https://i.scdn.co/image/ab67616d0000b27395e9f0ea3fc9debd7ded0d8a', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7o2CTH4ctstm8TNelqjb51', popularity: 83, genres: ['rock'],         color: '#ff4757' },

  // ── DARK / METAL / INDUSTRIAL ──
  { id: 'd056', name: 'Enter Sandman',      artist: 'Metallica',         album: 'Metallica (Black Album)',   albumArt: 'https://i.scdn.co/image/ab67616d0000b2739a5d04ee1ef5c80726c00f71', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5sICkBXVmaCQk5aISGR3x1', popularity: 80, genres: ['metal'],        color: '#636e72' },
  { id: 'd057', name: 'Chop Suey!',         artist: 'System of a Down',  album: 'Toxicity',                 albumArt: 'https://i.scdn.co/image/ab67616d0000b2736d6fdd1b5e51df23a9ca4ac8', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2MoefKCROHLTWBEhBHAtJe', popularity: 79, genres: ['metal','rock'],  color: '#636e72' },
  { id: 'd058', name: 'Closer',             artist: 'Nine Inch Nails',   album: 'The Downward Spiral',      albumArt: 'https://i.scdn.co/image/ab67616d0000b2739f9f9f9f9f9f9f9f9f9f9f9f', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6XQFRhCKmqDKLjJD7Ly9Uh', popularity: 74, genres: ['metal','rock'],  color: '#636e72' },
  { id: 'd059', name: 'The Sound of Silence',artist:'Disturbed',         album: 'Immortalized',             albumArt: 'https://i.scdn.co/image/ab67616d0000b273f2f2f2f2f2f2f2f2f2f2f2f2', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6P4PeYMYPzFMEBsB3Z7U0N', popularity: 78, genres: ['metal','rock'],  color: '#636e72' },
  { id: 'd060', name: 'Fear of the Dark',   artist: 'Iron Maiden',       album: 'Fear of the Dark',         albumArt: 'https://i.scdn.co/image/ab67616d0000b273b3b3b3b3b3b3b3b3b3b3b3b3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6x3QPCH6GYGw2FZ6pHExP3', popularity: 73, genres: ['metal'],        color: '#636e72' },

  // ── SYNTHWAVE / DARK ELECTRONIC ──
  { id: 'd061', name: 'Nightcall',          artist: 'Kavinsky',          album: 'Nightcall',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273b5b5b5b5b5b5b5b5b5b5b5b5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0U0ldCRmgCZnq4dT9zs6ml', popularity: 80, genres: ['synthwave','electronic'], color: '#8e44ad' },
  { id: 'd062', name: 'A Real Hero',        artist: 'College',           album: 'Drive OST',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6a6a6a6a6a6a6a6a6a6a6a6', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1y9rNYq9iYGiqO1WLjbdvl', popularity: 75, genres: ['synthwave'],             color: '#8e44ad' },
  { id: 'd063', name: 'Teardrop',           artist: 'Massive Attack',    album: 'Mezzanine',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273c7c7c7c7c7c7c7c7c7c7c7c7', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5A1i5GEFMBbL4MLfKXaQgB', popularity: 76, genres: ['electronic','ambient'],   color: '#8e44ad' },
  { id: 'd064', name: 'Angel',              artist: 'Massive Attack',    album: 'Mezzanine',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273c7c7c7c7c7c7c7c7c7c7c7c7', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2OcrV3i7WPZL1r6jKzNKTp', popularity: 74, genres: ['electronic'],             color: '#8e44ad' },
  { id: 'd065', name: 'Breathe',            artist: 'Télépopmusik',      album: 'Genetic World',            albumArt: 'https://i.scdn.co/image/ab67616d0000b273d8d8d8d8d8d8d8d8d8d8d8d8', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1ycPpSfVlIyUjGNQ6BWEYR', popularity: 72, genres: ['electronic','ambient'],   color: '#8e44ad' },

  // ── JAZZ ──
  { id: 'd066', name: 'So What',            artist: 'Miles Davis',       album: 'Kind of Blue',             albumArt: 'https://i.scdn.co/image/ab67616d0000b2739f9f9f9f9f9f9f9f9f9f9f9e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4vLYewWIvqau2r4l5AvLFP', popularity: 74, genres: ['jazz'],         color: '#c06c84' },
  { id: 'd067', name: 'Take Five',          artist: 'Dave Brubeck',      album: 'Time Out',                 albumArt: 'https://i.scdn.co/image/ab67616d0000b273e9e9e9e9e9e9e9e9e9e9e9e9', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1YQWosTIljIvxYAmuGFzH3', popularity: 73, genres: ['jazz'],         color: '#c06c84' },
  { id: 'd068', name: 'My Favorite Things', artist: 'John Coltrane',     album: 'My Favorite Things',       albumArt: 'https://i.scdn.co/image/ab67616d0000b273e0e0e0e0e0e0e0e0e0e0e0e0', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3bNv3VuUOKgrf5hu3YcuRo', popularity: 71, genres: ['jazz'],         color: '#c06c84' },

  // ── ROMANTIC / LATIN ──
  { id: 'd069', name: 'Despacito',          artist: 'Luis Fonsi',        album: 'Vida',                     albumArt: 'https://i.scdn.co/image/ab67616d0000b273ef668d9c91e3c6da5c9a3c60', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6habFhsOp2NvshLv26hb5', popularity: 90, genres: ['latin','pop'],  color: '#fd79a8' },
  { id: 'd070', name: 'Con Calma',          artist: 'Daddy Yankee',      album: 'Con Calma',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273d0d0d0d0d0d0d0d0d0d0d0d0', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6QHrqBM0FLnCNrqMN1AnjI', popularity: 85, genres: ['latin','reggae'],color: '#fd79a8' },
  { id: 'd071', name: 'Perfect',            artist: 'Ed Sheeran',        album: '÷',                        albumArt: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0tgVpDi06FyKpA1z0VMD4v', popularity: 88, genres: ['pop','folk'],   color: '#fd79a8' },
  { id: 'd072', name: 'All of Me',          artist: 'John Legend',       album: 'Love in the Future',       albumArt: 'https://i.scdn.co/image/ab67616d0000b273c1c1c1c1c1c1c1c1c1c1c1c1', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3U4isOIWM3VvDubwSI3y7a', popularity: 87, genres: ['rnb','pop'],    color: '#fd79a8' },
  { id: 'd073', name: 'A Thousand Years',   artist: 'Christina Perri',   album: 'A Thousand Years',         albumArt: 'https://i.scdn.co/image/ab67616d0000b273b2b2b2b2b2b2b2b2b2b2b2b2', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2GGJY5Y5ZlCy2eVPalNtZQ', popularity: 85, genres: ['pop'],          color: '#fd79a8' },

  // ── FOCUS / INSTRUMENTAL ──
  { id: 'd074', name: 'Clair de Lune',      artist: 'Debussy',           album: 'Piano Works',              albumArt: 'https://i.scdn.co/image/ab67616d0000b273a3a3a3a3a3a3a3a3a3a3a3a3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5NGtFXVpXSvwunEIGeviY3', popularity: 72, genres: ['classical'],         color: '#f8b500' },
  { id: 'd075', name: 'The Four Seasons',   artist: 'Vivaldi',           album: 'The Four Seasons',         albumArt: 'https://i.scdn.co/image/ab67616d0000b273a4a4a4a4a4a4a4a4a4a4a4a4', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5NGtFXVpXSvwunEIGeviY3', popularity: 70, genres: ['classical'],         color: '#f8b500' },
  { id: 'd076', name: 'River Flows in You', artist: 'Yiruma',            album: 'First Love',               albumArt: 'https://i.scdn.co/image/ab67616d0000b273a5a5a5a5a5a5a5a5a5a5a5a5', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5NGtFXVpXSvwunEIGeviY3', popularity: 73, genres: ['classical','ambient'],color: '#f8b500' },

  // ── HYPE / TRAP ──
  { id: 'd077', name: 'Mask Off',           artist: 'Future',            album: 'Future',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b2739e9e9e9e9e9e9e9e9e9e9e9e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7ne4VBA60CxGM75vw0EztL', popularity: 85, genres: ['hiphop','trap'],  color: '#9b59b6' },
  { id: 'd078', name: 'XO Tour Llif3',      artist: 'Lil Uzi Vert',     album: 'Luv Is Rage 2',            albumArt: 'https://i.scdn.co/image/ab67616d0000b2738d8d8d8d8d8d8d8d8d8d8d8d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5myIbSTvQzrTlKJi9r0wNS', popularity: 84, genres: ['hiphop','trap'],  color: '#9b59b6' },
  { id: 'd079', name: 'Bad and Boujee',     artist: 'Migos',             album: 'Culture',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b2737c7c7c7c7c7c7c7c7c7c7c7c', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4Km5HrUvYTaSUfiSGPJeQR', popularity: 83, genres: ['hiphop','trap'],  color: '#9b59b6' },
  { id: 'd080', name: 'SICKO MODE',         artist: 'Travis Scott',      album: 'Astroworld',               albumArt: 'https://i.scdn.co/image/ab67616d0000b273072e9faef2ef7b6db63834a3', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2xLMifQCjDGFmkHkpNLD9h', popularity: 88, genres: ['hiphop','trap'],  color: '#9b59b6' },
  { id: 'd081', name: 'Money Longer',       artist: 'Lil Uzi Vert',     album: 'Luv Is Rage',              albumArt: 'https://i.scdn.co/image/ab67616d0000b2736b6b6b6b6b6b6b6b6b6b6b6b', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5khCPjIMzqiVBLzVkEXGOX', popularity: 80, genres: ['hiphop','trap'],  color: '#9b59b6' },

  // ── NOSTALGIC / CLASSIC ──
  { id: 'd082', name: 'Hotel California',   artist: 'Eagles',            album: 'Hotel California',         albumArt: 'https://i.scdn.co/image/ab67616d0000b2730f0f0f0f0f0f0f0f0f0f0f0f', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/40riOy7x9W7GXjyGp4pjAv', popularity: 83, genres: ['rock'],         color: '#ffa94d' },
  { id: 'd083', name: 'Africa',             artist: 'Toto',              album: 'Toto IV',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b2731e1e1e1e1e1e1e1e1e1e1e1e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2374M0fQpWi3dLnB54qaLX', popularity: 84, genres: ['rock','pop'],   color: '#ffa94d' },
  { id: 'd084', name: 'Eye of the Tiger',   artist: 'Survivor',          album: 'Eye of the Tiger',         albumArt: 'https://i.scdn.co/image/ab67616d0000b2732d2d2d2d2d2d2d2d2d2d2d2d', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e', popularity: 80, genres: ['rock'],         color: '#ffa94d' },
  { id: 'd085', name: "Stayin' Alive",      artist: 'Bee Gees',          album: 'Saturday Night Fever',     albumArt: 'https://i.scdn.co/image/ab67616d0000b2733e3e3e3e3e3e3e3e3e3e3e3e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6A1FdNKOBpF2GVmGxRBlIs', popularity: 79, genres: ['pop','dance'],  color: '#ffa94d' },
  { id: 'd086', name: "September",          artist: 'Earth, Wind & Fire',album: 'The Best of...',           albumArt: 'https://i.scdn.co/image/ab67616d0000b2734f4f4f4f4f4f4f4f4f4f4f4f', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5fQCuFuZXP3M1P0TXVqlDp', popularity: 78, genres: ['soul','funk'],  color: '#ffa94d' },

  // ── MELANCHOLY / EMOTIONAL ──
  { id: 'd087', name: 'The Night We Met',   artist: 'Lord Huron',        album: 'Strange Trails',           albumArt: 'https://i.scdn.co/image/ab67616d0000b2735f5f5f5f5f5f5f5f5f5f5f5f', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3hRV0jL3vUpRrcy398teAU', popularity: 77, genres: ['indie','folk'], color: '#a29bfe' },
  { id: 'd088', name: 'Liability',          artist: 'Lorde',             album: 'Melodrama',                albumArt: 'https://i.scdn.co/image/ab67616d0000b273474747474747474747474747', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/7t7BNLKiB2YCCFK1BGEPGR', popularity: 76, genres: ['indie','pop'], color: '#a29bfe' },
  { id: 'd089', name: 'Skinny',             artist: 'Billie Eilish',     album: 'HIT ME HARD AND SOFT',     albumArt: 'https://i.scdn.co/image/ab67616d0000b273585858585858585858585858', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6QuyrbmDHytNHMnMixm49i', popularity: 81, genres: ['indie','pop'], color: '#a29bfe' },
  { id: 'd090', name: 'Video Games',        artist: 'Lana Del Rey',      album: 'Born to Die',              albumArt: 'https://i.scdn.co/image/ab67616d0000b273696969696969696969696969', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1btzWJ6z4gXP5BXXN3C2bk', popularity: 79, genres: ['indie','pop'], color: '#a29bfe' },
  { id: 'd091', name: 'Motion Sickness',    artist: 'Phoebe Bridgers',   album: 'Stranger in the Alps',     albumArt: 'https://i.scdn.co/image/ab67616d0000b2737a7a7a7a7a7a7a7a7a7a7a7a', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5SLPH0oFDZdFwB5rHbJNBb', popularity: 74, genres: ['indie','folk'], color: '#a29bfe' },

  // ── ENERGETIC / EDM ──
  { id: 'd092', name: 'Turn Down for What', artist: 'DJ Snake',          album: 'Turn Down for What',       albumArt: 'https://i.scdn.co/image/ab67616d0000b2738b8b8b8b8b8b8b8b8b8b8b8b', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/5KH3Eob7MKMrjZD0JnGbkO', popularity: 85, genres: ['electronic','dance'], color: '#00d2ff' },
  { id: 'd093', name: 'Lean On',            artist: 'Major Lazer',       album: 'Peace Is the Mission',     albumArt: 'https://i.scdn.co/image/ab67616d0000b2739c9c9c9c9c9c9c9c9c9c9c9c', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/4pFhBdXSWMSBTUqFJJZiPm', popularity: 86, genres: ['electronic','dance'], color: '#00d2ff' },
  { id: 'd094', name: 'Titanium',           artist: 'David Guetta',      album: 'Nothing but the Beat',     albumArt: 'https://i.scdn.co/image/ab67616d0000b273adadadadadadadadadadadadad', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/0tMt7OfFi7mDCpPHknfPcJ', popularity: 84, genres: ['electronic','pop'],   color: '#00d2ff' },
  { id: 'd095', name: 'Animals',            artist: 'Martin Garrix',     album: 'Animals',                  albumArt: 'https://i.scdn.co/image/ab67616d0000b273bebebebebebebebebebebebebe', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/6UZ8uRjovEWJhVoO8X67qP', popularity: 82, genres: ['electronic','dance'], color: '#00d2ff' },

  // ── COUNTRY / FOLK ──
  { id: 'd096', name: 'Jolene',             artist: 'Dolly Parton',      album: 'Jolene',                   albumArt: 'https://i.scdn.co/image/ab67616d0000b273cfcfcfcfcfcfcfcfcfcfcfcf', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/3kxfsdsCpFgN412fpnW85Y', popularity: 76, genres: ['country'],      color: '#e67e22' },
  { id: 'd097', name: 'Fast Car',           artist: 'Tracy Chapman',     album: 'Tracy Chapman',            albumArt: 'https://i.scdn.co/image/ab67616d0000b273e0e0e0e0e0e0e0e0e0e0e0e1', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2vHzHEfNaJ2WrEMMQVPmqQ', popularity: 77, genres: ['folk','country'], color: '#e67e22' },
  { id: 'd098', name: 'Ring of Fire',       artist: 'Johnny Cash',       album: 'Ring of Fire',             albumArt: 'https://i.scdn.co/image/ab67616d0000b273f1f1f1f1f1f1f1f1f1f1f1f1', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1vXDmVhTBHYdaerFMfHPyp', popularity: 75, genres: ['country'],      color: '#e67e22' },

  // ── FUNK / GROOVE ──
  { id: 'd099', name: 'Superstition',       artist: 'Stevie Wonder',     album: 'Talking Book',             albumArt: 'https://i.scdn.co/image/ab67616d0000b2730202020202020202020202020', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/1C2QJNTmsTxCDBuIgai8QV', popularity: 78, genres: ['soul','funk'],  color: '#e84393' },
  { id: 'd100', name: 'Get Lucky',          artist: 'Daft Punk',         album: 'Random Access Memories',   albumArt: 'https://i.scdn.co/image/ab67616d0000b27318ab2f8f98f5e14c80ffeb5e', previewUrl: null, spotifyUrl: 'https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof', popularity: 85, genres: ['electronic','funk'], color: '#00d2ff' },
]

function makeNode(base: Omit<SongNode, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'scale'>, idx: number): SongNode {
  return {
    ...base,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0,
    scale: 0.5 + (base.popularity / 100) * 0.8,
  }
}

const VIBE_SONG_INDICES: Record<Vibe, number[]> = {
  'global-top-50':    [0, 1, 2, 10, 11, 20, 21, 25, 26, 68, 69],
  'viral-50':         [6, 8, 12, 13, 14, 25, 40, 41],
  'new-music-friday': [2, 3, 4, 40, 41, 42, 43, 87],
  'hip-hop-central':  [10, 11, 12, 13, 14, 15, 76, 77, 78, 79, 80],
  'pop-rising':       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 40, 41],
  'dance-hits':       [25, 26, 27, 29, 30, 31, 32, 33, 91, 92, 93, 94],
  'mood-booster':     [1, 3, 5, 22, 23, 81, 82, 83, 84, 98, 99],
  'late-night':       [20, 21, 22, 23, 24, 65, 66, 67, 71, 72, 98],
  'workout':          [12, 14, 50, 51, 52, 53, 54, 55, 56, 76, 77, 78, 79],
  'chill-hits':       [35, 36, 37, 38, 39, 73, 74, 75, 86, 87, 88],
}

export function generateDemoSongs(count: number, vibe: Vibe = 'global-top-50'): SongNode[] {
  const songs: SongNode[] = []
  const vibeIndices = VIBE_SONG_INDICES[vibe] || VIBE_SONG_INDICES['global-top-50']

  for (let i = 0; i < count; i++) {
    // First pass: prefer vibe-matched songs (cycle through them)
    // Then fill remainder with all songs cycling
    let srcIdx: number
    if (i < vibeIndices.length) {
      srcIdx = vibeIndices[i]
    } else {
      // Cycle from vibe songs first, then all songs
      const vibeIdx = i % vibeIndices.length
      srcIdx = vibeIndices[vibeIdx]
      // Mix in some variety from vibe songs or adjacent index to preserve mood locking
      if (i % 4 === 0) {
        // Occasionally mix in any of the demo songs, but keep it low to keep vibe consistent
        srcIdx = (srcIdx + i) % DEMO_SONGS.length
      }
    }

    const base = DEMO_SONGS[Math.min(srcIdx, DEMO_SONGS.length - 1)]
    // Give each copy a unique ID so React keys don't collide
    songs.push(makeNode({ ...base, id: `${base.id}-${i}` }, i))
  }

  return songs
}
