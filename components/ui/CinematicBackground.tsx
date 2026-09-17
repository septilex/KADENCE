'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { SongNode } from '@/lib/types'

interface CinematicBackgroundProps {
  song: SongNode | null
}

export function CinematicBackground({ song }: CinematicBackgroundProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      <AnimatePresence>
        {song && (
          <motion.div
            key={song.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full bg-[#050508]"
          >
            {/* Huge Artwork */}
            <div 
              className="absolute inset-0 w-full h-full opacity-75"
              style={{
                backgroundImage: `url(${song.albumArt})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(9px) brightness(1.1)',
                transform: 'scale(1.1)' // Prevent blurred edges from leaking in
              }}
            />

            {/* Soft Cinematic Overlay */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                background: 'linear-gradient(to bottom, rgba(5,5,8,0.35) 0%, rgba(2,2,4,0.65) 100%)'
              }}
            />
            
            {/* Subtle supporting song.color glow */}
            <div 
              className="absolute inset-0 w-full h-full opacity-[0.08]"
              style={{ 
                background: `radial-gradient(circle at 50% 50%, ${song.color}, transparent 80%)`,
                mixBlendMode: 'screen'
              }}
            />
            
            {/* Soft Edge Vignette */}
            <div className="absolute inset-0 w-full h-full shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
