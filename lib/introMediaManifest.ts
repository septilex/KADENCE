import { Vibe } from './types'

export interface IntroMediaEntry {
  vibeId: Vibe
  trackName: string | null
  artist: string | null
  mp4File: string | null
}

export const INTRO_MEDIA_MANIFEST: Record<Vibe, IntroMediaEntry> = {
  'global-top-50': {
    vibeId: 'global-top-50',
    trackName: 'Blinding Lights',
    artist: 'The Weeknd',
    mp4File: '/videos/Beat It_30s.mp4',
  },
  'viral-50': {
    vibeId: 'viral-50',
    trackName: 'Paint The Town Red',
    artist: 'Doja Cat',
    mp4File: '/videos/Radhimaa_30s.mp4',
  },
  'new-music-friday': {
    vibeId: 'new-music-friday',
    trackName: 'vampire',
    artist: 'Olivia Rodrigo',
    mp4File: '/videos/Alaakaa Loova_30s.mp4',
  },
  'hip-hop-central': {
    vibeId: 'hip-hop-central',
    trackName: 'FE!N',
    artist: 'Travis Scott, Playboi Carti',
    mp4File: '/videos/Loser_30s.mp4',
  },
  'pop-rising': {
    vibeId: 'pop-rising',
    trackName: 'Espresso',
    artist: 'Sabrina Carpenter',
    mp4File: '/videos/Kiss Kiss Bang Bang_30s.mp4',
  },
  'dance-hits': {
    vibeId: 'dance-hits',
    trackName: 'Prada',
    artist: 'cassö, RAYE, D-Block Europe',
    mp4File: '/videos/Yeshanagula_30s.mp4',
  },
  'mood-booster': {
    vibeId: 'mood-booster',
    trackName: 'As It Was',
    artist: 'Harry Styles',
    mp4File: '/videos/Sunflower_30s.mp4',
  },
  'late-night': {
    vibeId: 'late-night',
    trackName: 'Snooze',
    artist: 'SZA',
    mp4File: '/videos/One Of The Girls_30s.mp4',
  },
  'workout': {
    vibeId: 'workout',
    trackName: 'INDUSTRY BABY',
    artist: 'Lil Nas X, Jack Harlow',
    mp4File: '/videos/Big Dawgs_30s.mp4',
  },
  'chill-hits': {
    vibeId: 'chill-hits',
    trackName: 'Kill Bill',
    artist: 'SZA',
    mp4File: '/videos/Pavazha Malli_30s.mp4',
  },
  'dev-special': {
    vibeId: 'dev-special',
    trackName: 'God Mode Begins',
    artist: 'Sai Abhyankkar, Gana Muthu & Vishnu Edavan',
    mp4File: '/videos/God Mode_30s.mp4',
  },
  'top-telugu': {
    vibeId: 'top-telugu',
    trackName: 'Srivalli',
    artist: 'Sid Sriram',
    mp4File: "/videos/Baby Won't You Tell Me_30s.mp4",
  },
  'top-tamil': {
    vibeId: 'top-tamil',
    trackName: 'Enjoy Enjaami',
    artist: 'Dhee, Arivu',
    mp4File: '/videos/Monica_30s.mp4',
  },
  'top-hindi': {
    vibeId: 'top-hindi',
    trackName: 'Kesariya',
    artist: 'Arijit Singh',
    mp4File: '/videos/Gehra Hua_30s.mp4',
  },
  'top-kpop': {
    vibeId: 'top-kpop',
    trackName: 'Dynamite',
    artist: 'BTS',
    mp4File: '/videos/Dynamite_30s.mp4',
  },
}
