import { create } from 'zustand'

interface AudioStoreState {
  currentUrl: string | null
  isPlaying: boolean
  progress: number
  duration: number
  
  // Actions to command the player
  playUrl: (url: string | null) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  seekTo: (progressPercent: number) => void

  // Actions for the player to report back state
  setPlayingState: (playing: boolean) => void
  setProgressState: (progress: number, duration: number) => void
  
  // Request a seek (player listens to this)
  seekRequest: number | null
  clearSeekRequest: () => void
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  currentUrl: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  seekRequest: null,

  playUrl: (url) => set({ currentUrl: url, isPlaying: !!url, progress: 0 }),
  
  play: () => {
    if (get().currentUrl) set({ isPlaying: true })
  },
  
  pause: () => set({ isPlaying: false }),
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying && !!state.currentUrl })),
  
  seekTo: (progressPercent) => set({ seekRequest: progressPercent }),
  
  setPlayingState: (playing) => set({ isPlaying: playing }),
  
  setProgressState: (progress, duration) => set({ progress, duration }),
  
  clearSeekRequest: () => set({ seekRequest: null }),
}))
