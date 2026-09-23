'use client'

import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { INTRO_MEDIA_MANIFEST } from '@/lib/introMediaManifest'

type PlaybackState = 'IDLE' | 'DWELLING' | 'PREVIEWING' | 'HANDOFF_WAIT' | 'FULL_PLAYBACK'

export default function HoverMediaBackground() {
  const hoveredVibe = useUIStore((s) => s.hoveredVibe)
  
  const [playbackState, setPlaybackState] = useState<PlaybackState>('IDLE')
  const [activeVibe, setActiveVibe] = useState<string | null>(null)
  
  const previewRef = useRef<HTMLVideoElement>(null)
  const fullRef = useRef<HTMLVideoElement>(null)
  
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isTransitioningRef = useRef(false)

  // Clear everything out and halt media
  const resetAndHalt = () => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    
    isTransitioningRef.current = false
    setPlaybackState('IDLE')
    setActiveVibe(null)

    if (previewRef.current) {
      previewRef.current.pause()
      previewRef.current.removeAttribute('src')
      previewRef.current.load()
    }
    if (fullRef.current) {
      fullRef.current.pause()
      fullRef.current.removeAttribute('src')
      fullRef.current.load()
    }
  }

  // 1. Hover State Watcher
  useEffect(() => {
    if (!hoveredVibe) {
      // Cursor left
      resetAndHalt()
      return
    }

    // Cursor is on a tile
    // If it's the SAME tile as what we're processing, do nothing
    if (hoveredVibe === activeVibe) return

    // Cursor moved to a DIFFERENT tile -> reset and start fresh dwell
    resetAndHalt()
    
    const vibeData = INTRO_MEDIA_MANIFEST[hoveredVibe]
    if (!vibeData || !vibeData.previewMp4 || !vibeData.fullMp4) return

    setActiveVibe(hoveredVibe)
    setPlaybackState('DWELLING')

    dwellTimerRef.current = setTimeout(() => {
      // Dwell passed
      setPlaybackState('PREVIEWING')
    }, 500)

  }, [hoveredVibe, activeVibe])

  // 2. Playback State Machine Effects
  useEffect(() => {
    if (playbackState === 'PREVIEWING' && activeVibe) {
      const vibeData = INTRO_MEDIA_MANIFEST[activeVibe as keyof typeof INTRO_MEDIA_MANIFEST]
      if (!vibeData) return

      const pVid = previewRef.current
      const fVid = fullRef.current
      if (!pVid || !fVid) return

      // Setup Preview
      pVid.src = vibeData.previewMp4!
      pVid.play().catch(() => {}) // Catch abort errors

      // Setup Full Video
      fVid.src = vibeData.fullMp4!
      fVid.load()

      const handleLoadedMetadata = () => {
        // Seek to ~3 seconds for background buffering
        fVid.currentTime = 3
      }

      fVid.addEventListener('loadedmetadata', handleLoadedMetadata)

      return () => {
        fVid.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }
  }, [playbackState, activeVibe])

  // 3. The Handoff Logic
  useEffect(() => {
    const pVid = previewRef.current
    const fVid = fullRef.current
    if (!pVid || !fVid) return

    const checkAndHandoff = () => {
      if (playbackState !== 'PREVIEWING' && playbackState !== 'HANDOFF_WAIT') return
      
      // Is the target position (3 seconds) buffered?
      const targetTime = 3
      let isBuffered = false
      for (let i = 0; i < fVid.buffered.length; i++) {
        if (fVid.buffered.start(i) <= targetTime && fVid.buffered.end(i) >= targetTime) {
          isBuffered = true
          break
        }
      }

      if (isBuffered) {
        // Ready! Execute transition
        isTransitioningRef.current = true
        fVid.play().catch(() => {})
        setPlaybackState('FULL_PLAYBACK')
      } else {
        // Not ready, enter wait state
        if (playbackState === 'PREVIEWING') {
          pVid.pause() // hold on last frame
          setPlaybackState('HANDOFF_WAIT')
        }
      }
    }

    // Monitor preview end
    const handlePreviewTimeUpdate = () => {
      // If we reach the end of the 3s preview
      if (pVid.currentTime >= 2.9 || pVid.ended) {
        checkAndHandoff()
      }
    }

    // Monitor full video progress during handoff wait
    const handleFullVideoProgress = () => {
      if (playbackState === 'HANDOFF_WAIT') {
        checkAndHandoff()
      }
    }

    pVid.addEventListener('timeupdate', handlePreviewTimeUpdate)
    pVid.addEventListener('ended', handlePreviewTimeUpdate)
    
    fVid.addEventListener('progress', handleFullVideoProgress)
    fVid.addEventListener('canplay', handleFullVideoProgress)
    fVid.addEventListener('canplaythrough', handleFullVideoProgress)

    return () => {
      pVid.removeEventListener('timeupdate', handlePreviewTimeUpdate)
      pVid.removeEventListener('ended', handlePreviewTimeUpdate)
      
      fVid.removeEventListener('progress', handleFullVideoProgress)
      fVid.removeEventListener('canplay', handleFullVideoProgress)
      fVid.removeEventListener('canplaythrough', handleFullVideoProgress)
    }
  }, [playbackState])

  // Render variables
  const showPreview = playbackState === 'PREVIEWING' || playbackState === 'HANDOFF_WAIT' || (playbackState === 'FULL_PLAYBACK' && isTransitioningRef.current)
  const showFull = playbackState === 'FULL_PLAYBACK'
  const isAnyActive = playbackState !== 'IDLE' && playbackState !== 'DWELLING'

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-300 ${isAnyActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}
    >
      {/* Background Dim */}
      <div className="absolute inset-0 bg-black/60 z-0" />
      
      {/* Preview Layer */}
      <video
        ref={previewRef}
        playsInline
        muted={false}
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-150 ${showPreview && !showFull ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Full Playback Layer */}
      <video
        ref={fullRef}
        playsInline
        muted={false}
        loop
        className={`absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-150 ${showFull ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
