import { useState, useRef, useEffect } from 'react'
import { Vibe } from '@/lib/types'
import { useAudioStore } from '@/store/audioStore'
import { useChartPreviewStore } from '@/store/chartPreviewStore'

export function useChartHover() {
  const [hoveredVibe, setHoveredVibe] = useState<Vibe | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number>(0)
  
  const { playUrl } = useAudioStore()
  const { previews, preloadAll } = useChartPreviewStore()

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef = useRef<Vibe | null>(null)

  // Preload all charts when this hook is first mounted on the homepage
  useEffect(() => {
    preloadAll()
  }, [preloadAll])

  const handleHoverStart = (vibeId: Vibe) => {
    console.log(`[HOVER] enter chart: ${vibeId}`)
    setHoveredVibe(vibeId)
    hoveredVibeRef.current = vibeId
    setPreviewIndex(0)
    
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current)

    hoverTimeoutRef.current = setTimeout(() => {
      console.log(`[HOVER] dwell triggered: ${vibeId}`)
      // If we moved off this card, abort
      if (hoveredVibeRef.current !== vibeId) {
        console.log(`[HOVER] aborting dwell, moved off ${vibeId}`)
        return
      }
      
      console.log(`[PREVIEW] requesting chart data for ${vibeId}`)
      const tracks = previews[vibeId]
      if (tracks && tracks.length > 0) {
        console.log(`[PREVIEW] tracks received: ${tracks.length}`)
        console.log(`[PREVIEW] selected track 0: ${tracks[0].name}`)
        // Play first track immediately
        console.log(`[AUDIO] play requested: ${tracks[0].previewUrl}`)
        playUrl(tracks[0].previewUrl || null)

        // Set up 10-second rotation
        rotationIntervalRef.current = setInterval(() => {
          setPreviewIndex(prev => {
            const nextIdx = (prev + 1) % tracks.length
            console.log(`[PREVIEW] rotation tick -> track ${nextIdx}: ${tracks[nextIdx].name}`)
            console.log(`[AUDIO] play requested: ${tracks[nextIdx].previewUrl}`)
            playUrl(tracks[nextIdx].previewUrl || null)
            return nextIdx
          })
        }, 10000)
      } else {
        console.log(`[PREVIEW] tracks received: 0 or undefined for ${vibeId}`)
      }
    }, 350)
  }

  const handleHoverEnd = () => {
    console.log(`[HOVER] exit chart`)
    setHoveredVibe(null)
    hoveredVibeRef.current = null
    
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current)
    
    playUrl(null)
    setPreviewIndex(0)
  }

  return {
    hoveredVibe,
    previewIndex,
    handleHoverStart,
    handleHoverEnd,
    previews
  }
}
