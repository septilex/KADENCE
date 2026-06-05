import { Vibe } from './types'

export interface VibeConfig {
  id: Vibe
  label: string
  sub: string
  accentColor: string
  bgColor: string
  gradient: string
  bgClass: string
  number: string
  badge?: string
  membranePreset: 'energetic' | 'punchy' | 'glossy' | 'cinematic' | 'elastic' | 'dreamy'
}

export const VIBE_CONFIGS: VibeConfig[] = [
  {
    id: 'global-top-50',
    label: 'Global Top 50',
    sub: 'Trending worldwide',
    bgColor: '#15FF40', // vivid neon green
    accentColor: '#10cc33',
    gradient: 'from-green-400 to-emerald-600',
    bgClass: 'rgba(21, 255, 64, 0.05)',
    number: '01',
    badge: 'LIVE',
    membranePreset: 'energetic',
  },
  {
    id: 'viral-50',
    label: 'Viral 50',
    sub: 'Blowing up now',
    bgColor: '#FF00E5', // vivid magenta
    accentColor: '#cc00b7',
    gradient: 'from-fuchsia-400 to-pink-600',
    bgClass: 'rgba(255, 0, 229, 0.05)',
    number: '02',
    badge: 'HOT',
    membranePreset: 'punchy',
  },
  {
    id: 'new-music-friday',
    label: 'New Music Friday',
    sub: 'Fresh drops weekly',
    bgColor: '#0055FF', // vivid blue
    accentColor: '#0044cc',
    gradient: 'from-blue-500 to-indigo-600',
    bgClass: 'rgba(0, 85, 255, 0.05)',
    number: '03',
    badge: 'NEW',
    membranePreset: 'glossy',
  },
  {
    id: 'hip-hop-central',
    label: 'Hip-Hop Central',
    sub: 'Rap · Trap · Drill',
    bgColor: '#FFB300', // rich gold
    accentColor: '#cc8f00',
    gradient: 'from-amber-400 to-orange-600',
    bgClass: 'rgba(255, 179, 0, 0.05)',
    number: '04',
    membranePreset: 'energetic',
  },
  {
    id: 'pop-rising',
    label: 'Pop Rising',
    sub: 'Next-gen pop hits',
    bgColor: '#FF0033', // deep red
    accentColor: '#cc0029',
    gradient: 'from-red-500 to-rose-700',
    bgClass: 'rgba(255, 0, 51, 0.05)',
    number: '05',
    membranePreset: 'energetic',
  },
  {
    id: 'dance-hits',
    label: 'Dance Hits',
    sub: 'EDM · House · Techno',
    bgColor: '#3300FF', // electric indigo
    accentColor: '#2900cc',
    gradient: 'from-indigo-500 to-blue-700',
    bgClass: 'rgba(51, 0, 255, 0.05)',
    number: '06',
    membranePreset: 'punchy',
  },
  {
    id: 'mood-booster',
    label: 'Mood Booster',
    sub: 'Feel-good anthems',
    bgColor: '#77FF00', // bright lime green
    accentColor: '#5fcc00',
    gradient: 'from-lime-400 to-green-600',
    bgClass: 'rgba(119, 255, 0, 0.05)',
    number: '07',
    membranePreset: 'energetic',
  },
  {
    id: 'late-night',
    label: 'Late Night',
    sub: 'R&B · Slow · Dark',
    bgColor: '#9900FF', // vibrant purple
    accentColor: '#7a00cc',
    gradient: 'from-purple-600 to-fuchsia-800',
    bgClass: 'rgba(153, 0, 255, 0.05)',
    number: '08',
    membranePreset: 'cinematic',
  },
  {
    id: 'workout',
    label: 'Workout',
    sub: 'High-BPM energy',
    bgColor: '#FF6600', // energetic orange
    accentColor: '#cc5200',
    gradient: 'from-orange-500 to-red-600',
    bgClass: 'rgba(255, 102, 0, 0.05)',
    number: '09',
    membranePreset: 'elastic',
  },
  {
    id: 'chill-hits',
    label: 'Chill Hits',
    sub: 'Lo-fi · Soft · Easy',
    bgColor: '#00B3FF', // cyan blue
    accentColor: '#008fcc',
    gradient: 'from-cyan-500 to-blue-700',
    bgClass: 'rgba(0, 179, 255, 0.05)',
    number: '10',
    membranePreset: 'dreamy',
  },
  {
    id: 'dev-special',
    label: '✨ Prajit\'s Universe',
    sub: 'Curated by Prajit Balaji',
    bgColor: '#1a1814',
    accentColor: '#d4af37',
    gradient: 'from-yellow-600 to-stone-900',
    bgClass: 'rgba(212, 175, 55, 0.05)',
    number: '★',
    badge: '👑 Creator\'s Pick',
    membranePreset: 'glossy',
  },
  {
    id: 'top-telugu',
    label: 'Top Telugu',
    sub: 'Tollywood · Trending · Regional',
    bgColor: '#00D46A', // emerald green
    accentColor: '#00aa55',
    gradient: 'from-emerald-400 to-green-700',
    bgClass: 'rgba(0, 212, 106, 0.05)',
    number: '11',
    badge: 'REGIONAL',
    membranePreset: 'energetic',
  },
  {
    id: 'top-tamil',
    label: 'Top Tamil',
    sub: 'Kollywood · Chart Toppers · Viral',
    bgColor: '#D4002B', // crimson red
    accentColor: '#aa0022',
    gradient: 'from-red-500 to-rose-700',
    bgClass: 'rgba(212, 0, 43, 0.05)',
    number: '12',
    badge: 'REGIONAL',
    membranePreset: 'punchy',
  },
  {
    id: 'top-hindi',
    label: 'Top Hindi',
    sub: 'Bollywood · Desi Hits · Now Trending',
    bgColor: '#D47A00', // amber/gold
    accentColor: '#aa6200',
    gradient: 'from-orange-400 to-amber-700',
    bgClass: 'rgba(212, 122, 0, 0.05)',
    number: '13',
    badge: 'HOT',
    membranePreset: 'energetic',
  },
  {
    id: 'top-kpop',
    label: 'Top K-Pop',
    sub: 'K-Pop · K-R&B · K-Indie',
    bgColor: '#8B00FF', // intense violet
    accentColor: '#6f00cc',
    gradient: 'from-violet-500 to-purple-700',
    bgClass: 'rgba(139, 0, 255, 0.05)',
    number: '14',
    badge: 'NEW',
    membranePreset: 'glossy',
  },
]
