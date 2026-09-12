'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SongNode } from '@/lib/types'

interface PreviewVideoLayerProps {
  song: SongNode | null
}

export function PreviewVideoLayer({ song }: PreviewVideoLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!song) {
      setIsVisible(false)
      // Wait for fade out animation before clearing url
      const t = setTimeout(() => setActiveUrl(null), 500)
      return () => clearTimeout(t)
    }

    // Try to load local video file for this specific song
    const url = `/videos/${song.id}.mp4`
    
    if (activeUrl === url) {
      setIsVisible(true)
      return
    }

    // Fade out previous video before switching src
    setIsVisible(false)
    const t = setTimeout(() => {
      setActiveUrl(url)
    }, 500)
    return () => clearTimeout(t)
  }, [song, activeUrl])

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none bg-black/30">
      <AnimatePresence>
        {activeUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 w-full h-full"
          >
            <video
              ref={videoRef}
              src={activeUrl}
              autoPlay
              loop
              muted
              playsInline
              onCanPlay={() => {
                // Only show if the video successfully loaded data
                setIsVisible(true)
              }}
              onError={(e) => {
                // If local MP4 does not exist (e.g. 404), gracefully skip and do not show a broken video
                console.log(`[Preview] No local video found for ${activeUrl}, gracefully skipping.`)
                setIsVisible(false)
              }}
              // Subdued visual presence behind the album wall
              className="w-full h-full object-cover opacity-[0.45] mix-blend-screen"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
