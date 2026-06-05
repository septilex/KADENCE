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
    bgColor: '#1a6b3a',
    accentColor: '#2eb860',
    gradient: 'from-green-600 to-emerald-800',
    bgClass: 'rgba(26, 107, 58, 0.05)',
    number: '01',
    badge: 'LIVE',
    membranePreset: 'energetic',
  },
  {
    id: 'viral-50',
    label: 'Viral 50',
    sub: 'Blowing up now',
    bgColor: '#8b1a6b',
    accentColor: '#d624a3',
    gradient: 'from-fuchsia-600 to-pink-800',
    bgClass: 'rgba(139, 26, 107, 0.05)',
    number: '02',
    badge: 'HOT',
    membranePreset: 'punchy',
  },
  {
    id: 'new-music-friday',
    label: 'New Music Friday',
    sub: 'Fresh drops weekly',
    bgColor: '#1a3a8b',
    accentColor: '#2b5cd6',
    gradient: 'from-blue-600 to-indigo-800',
    bgClass: 'rgba(26, 58, 139, 0.05)',
    number: '03',
    badge: 'NEW',
    membranePreset: 'glossy',
  },
  {
    id: 'hip-hop-central',
    label: 'Hip-Hop Central',
    sub: 'Rap · Trap · Drill',
    bgColor: '#5a3a00',
    accentColor: '#966000',
    gradient: 'from-amber-600 to-orange-800',
    bgClass: 'rgba(90, 58, 0, 0.05)',
    number: '04',
    membranePreset: 'energetic',
  },
  {
    id: 'pop-rising',
    label: 'Pop Rising',
    sub: 'Next-gen pop hits',
    bgColor: '#6b1a1a',
    accentColor: '#b32c2c',
    gradient: 'from-red-600 to-rose-800',
    bgClass: 'rgba(107, 26, 26, 0.05)',
    number: '05',
    membranePreset: 'energetic',
  },
  {
    id: 'dance-hits',
    label: 'Dance Hits',
    sub: 'EDM · House · Techno',
    bgColor: '#1a1a6b',
    accentColor: '#2e2eb8',
    gradient: 'from-indigo-600 to-blue-800',
    bgClass: 'rgba(26, 26, 107, 0.05)',
    number: '06',
    membranePreset: 'punchy',
  },
  {
    id: 'mood-booster',
    label: 'Mood Booster',
    sub: 'Feel-good anthems',
    bgColor: '#3a6b1a',
    accentColor: '#5ab82e',
    gradient: 'from-lime-600 to-green-800',
    bgClass: 'rgba(58, 107, 26, 0.05)',
    number: '07',
    membranePreset: 'energetic',
  },
  {
    id: 'late-night',
    label: 'Late Night',
    sub: 'R&B · Slow · Dark',
    bgColor: '#2a0a3a',
    accentColor: '#5c1780',
    gradient: 'from-purple-800 to-fuchsia-900',
    bgClass: 'rgba(42, 10, 58, 0.05)',
    number: '08',
    membranePreset: 'cinematic',
  },
  {
    id: 'workout',
    label: 'Workout',
    sub: 'High-BPM energy',
    bgColor: '#6b2a00',
    accentColor: '#b84a00',
    gradient: 'from-orange-600 to-red-800',
    bgClass: 'rgba(107, 42, 0, 0.05)',
    number: '09',
    membranePreset: 'elastic',
  },
  {
    id: 'chill-hits',
    label: 'Chill Hits',
    sub: 'Lo-fi · Soft · Easy',
    bgColor: '#0a3a4a',
    accentColor: '#176680',
    gradient: 'from-cyan-700 to-blue-900',
    bgClass: 'rgba(10, 58, 74, 0.05)',
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
]
