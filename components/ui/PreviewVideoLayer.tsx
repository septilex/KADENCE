'use client'
import { useEffect, useRef, useState } from 'react'
import { SongNode } from '@/lib/types'

interface PreviewVideoLayerProps {
  song: SongNode | null
}

export function PreviewVideoLayer({ song }: PreviewVideoLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const activeSlotIdxRef = useRef<number>(0)
  const activeUrlRef = useRef<string | null>(null)
  
  // Create Dual-Slot Video Elements on Mount
  useEffect(() => {
    const container = containerRef.current
    if (!container || slotsRef.current[0]) return

    const createSlot = () => {
      const v = document.createElement('video')
      v.playsInline = true
      v.loop = true
      v.muted = true
      v.preload = 'auto'
      v.style.cssText = [
        'position:absolute',
        'top:0', 'left:0', 'width:100%', 'height:100%',
        'object-fit:cover',
        'opacity:0',
        'mix-blend-mode:screen',
        'transition:opacity 0.5s ease-in-out',
        'pointer-events:none'
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

  // Handle URL changes imperatively (instant switch, no timeouts)
  useEffect(() => {
    const [slot0, slot1] = slotsRef.current
    if (!slot0 || !slot1) return

    const targetUrl = song ? `/videos/${song.id}.mp4` : null
    activeUrlRef.current = targetUrl

    if (!targetUrl) {
      // Fade out both slots if closing
      slot0.style.opacity = '0'
      slot1.style.opacity = '0'
      
      // Stop playback after fade finishes to free resources
      const t = setTimeout(() => {
        if (!activeUrlRef.current) {
          slot0.pause()
          slot1.pause()
        }
      }, 500)
      return () => clearTimeout(t)
    }

    const currentIdx = activeSlotIdxRef.current
    const currentSlot = currentIdx === 0 ? slot0 : slot1
    const nextIdx = currentIdx === 0 ? 1 : 0
    const nextSlot = nextIdx === 0 ? slot0 : slot1

    // If the target is already playing in the active slot, do nothing
    if (currentSlot.getAttribute('data-src') === targetUrl && !currentSlot.paused) {
      currentSlot.style.opacity = '0.45'
      return
    }

    // Switch active slot
    activeSlotIdxRef.current = nextIdx
    nextSlot.setAttribute('data-src', targetUrl)
    nextSlot.src = targetUrl
    nextSlot.currentTime = 0
    
    // Only fade in once the video has enough data to play, preventing black flashes
    nextSlot.oncanplay = () => {
      if (activeUrlRef.current === targetUrl) {
        nextSlot.style.opacity = '0.45'
      }
    }
    
    nextSlot.onerror = () => {
      // Gracefully skip missing MP4s
      console.log(`[Preview] No local video found for ${targetUrl}, gracefully skipping.`)
      nextSlot.style.opacity = '0'
    }

    // Play immediately. The browser will handle network queues and AbortErrors if overridden rapidly.
    const p = nextSlot.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => {}) // Ignore AbortError on rapid hover
    }

    // Fade out and pause the previous slot
    currentSlot.style.opacity = '0'
    const t = setTimeout(() => {
      if (activeSlotIdxRef.current !== currentIdx) {
        currentSlot.pause()
        currentSlot.removeAttribute('src')
        currentSlot.load()
      }
    }, 500)
    
    return () => clearTimeout(t)
  }, [song])

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 z-[5] pointer-events-none transition-colors duration-500 ${song ? 'bg-black/30' : 'bg-transparent'}`} 
    />
  )
}
