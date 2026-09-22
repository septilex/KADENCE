import { create } from 'zustand'

interface IntroAudioState {
  audioPool: Map<string, HTMLAudioElement>
  currentPlayingUrl: string | null
  initAndPreload: (urls: string[]) => void
  playUrl: (url: string) => void
  stopAll: () => void
}

export const useIntroAudioStore = create<IntroAudioState>((set, get) => ({
  audioPool: new Map(),
  currentPlayingUrl: null,

  initAndPreload: (urls: string[]) => {
    // We no longer aggressively preload 14 audio files here to avoid 
    // network saturation on Vercel production.
    // The audio instances will be lazily created in playUrl on hover.
  },

  playUrl: (url: string) => {
    const { audioPool, currentPlayingUrl } = get()
    
    if (currentPlayingUrl === url) return

    // Pause all currently playing audio instantly
    audioPool.forEach((audio, activeUrl) => {
      if (activeUrl !== url && !audio.paused) {
        audio.pause()
        audio.currentTime = 0
      }
    })

    let targetAudio = audioPool.get(url)
    if (!targetAudio) {
      targetAudio = new Audio()
      targetAudio.src = url
      targetAudio.preload = 'auto'
      targetAudio.loop = true // Intro preview loops
      audioPool.set(url, targetAudio)
    }

    targetAudio.play().catch(() => {
      // Autoplay policy rejection; perfectly fine to ignore silently.
      // It will work automatically after the user's first interaction.
    })
    set({ currentPlayingUrl: url, audioPool })
  },

  stopAll: () => {
    const { audioPool, currentPlayingUrl } = get()
    if (!currentPlayingUrl) return

    audioPool.forEach((audio) => {
      if (!audio.paused) {
        audio.pause()
        audio.currentTime = 0
      }
    })
    set({ currentPlayingUrl: null })
  }
}))
