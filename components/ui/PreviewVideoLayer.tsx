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
  
  // Maintain the Ready Pool for videos
  useEffect(() => {
    if (typeof window === 'undefined') return
    const topSongs = songs.slice(0, PRELOAD_COUNT)
    const newPool = new Map<string, HTMLVideoElement>()
    
    topSongs.forEach(s => {
      const vidUrl = `/videos/${s.id}.mp4`
      let v = poolRef.current.get(vidUrl)
      if (!v) {
        v = document.createElement('video')
        v.playsInline = true
        v.loop = true
        v.muted = true
        v.preload = 'auto' // Immediately start downloading
        v.src = vidUrl
        v.setAttribute('data-src', vidUrl)
        v.style.cssText = [
          'position:absolute',
          'top:0', 'left:0', 'width:100%', 'height:100%',
          'object-fit:cover',
          'opacity:0',
          'mix-blend-mode:screen',
          'transition:opacity 0.5s ease-in-out',
          'pointer-events:none'
        ].join(';')
        v.load()
      }
      newPool.set(vidUrl, v)
    })
    
    // Cleanup old items
    for (const [url, v] of poolRef.current.entries()) {
      if (!newPool.has(url) && v !== activeVideoRef.current) {
        v.pause()
        v.removeAttribute('src')
        v.load()
        if (v.parentNode) {
          v.parentNode.removeChild(v)
        }
      }
    }
    
    poolRef.current = newPool
  }, [songs])

  // Handle URL changes imperatively
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const targetUrl = song ? `/videos/${song.id}.mp4` : null
    activeUrlRef.current = targetUrl

    if (!targetUrl) {
      if (activeVideoRef.current) {
        const v = activeVideoRef.current
        v.style.opacity = '0'
        const t = setTimeout(() => {
          if (!activeUrlRef.current) {
             v.pause()
          }
        }, 500)
        return () => clearTimeout(t)
      }
      return
    }

    const previousVideo = activeVideoRef.current
    if (previousVideo && previousVideo.getAttribute('data-src') === targetUrl && !previousVideo.paused) {
      previousVideo.style.opacity = '0.45'
      return
    }

    let nextVideo = poolRef.current.get(targetUrl)
    if (!nextVideo) {
       nextVideo = document.createElement('video')
       nextVideo.playsInline = true
       nextVideo.loop = true
       nextVideo.muted = true
       nextVideo.preload = 'auto'
       nextVideo.src = targetUrl
       nextVideo.setAttribute('data-src', targetUrl)
       nextVideo.style.cssText = [
          'position:absolute',
          'top:0', 'left:0', 'width:100%', 'height:100%',
          'object-fit:cover',
          'opacity:0',
          'mix-blend-mode:screen',
          'transition:opacity 0.5s ease-in-out',
          'pointer-events:none'
        ].join(';')
    }
    
    if (nextVideo.parentNode !== container) {
       container.appendChild(nextVideo)
    }

    activeVideoRef.current = nextVideo

    // Fade in
    if (nextVideo.readyState >= 3) {
       nextVideo.style.opacity = '0.45'
    } else {
       nextVideo.oncanplay = () => {
         if (activeUrlRef.current === targetUrl) {
           nextVideo.style.opacity = '0.45'
         }
       }
    }
    
    nextVideo.onerror = () => {
      console.log(`[Preview] No local video found for ${targetUrl}, gracefully skipping.`)
      nextVideo.style.opacity = '0'
    }

    // Play immediately
    const p = nextVideo.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => {})
    }

    // Fade out previous
    if (previousVideo && previousVideo !== nextVideo) {
       previousVideo.style.opacity = '0'
       const t = setTimeout(() => {
         if (activeVideoRef.current !== previousVideo) {
            previousVideo.pause()
            // If it's not in the pool anymore, remove it
            if (!poolRef.current.has(previousVideo.getAttribute('data-src') || '')) {
               previousVideo.removeAttribute('src')
               previousVideo.load()
               if (previousVideo.parentNode) previousVideo.parentNode.removeChild(previousVideo)
            }
         }
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
