import { useState, useRef } from 'react'
import { Vibe } from '@/lib/types'
import { useAudioStore } from '@/store/audioStore'
import { SIGNATURE_SONGS } from '@/lib/signatureSongs'

export function useChartHover() {
  const [hoveredVibe, setHoveredVibe] = useState<Vibe | null>(null)
  const { playUrl } = useAudioStore()

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previewStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef = useRef<Vibe | null>(null)

  const handleHoverStart = (vibeId: Vibe) => {
    setHoveredVibe(vibeId)
    hoveredVibeRef.current = vibeId
    
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (previewStopTimeoutRef.current) clearTimeout(previewStopTimeoutRef.current)

    hoverTimeoutRef.current = setTimeout(() => {
      // If we moved off this card, abort
      if (hoveredVibeRef.current !== vibeId) return
      
      const song = SIGNATURE_SONGS[vibeId]
      if (song && song.previewUrl) {
        // Play signature track immediately
        // GlobalAudioPlayer automatically handles crossfading from any previous audio
        playUrl(song.previewUrl)

        // Automatically stop exactly after 10 seconds
        previewStopTimeoutRef.current = setTimeout(() => {
          if (hoveredVibeRef.current === vibeId) {
            playUrl(null)
          }
        }, 10000)
      }
    }, 200) // Fast hover response for premium feel
  }

  const handleHoverEnd = () => {
    setHoveredVibe(null)
    hoveredVibeRef.current = null
    
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (previewStopTimeoutRef.current) clearTimeout(previewStopTimeoutRef.current)
    
    // Smooth fade out via GlobalAudioPlayer
    playUrl(null)
  }

  return {
    hoveredVibe,
    handleHoverStart,
    handleHoverEnd,
    signatureSongs: SIGNATURE_SONGS
  }
}
