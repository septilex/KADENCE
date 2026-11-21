import { create } from 'zustand'
import { usePlaybackProgressStore } from './playbackProgressStore'

interface AudioStoreState {
  beatEligible: boolean
  currentUrl: string | null
  isPlaying: boolean
  playbackError: string | null
  setPlaybackError: (error: string | null) => void

  // Actions to command the player
  playUrl: (url: string | null, origin?: 'selected' | 'hover') => void
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
  beatEligible: false,
  currentUrl: null,
  isPlaying: false,
  playbackError: null,
  setPlaybackError: (playbackError) => set({ playbackError }),
  seekRequest: null,

  playUrl: (url, origin = 'selected') => {
    const beatEligible = !!url && origin === 'selected'
    if (get().currentUrl === url) { if (url) set({ isPlaying: true, beatEligible }); return }
    usePlaybackProgressStore.getState().setProgress(0, usePlaybackProgressStore.getState().duration)
    set({ beatEligible, currentUrl: url, isPlaying: !!url, seekRequest: null, playbackError: null })
  },

  play: () => {
    if (get().currentUrl) set({ isPlaying: true, beatEligible: true })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying && !!state.currentUrl, beatEligible: !!state.currentUrl })),

  seekTo: (progressPercent) => set({ seekRequest: progressPercent }),

  // Avoid notifying subscribers when nothing changed (the player reports this on every play()).
  setPlayingState: (playing) => { if (get().isPlaying !== playing) set({ isPlaying: playing }) },

  setProgressState: (progress, duration) => usePlaybackProgressStore.getState().setProgress(progress, duration),

  clearSeekRequest: () => set({ seekRequest: null }),

  preloadedUrls: [],
  setPreloadUrls: (urls) => set({ preloadedUrls: urls }),
}))
