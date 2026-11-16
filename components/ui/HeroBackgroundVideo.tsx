'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'

interface HeroBackgroundVideoProps {
  currentVibe: Vibe | null
  introComplete?: boolean
}

export function HeroBackgroundVideo({ introComplete = false }: HeroBackgroundVideoProps) {
  const hoveredVibe = useUIStore(s => s.hoveredVibe)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (introComplete) {
      // Universe entered — release globe permanently (no re-download ever)
      video.pause()
      video.removeAttribute('src')
      video.load()
    } else if (hoveredVibe || document.hidden) {
      video.pause()
    } else {
      // No category video — resume globe from buffered position
      if (!video.getAttribute('src')) {
        video.setAttribute('src', '/videos/globe.mp4')
        video.load()
      }
      if (video.paused) {
        video.play().catch(() => {})
      }
    }
    const onVisibility = () => {
      if (document.hidden || hoveredVibe || introComplete) video.pause()
      else video.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [introComplete, hoveredVibe])

  return (
    <motion.div
      className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: introComplete ? 0 : 1 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        src="/videos/globe.mp4"
        style={{
          transform: 'translate3d(0, 0, 0) scale(1.85)',
          transformOrigin: 'center top',
          objectPosition: 'center top', // Pins the top of the video to show the top half of the globe
          filter: 'contrast(1.3) brightness(1.4) saturate(1.2)',
          display: 'block',
        }}
      />
    </motion.div>
  )
}

