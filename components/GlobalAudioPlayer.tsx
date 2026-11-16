'use client'
import { useEffect } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { startAudioDirector } from '@/lib/audioDirector'
import { AudioEngine } from '@/lib/audioEngine'
import { startListeningTracker } from '@/lib/listeningTracker'

export function GlobalAudioPlayer() {
  useEffect(() => {
    const state = useAudioStore.getState()
    const engine = new AudioEngine({ playing: state.setPlayingState, progress: state.setProgressState, error: state.setPlaybackError })
    // Synchronous commands preserve the originating click's autoplay activation.
    const unsubscribe = useAudioStore.subscribe((next, prev) => {
      if (next.currentUrl !== prev.currentUrl) engine.setSource(next.currentUrl, next.isPlaying)
      else if (next.isPlaying !== prev.isPlaying) engine.setPlaying(next.isPlaying)
      if (next.preloadedUrls !== prev.preloadedUrls) engine.preload(next.preloadedUrls)
      if (next.seekRequest !== null && next.seekRequest !== prev.seekRequest) {
        engine.seek(next.seekRequest)
        next.clearSeekRequest()
      }
    })
    engine.setSource(state.currentUrl, state.isPlaying)
    engine.preload(state.preloadedUrls)
    const stopDirector = startAudioDirector()
    // Listening history for the profile card (plays, charts opened); browser-local.
    const stopTracker = startListeningTracker()
    return () => { stopTracker(); stopDirector(); unsubscribe(); engine.dispose() }
  }, [])
  return null
}
