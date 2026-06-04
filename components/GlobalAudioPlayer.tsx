'use client'

import { useEffect, useRef } from 'react'
import { useAudioStore } from '@/store/audioStore'

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
  const animFrame = useRef<number>(0)

  // Scrubbing/Progress Reporting Loop
  const updateProgress = () => {
    const el = audioContextRef.current
    if (el && el.duration && !el.paused) {
      setProgressState((el.currentTime / el.duration) * 100, el.duration)
    }
    animFrame.current = requestAnimationFrame(updateProgress)
  }

  useEffect(() => {
    animFrame.current = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(animFrame.current)
  }, [])

  // Handle Seek requests
  useEffect(() => {
    if (seekRequest !== null && audioContextRef.current && audioContextRef.current.duration) {
      const el = audioContextRef.current
      el.currentTime = (seekRequest / 100) * el.duration
      setProgressState(seekRequest, el.duration)
      clearSeekRequest()
    }
  }, [seekRequest, clearSeekRequest])

  // Handle Play/Pause toggles from the store
  useEffect(() => {
    const el = audioContextRef.current
    if (!el) return

    if (isPlaying && el.paused) {
      el.play().catch(() => {})
    } else if (!isPlaying && !el.paused) {
      el.pause()
    }
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
      console.log(`[AUDIO] Creating new Audio for: ${currentUrl}`)
      // Load and play next audio with a smooth fade-in
      const newAudio = new Audio(currentUrl)
      newAudio.volume = 0.0
      
      // Keep store updated when it ends
      newAudio.onended = () => {
        console.log(`[AUDIO] Track ended organically: ${currentUrl}`)
        setPlayingState(false)
        setProgressState(0, newAudio.duration)
      }

      newAudio.onloadedmetadata = () => {
        setProgressState(0, newAudio.duration)
      }

      audioContextRef.current = newAudio

      newAudio.play().then(() => {
        console.log(`[AUDIO] play success: ${currentUrl}`)
        setPlayingState(true)
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
      }).catch((e) => {
        console.log(`[AUDIO] play failed: ${e.message} for ${currentUrl}`)
        // Ignore autoplay block errors silently
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
