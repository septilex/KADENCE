'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { SongNode, Vibe } from '@/lib/types'
import { NodeField } from './NodeField'
import { CameraController } from './CameraController'
import { INTRO_Z, FOV_DEG } from '@/lib/gridCalc'

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
  isRefreshing = false,
  isPaused = false,
  onFps,
}: UniverseProps) {
  // Render continuously only while the wall is visible. When it is covered, 'never'
  // stops the R3F loop entirely (no draws, no jelly sim, no hover raycasts).
  const frameloop = songs.length === 0 ? 'demand' : isPaused ? 'never' : 'always'
  return (
    <Canvas
      frameloop={frameloop}
      gl={{
        antialias: false,
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
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.9} />

      <Suspense fallback={null}>
        {songs.length > 0 && (
          <NodeField
            songs={songs}
            currentVibe={currentVibe}

            selectedId={selectedSong?.id ?? null}
            onHover={onHover}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        )}
        <CameraController
          targetNodePos={selectedSong ? { x: selectedSong.x, y: selectedSong.y, z: 0 } : null}
          isDetailOpen={isDetailOpen}
        />
      </Suspense>
    </Canvas>
  )
}
