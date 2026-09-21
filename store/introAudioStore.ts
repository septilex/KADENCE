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
    if (typeof window === 'undefined') return
    
    const { audioPool } = get()
    let poolUpdated = false
    
    urls.forEach((url) => {
      if (!audioPool.has(url)) {
        const audio = new Audio()
        audio.src = url
        audio.preload = 'auto'
        audio.loop = true // Intro preview loops
        audioPool.set(url, audio)
        poolUpdated = true
      }
    })

    if (poolUpdated) {
      set({ audioPool })
    }
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

    const targetAudio = audioPool.get(url)
    if (targetAudio) {
      targetAudio.play().catch(() => {
        // Autoplay policy rejection; perfectly fine to ignore silently.
        // It will work automatically after the user's first interaction.
      })
      set({ currentPlayingUrl: url })
    } else {
      set({ currentPlayingUrl: null })
    }
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
