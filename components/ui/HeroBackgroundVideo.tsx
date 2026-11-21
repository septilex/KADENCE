'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useChartTransition } from '@/store/chartTransitionStore'
import { motion } from 'framer-motion'
import { releaseHomepageAudio } from '@/lib/homepageBeatAudio'
import { bindBeatMotion } from '@/lib/beatMotion'
import { Vibe } from '@/lib/types'

interface HeroBackgroundVideoProps {
  currentVibe: Vibe | null
  introComplete?: boolean
}

export function HeroBackgroundVideo({ introComplete = false }: HeroBackgroundVideoProps) {
  const hoveredVibe = useUIStore(s => s.hoveredVibe)
  const transitionPhase = useChartTransition(s => s.phase)
  const beatRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => { const video = videoRef.current; return () => { if (video) releaseHomepageAudio(video) } }, [])
  // A chart was picked: the globe freezes under the expanding flash (no more decoding), and
  // is released once the chart artwork covers the screen (no more downloading). If the load
  // fails or is cancelled, the phase returns to idle and the globe resumes below.
  const selecting = transitionPhase === 'flash'
  const covered = transitionPhase === 'loading' || transitionPhase === 'revealing'

  useEffect(() => {
    if (!introComplete && !covered && !selecting && !hoveredVibe && beatRef.current && videoRef.current) {
      return bindBeatMotion(beatRef.current, videoRef.current)
    }
  }, [introComplete, covered, selecting, hoveredVibe])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const playWithSound = () => {
      video.muted = false
      video.play().catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'NotAllowedError') {
          video.muted = true
          void video.play().catch(() => {})
        }
      })
    }
    const idle = () => !introComplete && !selecting && !covered && !hoveredVibe
    const enableSound = () => {
      if (idle() && !document.hidden) playWithSound()
    }

    if (introComplete || covered) {
      // Universe entered (or the loading artwork covers the screen) — release the globe.
      video.pause()
      video.removeAttribute('src')
      video.load()
    } else if (selecting || hoveredVibe || document.hidden) {
      video.pause()
    } else {
      // No category video — resume globe from buffered position
      if (!video.getAttribute('src')) {
        video.setAttribute('src', '/videos/globe-hq.mp4')
        video.load()
      }
      if (video.paused) {
        playWithSound()
      }
    }
    const onVisibility = () => {
      if (document.hidden || !idle()) video.pause()
      else playWithSound()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('click', enableSound)
    window.addEventListener('keydown', enableSound)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('click', enableSound)
      window.removeEventListener('keydown', enableSound)
    }
  }, [introComplete, hoveredVibe, selecting, covered])

  return (
    <motion.div
      className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: introComplete || covered ? 0 : 1 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <div ref={beatRef} className="absolute inset-0" style={{ transform: 'translate3d(0,0,0) scale(1)' }}>
      <video
        ref={videoRef}
        autoPlay
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/globe-hq.mp4"
        style={{
          transform: 'translate3d(0, 0, 0) scale(1.85)',
          transformOrigin: 'center top',
          objectPosition: 'center top', // Pins the top of the video to show the top half of the globe
          // No CSS filter: the original footage plays as encoded. A full-screen filter on an
          // upscaled video costs a GPU pass every frame and was making playback stutter.
          display: 'block',
        }}
      />
      </div>
    </motion.div>
  )
}

