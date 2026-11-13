import { create } from 'zustand'

/**
 * High-frequency playback progress (written ~8×/s by GlobalAudioPlayer).
 *
 * Kept OUT of audioStore on purpose: components that subscribe to audioStore
 * (page root, GlobalAudioPlayer, SongDetail) must not re-render on every
 * progress tick. Only leaf components that actually draw progress subscribe here.
 */
interface PlaybackProgressState {
  progress: number // 0–100
  duration: number // seconds
  setProgress: (progress: number, duration: number) => void
}

export const usePlaybackProgressStore = create<PlaybackProgressState>((set) => ({
  progress: 0,
  duration: 0,
  setProgress: (progress, duration) => set({ progress, duration }),
}))
