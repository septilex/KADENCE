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
import { Navbar } from '@/components/ui/Navbar'
import { HeroBackgroundVideo } from '@/components/ui/HeroBackgroundVideo'
import { PreviewVideoLayer } from '@/components/ui/PreviewVideoLayer'
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer'
import { useAudioStore } from '@/store/audioStore'
import { ChangeVibeOverlay } from '@/components/ui/ChangeVibeOverlay'
import { atlasManager } from '@/lib/atlasManager'
import { vibeService } from '@/lib/vibeService'

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
            className="px-5 py-3.5 rounded-2xl bg-black/75 border border-white/10 backdrop-blur-2xl flex items-center gap-4 max-w-sm shadow-[0_15px_40px_rgba(0,0,0,0.65)] transition-all duration-300 hover:border-white/20"
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
                <path d="M21 2.9v10.9a4.8 4.8 0 0 0-2.5-.7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5V6.1l-9 1.8v8.9a4.8 4.8 0 0 0-2.5-.7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5V4.2L21 2.9z"/>
              </svg>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default function Home() {
  const {
    songs, isLoading, loadingProgress, introComplete,
    currentVibe, isRefreshing, isChangingVibe,
    setSongs, selectSong, hoverSong, setLoading, setIntroComplete, setVibe, setRefreshing, setChangingVibe,
  } = useSongStore()
  // selectedSong and hoveredSong are read via targeted selectors only where needed
  const selectedSong = useSongStore(state => state.selectedSong)
  const hoveredSong  = useSongStore(state => state.hoveredSong)

  const { isSearchOpen, setSearchOpen } = useUIStore()
  const { setFps } = usePerformanceStore()
  const [previewSong, setPreviewSong] = useState<SongNode | null>(null)
  const fpsRef = useRef(60)

  /**
   * Gated Universe Entry / Vibe Switch
   * Synchronized pipeline:
   * 1. Fetch metadata via vibeService (reuses any in-flight prefetch or cached result)
   *    → If hover-prefetch already completed: step 1 resolves instantly (0ms).
   * 2. Direct Apple CDN loading & canvas painting of critical 64 covers (35% → 85%)
   *    → If browser HTTP cache already primed from hover prefetch: very fast.
   * 3. WebGL commit & single GPU texture flush (85% → 100%)
   * 4. Seamless transition with 100% stable, populated tiles
   * 5. Progressive background streaming of secondary covers
   */
  const handleVibeSelect = useCallback(async (vibe: Vibe) => {
    setVibe(vibe)
    setLoading(true, 5)

    try {
      // Phase 1: Fetch metadata — vibeService deduplicates any in-flight prefetch.
      // If the user hovered long enough for prefetch to finish, this is instant.
      const allFetched = await vibeService.fetchVibeSongs(vibe, false)
      if (!allFetched || allFetched.length === 0) {
        console.warn('[KADENCE] No songs returned for vibe:', vibe, '— completing intro anyway')
        setLoading(false, 0)
        setIntroComplete(true)
        return
      }
      setLoading(true, 35)

      // Phase 2: Synchronized Critical Artwork (direct CDN, 256x256, real progress tracking)
      await atlasManager.prepareCriticalVibe(allFetched, (ratio) => {
        const progress = Math.round(35 + ratio * 50)
        setLoading(true, progress)
      })

      // Phase 3: Set songs and warm WebGL
      setSongs(allFetched)
      setLoading(true, 92)

      // Wait two frames so React and Three.js commit the geometry & instances
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      setLoading(true, 100)

      // Fast transition — data is already loaded, no need to delay
      setTimeout(() => {
        setLoading(false, 100)
        setIntroComplete(true)
        // Phase 4: Progressive background streaming (silent & non-blocking)
        atlasManager.startBackgroundLoading(allFetched)
      }, 100)
    } catch (err) {
      console.error('[KADENCE] handleVibeSelect pipeline error:', err)
      // Ensure the UI never gets stuck — always complete the intro
      setLoading(false, 0)
      setIntroComplete(true)
    }
  }, [setVibe, setLoading, setSongs, setIntroComplete])

  // In-universe Vibe Switch pipeline
  // vibeService reuses any in-flight prefetch from ChangeVibeOverlay hover.
  const handleChangeVibe = useCallback(async (vibe: Vibe) => {
    if (vibe === currentVibe) return
    setRefreshing(true)
    setVibe(vibe)

    const newSongs = await vibeService.fetchVibeSongs(vibe, false)
    if (newSongs.length > 0) {
      await atlasManager.prepareCriticalVibe(newSongs, () => {})
      setSongs(newSongs)
      atlasManager.startBackgroundLoading(newSongs)
    }

    setTimeout(() => setRefreshing(false), 200)
  }, [currentVibe, setSongs, setRefreshing, setVibe])

  // ── "Refresh Tracks" flow: force-refresh from API, bypass cache ─────────────
  const handleRefresh = useCallback(async () => {
    if (!currentVibe || isRefreshing) return
    setRefreshing(true)

    // forceRefresh=true bypasses client cache and fetches fresh data from the API
    const freshSongs = await vibeService.fetchVibeSongs(currentVibe, true)

    if (freshSongs.length > 0) {
      await atlasManager.prepareCriticalVibe(freshSongs, () => {})
      setSongs(freshSongs)
      atlasManager.startBackgroundLoading(freshSongs)
    }

    setTimeout(() => setRefreshing(false), 300)
  }, [currentVibe, isRefreshing, setRefreshing, setSongs])

  const handleSelectSong    = useCallback((song: SongNode) => selectSong(song), [selectSong])
  const handleCloseSong     = useCallback(() => selectSong(null), [selectSong])

  // ── Global Audio Sync ───────────────────────────────────────────────────
  const { playUrl } = useAudioStore()
  
  useEffect(() => {
    // Sync Universe selections to global audio player instantly.
    if (introComplete && !isChangingVibe) {
      if (selectedSong) {
        playUrl(selectedSong.previewUrl || null)
      } else {
        playUrl(hoveredSong?.previewUrl || null)
      }
    }
  }, [selectedSong, hoveredSong, introComplete, isChangingVibe, playUrl])
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

      {/* Song Preview Video Layer */}
      {introComplete && <PreviewVideoLayer song={previewSong} />}

      {/* 3D Universe */}
      <motion.div
        className="absolute inset-0"
        animate={{ 
          opacity: isRefreshing ? 0.8 : 1,
          filter: isRefreshing ? 'blur(12px) brightness(0.8)' : 'blur(0px) brightness(1)'
        }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Universe
          songs={songs}
          hoveredSong={hoveredSong}
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
      {introComplete && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,5,8,0.7)_100%)] z-10" />
      )}

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
