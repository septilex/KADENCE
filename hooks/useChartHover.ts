import { useState, useRef, useCallback } from 'react'
import { Vibe } from '@/lib/types'
import { SIGNATURE_SONGS } from '@/lib/signatureSongs'
import { vibeService } from '@/lib/vibeService'
import { useUIStore } from '@/store/uiStore'

// How long the cursor must dwell on a card before prefetching begins.
// 150ms filters out rapid cursor sweeps without noticeable lag for intentional hovers.
const PREFETCH_DEBOUNCE_MS = 150

// Dwell threshold (50ms) to filter out fast cursor sweeps during scrolling
const HOVER_DWELL_MS = 50

// Dwell threshold before starting a category video download (prevents wasted
// bandwidth from rapid cursor sweeps across cards on the intro screen).
const VIDEO_DWELL_MS = 200

// ── Category → Local MP4 Preview Video Mapping ──────────────────────────────
// Each of the 14 homepage editorial categories has exactly one assigned 30s clip.
// Keyed by Vibe ID for direct O(1) lookup from the hover handler.
export const CATEGORY_PREVIEW_VIDEOS: Partial<Record<Vibe, string>> = {
  'global-top-50':   '/videos/Beat It_30s.mp4',
  'viral-50':        '/videos/Radhimaa_30s.mp4',
  'new-music-friday': '/videos/Alaakaa Loova_30s.mp4',
  'hip-hop-central': '/videos/Loser_30s.mp4',
  'pop-rising':      '/videos/Kiss Kiss Bang Bang_30s.mp4',
  'dance-hits':      '/videos/Yeshanagula_30s.mp4',
  'mood-booster':    '/videos/Sunflower_30s.mp4',
  'late-night':      '/videos/One Of The Girls_30s.mp4',
  'workout':         '/videos/Big Dawgs_30s.mp4',
  'chill-hits':      '/videos/Pavazha Malli_30s.mp4',
  'dev-special':     '/videos/God Mode_30s.mp4',
  'top-telugu':      "/videos/Baby Won't You Tell Me_30s.mp4",
  'top-tamil':       '/videos/Monica_30s.mp4',
  'top-hindi':       '/videos/Gehra Hua_30s.mp4',
  'top-kpop':        '/videos/Dynamite_30s.mp4',
}

export function useChartHover() {
  const [hoveredVibe, setHoveredVibe] = useState<Vibe | null>(null)
  const activeVideoUrl = hoveredVibe ? CATEGORY_PREVIEW_VIDEOS[hoveredVibe] || null : null

  const hoverDwellTimeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const prefetchDebounceRef   = useRef<NodeJS.Timeout | null>(null)
  const exitTimeoutRef        = useRef<NodeJS.Timeout | null>(null)
  const videoDwellTimeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const hoveredVibeRef        = useRef<Vibe | null>(null)

  const handleHoverStart = useCallback((vibeId: Vibe) => {
    // Immediately cancel any pending exit timer from moving between cards
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }

    hoveredVibeRef.current = vibeId
    setHoveredVibe(vibeId)

    // ── Debounced Video Trigger (200ms dwell) ─────────────────────────────
    // Cancel any pending video activation from the previous card
    if (videoDwellTimeoutRef.current) {
      clearTimeout(videoDwellTimeoutRef.current)
      videoDwellTimeoutRef.current = null
    }

    const videoUrl = CATEGORY_PREVIEW_VIDEOS[vibeId] || null
    videoDwellTimeoutRef.current = setTimeout(() => {
      // Only activate if cursor is still on this card after the dwell period
      if (hoveredVibeRef.current === vibeId) {
        useUIStore.getState().setActiveCategoryVideo(videoUrl)
      }
    }, VIDEO_DWELL_MS)

    // ── Prefetch (debounced 150ms) ───────────────────────────────────────────
    if (vibeService.isCached(vibeId)) return

    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current)
    prefetchDebounceRef.current = setTimeout(() => {
      if (hoveredVibeRef.current === vibeId) {
        vibeService.prefetchVibe(vibeId)
      }
    }, PREFETCH_DEBOUNCE_MS)
  }, [])

  const handleHoverEnd = useCallback(() => {
    if (hoverDwellTimeoutRef.current) clearTimeout(hoverDwellTimeoutRef.current)
    if (prefetchDebounceRef.current)  clearTimeout(prefetchDebounceRef.current)

    // Cancel any pending video dwell timer — prevents downloads from starting
    // after the cursor has already left the card
    if (videoDwellTimeoutRef.current) {
      clearTimeout(videoDwellTimeoutRef.current)
      videoDwellTimeoutRef.current = null
    }

    // 50ms grace period on hover exit: allows cursor to traverse the 12px gap
    // between cards without flashing or triggering double re-renders.
    // If entering another card, handleHoverStart cancels this timer immediately (0ms).
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    exitTimeoutRef.current = setTimeout(() => {
      hoveredVibeRef.current = null
      setHoveredVibe(null)
      useUIStore.getState().setActiveCategoryVideo(null)
    }, 50)
  }, [])

  return {
    hoveredVibe,
    activeVideoUrl,
    handleHoverStart,
    handleHoverEnd,
    signatureSongs: SIGNATURE_SONGS,
  }
}

