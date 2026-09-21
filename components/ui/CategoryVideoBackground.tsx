'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useSongStore } from '@/store/songStore'

// ── Zoom/Crop Configuration for Hardcoded Letterbox Videos ─────────────────
const CATEGORY_ZOOM_SCALES: Record<string, number> = {
  '/videos/Kiss Kiss Bang Bang_30s.mp4':    1.37, // 05 — Pop Rising (Omi Ba Pop / 2.40:1)
  '/videos/Yeshanagula_30s.mp4':            1.37, // 06 — Dance Hits (Yeshanagula / 2.40:1)
  '/videos/Sunflower_30s.mp4':             1.37, // 07 — Mood Booster (Sunflower / 2.39:1)
  '/videos/One Of The Girls_30s.mp4':       1.16, // 08 — Late Night (Roses / 2:1 Univisium)
  '/videos/God Mode_30s.mp4':               1.35, // Dev Special (God Mode / 2.40:1)
  "/videos/Baby Won't You Tell Me_30s.mp4": 1.35, // 11 — Top Telugu (Baby Don't You Love Me / 2.35:1)
  '/videos/Monica_30s.mp4':                1.37, // 12 — Top Tamil (Monica / 2.40:1)
  '/videos/Gehra Hua_30s.mp4':              1.38, // 13 — Top Hindi (Gehra Hua / 2.40:1)
  '/videos/Dynamite_30s.mp4':               1.35, // 14 — Top K-Pop (Dynamite / 2.35:1)
}

function getCategoryVideoScale(url: string | null): number {
  if (!url) return 1
  return CATEGORY_ZOOM_SCALES[url] ?? 1
}

// ── Full-Screen Category Video Background (Dual-Slot High-Performance Engine) ──
export function CategoryVideoBackground({ url }: { url?: string | null }) {
  // If url is passed as prop, use it (for backward compat), otherwise use the global store.
  const storeUrl = useUIStore((s) => s.activeCategoryVideo)
  const introComplete = useSongStore((s) => s.introComplete)
  const activeUrl = introComplete ? null : (url !== undefined ? url : storeUrl)

  const containerRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const visibleSlotIdxRef = useRef<number>(0)
  const activeUrlRef = useRef<string | null>(null)
  const userActivatedRef = useRef<boolean>(false)

  // (User Activation Listener removed since introAudioStore handles playback independently)

  // ── Create Dual-Slot Video Elements on Mount ─────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container || slotsRef.current[0]) return

    const createSlot = () => {
      const v = document.createElement('video')
      v.playsInline = true
      v.loop = true
      v.preload = 'auto'
      v.style.cssText = [
        'position:absolute',
        'top:0', 'left:0', 'width:100%', 'height:100%',
        'object-fit:cover',
        'display:none',
        'transform-origin:center center',
      ].join(';')
      container.appendChild(v)
      return v
    }

    slotsRef.current = [createSlot(), createSlot()]

    return () => {
      slotsRef.current.forEach(v => {
        if (v) {
          v.pause()
          v.removeAttribute('src')
          v.load()
          v.remove()
        }
      })
      slotsRef.current = [null, null]
    }
  }, [])

  // ── Handle Video URL Changes (Wait-for-Ready Crossfade Engine) ──
  useEffect(() => {
    const [slot0, slot1] = slotsRef.current
    if (!slot0 || !slot1) return

    activeUrlRef.current = activeUrl
    const targetUrl = activeUrl

    if (!targetUrl) {
      slot0.pause()
      slot1.pause()
      slot0.style.display = 'none'
      slot1.style.display = 'none'
      return
    }

    const visibleIdx = visibleSlotIdxRef.current
    const visibleSlot = visibleIdx === 0 ? slot0 : slot1
    const hiddenSlot = visibleIdx === 0 ? slot1 : slot0

    // 1. If the visible slot is ALREADY the target URL
    if (visibleSlot.getAttribute('data-src') === targetUrl) {
      if (visibleSlot.paused) {
        visibleSlot.muted = true
        visibleSlot.play().catch(() => {})
      }
      visibleSlot.style.display = 'block'
      return
    }

    // 2. If the hidden slot is ALREADY the target URL (was buffering or cached)
    if (hiddenSlot.getAttribute('data-src') === targetUrl && hiddenSlot.src) {
      visibleSlotIdxRef.current = visibleIdx === 0 ? 1 : 0
      
      hiddenSlot.muted = true
      hiddenSlot.play().catch(() => {})
      
      hiddenSlot.style.display = 'block'
      visibleSlot.pause()
      visibleSlot.style.display = 'none'
      return
    }

    // 3. New URL: Load into the hidden slot.
    // Mute/pause the visible slot immediately so its audio doesn't overlap while we buffer the new one,
    // BUT leave it display: block so the user sees a freeze frame instead of a black screen!
    visibleSlot.pause()

    hiddenSlot.setAttribute('data-src', targetUrl)
    hiddenSlot.src = targetUrl
    hiddenSlot.style.transform = `translate3d(0,0,0) scale(${getCategoryVideoScale(targetUrl)})`
    hiddenSlot.style.display = 'none'

    const onReady = () => {
      hiddenSlot.removeEventListener('canplay', onReady)
      
      // Staleness check
      if (activeUrlRef.current !== targetUrl) {
        hiddenSlot.pause()
        hiddenSlot.style.display = 'none'
        return
      }

      // Crossfade: Update state and swap visibility
      visibleSlotIdxRef.current = visibleIdx === 0 ? 1 : 0
      hiddenSlot.style.display = 'block'
      visibleSlot.pause()
      visibleSlot.style.display = 'none'
    }

    hiddenSlot.addEventListener('canplay', onReady, { once: true })

    // Start playing hidden slot (muted) so it's ready as soon as canplay fires
    hiddenSlot.muted = true
    hiddenSlot.play().catch(() => {})

    return () => {
      hiddenSlot.removeEventListener('canplay', onReady)
    }
  }, [activeUrl])

  const isAnyActive = Boolean(activeUrl)

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[1] pointer-events-none overflow-hidden bg-black transition-opacity duration-300 ${isAnyActive ? 'opacity-100' : 'opacity-0'}`}
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
    />
  )
}
