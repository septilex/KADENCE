'use client'
import { useEffect, useRef, useCallback, useState, memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useSongStore } from '@/store/songStore'
import { useUIStore } from '@/store/uiStore'
import { usePerformanceStore } from '@/store/performanceStore'
import { SongNode, Vibe } from '@/lib/types'
import { IntroScreen } from '@/components/ui/IntroScreen'
import { SearchPanel } from '@/components/ui/SearchPanel'
import { SongDetail } from '@/components/ui/SongDetail'
import { CinematicBackground } from '@/components/ui/CinematicBackground'
import { Navbar } from '@/components/ui/Navbar'
import { HeroBackgroundVideo } from '@/components/ui/HeroBackgroundVideo'
import HoverMediaBackground from '@/components/ui/HoverMediaBackground'
import { PreviewVideoLayer } from '@/components/ui/PreviewVideoLayer'
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer'
import { useAudioStore } from '@/store/audioStore'
import { ChangeVibeOverlay } from '@/components/ui/ChangeVibeOverlay'
import { atlasManager } from '@/lib/atlasManager'
import { vibeService } from '@/lib/vibeService'
import { logAudioDebug } from '@/lib/audioDebug'
import { getFirstTrackForVibe } from '@/lib/signatureSongs'

// Dynamic import for 3D (no SSR)
const Universe = dynamic(
  () => import('@/components/universe/Universe').then(m => m.Universe),
  { ssr: false }
)

// NOTE: The client-side cache is now managed by vibeService (lib/vibeService.ts).
// vibeService provides: in-flight dedup + prefetch-on-hover + 30-min TTL cache.

// ── Memoized hover tooltip — only re-renders when hoveredSong/selectedSong/introComplete change ──
// Extracting this prevents the entire Home from re-rendering on every hover state change.
const HoverTooltip = memo(function HoverTooltip() {
  const hoveredSong   = useSongStore(state => state.hoveredSong)
  const selectedSong  = useSongStore(state => state.selectedSong)
  const introComplete = useSongStore(state => state.introComplete)

  return (
    <AnimatePresence>
      {hoveredSong && introComplete && !selectedSong && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
        >
          <div
            className="px-5 py-3.5 rounded-2xl bg-black/75 border border-white/10 backdrop-blur-md flex items-center gap-4 max-w-sm shadow-[0_15px_40px_rgba(0,0,0,0.65)] transition-all duration-300 hover:border-white/20"
            style={{
              boxShadow: hoveredSong.color ? `0 10px 30px -10px ${hoveredSong.color}25, 0 15px 40px rgba(0,0,0,0.65)` : undefined
            }}
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
              <img
                src={hoveredSong.albumArt}
                alt={hoveredSong.name}
                className="w-full h-full object-cover"
              />
              {hoveredSong.previewUrl && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-white text-sm font-bold truncate tracking-tight">{hoveredSong.name}</p>
              <p className="text-white/60 text-xs truncate mt-0.5 font-medium">{hoveredSong.artist}</p>
              <p className="text-white/35 text-[10px] truncate mt-0.5 font-medium uppercase tracking-wider">
                {hoveredSong.album}
              </p>
            </div>
            
            <a
              href={hoveredSong.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#ea4cc0] hover:text-white flex items-center justify-center text-white/70 transition-all duration-300 flex-shrink-0 hover:scale-105"
              title="Open in iTunes"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default function Home() {
  // Use targeted selectors to prevent full-page re-renders on hover state changes
  const songs = useSongStore(s => s.songs)
  const loadingProgress = useSongStore(s => s.loadingProgress)
  const introComplete = useSongStore(s => s.introComplete)
  const currentVibe = useSongStore(s => s.currentVibe)
  const isRefreshing = useSongStore(s => s.isRefreshing)
  const isChangingVibe = useSongStore(s => s.isChangingVibe)
  
  const setSongs = useSongStore(s => s.setSongs)
  const selectSong = useSongStore(s => s.selectSong)
  const hoverSong = useSongStore(s => s.hoverSong)
  const setLoading = useSongStore(s => s.setLoading)
  const setIntroComplete = useSongStore(s => s.setIntroComplete)
  const setVibe = useSongStore(s => s.setVibe)
  const setRefreshing = useSongStore(s => s.setRefreshing)
  const setChangingVibe = useSongStore(s => s.setChangingVibe)

  const selectedSong = useSongStore(state => state.selectedSong)

  const { isSearchOpen, setSearchOpen } = useUIStore()
  const { setFps } = usePerformanceStore()
  const { playUrl } = useAudioStore()
  const [previewSong, setPreviewSong] = useState<SongNode | null>(null)
  const fpsRef = useRef(60)

  useEffect(() => {
    logAudioDebug('app mounted')
  }, [])

  /**
   * Decoupled Universe Entry / Vibe Switch:
   * Architecture:
   * 1. STAGE 1 (AUDIO PRIORITY): Immediately stop preview videos, resolve the first
   *    playable track synchronously (0ms in-memory), and call playUrl() directly in the
   *    user's click gesture context. Audio request starts immediately on the network.
   * 2. STAGE 2 (INDEPENDENT VISUAL PIPELINE): In parallel, track metadata fetches,
   *    critical artwork (32 tiles) loads into texture atlas, WebGL warms up, and
   *    universe transition executes. Visual and audio lifecycles run completely independently.
   */
  const handleVibeSelect = useCallback((vibe: Vibe) => {
    logAudioDebug('vibe select / enter clicked', vibe)

    // ── STAGE 1: IMMEDIATE FIRST TRACK AUDIO PRIORITY (0ms synchronous resolution) ──

    // Resolve first playable track synchronously from in-memory signature data
    const firstTrack = getFirstTrackForVibe(vibe)
    if (firstTrack?.previewUrl) {
      logAudioDebug('first track identified (0ms in-memory)', {
        name: firstTrack.name,
        artist: firstTrack.artist,
        previewUrl: firstTrack.previewUrl,
      })
      logAudioDebug('audio URL resolved', firstTrack.previewUrl)
      // Trigger audio play immediately using the active click gesture context
      playUrl(firstTrack.previewUrl)
    }

    // ── STAGE 2: INDEPENDENT PARALLEL VISUAL INITIALIZATION ───────────────
    // Metadata fetch, 32 critical artwork downloads, and WebGL warmup run in parallel
    // without blocking first track audio playback.
    (async () => {
      setVibe(vibe)
      setLoading(true, 5)

      try {
        logAudioDebug('tracks request started', vibe)
        const t0 = performance.now()
        const allFetched = await vibeService.fetchVibeSongs(vibe, false)
        const t1 = performance.now()
        logAudioDebug(`[PERF] JSON response received in ${(t1 - t0).toFixed(1)}ms`, { 
          count: allFetched?.length, 
          firstTrackName: allFetched?.[0]?.name 
        })

        if (!allFetched || allFetched.length === 0) {
          console.warn('[KADENCE] No songs returned for vibe:', vibe, '— completing intro anyway')
          setLoading(false, 0)
          setIntroComplete(true)
          return
        }

        // IMMEDIATE AUDIO PRELOAD DISPATCH (Decoupled from WebGL)
        const urlsToPreload = allFetched.map(s => s.previewUrl).filter(Boolean) as string[]
        useAudioStore.getState().setPreloadUrls(urlsToPreload)
        logAudioDebug(`[PERF] Dispatched ${urlsToPreload.length} URLs for preloading at ${(performance.now() - t0).toFixed(1)}ms`)

        // 10. Do not block setSongs() or audio initialization behind any expensive visual/WebGL operation.
        setSongs(allFetched)
        logAudioDebug('setSongs called immediately after fetch')

        // Fallback: if in-memory signature track had no audio URL, use first API track
        if (!firstTrack?.previewUrl && allFetched[0]?.previewUrl) {
          playUrl(allFetched[0].previewUrl)
        }

        setLoading(true, 35)

        // Phase 2: Synchronized Critical Artwork (direct CDN, 256x256, real progress tracking)
        logAudioDebug('artwork preparation started (32 critical tiles)')
        await atlasManager.prepareCriticalVibe(allFetched, (ratio) => {
          const progress = Math.round(35 + ratio * 50)
          setLoading(true, progress)
        })
        logAudioDebug('artwork preparation finished')

        // Phase 3: Warm WebGL
        logAudioDebug('WebGL commit / warm started')
        setLoading(true, 92)

        // Wait two frames so React and Three.js commit the geometry & instances
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        setLoading(true, 100)

        // Fast transition — data is already loaded, no need to delay
        setTimeout(() => {
          setLoading(false, 100)
          setIntroComplete(true)
          logAudioDebug('introComplete set to true (universe active)')
          // Phase 4: Progressive background streaming (silent & non-blocking)
          logAudioDebug('startBackgroundLoading started (224 secondary tiles)')
          atlasManager.startBackgroundLoading(allFetched)
        }, 100)
      } catch (err) {
        console.error('[KADENCE] handleVibeSelect pipeline error:', err)
        // Ensure the UI never gets stuck — always complete the intro
        setLoading(false, 0)
        setIntroComplete(true)
      }
    })()
  }, [setVibe, setLoading, setSongs, setIntroComplete, selectSong, playUrl])

  // In-universe Vibe Switch pipeline
  // vibeService reuses any in-flight prefetch from ChangeVibeOverlay hover.
  const handleChangeVibe = useCallback(async (vibe: Vibe) => {
    if (vibe === currentVibe) return
    setRefreshing(true)
    setVibe(vibe)

    // Immediately resolve and play new vibe's first track
    const firstTrack = getFirstTrackForVibe(vibe)
    if (firstTrack?.previewUrl) {
      playUrl(firstTrack.previewUrl)
    }

    const newSongs = await vibeService.fetchVibeSongs(vibe, false)
    if (newSongs.length > 0) {
      // Immediate Preload Dispatch
      const urlsToPreload = newSongs.map(s => s.previewUrl).filter(Boolean) as string[]
      useAudioStore.getState().setPreloadUrls(urlsToPreload)
      
      // Decouple from WebGL
      setSongs(newSongs)
      
      if (!firstTrack?.previewUrl && newSongs[0]?.previewUrl) {
        playUrl(newSongs[0].previewUrl)
      }
      
      await atlasManager.prepareCriticalVibe(newSongs, () => {})
      atlasManager.startBackgroundLoading(newSongs)
    }

    setTimeout(() => setRefreshing(false), 200)
  }, [currentVibe, setSongs, setRefreshing, setVibe, selectSong, playUrl])

  // ── "Refresh Tracks" flow: force-refresh from API, bypass cache ─────────────
  const handleRefresh = useCallback(async () => {
    if (!currentVibe || isRefreshing) return
    setRefreshing(true)

    // forceRefresh=true bypasses client cache and fetches fresh data from the API
    const freshSongs = await vibeService.fetchVibeSongs(currentVibe, true)

    if (freshSongs.length > 0) {
      // Immediate Preload Dispatch
      const urlsToPreload = freshSongs.map(s => s.previewUrl).filter(Boolean) as string[]
      useAudioStore.getState().setPreloadUrls(urlsToPreload)

      await atlasManager.prepareCriticalVibe(freshSongs, () => {})
      setSongs(freshSongs)
      atlasManager.startBackgroundLoading(freshSongs)
    }

    setTimeout(() => setRefreshing(false), 300)
  }, [currentVibe, isRefreshing, setRefreshing, setSongs])

  const handleSelectSong    = useCallback((song: SongNode | null) => {
    selectSong(song)
    if (song?.previewUrl) playUrl(song.previewUrl)
  }, [selectSong, playUrl])
  const handleCloseSong     = useCallback(() => selectSong(null), [selectSong])

  // ── Global Audio Sync ───────────────────────────────────────────────────
  // Extract target audio URL: hovered song takes preview precedence, falling back to selected song.
  // Audio playback is NOT blocked by introComplete or artwork loading!
  const targetAudioUrl = useSongStore((state) => {
    if (state.isChangingVibe) return null
    return state.hoveredSong?.previewUrl 
      ?? state.selectedSong?.previewUrl 
      ?? null
  })

  useEffect(() => {
    if (targetAudioUrl) {
      logAudioDebug('targetAudioUrl updated in page.tsx', targetAudioUrl)
      playUrl(targetAudioUrl)
    }
  }, [targetAudioUrl, playUrl])
  const handleSearchResults = useCallback((results: SongNode[]) => {
    if (results.length > 0) {
      // Use getState() to read current songs without adding songs to dependency array.
      // This prevents the callback from being recreated on every songs array change.
      const currentSongs = useSongStore.getState().songs
      const map = new Map(currentSongs.map((s: SongNode) => [s.id, s]))
      for (const res of results) {
        if (!map.has(res.id)) map.set(res.id, res)
      }
      setSongs(Array.from(map.values()))
    }
  }, [setSongs])

  const handleSearchSelect = useCallback(
    (song: SongNode) => { selectSong(song); setSearchOpen(false) },
    [selectSong, setSearchOpen],
  )

  return (
    <main className="fixed inset-0 bg-transparent overflow-hidden">
      <GlobalAudioPlayer />
      {/* Background Video Layer (Homepage Only) */}
      <HeroBackgroundVideo currentVibe={currentVibe} introComplete={introComplete} />
      
      {/* Zero-black-screen Hover MP4 Layer */}
      <HoverMediaBackground />
      
      {/* Song Preview Video Layer */}
      {introComplete && <PreviewVideoLayer song={previewSong} />}

      {/* 3D Universe */}
      <motion.div
        className="absolute inset-0"
        animate={{ 
          opacity: selectedSong ? 0 : (isRefreshing ? 0.8 : 1),
          filter: selectedSong ? 'blur(10px) brightness(0)' : (isRefreshing ? 'blur(12px) brightness(0.8)' : 'none')
        }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Universe
          songs={songs}
          selectedSong={selectedSong}
          currentVibe={currentVibe}
          onHover={hoverSong}
          onSelect={handleSelectSong}
          onPreview={setPreviewSong}
          isDetailOpen={!!selectedSong}
          isRefreshing={isRefreshing}
          onFps={(f) => { fpsRef.current = f; setFps(f) }}
        />
      </motion.div>

      {/* Vignette (Only for Universe) */}
      {introComplete && !selectedSong && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(5,5,8,0.45)_100%)] z-10" 
        />
      )}

      {/* Cinematic Background Layer */}
      <CinematicBackground song={selectedSong} />

      {/* UI Layer */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <AnimatePresence>
          {!introComplete && (
            <IntroScreen
              loadingProgress={loadingProgress}
              onVibeSelect={handleVibeSelect}
            />
          )}
        </AnimatePresence>

        {introComplete && (
          <div className="pointer-events-auto">
            <Navbar
              songCount={songs.length}
              currentVibe={currentVibe}
              onSearchOpen={() => setSearchOpen(true)}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              onChangeVibeClick={() => setChangingVibe(true)}
              isSongSelected={!!selectedSong}
            />
            <SearchPanel
              isOpen={isSearchOpen}
              onOpen={() => setSearchOpen(true)}
              onClose={() => setSearchOpen(false)}
              onResults={handleSearchResults}
              onSelectResult={handleSearchSelect}
            />
            <SongDetail song={selectedSong} onClose={handleCloseSong} />
          </div>
        )}
      </div>

      {/* Change Vibe Fullscreen Glass Overlay */}
      <AnimatePresence>
        {isChangingVibe && (
          <ChangeVibeOverlay
            currentVibe={currentVibe}
            onSelectVibe={handleChangeVibe}
            onClose={() => setChangingVibe(false)}
          />
        )}
      </AnimatePresence>

      {/* Hover Tooltip — rendered by isolated memo component to prevent full-page re-renders */}
      <HoverTooltip />
    </main>
  )
}
