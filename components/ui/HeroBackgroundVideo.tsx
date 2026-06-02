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
      initial={{ opacity: 1 }}
      animate={{ opacity: introComplete ? 0 : 1 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <motion.video
        initial={{ opacity: 0, scale: 1.4 }}
        animate={{ opacity: 0.6, scale: 1.4 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          willChange: 'transform, opacity',
          objectPosition: 'center top', // Pins the top of the video to show the top half of the globe
          filter: 'contrast(1.3) brightness(1.4) saturate(1.2)'
        }}
      >
        <source src="/videos/globe.mp4" type="video/mp4" />
      </motion.video>
    </motion.div>
  )
}
