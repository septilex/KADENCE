import { useRef, useCallback, useEffect } from 'react'
import { Vibe } from '@/lib/types'
import { SIGNATURE_SONGS } from '@/lib/signatureSongs'
import { vibeService } from '@/lib/vibeService'
import { useUIStore } from '@/store/uiStore'


// How long the cursor must dwell on a card before prefetching begins.
// Let the foreground video start before chart and artwork requests compete for bandwidth.
const PREFETCH_DEBOUNCE_MS = 1500


export function useChartHover() {
  const hoveredVibe = useUIStore((s) => s.hoveredVibe)
  const setHoveredVibe = useUIStore((s) => s.setHoveredVibe)

  const prefetchDebounceRef   = useRef<NodeJS.Timeout | null>(null)
  const exitTimeoutRef        = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef        = useRef<Vibe | null>(null)

  useEffect(() => () => {
    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current)
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
  }, [])

  const handleHoverStart = useCallback((vibeId: Vibe) => {
    // Immediately cancel any pending exit timer from moving between cards
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }

    hoveredVibeRef.current = vibeId
    setHoveredVibe(vibeId)

    // ── Prefetch (after playback startup) ───────────────────────────────────────────
    if (vibeService.isCached(vibeId)) return

    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current)
    prefetchDebounceRef.current = setTimeout(() => {
      if (hoveredVibeRef.current === vibeId) {
        vibeService.prefetchVibe(vibeId)
      }
    }, PREFETCH_DEBOUNCE_MS)
  }, [setHoveredVibe])

  const handleHoverEnd = useCallback(() => {
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

