'use client'

import { useEffect, useRef } from 'react'
import { useAudioStore } from '@/store/audioStore'

// Progress update interval — 8Hz (125ms) is imperceptibly smooth for a scrubber
// and reduces Zustand state updates from 60/sec to 8/sec, eliminating 52 React
// re-renders per second in SongDetail.
const PROGRESS_INTERVAL_MS = 125

export function GlobalAudioPlayer() {
  const { 
    currentUrl, 
    isPlaying, 
    seekRequest,
    clearSeekRequest, 
    setPlayingState, 
    setProgressState 
  } = useAudioStore()

  const audioContextRef = useRef<HTMLAudioElement | null>(null)
  const audioFadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioDebounceRef = useRef<NodeJS.Timeout | null>(null)
  // Throttled progress reporter — fires at PROGRESS_INTERVAL_MS, not every rAF
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Scrubbing/Progress Reporting — throttled to 8Hz instead of 60Hz rAF.
  // This reduces Zustand set() calls from ~60/sec to ~8/sec while still
  // feeling instant to the user.
  const startProgressTimer = () => {
    if (progressTimerRef.current) return
    progressTimerRef.current = setInterval(() => {
      const el = audioContextRef.current
      if (el && el.duration && !el.paused) {
        setProgressState((el.currentTime / el.duration) * 100, el.duration)
      }
    }, PROGRESS_INTERVAL_MS)
  }

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => stopProgressTimer()
  }, [])

  // Handle Seek requests
  useEffect(() => {
    if (seekRequest !== null && audioContextRef.current && audioContextRef.current.duration) {
      const el = audioContextRef.current
      el.currentTime = (seekRequest / 100) * el.duration
      setProgressState(seekRequest, el.duration)
      clearSeekRequest()
    }
  }, [seekRequest, clearSeekRequest, setProgressState])

  // Handle Play/Pause toggles from the store
  useEffect(() => {
    const el = audioContextRef.current
    if (!el) return

    if (isPlaying && el.paused) {
      el.play().catch(() => {})
      startProgressTimer()
    } else if (!isPlaying && !el.paused) {
      el.pause()
      stopProgressTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Handle URL changes (Crossfading)
  useEffect(() => {
    // Clear any pending audio starts
    if (audioDebounceRef.current) clearTimeout(audioDebounceRef.current)

    if (!currentUrl) {
      // Fade out and stop existing playing audio
      const audio = audioContextRef.current
      if (audio) {
        let vol = audio.volume
        if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
        audioFadeIntervalRef.current = setInterval(() => {
          vol -= 0.05
          if (vol <= 0) {
            if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
            audio.pause()
            stopProgressTimer()
            setPlayingState(false)
            audioContextRef.current = null
          } else {
            audio.volume = Math.max(0, vol)
          }
        }, 30)
      }
      return
    }

    // Stop current intervals
    if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)

    // Fade out previous audio if playing
    const prevAudio = audioContextRef.current
    if (prevAudio) {
      // If it's the exact same URL, don't restart it
      if (prevAudio.src === currentUrl) return

      let prevVol = prevAudio.volume
      const fadeOutStep = prevVol / 10 // 10 steps
      const fadeOutInterval = setInterval(() => {
        prevVol -= fadeOutStep
        if (prevVol <= 0) {
          clearInterval(fadeOutInterval)
          prevAudio.pause()
        } else {
          prevAudio.volume = Math.max(0, prevVol)
        }
      }, 30) // 10 steps * 30ms = 300ms fade out
    }
    
    audioContextRef.current = null // clear so we don't fade it out again

    // Debounce new audio play slightly to yield event loop (caller manages main debounce)
    audioDebounceRef.current = setTimeout(() => {
      // Load and play next audio with a smooth fade-in
      const newAudio = new Audio(currentUrl)
      newAudio.volume = 0.0
      
      // Keep store updated when it ends
      newAudio.onended = () => {
        stopProgressTimer()
        setPlayingState(false)
        setProgressState(0, newAudio.duration)
      }

      newAudio.onloadedmetadata = () => {
        setProgressState(0, newAudio.duration)
      }

      audioContextRef.current = newAudio

      newAudio.play().then(() => {
        setPlayingState(true)
        startProgressTimer()
        let targetVol = 0.35 // Atmospheric volume peak
        let currentVol = 0.0
        const fadeInStep = targetVol / 10 // 10 steps
        
        audioFadeIntervalRef.current = setInterval(() => {
          currentVol += fadeInStep
          if (currentVol >= targetVol) {
            if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
            newAudio.volume = targetVol
          } else {
            newAudio.volume = currentVol
          }
        }, 30) // 10 steps * 30ms = 300ms fade in
      }).catch(() => {
        // Ignore autoplay block errors silently
        stopProgressTimer()
        setPlayingState(false)
      })
    }, 10) // 10ms yield instead of 250ms delay

    return () => {
      if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
      if (audioDebounceRef.current) clearTimeout(audioDebounceRef.current)
    }
  }, [currentUrl]) // deliberately omit other deps to only run on URL change

  return null // Audio is completely headless
}
