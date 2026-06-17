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

  // Single reusable HTMLAudioElement
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioFadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize the singleton audio element on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.crossOrigin = 'anonymous'

      // Keep store updated when it ends
      audioRef.current.onended = () => {
        stopProgressTimer()
        setPlayingState(false)
        if (audioRef.current) setProgressState(0, audioRef.current.duration)
      }

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) setProgressState(0, audioRef.current.duration)
      }
    }
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
        audioRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scrubbing/Progress Reporting
  const startProgressTimer = () => {
    if (progressTimerRef.current) return
    progressTimerRef.current = setInterval(() => {
      const el = audioRef.current
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
    if (seekRequest !== null && audioRef.current && audioRef.current.duration) {
      const el = audioRef.current
      el.currentTime = (seekRequest / 100) * el.duration
      setProgressState(seekRequest, el.duration)
      clearSeekRequest()
    }
  }, [seekRequest, clearSeekRequest, setProgressState])

  // Handle Play/Pause toggles from the store
  useEffect(() => {
    const el = audioRef.current
    if (!el || !el.src) return

    if (isPlaying && el.paused) {
      el.play().then(() => {
        startProgressTimer()
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Audio play error:', err)
      })
    } else if (!isPlaying && !el.paused) {
      el.pause()
      stopProgressTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Handle URL changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)

    if (!currentUrl) {
      // Fade out rapidly when leaving a node (100ms fade to prevent clicking)
      let vol = audio.volume
      const fadeOutStep = vol / 5 // 5 steps
      audioFadeIntervalRef.current = setInterval(() => {
        vol -= fadeOutStep
        if (vol <= 0) {
          if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          stopProgressTimer()
          setPlayingState(false)
        } else {
          audio.volume = Math.max(0, vol)
        }
      }, 20) // 5 steps * 20ms = 100ms fade out
      return
    }

    // New URL to play immediately
    if (audio.src !== currentUrl) {
      audio.pause()
      audio.src = currentUrl
      audio.volume = 0.05 // start very low but non-zero to fade in fast
      audio.play().then(() => {
        setPlayingState(true)
        startProgressTimer()
        
        let targetVol = 0.35 // Atmospheric volume peak
        let currentVol = audio.volume
        const fadeInStep = (targetVol - currentVol) / 5 // 5 steps
        
        audioFadeIntervalRef.current = setInterval(() => {
          currentVol += fadeInStep
          if (currentVol >= targetVol) {
            if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
            audio.volume = targetVol
          } else {
            audio.volume = Math.min(targetVol, currentVol)
          }
        }, 20) // 5 steps * 20ms = 100ms fade in
      }).catch(err => {
        if (err.name !== 'AbortError') {
          // Ignore AbortError caused by rapid hovering
          console.error('Audio play error:', err)
          stopProgressTimer()
          setPlayingState(false)
        }
      })
    }
  }, [currentUrl, setPlayingState])

  return null // Audio is completely headless
}
