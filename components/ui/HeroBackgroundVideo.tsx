'use client'

import { motion } from 'framer-motion'
import { Vibe } from '@/lib/types'

interface HeroBackgroundVideoProps {
  currentVibe: Vibe | null
  introComplete?: boolean
}

export function HeroBackgroundVideo({ currentVibe, introComplete = false }: HeroBackgroundVideoProps) {
  return (
    <motion.div
      className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: introComplete ? 0 : 1 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: 'translate3d(0, 0, 0)',
          objectPosition: 'center top', // Pins the top of the video to show the top half of the globe
          filter: 'contrast(1.3) brightness(1.4) saturate(1.2)'
        }}
      >
        <source src="/videos/globe.mp4" type="video/mp4" />
      </video>
    </motion.div>
  )
}
