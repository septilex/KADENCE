import { useState, useRef, useCallback } from 'react'
import { Vibe } from '@/lib/types'
import { useAudioStore } from '@/store/audioStore'
import { SIGNATURE_SONGS } from '@/lib/signatureSongs'
import { vibeService } from '@/lib/vibeService'

// How long the cursor must dwell on a card before prefetching begins.
// 150ms filters out rapid cursor sweeps without noticeable lag for intentional hovers.
const PREFETCH_DEBOUNCE_MS = 150

// Dwell threshold (50ms) to filter out fast cursor sweeps during scrolling
const HOVER_DWELL_MS = 50

export function useChartHover() {
  const [hoveredVibe, setHoveredVibe] = useState<Vibe | null>(null)
  const { playUrl } = useAudioStore()

  const hoverDwellTimeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const previewStopTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prefetchDebounceRef   = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef        = useRef<Vibe | null>(null)

  const handleHoverStart = useCallback((vibeId: Vibe) => {
    hoveredVibeRef.current = vibeId

    if (hoverDwellTimeoutRef.current) clearTimeout(hoverDwellTimeoutRef.current)
    hoverDwellTimeoutRef.current = setTimeout(() => {
      if (hoveredVibeRef.current === vibeId) {
        setHoveredVibe(vibeId)

        // ── Audio preview (instant upon dwell) ───────────────────────────────────
        const song = SIGNATURE_SONGS[vibeId]
        if (song?.previewUrl) {
          playUrl(song.previewUrl)
          if (previewStopTimeoutRef.current) clearTimeout(previewStopTimeoutRef.current)
          previewStopTimeoutRef.current = setTimeout(() => {
            if (hoveredVibeRef.current === vibeId) playUrl(null)
          }, 10000)
        }
      }
    }, HOVER_DWELL_MS)

    // ── Prefetch (debounced 150ms) ───────────────────────────────────────────
    // Skip if we already have fresh data in the client cache.
    if (vibeService.isCached(vibeId)) return

    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current)
    prefetchDebounceRef.current = setTimeout(() => {
      // Only fire if the cursor is still on the same card
      if (hoveredVibeRef.current === vibeId) {
        vibeService.prefetchVibe(vibeId)
      }
    }, PREFETCH_DEBOUNCE_MS)
  }, [playUrl])

  const handleHoverEnd = useCallback(() => {
    if (hoverDwellTimeoutRef.current)  clearTimeout(hoverDwellTimeoutRef.current)
    if (previewStopTimeoutRef.current) clearTimeout(previewStopTimeoutRef.current)
    if (prefetchDebounceRef.current)   clearTimeout(prefetchDebounceRef.current)

    setHoveredVibe(null)
    hoveredVibeRef.current = null

    playUrl(null)
  }, [playUrl])

  return {
    hoveredVibe,
    handleHoverStart,
    handleHoverEnd,
    signatureSongs: SIGNATURE_SONGS,
  }
}
