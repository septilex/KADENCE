import { create } from 'zustand'
import { usePlaybackProgressStore } from './playbackProgressStore'

interface AudioStoreState {
  currentUrl: string | null
  isPlaying: boolean

  // Actions to command the player
  playUrl: (url: string | null) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  seekTo: (progressPercent: number) => void

  // Actions for the player to report back state
  setPlayingState: (playing: boolean) => void
  /** Writes to usePlaybackProgressStore (not this store) so progress ticks never re-render audioStore subscribers. */
  setProgressState: (progress: number, duration: number) => void

  // Request a seek (player listens to this)
  seekRequest: number | null
  clearSeekRequest: () => void

  // Preload URLs managed independently of visual UI
  preloadedUrls: string[]
  setPreloadUrls: (urls: string[]) => void
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  currentUrl: null,
  isPlaying: false,
  seekRequest: null,

  playUrl: (url) => {
    usePlaybackProgressStore.getState().setProgress(0, usePlaybackProgressStore.getState().duration)
    set({ currentUrl: url, isPlaying: !!url })
  },

  play: () => {
    if (get().currentUrl) set({ isPlaying: true })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying && !!state.currentUrl })),

  seekTo: (progressPercent) => set({ seekRequest: progressPercent }),

  // Avoid notifying subscribers when nothing changed (the player reports this on every play()).
  setPlayingState: (playing) => { if (get().isPlaying !== playing) set({ isPlaying: playing }) },

  setProgressState: (progress, duration) => usePlaybackProgressStore.getState().setProgress(progress, duration),

  clearSeekRequest: () => set({ seekRequest: null }),

  preloadedUrls: [],
  setPreloadUrls: (urls) => set({ preloadedUrls: urls }),
}))
