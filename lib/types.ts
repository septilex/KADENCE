// Spotify specific types removed.

// Internal node type for 3D rendering
export interface SongNode {
  id: string
  name: string
  artist: string
  album: string
  albumArt: string
  previewUrl: string | null
  spotifyUrl: string
  popularity: number
  genres: string[]
  // 3D position
  x: number
  y: number
  z: number
  // Physics
  vx: number
  vy: number
  // Display
  color: string
  scale: number
}

export type Vibe =
  | 'global-top-50'
  | 'viral-50'
  | 'new-music-friday'
  | 'hip-hop-central'
  | 'pop-rising'
  | 'dance-hits'
  | 'mood-booster'
  | 'late-night'
  | 'workout'
  | 'chill-hits'
  | 'dev-special'
  | 'top-telugu'
  | 'top-tamil'
  | 'top-hindi'
  | 'top-kpop'

export interface MoodQuery {
  query: string
  genres?: string[]
  energy?: number // 0-1
  valence?: number // 0-1
  tempo?: number
}

// Per-vibe accent color for UI theming
export const VIBE_COLORS: Record<Vibe, string> = {
  'global-top-50': '#2eb860',
  'viral-50': '#d624a3',
  'new-music-friday': '#2e6bb8',
  'hip-hop-central': '#b87600',
  'pop-rising': '#d62424',
  'dance-hits': '#2e2eb8',
  'mood-booster': '#76b82e',
  'late-night': '#762eb8',
  'workout': '#d65500',
  'chill-hits': '#00b8d6',
  'dev-special': '#d4af37', // Gold
  'top-telugu': '#059669', // Emerald Green
  'top-tamil': '#dc2626', // Crimson Red
  'top-hindi': '#f97316', // Saffron Orange
  'top-kpop': '#8b5cf6', // Violet
}
