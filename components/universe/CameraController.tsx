'use client'
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSongStore } from '@/store/songStore'
import * as THREE from 'three'
import { BROWSE_Z, INTRO_Z, computeGrid, computeBounds } from '@/lib/gridCalc'

interface CameraControllerProps {
  targetNodePos?: { x: number; y: number; z: number } | null
  isDetailOpen?: boolean
}

const FOCUSED_Z  = 36    // was 48 — proportionally closer with new BROWSE_Z=46
const PANEL_OFF  = -4.0  // was -2.5 — wider offset to clear the drawer with bigger tiles

// Frame-rate-independent friction: Math.exp(-FRICTION_K * delta)
// 0.94 at 60fps → FRICTION_K = -ln(0.94) * 60 ≈ 3.71
const FRICTION_K = 3.71

// Max velocity per axis — prevents over-flicking on fast swipes
const MAX_VEL = 0.8

export function CameraController({ targetNodePos, isDetailOpen }: CameraControllerProps) {
  const { camera, gl, size } = useThree()
  const introComplete = useSongStore(state => state.introComplete)
  const count         = useSongStore(state => state.songs.length)

  const posX = useRef(0)
  const posY = useRef(0)
  const posZ = useRef(INTRO_Z)
  const tgtX = useRef(0)
  const tgtY = useRef(0)
  const tgtZ = useRef(INTRO_Z)

  const velX       = useRef(0)
  const velY       = useRef(0)
  const isDragging = useRef(false)
  const lastMouse  = useRef({ x: 0, y: 0 })
  const idleT      = useRef(0)

  useEffect(() => {
    if (!introComplete) {
      tgtZ.current = INTRO_Z
    } else if (isDetailOpen && targetNodePos) {
      tgtX.current = targetNodePos.x + PANEL_OFF
      tgtY.current = targetNodePos.y
      tgtZ.current = FOCUSED_Z
    } else if (introComplete) {
      tgtX.current = 0
      tgtY.current = 0
      tgtZ.current = BROWSE_Z
    }
  }, [targetNodePos, isDetailOpen, introComplete])

  useFrame((state, delta) => {
    if (!introComplete) {
      // Gentle zoom from INTRO_Z down to BROWSE_Z while loading
      tgtZ.current = Math.max(BROWSE_Z, tgtZ.current - delta * 4)
    } else if (!isDetailOpen) {
      // Target is locked to (0,0) for the main view
      tgtX.current = 0
      tgtY.current = 0
    }

    // ── Camera smoothing ──────────────────────────────────────────────────
    // XY: alpha 4.5 → responsive, tracks momentum closely → buttery drag feel
    // Z:  alpha 2.5 → smooth but not delayed zoom transitions
    const alphaXY = 1 - Math.exp(-delta * 4.5)
    const alphaZ  = 1 - Math.exp(-delta * (isDetailOpen ? 2.5 : 2.0))

    posX.current += (tgtX.current - posX.current) * alphaXY
    posY.current += (tgtY.current - posY.current) * alphaXY
    posZ.current += (tgtZ.current - posZ.current) * alphaZ

    camera.position.set(posX.current, posY.current, posZ.current)

    // Dead-straight look-ahead — camera NEVER rotates, preserving "live wallpaper" feel
    camera.lookAt(posX.current, posY.current, 0)
  })

  return null
}
