'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import { INTRO_MEDIA_MANIFEST } from '@/lib/introMediaManifest'

/**
 * HoverMediaBackground
 *
 * Full-screen background video layer for the homepage vibe tiles.
 * State machine: IDLE → DWELLING (800ms) → PREVIEWING → FULL_PLAYBACK
 *
 * Design principles:
 * - Preview (3s clip) is highest priority — starts as soon as canplay fires.
 * - Full video (30s) loading is deferred until preview is confirmed playing.
 * - Preview loops if full video isn't ready at handoff time.
 * - A monotonic session counter invalidates stale callbacks from old hovers.
 * - Audio comes from the MP4 tracks themselves; no overlapping playback.
 */

type PlaybackPhase = 'IDLE' | 'DWELLING' | 'PREVIEWING' | 'FULL_PLAYBACK'

const DWELL_MS = 800
const HANDOFF_TARGET_TIME = 3

const NEEDS_SCALE_UP = new Set([
  'pop-rising',
  'dance-hits',
  'mood-booster',
  'dev-special',
  'top-telugu',
  'top-tamil',
  'top-hindi',
  'top-kpop',
])

export default function HoverMediaBackground() {
  const hoveredVibe = useUIStore((s) => s.hoveredVibe)

  // ── Refs for state machine (no re-render needed for transitions) ──
  const phaseRef = useRef<PlaybackPhase>('IDLE')
  const activeVibeRef = useRef<string | null>(null)
  const sessionRef = useRef(0) // monotonic counter to invalidate stale closures
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewRef = useRef<HTMLVideoElement>(null)
  const fullRef = useRef<HTMLVideoElement>(null)

  // ── DOM opacity/visibility helpers (avoids React re-renders) ──
  const containerRef = useRef<HTMLDivElement>(null)
  const previewWrapRef = useRef<HTMLVideoElement | null>(null) // alias
  const fullWrapRef = useRef<HTMLVideoElement | null>(null)    // alias

  const setVisible = useCallback((el: HTMLElement | null, visible: boolean) => {
    if (!el) return
    el.style.opacity = visible ? '1' : '0'
  }, [])

  const setContainerActive = useCallback((active: boolean) => {
    const el = containerRef.current
    if (!el) return
    if (active) {
      el.style.opacity = '1'
      el.style.zIndex = '1'
    } else {
      el.style.opacity = '0'
      el.style.zIndex = '-10'
    }
  }, [])

  const setScale = useCallback((vibeId: string | null) => {
    const scale = vibeId && NEEDS_SCALE_UP.has(vibeId) ? 'scale(1.35)' : 'scale(1)'
    if (previewRef.current) previewRef.current.style.transform = scale
    if (fullRef.current) fullRef.current.style.transform = scale
  }, [])

  // ── Halt: stop all media and reset to IDLE ──
  const halt = useCallback(() => {
    // Bump session so any in-flight callbacks become stale
    sessionRef.current++

    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }

    phaseRef.current = 'IDLE'
    activeVibeRef.current = null

    const pVid = previewRef.current
    const fVid = fullRef.current

    if (pVid) {
      pVid.pause()
      pVid.removeAttribute('src')
      pVid.load()
    }
    if (fVid) {
      fVid.pause()
      fVid.removeAttribute('src')
      fVid.load()
    }

    setVisible(pVid, false)
    setVisible(fVid, false)
    setContainerActive(false)
  }, [setVisible, setContainerActive])

  // ── Begin full-video preparation (called after preview is confirmed playing) ──
  const beginFullVideoPrep = useCallback((session: number, vibeId: string) => {
    if (sessionRef.current !== session) return
    const entry = INTRO_MEDIA_MANIFEST[vibeId as keyof typeof INTRO_MEDIA_MANIFEST]
    if (!entry?.fullMp4) return

    const fVid = fullRef.current
    if (!fVid) return

    // Handler: once metadata loads, seek to ~3s
    const onLoadedMetadata = () => {
      if (sessionRef.current !== session) return
      fVid.currentTime = HANDOFF_TARGET_TIME
    }

    // Handler: once the target position is buffered, execute handoff
    const attemptHandoff = () => {
      if (sessionRef.current !== session) return
      if (phaseRef.current !== 'PREVIEWING') return

      // Check if target time is buffered
      let ready = false
      for (let i = 0; i < fVid.buffered.length; i++) {
        if (fVid.buffered.start(i) <= HANDOFF_TARGET_TIME && fVid.buffered.end(i) >= HANDOFF_TARGET_TIME + 0.5) {
          ready = true
          break
        }
      }
      if (!ready) return

      // Execute handoff
      phaseRef.current = 'FULL_PLAYBACK'

      const pVid = previewRef.current
      const playPromise = fVid.play()
      if (playPromise) {
        playPromise
          .then(() => {
            if (sessionRef.current !== session) return
            // Full video is playing — fade it in, fade preview out
            setVisible(fVid, true)
            // Short delay to allow crossfade, then stop preview
            setTimeout(() => {
              if (sessionRef.current !== session) return
              setVisible(pVid, false)
              if (pVid) {
                pVid.pause()
              }
            }, 200)
          })
          .catch(() => {
            // play() rejected (e.g. user left) — do nothing, halt will clean up
          })
      }
    }

    fVid.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    fVid.addEventListener('progress', attemptHandoff)
    fVid.addEventListener('canplay', attemptHandoff)
    fVid.addEventListener('canplaythrough', attemptHandoff)
    fVid.addEventListener('seeked', attemptHandoff)

    // Start loading — but don't call play() yet
    fVid.src = entry.fullMp4
    fVid.load()

    // Store cleanup for this session
    const cleanup = () => {
      fVid.removeEventListener('loadedmetadata', onLoadedMetadata)
      fVid.removeEventListener('progress', attemptHandoff)
      fVid.removeEventListener('canplay', attemptHandoff)
      fVid.removeEventListener('canplaythrough', attemptHandoff)
      fVid.removeEventListener('seeked', attemptHandoff)
    }
    // We rely on halt() to do removeAttribute('src') + load() which implicitly
    // cancels everything, but let's also clean up listeners when session changes.
    // Store the cleanup on the element for halt to call.
    ;(fVid as unknown as Record<string, unknown>).__cleanup = cleanup
  }, [setVisible])

  // ── Begin preview playback ──
  const beginPreview = useCallback((session: number, vibeId: string) => {
    if (sessionRef.current !== session) return
    const entry = INTRO_MEDIA_MANIFEST[vibeId as keyof typeof INTRO_MEDIA_MANIFEST]
    if (!entry?.previewMp4) return

    const pVid = previewRef.current
    if (!pVid) return

    phaseRef.current = 'PREVIEWING'
    setContainerActive(true)
    setScale(vibeId)

    // Enable looping on the preview — if full video isn't ready, preview loops
    pVid.loop = true

    const onCanPlay = () => {
      if (sessionRef.current !== session) return

      setVisible(pVid, true)

      const playPromise = pVid.play()
      if (playPromise) {
        playPromise
          .then(() => {
            if (sessionRef.current !== session) return
            // Preview is confirmed playing — NOW start loading full video
            beginFullVideoPrep(session, vibeId)
          })
          .catch(() => {
            // play() was interrupted (user left tile) — halt handles cleanup
          })
      }
    }

    pVid.addEventListener('canplay', onCanPlay, { once: true })
    pVid.src = entry.previewMp4
    pVid.load()

    // Cleanup listener if session invalidated before canplay fires
    ;(pVid as unknown as Record<string, unknown>).__cleanup = () => {
      pVid.removeEventListener('canplay', onCanPlay)
    }
  }, [setVisible, setContainerActive, setScale, beginFullVideoPrep])

  // ── Main hover watcher ──
  useEffect(() => {
    // Clean up stale listeners from previous session
    const pVid = previewRef.current
    const fVid = fullRef.current
    const cleanupPrev = (pVid as unknown as Record<string, unknown>)?.__cleanup as (() => void) | undefined
    const cleanupFull = (fVid as unknown as Record<string, unknown>)?.__cleanup as (() => void) | undefined
    if (cleanupPrev) { cleanupPrev(); (pVid as unknown as Record<string, unknown>).__cleanup = undefined }
    if (cleanupFull) { cleanupFull(); (fVid as unknown as Record<string, unknown>).__cleanup = undefined }

    if (!hoveredVibe) {
      halt()
      return
    }

    // Same tile — no action needed
    if (hoveredVibe === activeVibeRef.current && phaseRef.current !== 'IDLE') {
      return
    }

    // Different tile or fresh hover — reset and start new dwell
    halt()

    const entry = INTRO_MEDIA_MANIFEST[hoveredVibe as keyof typeof INTRO_MEDIA_MANIFEST]
    if (!entry?.previewMp4 || !entry?.fullMp4) return

    const session = ++sessionRef.current
    activeVibeRef.current = hoveredVibe
    phaseRef.current = 'DWELLING'

    dwellTimerRef.current = setTimeout(() => {
      if (sessionRef.current !== session) return
      beginPreview(session, hoveredVibe)
    }, DWELL_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredVibe])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      halt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        transition: 'opacity 300ms ease',
        opacity: 0,
        zIndex: -10,
      }}
    >
      {/* Background Dim */}
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 0 }} />

      {/* Preview Layer */}
      <video
        ref={previewRef}
        playsInline
        muted={false}
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          zIndex: 10,
          transition: 'opacity 150ms ease',
          opacity: 0,
          transformOrigin: 'center',
        }}
      />

      {/* Full Playback Layer */}
      <video
        ref={fullRef}
        playsInline
        muted={false}
        loop
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          zIndex: 20,
          transition: 'opacity 150ms ease',
          opacity: 0,
          transformOrigin: 'center',
        }}
      />
    </div>
  )
}
