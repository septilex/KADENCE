'use client'

import { useEffect, useRef } from 'react'
import { useSongStore } from '@/store/songStore'
import { useChartHover } from '@/hooks/useChartHover'

const CATEGORY_ZOOM_SCALES: Record<string, number> = {
  '/videos/Kiss Kiss Bang Bang_30s.mp4':    1.37, 
  '/videos/Yeshanagula_30s.mp4':            1.37, 
  '/videos/Sunflower_30s.mp4':              1.37, 
  '/videos/One Of The Girls_30s.mp4':       1.16, 
  '/videos/God Mode_30s.mp4':               1.35, 
  "/videos/Baby Won't You Tell Me_30s.mp4": 1.35, 
  '/videos/Monica_30s.mp4':                 1.37, 
  '/videos/Gehra Hua_30s.mp4':              1.38, 
  '/videos/Dynamite_30s.mp4':               1.35, 
}

function getCategoryVideoScale(url: string | null): number {
  if (!url) return 1
  return CATEGORY_ZOOM_SCALES[url] ?? 1
}

export function HoverMediaBackground() {
  const introComplete = useSongStore((s) => s.introComplete)
  const { activeVideoUrl } = useChartHover()

  // If intro is complete, we don't play hover media
  const activeUrl = introComplete ? null : activeVideoUrl

  const videoRef = useRef<HTMLVideoElement>(null)
  const currentUrlRef = useRef<string | null>(null)
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    currentUrlRef.current = activeUrl

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }

    if (activeUrl) {
      const scale = getCategoryVideoScale(activeUrl)
      video.style.transform = `translate3d(0,0,0) scale(${scale})`
      
      if (video.getAttribute('src') !== activeUrl) {
        video.src = activeUrl
      }
      
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Race-safety: If the active URL changed while waiting for play() to resolve, 
          // and somehow we are not on activeUrl anymore, ensure we pause.
          // Note: Browser usually aborts play automatically when src changes, but this is a fail-safe.
          if (currentUrlRef.current !== activeUrl) {
            video.pause()
          }
        }).catch((e) => {
          if (e.name !== 'AbortError') {
            console.error('[HoverMediaBackground] play failed', e)
          }
        })
      }
    } else {
      // Delay cleanup to allow opacity fade to finish (300ms)
      cleanupTimeoutRef.current = setTimeout(() => {
        if (currentUrlRef.current === null) {
          video.pause()
          video.removeAttribute('src')
          video.load()
        }
      }, 300)
    }
  }, [activeUrl])

  const isAnyActive = Boolean(activeUrl)

  return (
    <div
      className={`fixed inset-0 z-[1] pointer-events-none overflow-hidden bg-black transition-opacity duration-300 ${isAnyActive ? 'opacity-100' : 'opacity-0'}`}
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
    >
      <video
        ref={videoRef}
        playsInline
        loop
        preload="auto"
        muted={false}
        className="absolute top-0 left-0 w-full h-full object-cover"
        style={{ transformOrigin: 'center center' }}
      />
    </div>
  )
}
