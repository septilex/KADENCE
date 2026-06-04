'use client'
import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { SongNode, Vibe } from '@/lib/types'
import { SPACING_X, SPACING_Y, CARD_W, CARD_H, computeGrid } from '@/lib/gridCalc'
import { VIBE_COLORS } from '@/lib/types'

interface NodeFieldProps {
  songs: SongNode[]
  currentVibe: Vibe | null
  hoveredId: string | null
  selectedId: string | null
  onHover: (song: SongNode | null) => void
  onSelect: (song: SongNode) => void
}

// ── Texture atlas config ──────────────────────────────────────────────────────
const TEXTURE_SIZE  = 256    // px per atlas slot
const TEXTURE_DEPTH = 256    // max unique artworks in the atlas
const ATLAS_COLS    = 16     // 16x16 = 256 slots (4096x4096px canvas)
const MAX_LOADS     = 16     // concurrent in-flight image loads

// ── Motion & Interaction Tuning Constants ─────────────────────────────────────
const SPRING_STIFFNESS     = 70.0    // Smooth trailing delay
const SPRING_DAMPING       = 16.8    // Critically damped — no wobble
const SPRING_MASS          = 1.0     // Physical weight of the wall
const PARALLAX_STRENGTH    = 0.028   // Amount of background drift
const MOMENTUM_MULTIPLIER  = 1.0     // Multiplier for velocity retention
const LENS_RADIUS          = 10.2    // -15% from 12.0
const LENS_INTENSITY       = 5.3     // +20% from 4.4

const vertexShader = /* glsl */`
  in float aTexIndex;
  in float aInstanceIdx;

  out vec2 vUvCustom;
  out float vTexIndex;
  out float vHighlight;
  out vec3 vNormal;
  out float vWarpInfluence;
  out vec3 vVibeColor;

  uniform vec2  uCameraXY;
  uniform vec2  uRawMouse;
  uniform vec2  uMouse;
  uniform float uHoverIdx;
  uniform float uSelectedIdx;
  uniform float uTime;
  uniform vec3  uVibeAccent;
  uniform float uWaveSpeed;
  uniform float uWaveAmp;

  void main() {
    vUvCustom = uv;
    vTexIndex = aTexIndex;
    vVibeColor = uVibeAccent;

    vec3 localPos = position;

    float localScale = 1.0;
    float zOffset    = 0.0;
    vHighlight       = 0.92;

    if (abs(aInstanceIdx - uHoverIdx) < 0.1) {
      localScale = 1.10;
    }

    if (abs(aInstanceIdx - uSelectedIdx) < 0.1) {
      localScale = 1.14;
      zOffset    = 0.7;
      vHighlight = 1.38;
    }

    localPos.xy *= localScale;
    localPos.z  += zOffset;

    vec3 baseWPos = (modelMatrix * instanceMatrix * vec4(localPos, 1.0)).xyz;
    vec3 displacedWPos = baseWPos;
    
    // ── Flat Cinematic Wall ─────────────────────────────────────
    // The wall remains perfectly flat at Z=0. No global mesh curvature.
    
    // ── Glass Lens (smoothed mouse — lively trailing) ──
    // uMouse trails behind cursor with spring physics, creating organic follow.
    // uRawMouse is kept for hover hit-detection only (instant, below).
    vec2 deltaLens = baseWPos.xy - uMouse;
    float distLens = length(deltaLens);
    
    float R = ${LENS_RADIUS.toFixed(1)};
    float lensFactor = smoothstep(R, 0.0, distLens);
    
    float maxZ = ${LENS_INTENSITY.toFixed(1)};
    displacedWPos.z += lensFactor * maxZ;
    
    // ── Micro-Parallax ──
    float parallaxDepth = 1.0 + mod(aInstanceIdx, 4.0) * 0.08;
    displacedWPos.xy -= (uMouse * ${PARALLAX_STRENGTH.toFixed(3)}) * parallaxDepth;

    // ── Surface Normal + Subtle Card Tilt ──
    float dr = 0.0;
    if (distLens < R) {
        dr = -6.0 * distLens * (R - distLens) / (R * R * R);
    }
    float dz_dx = dr * (deltaLens.x / max(distLens, 0.0001)) * maxZ;
    float dz_dy = dr * (deltaLens.y / max(distLens, 0.0001)) * maxZ;

    // Card tilt: nudge normal toward cursor inside lens boundary
    float tiltStrength = 0.18;
    vec2 tiltDir = -normalize(deltaLens + vec2(0.0001));
    vec3 tiltedNormal = vec3(
        -dz_dx + tiltDir.x * lensFactor * tiltStrength,
        -dz_dy + tiltDir.y * lensFactor * tiltStrength,
        1.0
    );
    vNormal = normalize(tiltedNormal);

    vWarpInfluence = lensFactor;
    vHighlight += lensFactor * 0.12;

    vec4 mvPosition = viewMatrix * vec4(displacedWPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
// Pure artwork display for the resting wall. Inject vibe tinting based on active world status.
const fragmentShader = /* glsl */`
  precision mediump sampler2D;

  in vec2  vUvCustom;
  in float vTexIndex;
  in float vHighlight;
  in vec3  vNormal;
  in float vWarpInfluence;
  in vec3  vVibeColor;

  uniform sampler2D uAtlas;
  uniform float uSelectedIdx;
  uniform float uHoverIdx;

  out vec4 fragColor;

  void main() {
    // ── SDF Rounded Corners ─────────────────────────────────────
    vec2 centeredUv = vUvCustom - 0.5;
    vec2 boxSize = vec2(0.5); // full width of the tile
    float cornerRadius = 0.04; // subtle premium rounding
    
    vec2 d = abs(centeredUv) - boxSize + vec2(cornerRadius);
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - cornerRadius;
    
    // Strictly discard ONLY the exact rounded corner pixels
    if (dist > 0.0) {
      discard;
    }

    // Atlas UV calculation
    float cols = 16.0;
    float col = mod(vTexIndex, cols);
    float row = floor(vTexIndex / cols);
    vec2 atlasUv = (vUvCustom + vec2(col, cols - 1.0 - row)) / cols;

    vec4 c = texture(uAtlas, atlasUv);

    // ── Base colour: gamma-correct multiply by per-tile brightness ────────
    vec3 lin     = pow(c.rgb, vec3(2.2));
    
    // Smooth vibe ambient glow color grading / tint overlay (very subtle so covers are readable)
    vec3 tint = mix(vec3(1.0), vVibeColor, 0.04);
    vec3 baseRgb = lin * vHighlight * tint;

    // ── Localized specular sheen — ONLY inside the warp deformation field ─
    float spec = 0.0;
    if (vWarpInfluence > 0.001) {
      vec3 lightDir = normalize(vec3(0.30, 0.40, 1.0));
      vec3 viewDir  = vec3(0.0, 0.0, 1.0);
      vec3 halfDir  = normalize(lightDir + viewDir);
      float rawSpec = pow(max(dot(vNormal, halfDir), 0.0), 32.0);
      // Give warp sheen a subtle hue shift matching the vibe accent color
      spec = rawSpec * vWarpInfluence * vWarpInfluence * 0.07;
      baseRgb += spec * vVibeColor * 0.4;
    }

    vec3 finalLinear = baseRgb + vec3(spec);
    vec3 out_        = pow(max(finalLinear, vec3(0.0)), vec3(1.0 / 2.2));
    fragColor        = vec4(out_, c.a);
  }
`;

export function NodeField({ songs, currentVibe, hoveredId, selectedId, onHover, onSelect }: NodeFieldProps) {
  console.log('[DIAG:NodeField] songs.length entering NodeField:', songs.length)
  const { camera, gl, size } = useThree()
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // ── Grid layout dimensions ─────────────────────────────────────────────────
  const dims  = useMemo(
    () => computeGrid(songs.length, size.width, size.height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [songs.length, size.width, size.height]
  )
  const count = dims.virtualCount
  const COLS  = dims.COLS
  const ROWS  = dims.ROWS
  console.log(`[DIAG:NodeField] grid generation output -> size: ${size.width}x${size.height}, COLS: ${COLS}, ROWS: ${ROWS}, count (virtualCount): ${count}`)


  const rawMouseNDC       = useRef(new THREE.Vector2(-10, -10))
  const rawMouseWorld     = useRef(new THREE.Vector2(0, 0))
  const smoothMouseWorld  = useRef(new THREE.Vector2(0, 0))
  const mouseVelocity     = useRef(new THREE.Vector2(0, 0))
  const lastHoverId       = useRef<string | null>(null)
  const textureNeedsFlush = useRef(false)

  // ── Texture Atlas ─────────────────────────────────────────────────────────
  const defaultAtlasTexture = useMemo(() => {
    const tex = new THREE.Texture()
    tex.needsUpdate = true
    return tex
  }, [])

  const [atlas, setAtlas] = useState<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } | null>(null)

  useEffect(() => {
    const cvs = document.createElement('canvas')
    cvs.width = TEXTURE_SIZE * ATLAS_COLS
    cvs.height = TEXTURE_SIZE * ATLAS_COLS
    
    const ctx = cvs.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#0a0a0e'
    ctx.fillRect(0, 0, cvs.width, cvs.height)
    
    const tex = new THREE.CanvasTexture(cvs)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.generateMipmaps = false
    tex.needsUpdate = true
    
    setAtlas({ canvas: cvs, texture: tex })
  }, [])

  const loadedSet  = useRef(new Set<number>())
  const loadingSet = useRef(new Set<number>())
  const flushData  = useRef({ lastCount: 0, lastTime: 0 })

  // Reset on songs change
  useEffect(() => {
    loadedSet.current.clear()
    loadingSet.current.clear()
    flushData.current = { lastCount: 0, lastTime: 0 }
  }, [songs])

  const loadSlot = (realIdx: number, url: string) => {
    if (!url || loadedSet.current.has(realIdx) || loadingSet.current.has(realIdx)) return
    loadingSet.current.add(realIdx)
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!atlas) return
      const ctx = atlas.canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      
      const slot = realIdx % TEXTURE_DEPTH
      const col = slot % ATLAS_COLS
      const row = Math.floor(slot / ATLAS_COLS)
      
      ctx.drawImage(img, col * TEXTURE_SIZE, row * TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_SIZE)
      
      loadedSet.current.add(realIdx)
      loadingSet.current.delete(realIdx)
    }
    img.onerror = () => {
      loadedSet.current.add(realIdx)
      loadingSet.current.delete(realIdx)
    }
    img.src = url
  }

  // Progressive texture loading
  useFrame(() => {
    if (songs.length === 0) return
    let launched = 0
    for (let i = 0; i < songs.length && i < TEXTURE_DEPTH; i++) {
      if (loadingSet.current.size >= MAX_LOADS) break
      if (!loadedSet.current.has(i) && !loadingSet.current.has(i)) {
        if (songs[i]?.albumArt) {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(songs[i].albumArt)}`
          loadSlot(i, proxyUrl)
          launched++
          if (launched >= 4) break
        }
      }
    }
  })

  // Per-instance texture index attribute — shuffled to prevent visible repeat patterns.
  // Uses a deterministic xorshift32 so layout is stable across re-renders but
  // visually random with no sequential stripes or diagonal artifact bands.
  const texIndices = useMemo(() => {
    const arr = new Float32Array(count)
    if (songs.length === 0) return arr

    const n = Math.min(songs.length, TEXTURE_DEPTH)

    // Build a pool that wraps through all songs once, then repeats as needed
    const pool = new Int32Array(count)
    for (let i = 0; i < count; i++) pool[i] = i % n

    // Deterministic xorshift32 pseudo-random number generator (fast, good quality)
    let seed = 0xA3C7_9B1D
    const rng = () => {
      seed ^= seed << 13
      seed ^= seed >> 17
      seed ^= seed << 5
      return (seed >>> 0) / 0xFFFF_FFFF
    }

    // Fisher-Yates shuffle — O(n), stable seed → same layout on every render
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
    }

    // Neighbor-conflict resolution: swap any tile that matches its left or top
    // neighbor so adjacent cells always show visually distinct album art
    const c = (count > 0 && songs.length > 0)
      ? Math.ceil(Math.sqrt(count * (16 / 9)))  // estimated COLS for neighbor calc
      : 1
    for (let i = c + 1; i < count; i++) {
      const left = pool[i - 1]
      const top  = pool[i - c]
      if (pool[i] === left || pool[i] === top) {
        // Find a nearby non-conflicting candidate to swap with
        for (let j = i + 1; j < Math.min(i + 8, count); j++) {
          if (pool[j] !== left && pool[j] !== top) {
            const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
            break
          }
        }
      }
    }

    for (let i = 0; i < count; i++) arr[i] = pool[i]
    return arr
  }, [count, songs.length])

  const instanceIndices = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) arr[i] = i
    return arr
  }, [count])

  // ── Subdivided geometry ───────────────────────────────────────────────────
  // We use 8x8 subdivisions per plane so the tiles curve organically when deformed.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 8, 8)
    geo.setAttribute('aTexIndex',    new THREE.InstancedBufferAttribute(texIndices, 1))
    geo.setAttribute('aInstanceIdx', new THREE.InstancedBufferAttribute(instanceIndices, 1))
    return geo
  }, [texIndices, instanceIndices])

  // ── Material ──────────────────────────────────────────────────────────────
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas:       { value: atlas ? atlas.texture : defaultAtlasTexture },
      uCameraXY:    { value: new THREE.Vector2(0, 0) },
      uRawMouse:    { value: new THREE.Vector2(0, 0) },
      uMouse:       { value: new THREE.Vector2(0, 0) },
      uHoverIdx:      { value: -1 },
      uSelectedIdx:   { value: -1 },
      uTime:          { value: 0 },
      uVibeAccent:    { value: new THREE.Color('#d63384') },
      uWaveSpeed:     { value: 1.0 },
      uWaveAmp:       { value: 1.0 },
    },
    glslVersion: THREE.GLSL3,
    transparent: false,
    depthWrite:  true,
    depthTest:   true,
  }), [atlas, defaultAtlasTexture])

  // Initialize instance matrices
  useEffect(() => {
    if (!meshRef.current) {
      console.warn('[DIAG:NodeField] instanceMatrix loop skipped — meshRef is null')
      return
    }
    console.log(`[DIAG:NodeField] Running instanceMatrix loop for count=${count}, meshRef.count=${meshRef.current.count}`)
    const dummy  = new THREE.Object3D()
    const halfC  = (COLS - 1) / 2
    const halfR  = (ROWS - 1) / 2
    for (let i = 0; i < count; i++) {
      const c = i % COLS
      const r = Math.floor(i / COLS)
      dummy.position.set(
        (c - halfC) * SPACING_X,
        -(r - halfR) * SPACING_Y,
        0
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    console.log(`[DIAG:NodeField] Finished populating instanceMatrix for ${count} tiles.`)
  }, [count, COLS, ROWS, geometry])

  // Mouse event capturing
  useEffect(() => {
    const el = gl.domElement
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      rawMouseNDC.current.set(
        ((e.clientX - r.left) / r.width)  *  2 - 1,
        ((e.clientY - r.top)  / r.height) * -2 + 1,
      )
    }
    const onLeave = () => { rawMouseNDC.current.set(-10, -10) }
    const onClick = () => {
      if (lastHoverId.current) {
        const s = songs.find(s => s.id === lastHoverId.current)
        if (s) onSelect(s)
      }
    }
    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('click', onClick)
    }
  }, [gl, onSelect, songs])

  const _vec3 = useMemo(() => new THREE.Vector3(), [])

  // ── Frame Loop ─────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (atlas && flushData.current.lastCount !== loadedSet.current.size) {
      const now = performance.now()
      const isComplete = loadedSet.current.size === Math.min(songs.length, TEXTURE_DEPTH)
      const isInitialBatch = loadedSet.current.size <= 16

      if (now - flushData.current.lastTime > 500 || isComplete || isInitialBatch) {
        atlas.texture.needsUpdate = true
        flushData.current.lastTime = now
        flushData.current.lastCount = loadedSet.current.size
      }
    }

    material.uniforms.uTime.value = state.clock.getElapsedTime()

    // Cap delta time to maintain numerical stability during frame-rate drops
    const dt = Math.min(delta, 0.03)
    
    // Feed camera XY to shader for centered fisheye effect
    material.uniforms.uCameraXY.value.set(camera.position.x, camera.position.y)

    // ── Mouse to world-space raycasting ──────────────────────────────────────
    let targetWorldX = camera.position.x
    let targetWorldY = camera.position.y

    if (rawMouseNDC.current.x > -2) {
      _vec3.set(rawMouseNDC.current.x, rawMouseNDC.current.y, 0.5).unproject(camera)
      const dir      = _vec3.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      const hit      = camera.position.clone().add(dir.multiplyScalar(distance))
      targetWorldX   = hit.x
      targetWorldY   = hit.y
    }

    // ── Spatial Computing Spring Parallax ────────────────────────────────────
    // Second-order mass-spring-damper system for physical weight and momentum.
    // This allows the wall to build inertia and elastically settle when you stop moving.
    const forceX = (targetWorldX - smoothMouseWorld.current.x) * SPRING_STIFFNESS - mouseVelocity.current.x * SPRING_DAMPING;
    const forceY = (targetWorldY - smoothMouseWorld.current.y) * SPRING_STIFFNESS - mouseVelocity.current.y * SPRING_DAMPING;

    mouseVelocity.current.x += (forceX / SPRING_MASS) * (dt * MOMENTUM_MULTIPLIER);
    mouseVelocity.current.y += (forceY / SPRING_MASS) * (dt * MOMENTUM_MULTIPLIER);

    smoothMouseWorld.current.x += mouseVelocity.current.x * dt;
    smoothMouseWorld.current.y += mouseVelocity.current.y * dt;

    rawMouseWorld.current.set(targetWorldX, targetWorldY)

    material.uniforms.uMouse.value.copy(smoothMouseWorld.current)
    material.uniforms.uRawMouse.value.copy(rawMouseWorld.current)

    // ── Vibe personality styling ─────────────────────────────────────────────
    // Configure wave values and spring characteristics based on vibe config
    let waveSpeed = 1.0
    let waveAmp = 1.0
    let vibeColorHex = '#d63384'

    if (currentVibe) {
      vibeColorHex = VIBE_COLORS[currentVibe] || vibeColorHex

      if (currentVibe === 'workout') {
        waveSpeed = 2.4
        waveAmp = 1.8
      } else if (currentVibe === 'chill-hits') {
        waveSpeed = 0.4
        waveAmp = 0.9
      } else if (currentVibe === 'late-night') {
        waveSpeed = 0.55
        waveAmp = 0.7
      } else if (currentVibe === 'viral-50' || currentVibe === 'dance-hits') {
        waveSpeed = 1.8
        waveAmp = 1.5
      } else if (currentVibe === 'new-music-friday') {
        waveSpeed = 0.9
        waveAmp = 1.2
      } else {
        waveSpeed = 1.2
        waveAmp = 1.1
      }
    }

    material.uniforms.uWaveSpeed.value = waveSpeed
    material.uniforms.uWaveAmp.value = waveAmp
    material.uniforms.uVibeAccent.value.set(vibeColorHex)

    // ── O(1) Hover detection ─────────────────────────────────────────────────
    let hoverIdx = -1
    let newHoverId: string | null = null

    // Determine hover using actual cursor target (not smoothed spring cursor)
    // to keep hover selection snappy and directly aligned with the cursor coordinate.
    if (targetWorldX !== -9999) {
      const camX   = camera.position.x
      const camY   = camera.position.y
      const halfC  = (COLS - 1) / 2
      const halfR  = (ROWS - 1) / 2
      const c      = Math.round((targetWorldX - camX + (halfC * SPACING_X)) / SPACING_X)
      const r      = Math.round(-(targetWorldY - camY) / SPACING_Y + halfR)

      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
        hoverIdx = r * COLS + c
        if (hoverIdx < count) {
          const mappedIndex = texIndices[hoverIdx]
          const s   = songs[mappedIndex]
          newHoverId = s?.id ?? null
        }
      }
    }

    if (newHoverId !== lastHoverId.current) {
      lastHoverId.current = newHoverId
      const s = songs.find(s => s.id === newHoverId) || null
      onHover(s)
      gl.domElement.style.cursor = newHoverId ? 'pointer' : 'crosshair'
    }

    material.uniforms.uHoverIdx.value = hoverIdx

    let selIdx = -1
    if (selectedId) {
      const idx = songs.findIndex(s => s.id === selectedId)
      if (idx !== -1) selIdx = idx
    }
    material.uniforms.uSelectedIdx.value = selIdx
  })

  return (
    <instancedMesh
      key={`wall-${count}`}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  )
}
