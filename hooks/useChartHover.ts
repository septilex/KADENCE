import { useRef, useCallback } from 'react'
import { Vibe } from '@/lib/types'
import { SIGNATURE_SONGS } from '@/lib/signatureSongs'
import { vibeService } from '@/lib/vibeService'
import { useUIStore } from '@/store/uiStore'


// How long the cursor must dwell on a card before prefetching begins.
// 150ms filters out rapid cursor sweeps without noticeable lag for intentional hovers.
const PREFETCH_DEBOUNCE_MS = 150

// Dwell threshold (50ms) to filter out fast cursor sweeps during scrolling
const HOVER_DWELL_MS = 50

export function useChartHover() {
  const hoveredVibe = useUIStore((s) => s.hoveredVibe)
  const setHoveredVibe = useUIStore((s) => s.setHoveredVibe)

  const hoverDwellTimeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const prefetchDebounceRef   = useRef<NodeJS.Timeout | null>(null)
  const exitTimeoutRef        = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef        = useRef<Vibe | null>(null)

  const handleHoverStart = useCallback((vibeId: Vibe) => {
    // Immediately cancel any pending exit timer from moving between cards
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }

    hoveredVibeRef.current = vibeId
    setHoveredVibe(vibeId)

    // ── Prefetch (debounced 150ms) ───────────────────────────────────────────
    if (vibeService.isCached(vibeId)) return

    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current)
    prefetchDebounceRef.current = setTimeout(() => {
      if (hoveredVibeRef.current === vibeId) {
        vibeService.prefetchVibe(vibeId)
      }
    }, PREFETCH_DEBOUNCE_MS)
  }, [setHoveredVibe])

  const handleHoverEnd = useCallback(() => {
    if (hoverDwellTimeoutRef.current) clearTimeout(hoverDwellTimeoutRef.current)
    if (prefetchDebounceRef.current)  clearTimeout(prefetchDebounceRef.current)
    // 50ms grace period on hover exit: allows cursor to traverse the 12px gap
    // between cards without flashing or triggering double re-renders.
    // If entering another card, handleHoverStart cancels this timer immediately (0ms).
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    exitTimeoutRef.current = setTimeout(() => {
      hoveredVibeRef.current = null
      setHoveredVibe(null)
    }, 50)
  }, [setHoveredVibe])

  return {
    hoveredVibe,

    handleHoverStart,
    handleHoverEnd,
    signatureSongs: SIGNATURE_SONGS,
  }
}

