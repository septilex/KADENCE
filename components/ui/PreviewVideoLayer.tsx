'use client'
import { useEffect, useRef } from 'react'
import { SongNode } from '@/lib/types'
import { useSongStore } from '@/store/songStore'

interface PreviewVideoLayerProps {
  song: SongNode | null
}

const PRELOAD_COUNT = 32

export function PreviewVideoLayer({ song }: PreviewVideoLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const songs = useSongStore(state => state.songs)
  const poolRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const activeVideoRef = useRef<HTMLVideoElement | null>(null)
  const activeUrlRef = useRef<string | null>(null)
  
  // Removed the aggressive 32-video preload loop.
  // It was requesting 32 non-existent /videos/${s.id}.mp4 files concurrently,
  // causing 32 parallel 404 HTTP requests that exhausted the browser's connection limit
  // and completely blocked all audio and texture requests for 30-40 seconds.

  // Handle URL changes imperatively
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Since track-specific videos (by ID) do not exist in the public/videos folder,
    // we bypass the video element creation entirely. This prevents a 404 network request
    // from firing on every hover, which would otherwise violate the zero-network-request-on-hover rule.
    // The layer will simply act as a cinematic dark overlay when a track is hovered.
    
    if (activeVideoRef.current) {
        const v = activeVideoRef.current
        v.style.opacity = '0'
        const t = setTimeout(() => {
             v.pause()
        }, 500)
        return () => clearTimeout(t)
    }

  }, [song])

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 z-[5] pointer-events-none transition-colors duration-500 ${song ? 'bg-black/30' : 'bg-transparent'}`} 
    />
  )
}
