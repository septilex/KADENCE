import { Vibe } from './types'

export interface IntroMediaEntry {
  vibeId: Vibe
  trackName: string | null
  artist: string | null
  previewMp4: string | null
  fullMp4: string | null
}

export const INTRO_MEDIA_MANIFEST: Record<Vibe, IntroMediaEntry> = {
  'global-top-50': {
    vibeId: 'global-top-50',
    trackName: 'Blinding Lights',
    artist: 'The Weeknd',
    previewMp4: '/videos/Beat It_preview_3s.mp4',
    fullMp4: '/videos/Beat It_30s.mp4',
  },
  'viral-50': {
    vibeId: 'viral-50',
    trackName: 'Paint The Town Red',
    artist: 'Doja Cat',
    previewMp4: '/videos/Radhimaa_preview_3s.mp4',
    fullMp4: '/videos/Radhimaa_30s.mp4',
  },
  'new-music-friday': {
    vibeId: 'new-music-friday',
    trackName: 'vampire',
    artist: 'Olivia Rodrigo',
    previewMp4: '/videos/Alaakaa Loova_preview_3s.mp4',
    fullMp4: '/videos/Alaakaa Loova_30s.mp4',
  },
  'hip-hop-central': {
    vibeId: 'hip-hop-central',
    trackName: 'FE!N',
    artist: 'Travis Scott, Playboi Carti',
    previewMp4: '/videos/Loser_preview_3s.mp4',
    fullMp4: '/videos/Loser_30s.mp4',
  },
  'pop-rising': {
    vibeId: 'pop-rising',
    trackName: 'Espresso',
    artist: 'Sabrina Carpenter',
    previewMp4: '/videos/Kiss Kiss Bang Bang_preview_3s.mp4',
    fullMp4: '/videos/Kiss Kiss Bang Bang_30s.mp4',
  },
  'dance-hits': {
    vibeId: 'dance-hits',
    trackName: 'Prada',
    artist: 'cassö, RAYE, D-Block Europe',
    previewMp4: '/videos/Yeshanagula_preview_3s.mp4',
    fullMp4: '/videos/Yeshanagula_30s.mp4',
  },
  'mood-booster': {
    vibeId: 'mood-booster',
    trackName: 'As It Was',
    artist: 'Harry Styles',
    previewMp4: '/videos/Sunflower_preview_3s.mp4',
    fullMp4: '/videos/Sunflower_30s.mp4',
  },
  'late-night': {
    vibeId: 'late-night',
    trackName: 'Snooze',
    artist: 'SZA',
    previewMp4: '/videos/One Of The Girls_preview_3s.mp4',
    fullMp4: '/videos/One Of The Girls_30s.mp4',
  },
  'workout': {
    vibeId: 'workout',
    trackName: 'INDUSTRY BABY',
    artist: 'Lil Nas X, Jack Harlow',
    previewMp4: '/videos/Big Dawgs_preview_3s.mp4',
    fullMp4: '/videos/Big Dawgs_30s.mp4',
  },
  'chill-hits': {
    vibeId: 'chill-hits',
    trackName: 'Kill Bill',
    artist: 'SZA',
    previewMp4: '/videos/Pavazha Malli_preview_3s.mp4',
    fullMp4: '/videos/Pavazha Malli_30s.mp4',
  },
  'dev-special': {
    vibeId: 'dev-special',
    trackName: 'God Mode Begins',
    artist: 'Sai Abhyankkar, Gana Muthu & Vishnu Edavan',
    previewMp4: '/videos/God Mode_preview_3s.mp4',
    fullMp4: '/videos/God Mode_30s.mp4',
  },
  'top-telugu': {
    vibeId: 'top-telugu',
    trackName: 'Srivalli',
    artist: 'Sid Sriram',
    previewMp4: "/videos/Baby Won't You Tell Me_preview_3s.mp4",
    fullMp4: "/videos/Baby Won't You Tell Me_30s.mp4",
  },
  'top-tamil': {
    vibeId: 'top-tamil',
    trackName: 'Enjoy Enjaami',
    artist: 'Dhee, Arivu',
    previewMp4: '/videos/Monica_preview_3s.mp4',
    fullMp4: '/videos/Monica_30s.mp4',
  },
  'top-hindi': {
    vibeId: 'top-hindi',
    trackName: 'Kesariya',
    artist: 'Arijit Singh',
    previewMp4: '/videos/Gehra Hua_preview_3s.mp4',
    fullMp4: '/videos/Gehra Hua_30s.mp4',
  },
  'top-kpop': {
    vibeId: 'top-kpop',
    trackName: 'Dynamite',
    artist: 'BTS',
    previewMp4: '/videos/Dynamite_preview_3s.mp4',
    fullMp4: '/videos/Dynamite_30s.mp4',
  },
}
