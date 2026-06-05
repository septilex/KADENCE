'use client'
import { useEffect, useRef, useCallback, memo } from 'react'
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
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer'
import { useAudioStore } from '@/store/audioStore'
import { ChangeVibeOverlay } from '@/components/ui/ChangeVibeOverlay'

// Dynamic import for 3D (no SSR)
const Universe = dynamic(
  () => import('@/components/universe/Universe').then(m => m.Universe),
  { ssr: false }
)

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
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#1db954] hover:text-black flex items-center justify-center text-white/70 transition-all duration-300 flex-shrink-0 hover:scale-105"
              title="Open in Spotify"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.978-.335.076-.668-.135-.744-.47-.076-.335.135-.668.47-.744 3.856-.88 7.15-.506 9.822 1.13.295.18.387.563.206.855zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.344 1.334.367.227.487.708.26 1.08zm.105-2.833C14.852 8.94 9.773 8.77 6.83 9.664c-.475.144-.974-.124-1.118-.6-.144-.475.124-.974.6-1.118 3.39-1.03 9.002-.835 12.593 1.297.427.253.567.808.314 1.235-.252.427-.808.567-1.235.314z"/>
              </svg>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// ── Parallel image preloader ───────────────────────────────────────────────
// Warms the browser cache for all album artworks before the user enters.
// Uses a worker-pool pattern: CONCURRENCY workers each pull from a shared queue.
function preloadImages(
  urls: string[],
  onProgress: (loaded: number, total: number) => void,
  concurrency = 30,
): Promise<void> {
  return new Promise((resolve) => {
    if (urls.length === 0) { resolve(); return }
    let next = 0
    let done = 0
    const total = urls.length

    const runWorker = () => {
      if (next >= total) return
      const url = urls[next++]
      const img  = new Image()
      img.crossOrigin = 'anonymous'
      const finish = () => {
        done++
        onProgress(done, total)
        if (done >= total) resolve()
        else runWorker() // pick up next URL from the queue
      }
      img.onload  = finish
      img.onerror = finish
      img.src = url
    }

    // Kick off `concurrency` workers in parallel
    const workers = Math.min(concurrency, total)
    for (let i = 0; i < workers; i++) runWorker()
  })
}

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
  const fpsRef = useRef(60)

  // Fetch ~1000 songs for a given vibe
  const loadSongs = useCallback(async (vibe: Vibe, forceRefresh = false) => {
    try {
      const qs  = forceRefresh ? `?vibe=${vibe}&refresh=1` : `?vibe=${vibe}`
      const res = await fetch(`/api/songs${qs}`)
      const data = await res.json()
      return (data.songs || []) as SongNode[]
    } catch {
      return []
    }
  }, [])

  /**
   * Gated Universe Entry / Vibe Switch
   * Optimizes for perceived speed: fetches/preloads only the first ~100 visible tracks,
   * transitions the user into the universe instantly, and loads the remaining tracks
   * in the background.
   */
  const handleVibeSelect = useCallback(async (vibe: Vibe) => {
    setVibe(vibe)
    setLoading(true, 10)

    // Phase 1: Fetch a small fast initial batch for instant render (100 tracks)
    const initialFetched = await loadSongs(vibe, false)
    const initialBatch = initialFetched.slice(0, 120)
    setSongs(initialBatch)
    setLoading(true, 60)

    // Preload ONLY the initial visible batch of artwork
    const artworks = initialBatch.map(s => s.albumArt).filter(Boolean) as string[]
    await preloadImages(artworks, () => {}, 30)

    setLoading(false, 100)
    setIntroComplete(true)

    // Phase 2: Stream remaining tracks silently in the background
    if (initialFetched.length > initialBatch.length) {
      setTimeout(() => {
        // Incrementally update songs array with the full set
        setSongs(initialFetched)
        // Background-preload the rest
        const remainingArtworks = initialFetched.slice(120).map(s => s.albumArt).filter(Boolean) as string[]
        preloadImages(remainingArtworks, () => {}, 15)
      }, 1000)
    }
  }, [setVibe, setLoading, loadSongs, setSongs, setIntroComplete])

  // In-universe Vibe Switch pipeline
  const handleChangeVibe = useCallback(async (vibe: Vibe) => {
    if (vibe === currentVibe) return
    setRefreshing(true)
    setVibe(vibe)

    // Load initial fast batch first for speed, then swap and backfill
    const newSongs = await loadSongs(vibe, false)
    if (newSongs.length > 0) {
      const initialBatch = newSongs.slice(0, 120)
      const artworks = initialBatch.map(s => s.albumArt).filter(Boolean) as string[]
      await preloadImages(artworks, () => {}, 35)
      setSongs(initialBatch)

      // Backfill rest
      setTimeout(() => {
        setSongs(newSongs)
        const rest = newSongs.slice(120).map(s => s.albumArt).filter(Boolean) as string[]
        preloadImages(rest, () => {}, 15)
      }, 800)
    }

    setTimeout(() => setRefreshing(false), 300)
  }, [currentVibe, loadSongs, setSongs, setRefreshing, setVibe])

  // ── "Refresh Tracks" flow: preload new artwork before swapping ─────────
  const handleRefresh = useCallback(async () => {
    if (!currentVibe || isRefreshing) return
    setRefreshing(true)

    // Phase 1: fetch fresh tracks
    const freshSongs = await loadSongs(currentVibe, true)

    if (freshSongs.length > 0) {
      // Phase 2: pre-warm the browser image cache so tiles don't flash placeholders
      const artworks = freshSongs.map(s => s.albumArt).filter(Boolean) as string[]
      await preloadImages(artworks, () => {}, 30)

      // Phase 3: swap
      setSongs(freshSongs)
    }

    // Brief hold so the fade-in looks intentional, then restore
    setTimeout(() => setRefreshing(false), 600)
  }, [currentVibe, isRefreshing, setRefreshing, loadSongs, setSongs])

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
