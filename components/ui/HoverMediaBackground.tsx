'use client'
import { bindBeatMotion } from '@/lib/beatMotion'
import { useChartTransition } from '@/store/chartTransitionStore'
import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useSongStore } from '@/store/songStore'
import { INTRO_MEDIA_MANIFEST } from '@/lib/introMediaManifest'
import { HoverVideoPool } from '@/lib/hoverVideoPool'
import { measurePicture, coverScale, type PictureBox } from '@/lib/videoCrop'

// Where the picture sits inside each file (some MP4s have black bars burned in). Measured once per file.
const pictureCache = new Map<string, PictureBox>([
  // This clip opens with a full-frame title card, then changes to cinema footage
  // at y=138..941 inside its 1920x1080 frame. Opening-frame detection misses those
  // later bars (and the logo in the lower bar). Use the footage area throughout
  // so the background stays covered without changing zoom at scene cuts.
  ['/videos/Yeshanagula_30s.mp4', { w: 1, h: 804 / 1080 }],
])

// Original MP4 audio and video stay on the same element for synchronized playback.
export default function HoverMediaBackground() {
  const rawVibe = useUIStore(s => s.hoveredVibe)
  const active = useSongStore(s => !s.introComplete || s.isChangingVibe)
  const vibe = active ? rawVibe : null
  const homepage = useSongStore(s => !s.introComplete)
  const phase = useChartTransition(s => s.phase)
  const homepageRef = useRef(false)
  const beatRef = useRef<HTMLDivElement>(null)
  const stopBeat = useRef<(() => void) | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const poolRef = useRef<HoverVideoPool | null>(null)

  useEffect(() => {
    homepageRef.current = homepage && phase === 'idle'
    stopBeat.current?.(); stopBeat.current = null
    const video = videoRef.current
    if (homepageRef.current && video?.style.opacity === '1' && beatRef.current) stopBeat.current = bindBeatMotion(beatRef.current, video, 2)
    return () => { stopBeat.current?.(); stopBeat.current = null }
  }, [homepage, phase])

  useEffect(() => {
    const pool = new HoverVideoPool()
    poolRef.current = pool
    return () => { pool.dispose(); poolRef.current = null }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const pool = poolRef.current
    if (!container || !pool) return
    container.style.opacity = '0'
    container.style.zIndex = '-10'
    videoRef.current = null
    if (!active) { pool.dispose(); return }
    const source = vibe ? INTRO_MEDIA_MANIFEST[vibe]?.fullMp4 : null
    if (!source) return

    let cancelled = false
    const video = pool.get(source)
    videoRef.current = video
    video.className = 'absolute inset-0 w-full h-full object-cover'
    video.style.opacity = '0'
    const wrapper = beatRef.current!
    if (video.parentElement !== wrapper) wrapper.appendChild(video)
    let picture: PictureBox | null = pictureCache.get(source) ?? null
    const applyCrop = () => {
      const scale = picture ? coverScale(picture, video.videoWidth, video.videoHeight, window.innerWidth, window.innerHeight) : 1
      video.style.transform = scale > 1 ? `scale(${scale.toFixed(3)})` : ''
    }
    const reveal = () => {
      if (cancelled) return
      applyCrop()
      video.style.opacity = '1'
      container.style.zIndex = '1'
      container.style.opacity = '1'
      if (homepageRef.current && !stopBeat.current) stopBeat.current = bindBeatMotion(wrapper, video, 2)
    }
    const playing = () => {
      if (cancelled) return
      if (picture) { reveal(); return }
      // A single small sample is synchronous: show the first frame immediately.
      // Refine across later frames without hiding already-playing audio/video.
      void measurePicture(video, () => cancelled, 1).then(box => {
        if (cancelled) return
        picture = box
        reveal()
        void measurePicture(video, () => cancelled).then(refined => {
          if (cancelled || !refined) return
          picture = refined
          pictureCache.set(source, refined)
          applyCrop()
        })
      })
    }
    window.addEventListener('resize', applyCrop)
    video.addEventListener('playing', playing, { once: true })
    video.preload = 'auto'
    if (video.readyState >= 1) video.currentTime = 0
    video.volume = 1
    video.muted = !navigator.userActivation?.hasBeenActive
    const play = () => {
      void video.play().catch((error: unknown) => {
        if (cancelled) return
        if ((error as { name?: string })?.name === 'NotAllowedError') {
          video.muted = true
          void video.play().catch(() => {})
        }
      })
    }
    const onVisibility = () => {
      if (document.hidden) video.pause()
      else play()
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) play()
    return () => {
      cancelled = true
      stopBeat.current?.(); stopBeat.current = null
      video.removeEventListener('playing', playing)
      window.removeEventListener('resize', applyCrop)
      document.removeEventListener('visibilitychange', onVisibility)
      pool.stop(source)
      videoRef.current = null
    }
  }, [vibe, active])

  useEffect(() => {
    const enableSound = () => {
      const video = videoRef.current
      if (!video?.getAttribute('src') || document.hidden) return
      video.muted = false
      void video.play().catch(() => {})
    }
    window.addEventListener('pointerdown', enableSound, true)
    window.addEventListener('keydown', enableSound, true)
    return () => {
      window.removeEventListener('pointerdown', enableSound, true)
      window.removeEventListener('keydown', enableSound, true)
    }
  }, [])

  return <div ref={containerRef} aria-hidden="true"
    className="fixed inset-0 pointer-events-none overflow-hidden"
    style={{ opacity: 0, zIndex: -10, contain: 'strict' }}>
    <div ref={beatRef} className="absolute inset-0" style={{ transform: 'translate3d(0,0,0) scale(1)' }} />
  </div>
}
