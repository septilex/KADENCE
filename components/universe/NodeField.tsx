'use client'
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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
const TEXTURE_SIZE  = 256    // px per atlas slot (quality vs VRAM trade-off)
const TEXTURE_DEPTH = 512    // max unique artworks in the atlas
const MAX_LOADS     = 16     // concurrent in-flight image loads

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
    
    // ── Localized Optical Z-Pull Bubble (Luxurious Pressure Field) ──
    // The focus bubble follows the highly smoothed mouse coordinate.
    // When the cursor pauses, the bubble softly arrives, gradually enlarging 
    // the nearby posters and giving them depth, creating a breathing effect.
    vec2 deltaMouse = baseWPos.xy - uMouse;
    float distMouseSq = dot(deltaMouse, deltaMouse);
    float bulgeSpread = 0.015; // Soft, atmospheric focus area
    float bulgeAmount = 10.0;  // Elegant depth attraction (amplified smoothly by arrival)
    float exp_term = exp(-distMouseSq * bulgeSpread);
    displacedWPos.z += exp_term * bulgeAmount;
    
    // ── Surface Normal Calculation ───────────────────────────
    float dz_dx = -2.0 * deltaMouse.x * bulgeSpread * bulgeAmount * exp_term;
    float dz_dy = -2.0 * deltaMouse.y * bulgeSpread * bulgeAmount * exp_term;
    vNormal = normalize(vec3(-dz_dx, -dz_dy, 1.0));
    
    vWarpInfluence = exp_term; 
    vHighlight += exp_term * 0.15; // Smooth cinematic brightness lift

    // Ambient breathing
    float b1 = sin(baseWPos.x * 0.072 + baseWPos.y * 0.051 + uTime * 0.23 * uWaveSpeed);
    float b2 = sin(baseWPos.x * -0.048 + baseWPos.y * 0.082 + uTime * 0.18 * uWaveSpeed);
    displacedWPos.z += (b1 + b2) * 0.052 * uWaveAmp;

    vec4 mvPosition = viewMatrix * vec4(displacedWPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
// Pure artwork display for the resting wall. Inject vibe tinting based on active world status.
const fragmentShader = /* glsl */`
  precision mediump sampler2DArray;

  in vec2  vUvCustom;
  in float vTexIndex;
  in float vHighlight;
  in vec3  vNormal;
  in float vWarpInfluence;
  in vec3  vVibeColor;

  uniform sampler2DArray uTextures;
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

    vec4 c = texture(uTextures, vec3(vUvCustom, vTexIndex));

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
  const smoothMouseWorld  = useRef(new THREE.Vector2(0, 0))
  const lastHoverId       = useRef<string | null>(null)
  const textureNeedsFlush = useRef(false)

  // ── Texture Atlas ─────────────────────────────────────────────────────────
  const textureArray = useMemo(() => {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4 * TEXTURE_DEPTH)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10; data[i + 1] = 10; data[i + 2] = 14; data[i + 3] = 255
    }
    const tex = new THREE.DataArrayTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_DEPTH)
    tex.format          = THREE.RGBAFormat
    tex.type            = THREE.UnsignedByteType
    tex.minFilter       = THREE.LinearFilter
    tex.magFilter       = THREE.LinearFilter
    tex.wrapS           = THREE.ClampToEdgeWrapping
    tex.wrapT           = THREE.ClampToEdgeWrapping
    tex.generateMipmaps = false
    tex.needsUpdate     = true
    return tex
  }, [])

  // Offscreen canvas for image→texture upload
  const offscreenCanvas = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cvs = document.createElement('canvas')
    cvs.width = cvs.height = TEXTURE_SIZE
    offscreenCanvas.current = cvs
  }, [])

  const loadedSet  = useRef(new Set<number>())
  const loadingSet = useRef(new Set<number>())

  // Reset on songs change
  useEffect(() => {
    loadedSet.current.clear()
    loadingSet.current.clear()
  }, [songs])

  const imageLoader = useMemo(() => {
    const l = new THREE.ImageLoader()
    l.setCrossOrigin('anonymous')
    return l
  }, [])

  const loadSlot = (realIdx: number, url: string) => {
    if (!url || loadedSet.current.has(realIdx) || loadingSet.current.has(realIdx)) return
    loadingSet.current.add(realIdx)
    imageLoader.load(url, (img) => {
      const upload = () => {
        const cvs = offscreenCanvas.current
        if (!cvs) return
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        ctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        const imgData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        const slot    = realIdx % TEXTURE_DEPTH
        const offset  = slot * TEXTURE_SIZE * TEXTURE_SIZE * 4
        ;(textureArray.image.data as Uint8Array).set(imgData.data, offset)
        textureNeedsFlush.current = true
        loadedSet.current.add(realIdx)
        loadingSet.current.delete(realIdx)
      }
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(upload, { timeout: 200 })
      } else {
        setTimeout(upload, 0)
      }
    }, undefined, () => {
      loadedSet.current.add(realIdx)
      loadingSet.current.delete(realIdx)
    })
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
      uTextures:    { value: textureArray },
      uCameraXY:    { value: new THREE.Vector2(0, 0) },
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
  }), [textureArray])

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
    if (textureNeedsFlush.current) {
      textureArray.needsUpdate = true
      textureNeedsFlush.current = false
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

    // ── Cinematic Breathing Parallax ─────────────────────────────────────────
    // A highly smoothed, luxurious exponential ease (not a bouncy spring).
    // This allows the focus bubble to gently drift and arrive at the cursor 
    // when paused, creating the soft progressive enlargement.
    const easeFactor = 1.0 - Math.exp(-3.5 * dt);
    smoothMouseWorld.current.x += (targetWorldX - smoothMouseWorld.current.x) * easeFactor;
    smoothMouseWorld.current.y += (targetWorldY - smoothMouseWorld.current.y) * easeFactor;

    material.uniforms.uMouse.value.copy(smoothMouseWorld.current)

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
          const s   = songs[hoverIdx % songs.length]
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
