'use client'
import { Component, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { SongNode, Vibe } from '@/lib/types'
import { NodeField } from './NodeField'
import { CameraController } from './CameraController'
import { INTRO_Z, FOV_DEG } from '@/lib/gridCalc'
import { TrackList } from './TrackList'
import { useChartTransition, reportFirstFrame } from '@/store/chartTransitionStore'

/**
 * Scene warm-up for the chart transition: asks for exactly one frame while the wall is still
 * covered by the loading overlay, and reports once that frame (with the new chart's NodeField,
 * shaders compiled) has been drawn. No loop of its own: one invalidate per warm-up request.
 */
function FirstFrameSignal({ request }: { request: number }) {
  const invalidate = useThree(s => s.invalidate)
  const frameloop = useThree(s => s.frameloop)
  const reported = useRef<number | null>(null)
  useEffect(() => { if (reported.current !== request) invalidate() }, [request, frameloop, invalidate])
  useFrame(() => {
    if (reported.current === request) return
    reported.current = request
    // useFrame runs right before this frame's gl.render in the same task; the microtask runs
    // after the render has been issued.
    queueMicrotask(() => reportFirstFrame(request))
  })
  return null
}

/** Non-WebGL views (list mode, renderer failure) are ready as soon as they mount. */
function ReadyOnMount() {
  const warmRequest = useChartTransition(s => s.warmRequest)
  useEffect(() => { if (warmRequest !== null) reportFirstFrame(warmRequest) }, [warmRequest])
  return null
}

const subscribeVisibility = (notify: () => void) => { document.addEventListener('visibilitychange', notify); return () => document.removeEventListener('visibilitychange', notify) }
const getVisible = () => document.visibilityState === 'visible'
const getServerVisible = () => true
const subscribeMotion = (notify: () => void) => { const media = matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify) }
const getReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const getServerMotion = () => false

class RendererBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

interface UniverseProps {
  songs: SongNode[]

  selectedSong: SongNode | null
  currentVibe: Vibe | null
  onHover: (song: SongNode | null) => void
  onSelect: (song: SongNode | null) => void
  onPreview: (song: SongNode | null) => void
  isDetailOpen?: boolean
  isRefreshing?: boolean
  /** True while the wall is fully covered (Song Detail, Switch Chart overlay): rendering is suspended. */
  isPaused?: boolean
  onFps?: (fps: number) => void
}

export function Universe({
  songs,

  selectedSong,
  currentVibe,
  onHover,
  onSelect,
  onPreview,
  isDetailOpen = false,
  isPaused = false,
}: UniverseProps) {
  const visible = useSyncExternalStore(subscribeVisibility, getVisible, getServerVisible)
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerMotion)
  const [listMode, setListMode] = useState<boolean | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const showList = contextLost || (listMode ?? reducedMotion)
  useEffect(() => { if (showList || isPaused || !visible) onHover(null) }, [showList, isPaused, visible, onHover])
  const warmRequest = useChartTransition(s => s.warmRequest)
  const fallback = <><TrackList songs={songs} onSelect={onSelect} /><ReadyOnMount /></>
  // Render continuously only while the wall is visible. When it is covered, 'never'
  // stops the R3F loop entirely (no draws, no jelly sim, no hover raycasts) — except during a
  // chart-transition warm-up, where 'demand' lets FirstFrameSignal draw a single frame.
  const frameloop = !visible ? 'never'
    : isPaused ? (warmRequest !== null ? 'demand' : 'never')
    : songs.length === 0 ? 'demand' : 'always'
  return (
    <>
    {showList ? fallback : <RendererBoundary fallback={fallback}>
    <Canvas
      fallback={fallback}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true), { once: true })
      }}
      frameloop={frameloop}
      gl={{
        // MSAA: the tiles tilt under the lens, and their edges crawl without it.
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true,
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 0, INTRO_Z], fov: FOV_DEG, near: 0.5, far: 800 }}
      dpr={[1, 1.5]}
      style={{ 
        width: '100%', 
        height: '100%',
        background: 'transparent'
      }}
    >
      <ambientLight intensity={0.9} />

      <Suspense fallback={null}>
        {songs.length > 0 && (
          <NodeField
            enabled={visible && !isPaused}
            songs={songs}
            currentVibe={currentVibe}

            selectedId={selectedSong?.id ?? null}
            onHover={onHover}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        )}
        {/* Inside the Suspense boundary: while NodeField suspends, no frame is reported. */}
        {songs.length > 0 && warmRequest !== null && <FirstFrameSignal request={warmRequest} />}
        <CameraController
          targetNodePos={selectedSong ? { x: selectedSong.x, y: selectedSong.y, z: 0 } : null}
          isDetailOpen={isDetailOpen}
        />
      </Suspense>
    </Canvas>
    </RendererBoundary>}
    {!isPaused && <button className="absolute bottom-5 right-5 z-20 rounded-full border border-white/20 bg-black/80 px-4 py-2 text-sm text-white" onClick={() => { setContextLost(false); setListMode(!showList) }}>
      {showList ? 'Universe view' : 'List view'}
    </button>}
    </>
  )
}
