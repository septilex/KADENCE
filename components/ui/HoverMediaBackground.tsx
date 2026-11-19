'use client'
import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useSongStore } from '@/store/songStore'
import { INTRO_MEDIA_MANIFEST } from '@/lib/introMediaManifest'
import { measurePicture, coverScale, type PictureBox } from '@/lib/videoCrop'

// Where the picture sits inside each file (some MP4s have black bars burned in). Measured once per file.
const pictureCache = new Map<string, PictureBox>()

// One original full-length MP4 owns both video and audio. No short preview,
// re-encoding, seeking, crossfade, or overlapping audio sources.
export default function HoverMediaBackground() {
  const rawVibe = useUIStore(s => s.hoveredVibe)
  const active = useSongStore(s => !s.introComplete || s.isChangingVibe)
  const vibe = active ? rawVibe : null
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    setVisible(false)
    video.pause()
    video.removeAttribute('src')
    video.load()
    const source = vibe ? INTRO_MEDIA_MANIFEST[vibe]?.fullMp4 : null
    if (!source) return
    // Scale the video so the picture, not the file with its burned-in bars, covers the screen.
    let picture: PictureBox | null = pictureCache.get(source) ?? null
    const applyCrop = () => {
      const scale = picture ? coverScale(picture, video.videoWidth, video.videoHeight, window.innerWidth, window.innerHeight) : 1
      video.style.transform = scale > 1 ? `scale(${scale.toFixed(3)})` : ''
    }
    const playing = () => {
      if (cancelled) return
      setSoundEnabled(!video.muted)
      if (picture) { applyCrop(); setVisible(true); return }
      // First time this file plays: measure its bars (~0.3 s) before showing it, so it never
      // appears letterboxed. Show it anyway if measuring is slow.
      const reveal = setTimeout(() => { if (!cancelled) setVisible(true) }, 600)
      void measurePicture(video, () => cancelled).then((box) => {
        clearTimeout(reveal)
        if (cancelled) return
        if (box) { picture = box; pictureCache.set(source, box); applyCrop() }
        setVisible(true)
      })
    }
    window.addEventListener('resize', applyCrop)
    const volume = () => { if (!cancelled) setSoundEnabled(!video.muted) }
    video.addEventListener('playing', playing)
    video.addEventListener('volumechange', volume)
    video.src = source
    video.volume = 1
    video.muted = false
    video.load()
    void video.play().catch((error: unknown) => {
      if (cancelled) return
      if ((error as { name?: string })?.name === 'NotAllowedError') {
        video.muted = true
        setSoundEnabled(false)
        void video.play().catch(() => {})
      }
    })
    return () => {
      cancelled = true
      video.removeEventListener('playing', playing)
      video.removeEventListener('volumechange', volume)
      window.removeEventListener('resize', applyCrop)
      video.style.transform = ''
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [vibe])

  useEffect(() => {
    const enableSound = () => {
      const video = videoRef.current
      if (!video?.getAttribute('src')) return
      video.muted = false
      void video.play().then(() => setSoundEnabled(true)).catch(() => setSoundEnabled(false))
    }
    window.addEventListener('click', enableSound)
    window.addEventListener('keydown', enableSound)
    return () => {
      window.removeEventListener('click', enableSound)
      window.removeEventListener('keydown', enableSound)
    }
  }, [])

  return <>
    {active && vibe && !soundEnabled && <button
      className="fixed bottom-5 right-5 z-[110] pointer-events-auto rounded-full border border-white/30 bg-black/80 px-4 py-2 text-sm text-white"
    >Enable sound</button>}
    <div className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ opacity: visible ? 1 : 0, zIndex: visible ? 1 : -10, transition: 'opacity 150ms ease' }}>
      <video ref={videoRef} playsInline loop preload="auto"
        className="absolute inset-0 w-full h-full object-cover" />
    </div>
  </>
}
