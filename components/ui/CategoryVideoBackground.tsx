'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'

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
  const activeUrl = url !== undefined ? url : storeUrl

  const containerRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const activeSlotIdxRef = useRef<number>(0)
  const activeUrlRef = useRef<string | null>(null)
  const userActivatedRef = useRef<boolean>(false)

  // ── Global User Activation Listener for Instant Audio Unlocking ──────────
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).userActivation?.hasBeenActive) {
      userActivatedRef.current = true
    }

    const unlockAudio = () => {
      userActivatedRef.current = true
      const activeSlot = slotsRef.current[activeSlotIdxRef.current]
      if (activeSlot && !activeSlot.paused && activeSlot.muted) {
        activeSlot.muted = false
        activeSlot.volume = 1.0
      }
      window.removeEventListener('pointerdown', unlockAudio, true)
      window.removeEventListener('keydown', unlockAudio, true)
      window.removeEventListener('touchstart', unlockAudio, true)
    }

    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true })
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true })
    window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio, true)
      window.removeEventListener('keydown', unlockAudio, true)
      window.removeEventListener('touchstart', unlockAudio, true)
    }
  }, [])

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

  // ── Handle Video URL Changes (Immediate, Authoritative, 0 Competing Decoders) ──
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

    const currentIdx = activeSlotIdxRef.current
    const currentSlot = currentIdx === 0 ? slot0 : slot1
    const nextIdx = currentIdx === 0 ? 1 : 0
    const nextSlot = nextIdx === 0 ? slot0 : slot1

    if (currentSlot.getAttribute('data-src') === targetUrl && !currentSlot.paused) {
      return
    }

    activeSlotIdxRef.current = nextIdx
    nextSlot.setAttribute('data-src', targetUrl)
    nextSlot.src = targetUrl
    nextSlot.style.transform = `translate3d(0,0,0) scale(${getCategoryVideoScale(targetUrl)})`
    nextSlot.currentTime = 0

    const hasActivation = userActivatedRef.current || (typeof navigator !== 'undefined' && (navigator as any).userActivation?.hasBeenActive)

    if (hasActivation) {
      nextSlot.muted = false
      nextSlot.volume = 1.0
      nextSlot.play().catch(() => {
        if (activeUrlRef.current !== targetUrl) return
        nextSlot.muted = true
        nextSlot.play().catch(() => {})
      })
    } else {
      nextSlot.muted = false
      nextSlot.volume = 1.0
      const p = nextSlot.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (activeUrlRef.current !== targetUrl) return
          nextSlot.muted = true
          nextSlot.play().catch(() => {})
        })
      }
    }

    nextSlot.style.display = 'block'
    currentSlot.pause()
    currentSlot.style.display = 'none'
    currentSlot.removeAttribute('src')
    currentSlot.load()
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
