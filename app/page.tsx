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
const getAtlasManager = () => import('@/lib/atlasManager').then(m => m.atlasManager)
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
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
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
            
            <span className="text-xs text-white/50">Click to open</span>
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

  // Selector-only subscriptions: Home must not re-render on unrelated store writes
  // (e.g. intro hoveredVibe changes or audio state it does not render).
  const isSearchOpen = useUIStore(s => s.isSearchOpen)
  const setSearchOpen = useUIStore(s => s.setSearchOpen)
  const setFps = usePerformanceStore(s => s.setFps)
  const playUrl = useAudioStore(s => s.playUrl)
  const [previewSong, setPreviewSong] = useState<SongNode | null>(null)
  const fpsRef = useRef(60)

  useEffect(() => {
    logAudioDebug('app mounted')
  }, [])

  const loadRequest = useRef(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [introAttempt, setIntroAttempt] = useState(0)

  const loadChart = useCallback(async (vibe: Vibe, refresh = false) => {
    const request = ++loadRequest.current
    const previous = useSongStore.getState()
    const entering = !previous.introComplete
    const previousUrl = useAudioStore.getState().currentUrl
    useUIStore.getState().setHoveredVibe(null)
    setLoadError(null)
    setRefreshing(true)
    setLoading(true, 5)
    selectSong(null)
    hoverSong(null)
    const firstTrack = getFirstTrackForVibe(vibe)
    if (!refresh) playUrl(firstTrack?.previewUrl ?? null)
    try {
      const [newSongs, atlasManager] = await Promise.all([
        vibeService.fetchVibeSongs(vibe, refresh), getAtlasManager(),
      ])
      if (request !== loadRequest.current) return
      if (!newSongs.length) throw new Error('No tracks available')
      setLoading(true, 35)
      await atlasManager.prepareCriticalVibe(newSongs, ratio => {
        if (request === loadRequest.current) setLoading(true, Math.round(35 + ratio * 60))
      })
      if (request !== loadRequest.current) return
      // Commit metadata and its prepared artwork together. The old wall stays visible
      // during the fetch; a late request cannot replace a more recently chosen chart.
      setVibe(vibe)
      setSongs(newSongs)
      useAudioStore.getState().setPreloadUrls(newSongs.flatMap(s => s.previewUrl ? [s.previewUrl] : []))
      if (!refresh && !firstTrack?.previewUrl) playUrl(newSongs.find(s => s.previewUrl)?.previewUrl ?? null)
      setIntroComplete(true)
      void atlasManager.startBackgroundLoading(newSongs)
    } catch (error) {
      if (request !== loadRequest.current) return
      console.error('[KADENCE] Chart load failed:', error)
      setLoadError('This chart could not be loaded. Please try again or choose another chart.')
      playUrl(previousUrl)
      if (entering) setIntroAttempt(attempt => attempt + 1)
    } finally {
      if (request === loadRequest.current) {
        setLoading(false, 100)
        setRefreshing(false)
      }
    }
  }, [setSongs, setVibe, setLoading, setRefreshing, setIntroComplete, selectSong, hoverSong, playUrl])

  const handleVibeSelect = useCallback((vibe: Vibe) => { void loadChart(vibe) }, [loadChart])
  const handleChangeVibe = useCallback((vibe: Vibe) => {
    if (vibe !== useSongStore.getState().currentVibe) void loadChart(vibe)
  }, [loadChart])
  const handleRefresh = useCallback(() => {
    const state = useSongStore.getState()
    if (state.currentVibe && !state.isRefreshing) void loadChart(state.currentVibe, true)
  }, [loadChart])

  const handleSelectSong    = useCallback((song: SongNode | null) => {
    selectSong(song)
    if (song?.previewUrl) playUrl(song.previewUrl)
  }, [selectSong, playUrl])
  const handleCloseSong     = useCallback(() => selectSong(null), [selectSong])

  /** Leave the universe for the homepage. The loaded chart stays in memory, so choosing it
   *  again is instant; picking any chart on the homepage loads it as usual. */
  const handleGoHome = useCallback(() => {
    loadRequest.current++ // a chart load still in flight must not reopen the universe
    setRefreshing(false) // ...and its own cleanup is skipped once superseded
    setLoading(false, 100)
    selectSong(null)
    hoverSong(null)
    setSearchOpen(false)
    setChangingVibe(false)
    setPreviewSong(null)
    useUIStore.getState().setHoveredVibe(null)
    playUrl(null) // the homepage plays its own hover video sound
    setIntroAttempt(attempt => attempt + 1) // fresh homepage (chart picker, scrolled to top)
    setIntroComplete(false)
  }, [selectSong, hoverSong, setSearchOpen, setChangingVibe, playUrl, setIntroComplete, setRefreshing, setLoading])

  // Hover/selection → audio is handled by lib/audioDirector (started in GlobalAudioPlayer),
  // outside React, so tile changes do not re-render this component.
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
        // Hidden and click-through while the homepage is showing over a loaded universe.
        style={{ pointerEvents: introComplete ? undefined : 'none' }}
        animate={{
          // Song Detail: opacity-only fade (no animated full-screen blur over the canvas;
          // the canvas also stops rendering while covered — see Universe isPaused).
          opacity: !introComplete || selectedSong ? 0 : (isRefreshing ? 0.8 : 1),
          filter: 'none'
        }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {songs.length > 0 && <Universe
          songs={songs}
          selectedSong={selectedSong}
          currentVibe={currentVibe}
          onHover={hoverSong}
          onSelect={handleSelectSong}
          onPreview={setPreviewSong}
          isDetailOpen={!!selectedSong}
          isRefreshing={isRefreshing}
          isPaused={!introComplete || !!selectedSong || isChangingVibe || isRefreshing || isSearchOpen}
          onFps={(f) => { fpsRef.current = f; setFps(f) }}
        />}
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
              key={introAttempt}
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
              onHome={handleGoHome}
              isSongSelected={!!selectedSong}
            />
            <SearchPanel
              isOpen={isSearchOpen}
              onOpen={() => setSearchOpen(true)}
              onClose={() => setSearchOpen(false)}
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
            onClose={() => { useUIStore.getState().setHoveredVibe(null); setChangingVibe(false) }}
          />
        )}
      </AnimatePresence>

      {/* Hover Tooltip — rendered by isolated memo component to prevent full-page re-renders */}
      <HoverTooltip />
      {loadError && <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-lg rounded-xl bg-red-950 px-5 py-3 text-sm text-white shadow-xl">
        {loadError}<button className="ml-4 underline" onClick={() => setLoadError(null)}>Dismiss</button>
      </div>}
    </main>
  )
}
