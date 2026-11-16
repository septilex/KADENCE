import { SongNode, Vibe } from './types';
import { devSpecialData } from './devSpecialData';

export function getFirstTrackForVibe(vibe: Vibe): SongNode | null {
  if (vibe === 'dev-special' && devSpecialData && devSpecialData.length > 0) {
    return devSpecialData[0];
  }
  const sig = SIGNATURE_SONGS[vibe];
  if (sig) {
    return {
      ...sig,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      scale: 1,
    } as SongNode;
  }
  return null;
}

// Hardcoded signature tracks combining Spotify metadata with iTunes 30-second audio previews
// This ensures that chart previews are 100% reliable and always play a matching song.
export const SIGNATURE_SONGS: Record<Vibe, Omit<SongNode, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'scale'>> = {
  'global-top-50': {
    id: "0VjIjW4GlUZAMYd2vXMi3b",
    name: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",

    popularity: 92,
    color: "#1DB954",
    genres: ["Pop", "Synthwave"]
  },
  'viral-50': {
    id: "2IGMVunIBsBLtEQyoI1Mu7",
    name: "Paint The Town Red",
    artist: "Doja Cat",
    album: "Paint The Town Red",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e69a141e4ffe839c38c4c228",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/2b/09/d0/2b09d002-eb39-20e8-6516-241c940aac8d/mzaf_2681231828238645518.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/2IGMVunIBsBLtEQyoI1Mu7",

    popularity: 88,
    color: "#1DB954",
    genres: ["Rap", "Pop"]
  },
  'new-music-friday': {
    id: "1kuGVB7EU95pJObxwvfwKS",
    name: "vampire",
    artist: "Olivia Rodrigo",
    album: "GUTS",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/83/09/5e/83095ea1-83bf-ecdc-3b75-358c350fca51/mzaf_15560849688086702972.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/1kuGVB7EU95pJObxwvfwKS",

    popularity: 90,
    color: "#1DB954",
    genres: ["Pop", "Rock"]
  },
  'hip-hop-central': {
    id: "42VsgItocQwOQC3XWZ8JNA",
    name: "FE!N (feat. Playboi Carti)",
    artist: "Travis Scott, Playboi Carti",
    album: "UTOPIA",
    albumArt: "https://i.scdn.co/image/ab67616d0000b27304481c826dd292e5e4983b3f",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/40/d6/ad/40d6ad31-66e8-2385-cb64-a8115140ac1e/mzaf_12501327980583891859.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/42VsgItocQwOQC3XWZ8JNA",

    popularity: 95,
    color: "#1DB954",
    genres: ["Hip Hop", "Trap"]
  },
  'pop-rising': {
    id: "2qSkIjg1o9h3YT9RAgYN75",
    name: "Espresso",
    artist: "Sabrina Carpenter",
    album: "Espresso",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273659cd4673230913b3918e0d5",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e9/4d/02/e94d0230-11ee-ef94-d2cf-a5d547bd73f4/mzaf_554140808559155562.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/2qSkIjg1o9h3YT9RAgYN75",

    popularity: 96,
    color: "#1DB954",
    genres: ["Pop", "Upbeat"]
  },
  'dance-hits': {
    id: "59NraMJsLaMCVtwXTSia8i",
    name: "Prada",
    artist: "cassö, RAYE, D-Block Europe",
    album: "Prada",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e4b7dccdfd54375ded9ccc5c",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/6a/9b/26/6a9b2674-c8e9-3aa8-b075-a2ccc6b950c5/mzaf_17262420035756291929.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/59NraMJsLaMCVtwXTSia8i",

    popularity: 87,
    color: "#1DB954",
    genres: ["Dance", "Electronic"]
  },
  'mood-booster': {
    id: "4Dvkj6JhhA12EX05fT7y2e",
    name: "As It Was",
    artist: "Harry Styles",
    album: "Harry's House",
    albumArt: "https://i.scdn.co/image/ab67616d0000b27382ce362511fb3d9dda6578ee",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/4Dvkj6JhhA12EX05fT7y2e",

    popularity: 91,
    color: "#1DB954",
    genres: ["Pop", "Indie"]
  },
  'late-night': {
    id: "4iZ4pt7kvcaH6Yo8UoZ4s2",
    name: "Snooze",
    artist: "SZA",
    album: "SOS",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273bc18bdade69ec5ef0bb25b17",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b3/9b/ca/b39bca57-2627-1aec-77af-cbf551205394/mzaf_4430383240210492712.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/4iZ4pt7kvcaH6Yo8UoZ4s2",

    popularity: 89,
    color: "#1DB954",
    genres: ["R&B", "Soul"]
  },
  'workout': {
    id: "27NovPIUIRrOZoCHxABJwK",
    name: "INDUSTRY BABY",
    artist: "Lil Nas X, Jack Harlow",
    album: "INDUSTRY BABY (feat. Jack Harlow)",
    albumArt: "https://i.scdn.co/image/ab67616d0000b2738a09f10b028a8bb55bfed9b8",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/be/9b/35/be9b35f7-e564-fafa-8586-146e2f7b7320/mzaf_7128424125938593552.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/27NovPIUIRrOZoCHxABJwK",

    popularity: 85,
    color: "#1DB954",
    genres: ["Rap", "Pop"]
  },
  'chill-hits': {
    id: "3OHfY25tqY28d16oZczHc8",
    name: "Kill Bill",
    artist: "SZA",
    album: "SOS",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273bc18bdade69ec5ef0bb25b17",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/45/2b/ea/452bead6-c7f5-82d4-f5f7-ec876014b4cc/mzaf_2905911853279084717.plus.aac.p.m4a",
    spotifyUrl: "https://open.spotify.com/track/3OHfY25tqY28d16oZczHc8",

    popularity: 92,
    color: "#1DB954",
    genres: ["R&B", "Chill"]
  },
  'dev-special': {
    id: "6773013478",
    name: "God Mode Begins",
    artist: "Sai Abhyankkar, Gana Muthu & Vishnu Edavan",
    album: "Karuppu (Original Motion Picture Soundtrack)",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d4/c4/38/d4c43885-7866-3ac4-e323-b9ca6a7621ec/cover.jpg/600x600bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/86/d0/3886d08d-1e96-dc45-d4fd-9138fc7748a3/mzaf_13976698916373719684.plus.aac.p.m4a",
    spotifyUrl: "https://music.apple.com/us/album/god-mode-begins/6773013206?i=6773013478&uo=4",
    popularity: 96,
    color: "#d4af37",
    genres: ["Tamil", "Dev Special"]
  },
  'top-telugu': {
    id: "1602184669",
    name: "Srivalli",
    artist: "Sid Sriram",
    album: "Pushpa - The Rise, Part. 01 (Original Motion Picture Soundtrack)",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ec/34/7b/ec347b9b-0add-c529-4746-799277a5e1c0/cover.jpg/600x600bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9b/4a/e3/9b4ae3a2-43ee-dd7b-0474-3b7e914513cf/mzaf_10743675123561433132.plus.aac.p.m4a",
    spotifyUrl: "https://music.apple.com/in/album/srivalli/1602184415?i=1602184669&uo=4",
    popularity: 94,
    color: "#059669",
    genres: ["Telugu", "Tollywood", "Regional"]
  },
  'top-tamil': {
    id: "1749347867",
    name: "Enjoy Enjaami",
    artist: "Dhee, Arivu & Santhosh Narayanan",
    album: "Enjoy Enjaami - Single",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/cf/c5/9b/cfc59b20-dda2-e4a3-54db-e23ac7a55b80/cover.jpg/600x600bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/87/8a/62/878a62f4-048c-d977-2a6f-a7a5b30a608d/mzaf_7142756228278497817.plus.aac.p.m4a",
    spotifyUrl: "https://music.apple.com/in/album/enjoy-enjaami/1749347864?i=1749347867&uo=4",
    popularity: 91,
    color: "#dc2626",
    genres: ["Tamil", "Kollywood", "Regional"]
  },
  'top-hindi': {
    id: "1648663570",
    name: "Kesariya",
    artist: "Pritam, Arijit Singh & Amitabh Bhattacharya",
    album: "Brahmastra (Original Motion Picture Soundtrack)",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/01/ef/35/01ef35ac-c046-656c-638f-928c4af51c8d/196589554871.jpg/600x600bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/21/4e/c3/214ec337-5c13-fdbf-e7dd-2738f2f9d3e2/mzaf_5009421294700453120.plus.aac.p.m4a",
    spotifyUrl: "https://music.apple.com/in/album/kesariya/1648663561?i=1648663570&uo=4",
    popularity: 93,
    color: "#f97316",
    genres: ["Hindi", "Bollywood", "Indian Pop"]
  },
  'top-kpop': {
    id: "1596532400",
    name: "Dynamite",
    artist: "BTS",
    album: "BE",
    albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/22/f3/8f/22f38fb9-1690-326a-d891-7aa946c2b06f/195497623273_Cover.jpg/600x600bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/a0/a6/a3a0a6b5-4715-b872-1aff-21e42634d9cd/mzaf_7224423421767640589.plus.aac.p.m4a",
    spotifyUrl: "https://music.apple.com/in/album/dynamite/1596532185?i=1596532400&uo=4",
    popularity: 97,
    color: "#8b5cf6",
    genres: ["K-Pop", "Dance", "Korean"]
  }
};
