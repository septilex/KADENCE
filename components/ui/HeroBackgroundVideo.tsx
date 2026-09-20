'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'
import { useUIStore } from '@/store/uiStore'

interface HeroBackgroundVideoProps {
  currentVibe: Vibe | null
  introComplete?: boolean
}

export function HeroBackgroundVideo({ currentVibe, introComplete = false }: HeroBackgroundVideoProps) {
  const activeCategoryVideo = useUIStore((s) => s.activeCategoryVideo)
  const isSongActive = Boolean(activeCategoryVideo)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (introComplete) {
      // Universe entered — release globe permanently (no re-download ever)
      video.pause()
      video.removeAttribute('src')
      video.load()
    } else if (isSongActive) {
      // Category video active — pause globe but KEEP src to avoid re-download
      if (!video.paused) {
        video.pause()
      }
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
  }, [isSongActive, introComplete])

  return (
    <motion.div
      className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: (introComplete || isSongActive) ? 0 : 1 }}
      transition={{ duration: isSongActive ? 0.15 : 1.5, ease: 'easeInOut' }}
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
          display: isSongActive ? 'none' : 'block',
        }}
      />
    </motion.div>
  )
}

