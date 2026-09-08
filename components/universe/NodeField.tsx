'use client'
import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SongNode, Vibe } from '@/lib/types'
import { SPACING_X, SPACING_Y, CARD_W, CARD_H, computeGrid } from '@/lib/gridCalc'
import { VIBE_COLORS } from '@/lib/types'
import { atlasManager, getOptimizedArtworkUrl } from '@/lib/atlasManager'

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
const MAX_LOADS     = 128    // concurrent in-flight image loads (increased for cached hits)

// ── Motion & Interaction Tuning Constants ─────────────────────────────────────
const SPRING_STIFFNESS     = 120.0   // Tighter cursor anchoring
const SPRING_DAMPING       = 22.0    // Critically damped — no wobble
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
      localScale = 1.03;
      zOffset    = 0.3;
      vHighlight = 1.25;
    }

    if (abs(aInstanceIdx - uSelectedIdx) < 0.1) {
      localScale = 1.06;
      zOffset    = 0.8;
      vHighlight = 1.45;
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

  const rawMouseNDC       = useRef(new THREE.Vector2(-10, -10))
  const rawMouseWorld     = useRef(new THREE.Vector2(0, 0))
  const smoothMouseWorld  = useRef(new THREE.Vector2(0, 0))
  const mouseVelocity     = useRef(new THREE.Vector2(0, 0))
  const lastHoverId       = useRef<string | null>(null)
  const textureNeedsFlush = useRef(false)

  // ── Pre-allocated scratch objects to avoid per-frame heap allocation ────────
  // These are reused every frame via .set() / .copy() — zero GC pressure.
  const _scratchVec3    = useRef(new THREE.Vector3())
  const _scratchDir     = useRef(new THREE.Vector3())
  const _scratchHit     = useRef(new THREE.Vector3())

  // ── Cached DOM rect for mousemove — refreshed only on resize ───────────────
  const domRectRef = useRef<DOMRect | null>(null)

  // ── Precomputed O(1) lookup maps ───────────────────────────────────────────
  // Replaces O(n) songs.find() and songs.findIndex() calls inside useFrame.
  const songMaps = useMemo(() => {
    const byId    = new Map<string, SongNode>()
    const idxById = new Map<string, number>()
    for (let i = 0; i < songs.length; i++) {
      byId.set(songs[i].id, songs[i])
      idxById.set(songs[i].id, i)
    }
    return { byId, idxById }
  }, [songs])

  // ── Vibe uniform cache — only write to GPU when values actually change ──────
  const vibeCache = useRef({ speed: -1, amp: -1, hex: '' })

  // ── Texture Atlas — use the shared atlasManager that was already pre-loaded ─
  // This eliminates duplicate image loading: atlasManager.prepareCriticalVibe()
  // already populated the first 64 critical tiles during the loading phase.
  const defaultAtlasTexture = useMemo(() => {
    const tex = new THREE.Texture()
    tex.needsUpdate = true
    return tex
  }, [])

  const atlas = useMemo(() => {
    try {
      const result = atlasManager.init()
      return result
    } catch {
      return null
    }
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

  // Wrapped in useCallback so the frame loop always captures a stable reference.
  // Loads images DIRECTLY from Apple CDN (no proxy round-trip).
  const loadSlot = useCallback((realIdx: number, url: string) => {
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
  }, [atlas])

  // Progressive texture loading — direct CDN, no proxy round-trip
  useFrame(() => {
    if (songs.length === 0) return
    let launched = 0
    for (let i = 0; i < songs.length && i < TEXTURE_DEPTH; i++) {
      if (loadingSet.current.size >= MAX_LOADS) break
      if (!loadedSet.current.has(i) && !loadingSet.current.has(i)) {
        if (songs[i]?.albumArt) {
          const directUrl = getOptimizedArtworkUrl(songs[i].albumArt, 256)
          loadSlot(i, directUrl)
          launched++
          // Allow up to 64 image load requests per frame so cached hits populate the atlas instantly
          if (launched >= 64) break
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
      // Divide by 2^32 to ensure the result is strictly in [0, 1), avoiding out-of-bounds in Fisher-Yates
      return (seed >>> 0) / 4294967296
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

  // ── Material — created once, atlas updated imperatively ───────────────────
  // Decoupling material from atlas prevents a full shader recompile every time
  // the atlas state changes. Instead we update the uniform value directly.
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas:       { value: defaultAtlasTexture },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []) // No atlas dependency — updated via useEffect below

  // Update atlas uniform without recreating material (avoids shader recompile)
  useEffect(() => {
    if (atlas && material) {
      material.uniforms.uAtlas.value = atlas.texture
    }
  }, [atlas, material])

  // Initialize instance matrices
  useEffect(() => {
    if (!meshRef.current) return
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
  }, [count, COLS, ROWS, geometry])

  // Mouse event capturing
  useEffect(() => {
    const el = gl.domElement

    const onMove = (e: MouseEvent) => {
      // Always compute fresh bounds to account for viewport scaling, CSS transforms, or scroll offsets
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      
      // Calculate precise NDC coordinates mapping the mouse to the canvas rendering space
      rawMouseNDC.current.set(
        ((e.clientX - r.left) / r.width)  *  2 - 1,
        ((e.clientY - r.top)  / r.height) * -2 + 1,
      )
    }
    
    const onLeave = () => { rawMouseNDC.current.set(-10, -10) }
    const onClick = (e: MouseEvent) => {
      // Only process clicks on the WebGL canvas, ignore clicks on floating UI elements
      if (e.target !== el) return
      if (lastHoverId.current) {
        const s = songMaps.byId.get(lastHoverId.current)
        if (s) onSelect(s)
      }
    }
    
    // Attach to window so we catch pointer events even if UI overlays are on top of the canvas
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('click', onClick)
    }
  }, [gl, onSelect, songMaps])

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

    // ── Mouse to world-space raycasting ──
    let targetWorldX = camera.position.x
    let targetWorldY = camera.position.y
    let isMouseActive = false

    if (rawMouseNDC.current.x > -2) {
      // Use THREE.Raycaster for perfectly accurate projection that automatically handles
      // perspective/orthographic transforms, CSS scaling, and aspect ratios.
      state.raycaster.setFromCamera(rawMouseNDC.current, camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      state.raycaster.ray.intersectPlane(plane, _scratchHit.current)
      
      if (_scratchHit.current) {
        targetWorldX = _scratchHit.current.x
        targetWorldY = _scratchHit.current.y
        isMouseActive = true
      }
    }

    // ── Zero Delay Cursor Tracking ───────────────────────────────────────────
    // The user requested ZERO lag/delay between the cursor and the cursor effect.
    // Directly snap the effect coordinates to the raw target world coordinates.
    smoothMouseWorld.current.x = targetWorldX;
    smoothMouseWorld.current.y = targetWorldY;

    rawMouseWorld.current.set(targetWorldX, targetWorldY)

    material.uniforms.uMouse.value.copy(smoothMouseWorld.current)
    material.uniforms.uRawMouse.value.copy(rawMouseWorld.current)

    // ── Vibe personality styling — only write to GPU uniforms when values change ─
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

    // Only write uniforms when values have actually changed (avoids GPU uniform upload every frame)
    const vc = vibeCache.current
    if (vc.speed !== waveSpeed) {
      material.uniforms.uWaveSpeed.value = waveSpeed
      vc.speed = waveSpeed
    }
    if (vc.amp !== waveAmp) {
      material.uniforms.uWaveAmp.value = waveAmp
      vc.amp = waveAmp
    }
    if (vc.hex !== vibeColorHex) {
      material.uniforms.uVibeAccent.value.set(vibeColorHex)
      vc.hex = vibeColorHex
    }

    // ── O(1) Hover detection ─────────────────────────────────────────────────
    let hoverIdx = -1
    let newHoverId: string | null = null

    // Determine hover using actual cursor target (not smoothed spring cursor)
    // to keep hover selection snappy and directly aligned with the cursor coordinate.
    if (isMouseActive) {
      const halfC  = (COLS - 1) / 2
      const halfR  = (ROWS - 1) / 2
      
      // Inverse the vertex shader's micro-parallax to find which grid tile 
      // is visually residing under the exact mouse cursor coordinate.
      // Vertex Shader shift: displacedWPos.xy -= uMouse * 0.028
      const effectiveWorldX = targetWorldX + (targetWorldX * 0.028)
      const effectiveWorldY = targetWorldY + (targetWorldY * 0.028)

      // Map corrected world coordinates to grid indices (independent of camera position since the wall is static at origin)
      const c = Math.round((effectiveWorldX + (halfC * SPACING_X)) / SPACING_X)
      const r = Math.round(-effectiveWorldY / SPACING_Y + halfR)

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
      // O(1) Map lookup — replaces O(n) songs.find()
      const s = newHoverId ? (songMaps.byId.get(newHoverId) ?? null) : null
      onHover(s)
      gl.domElement.style.cursor = newHoverId ? 'pointer' : 'crosshair'
    }

    material.uniforms.uHoverIdx.value = hoverIdx

    let selIdx = -1
    if (selectedId) {
      // O(1) Map lookup — replaces O(n) songs.findIndex()
      const idx = songMaps.idxById.get(selectedId)
      if (idx !== undefined) selIdx = idx
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
