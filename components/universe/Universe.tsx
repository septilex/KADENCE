'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { SongNode, Vibe } from '@/lib/types'
import { NodeField } from './NodeField'
import { CameraController } from './CameraController'
import { INTRO_Z, FOV_DEG } from '@/lib/gridCalc'

interface UniverseProps {
  songs: SongNode[]
  hoveredSong: SongNode | null
  selectedSong: SongNode | null
  currentVibe: Vibe | null
  onHover: (song: SongNode | null) => void
  onSelect: (song: SongNode) => void
  isDetailOpen?: boolean
  isRefreshing?: boolean
  onFps?: (fps: number) => void
}

export function Universe({
  songs,
  hoveredSong,
  selectedSong,
  currentVibe,
  onHover,
  onSelect,
  isDetailOpen = false,
  isRefreshing = false,
  onFps,
}: UniverseProps) {
  console.log('[DIAG:Universe] songs.length entering Universe:', songs.length)
  return (
    <Canvas
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
    >
      <ambientLight intensity={0.9} />

      <Suspense fallback={null}>
        {songs.length > 0 && (
          <NodeField
            songs={songs}
            currentVibe={currentVibe}
            hoveredId={hoveredSong?.id ?? null}
            selectedId={selectedSong?.id ?? null}
            onHover={onHover}
            onSelect={onSelect}
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
