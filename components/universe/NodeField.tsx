'use client'
/* R3F owns mutable Three.js resources. Its frame loop intentionally updates GPU
   uniforms and the canvas cursor outside React; these are not React state. */
/* eslint-disable react-hooks/immutability */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SongNode, Vibe } from '@/lib/types'
import { SPACING_X, SPACING_Y, CARD_W, CARD_H, computeGrid, buildTileSlots } from '@/lib/gridCalc'
import { VIBE_COLORS } from '@/lib/types'
import { atlasManager } from '@/lib/atlasManager'
import { JellyField } from '@/lib/jellyField'
import { WallPicker, LENS_RADIUS, LENS_INTENSITY, PARALLAX_STRENGTH } from '@/lib/wallPicking'

interface NodeFieldProps {
  songs: SongNode[]
  currentVibe: Vibe | null
  hoveredId?: string | null
  selectedId: string | null
  onHover: (song: SongNode | null) => void
  onSelect: (song: SongNode | null) => void
  onPreview: (song: SongNode | null) => void
}

// ── Texture atlas config ──────────────────────────────────────────────────────
const TEXTURE_DEPTH = 256    // max unique artworks in the atlas (must match atlasManager)

const vertexShader = /* glsl */`
  in float aTexIndex;
  in float aInstanceIdx;

  out vec2 vUvCustom;
  flat out float vTexIndex;
  flat out float vArt;
  out vec2 vWorldXY;
  out float vHighlight;
  out vec3 vNormal;
  out float vWarpInfluence;
  out vec3 vVibeColor;
  out float vPopProgress;

  uniform vec2  uCameraXY;
  uniform vec2  uRawMouse;
  uniform vec2  uMouse;
  uniform float uHoverIdx;
  uniform float uSelectedIdx;
  uniform float uPopIdx;
  uniform float uPopProgress;
  uniform float uTime;
  uniform vec3  uVibeAccent;
  uniform float uWaveSpeed;
  uniform float uWaveAmp;
  uniform sampler2D uJellyMap;
  uniform vec4 uGridExtent;
  uniform sampler2D uReveal;
  uniform float uNow;
  uniform float uCols;

  void main() {
    vUvCustom = uv;
    vTexIndex = aTexIndex;

    // Per-artwork reveal: -1 = not loaded yet (placeholder), otherwise the time the cover
    // reached the GPU. Each cover fades in over ~0.45 s instead of popping.
    float revealAt = texelFetch(uReveal, ivec2(int(aTexIndex + 0.5), 0), 0).r;
    vArt = revealAt < 0.0 ? 0.0 : clamp((uNow - revealAt) / 0.45, 0.0, 1.0);
    vVibeColor = uVibeAccent;
    vPopProgress = 0.0;

    vec3 localPos = position;

    float localScale = 1.0;
    float zOffset    = 0.0;
    vHighlight       = abs(aInstanceIdx - uHoverIdx) < 0.1 ? 1.22 : 1.05;

    // Pop: Z offset + brightness only — no XY scale.
    // Scaling one tile's XY independently breaks surface continuity
    // with its neighbors, causing the "rubber card" jitter.
    if (abs(aInstanceIdx - uPopIdx) < 0.1) {
      // Keep hover geometry fixed: lifting the picked tile causes hit-test feedback at edges.
      vHighlight = mix(1.05, 1.45, uPopProgress);
      vPopProgress = uPopProgress;
    }

    // Selected: local scale is a deliberate UI state (not continuous motion)
    if (abs(aInstanceIdx - uSelectedIdx) < 0.1) {
      localScale = max(localScale, 1.06);
      zOffset    = max(zOffset, 0.8);
      vHighlight = max(vHighlight, 1.55);
    }

    localPos.xy *= localScale;
    localPos.z  += zOffset;

    // ── Tile center in world space (shared-field evaluation point) ──
    vec3 tileCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    vec3 baseWPos = (modelMatrix * instanceMatrix * vec4(localPos, 1.0)).xyz;
    vec3 displacedWPos = baseWPos;

    // ── Jelly Displacement Field (tile-center evaluation) ──
    // Evaluated at the tile CENTER so all vertices translate uniformly.
    // Per-vertex jelly sampling caused neighboring tiles to shift
    // independently, breaking the continuous surface.
    vec2 centerGridUV = (tileCenter.xy - uGridExtent.xy) / (uGridExtent.zw - uGridExtent.xy);
    vec2 jellyDisp = texture(uJellyMap, clamp(centerGridUV, 0.0, 1.0)).rg;
    displacedWPos.xy += jellyDisp;
    
    // ── Glass Lens (per-vertex for gentle rigid-body tilt) ──
    // The lens is a continuous world-space function. With flat 1×1 tiles,
    // the 4 corner vertices produce a gentle tilt — not per-tile curvature.
    // This gives the continuous membrane / bedsheet feel across the grid.
    vec2 deltaLens = displacedWPos.xy - uMouse;
    float distLens = length(deltaLens);
    
    float R = ${LENS_RADIUS.toFixed(1)};
    float lensFactor = 1.0 - smoothstep(0.0, R, distLens);
    
    float maxZ = ${LENS_INTENSITY.toFixed(1)};
    displacedWPos.z += lensFactor * maxZ;
    
    // ── Micro-Parallax (uniform — no per-instance variation) ──
    // All tiles shift by the same amount, preserving grid alignment.
    // Per-instance parallax (mod(aInstanceIdx,4)*0.08) caused adjacent
    // tiles to shift by different XY amounts — the primary jitter source.
    displacedWPos.xy -= uMouse * ${PARALLAX_STRENGTH.toFixed(3)};

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

    // Depth separation between neighbours. The jelly field can push adjacent tiles into each
    // other; coplanar overlaps z-fight (the overlapping strip flickers between the two covers).
    // A 2×2 checkerboard of tiny Z offsets gives every tile a different depth from all eight
    // of its neighbours, so one of them always wins cleanly.
    float gridCol = mod(aInstanceIdx, uCols);
    float gridRow = floor(aInstanceIdx / uCols);
    displacedWPos.z += (mod(gridCol, 2.0) + 2.0 * mod(gridRow, 2.0)) * 0.004;
    vWorldXY = displacedWPos.xy;

    vec4 mvPosition = viewMatrix * vec4(displacedWPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
// Pure artwork display for the resting wall. Inject vibe tinting based on active world status.
const fragmentShader = /* glsl */`
  precision highp sampler2DArray;

  in vec2  vUvCustom;
  flat in float vTexIndex;
  flat in float vArt;
  in vec2  vWorldXY;
  in float vHighlight;
  in vec3  vNormal;
  in float vWarpInfluence;
  in vec3  vVibeColor;
  in float vPopProgress;

  uniform sampler2DArray uAtlas;
  uniform float uSelectedIdx;
  uniform float uHoverIdx;
  uniform float uTime;

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
    // Subtly zoom out artwork to reveal a frame while the tile grows
    float artworkZoomScale = mix(1.0, 1.15, vPopProgress);
    vec2 scaledUv = centeredUv * artworkZoomScale;
    vec2 textureUv = scaledUv + 0.5;

    
    // Check bounds for the "expanding frame" effect
    vec4 c;
    if (textureUv.x < 0.0 || textureUv.x > 1.0 || textureUv.y < 0.0 || textureUv.y > 1.0) {
      // Solid color background mimicking the vibe accent behind the image
      c = vec4(vVibeColor * 0.15, 1.0);
    } else {
      // Placeholder for covers that are still downloading: dark glass in the chart's colour
      // with a slow sheen sweeping across the wall, so empty tiles read as "loading", not broken.
      float sheen = 0.5 + 0.5 * sin((vWorldXY.x + vWorldXY.y) * 0.22 - uTime * 1.6);
      vec3 placeholder = vec3(0.075, 0.075, 0.10) + vVibeColor * (0.05 + 0.07 * sheen * sheen)
                       + vec3(0.03) * (1.0 - textureUv.y);
      c = vec4(placeholder, 1.0);
      if (vArt > 0.0) {
        vec2 safeUv = clamp(textureUv, vec2(0.5 / 256.0), vec2(1.0 - 0.5 / 256.0));
        vec3 art = texture(uAtlas, vec3(safeUv.x, 1.0 - safeUv.y, vTexIndex)).rgb;
        float fade = vArt * vArt * (3.0 - 2.0 * vArt);
        c.rgb = mix(placeholder, art, fade);
      }
    }

    // ── Base colour: gamma-correct multiply by per-tile brightness ────────
    vec3 lin     = pow(c.rgb, vec3(2.2));
    
    // Direct highlight application (no artificial vibe tinting, preserving natural colors)
    vec3 baseRgb = lin * vHighlight;

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
    fragColor        = vec4(out_, 1.0);
  }
`;

export function NodeField({ songs, currentVibe, selectedId, onHover, onSelect }: NodeFieldProps) {
  const { camera, gl, size } = useThree()
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // ── Grid layout dimensions ─────────────────────────────────────────────────
  const dims  = useMemo(
    () => computeGrid(songs.length, size.width, size.height),
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
  const lastHoverVisualIdx = useRef<number>(-1)
  const jellyFieldRef = useRef<JellyField | null>(null)
  const prevMouseWorldRef = useRef(new THREE.Vector2(0, 0))
  const prevMouseActiveRef = useRef(false)
  const hoverStartTime    = useRef<number | null>(null)
  const activePopId       = useRef<string | null>(null)
  const popProgress       = useRef(0)

  // ── Pre-allocated scratch objects to avoid per-frame heap allocation ────────
  // These are reused every frame via .set() / .copy() — zero GC pressure.
  const picker = useMemo(() => new WallPicker(), [])
  const _scratchHit     = useRef(new THREE.Vector3())
  const _scratchPlane   = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))

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
    const tex = new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1)
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

  // Artwork is owned by atlasManager (single loader, per-slot de-duplication, generation
  // token against stale charts, throttled GPU uploads). NodeField only asks it to make sure
  // every slot for the current song list is populated — this also covers songs appended
  // by search, which do not go through prepareCriticalVibe().
  useEffect(() => {
    if (songs.length > 0) void atlasManager.ensureSongs(songs)
  }, [songs])

  // Sharper covers on the tilted tiles around the pointer.
  useEffect(() => {
    atlasManager.setAnisotropy(Math.min(8, gl.capabilities.getMaxAnisotropy()))
  }, [gl])

  // Per-instance texture index attribute — shuffled to prevent visible repeat patterns.
  // Uses a deterministic xorshift32 so layout is stable across re-renders but
  // visually random with no sequential stripes or diagonal artifact bands.
  // The layout lives in gridCalc so atlasManager can load artwork in on-screen order.
  const texIndices = useMemo(
    () => buildTileSlots(count, Math.min(songs.length, TEXTURE_DEPTH), COLS),
    [count, songs.length, COLS]
  )

  const instanceIndices = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) arr[i] = i
    return arr
  }, [count])

  // ── Tile geometry ─────────────────────────────────────────────────────────
  // Flat 1×1 tiles behave as rigid bodies: they tilt gently with the lens
  // deformation but never curve individually, preserving the continuous
  // bedsheet / membrane feel across the grid.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1)
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
      uPopIdx:        { value: -1 },
      uPopProgress:   { value: 0 },
      uTime:          { value: 0 },
      uVibeAccent:    { value: new THREE.Color('#d63384') },
      uWaveSpeed:     { value: 1.0 },
      uWaveAmp:       { value: 1.0 },
      uJellyMap:      { value: null },
      uGridExtent:    { value: new THREE.Vector4(0, 0, 1, 1) },
      uReveal:        { value: null },
      uNow:           { value: 0 },
      uCols:          { value: 1 },
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
      material.uniforms.uReveal.value = atlas.reveal
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

  // The same deformed surface is used for hover, mouse clicks and first touch taps.
  useEffect(() => {
    const el = gl.domElement
    const updateRect = () => { domRectRef.current = el.getBoundingClientRect() }
    updateRect()
    const observer = new ResizeObserver(updateRect)
    observer.observe(el)
    const onMove = (e: PointerEvent | MouseEvent) => {
      const r = domRectRef.current
      if (!r?.width || !r.height) return
      rawMouseNDC.current.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * -2 + 1)
    }
    const onLeave = () => {
      rawMouseNDC.current.set(-10, -10)
      lastHoverId.current = null
      lastHoverVisualIdx.current = -1
      activePopId.current = null
      hoverStartTime.current = null
      onHover(null)
    }
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { onMove(e); down = { x: e.clientX, y: e.clientY } }
    const raycaster = new THREE.Raycaster()
    const onClick = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return
      onMove(e)
      raycaster.setFromCamera(rawMouseNDC.current, camera)
      const idx = picker.pick(raycaster.ray, dims, smoothMouseWorld.current, jellyFieldRef.current)
      // A click always opens details, even after the dwell animation. Previously it
      // switched to an obsolete preview-only path after one second.
      if (idx >= 0) onSelect(songs[texIndices[idx]] ?? null)
    }
    window.addEventListener('resize', updateRect, { passive: true })
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerdown', onDown, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointercancel', onLeave)
    el.addEventListener('click', onClick)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointercancel', onLeave)
      el.removeEventListener('click', onClick)
    }
  }, [gl, camera, dims, picker, onHover, onSelect, songs, texIndices])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => {
    material.dispose()
    defaultAtlasTexture.dispose()
    jellyFieldRef.current?.dispose()
    jellyFieldRef.current = null
  }, [material, defaultAtlasTexture])

  // ── Frame Loop ─────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime()
    material.uniforms.uNow.value = atlasManager.now()
    material.uniforms.uCols.value = COLS

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
      const hit = state.raycaster.ray.intersectPlane(_scratchPlane.current, _scratchHit.current)
      
      if (hit) {
        targetWorldX = _scratchHit.current.x
        targetWorldY = _scratchHit.current.y
        isMouseActive = true
      }
    }

    // ── Smooth Delayed Cursor Tracking ──────────────────────────────────────
    // Add smooth spring lag to the cursor interaction so tiles have weight, delay,
    // and a luxurious fluid follow instead of snapping rigidly to the pointer.
    if (isMouseActive) {
      if (!prevMouseActiveRef.current) {
        // First frame active: snap so there is no wild jump from offscreen
        smoothMouseWorld.current.set(targetWorldX, targetWorldY)
        mouseVelocity.current.set(0, 0)
      } else {
        // Damped spring-follow towards actual cursor position
        // Gives the "drag through honey/liquid" delayed follow
        const followSpeed = 9.0 // Smooth delayed follow rate
        const alpha = 1.0 - Math.exp(-followSpeed * dt)
        smoothMouseWorld.current.x += (targetWorldX - smoothMouseWorld.current.x) * alpha
        smoothMouseWorld.current.y += (targetWorldY - smoothMouseWorld.current.y) * alpha
      }
    }

    rawMouseWorld.current.set(targetWorldX, targetWorldY)

    material.uniforms.uMouse.value.copy(smoothMouseWorld.current)
    material.uniforms.uRawMouse.value.copy(rawMouseWorld.current)

    // ── Jelly Field Physics Update ──────────────────────────────────────────
    // Lazy-init the jelly field on first frame (avoids creation if no frames run)
    if (!jellyFieldRef.current) {
      jellyFieldRef.current = new JellyField()
      material.uniforms.uJellyMap.value = jellyFieldRef.current.texture
    }

    // Compute grid world-space extents from current tile layout
    const halfC_j = (COLS - 1) / 2
    const halfR_j = (ROWS - 1) / 2
    const gMinX = -halfC_j * SPACING_X
    const gMinY = -halfR_j * SPACING_Y
    const gMaxX = halfC_j * SPACING_X
    const gMaxY = halfR_j * SPACING_Y
    material.uniforms.uGridExtent.value.set(gMinX, gMinY, gMaxX, gMaxY)

    // Compute velocity of the smoothed interaction point for jelly physics
    // Using smoothed coordinates provides fluid, organic momentum without jerky jitter
    let jellyVelX = 0
    let jellyVelY = 0
    if (isMouseActive && prevMouseActiveRef.current && dt > 0) {
      jellyVelX = (smoothMouseWorld.current.x - prevMouseWorldRef.current.x) / dt
      jellyVelY = (smoothMouseWorld.current.y - prevMouseWorldRef.current.y) / dt
    }
    prevMouseActiveRef.current = isMouseActive
    if (isMouseActive) {
      prevMouseWorldRef.current.copy(smoothMouseWorld.current)
    }

    // Run spring-mass simulation and upload displacement texture to GPU
    jellyFieldRef.current.update(
      smoothMouseWorld.current.x, smoothMouseWorld.current.y,
      jellyVelX, jellyVelY,
      isMouseActive,
      dt,
      gMinX, gMinY, gMaxX, gMaxY,
    )

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

    const hoverIdx = isMouseActive
      ? picker.pick(state.raycaster.ray, dims, smoothMouseWorld.current, jellyFieldRef.current)
      : -1
    const hoveredSong = hoverIdx >= 0 ? songs[texIndices[hoverIdx]] : null
    const newHoverId = hoveredSong?.id ?? null
    // Visual identity matters: the same song occurs on multiple tiles.
    if (newHoverId !== lastHoverId.current || hoverIdx !== lastHoverVisualIdx.current) {
      const songChanged = newHoverId !== lastHoverId.current
      lastHoverId.current = newHoverId
      lastHoverVisualIdx.current = hoverIdx
      hoverStartTime.current = newHoverId ? state.clock.getElapsedTime() : null
      activePopId.current = null
      popProgress.current = 0
      if (songChanged) onHover(hoveredSong ?? null)
      gl.domElement.style.cursor = newHoverId ? 'pointer' : 'crosshair'
    }

    // ── Hover Dwell & Pop Animation ──────────────────────────────────────────
    const currentElapsedTime = state.clock.getElapsedTime()
    if (lastHoverId.current && hoverStartTime.current !== null) {
      if (currentElapsedTime - hoverStartTime.current >= 1.0) { // 1 second dwell
        activePopId.current = lastHoverId.current
      }
    }

    let targetPopProgress = 0
    let currentPopIdx = -1

    if (activePopId.current === lastHoverId.current && lastHoverId.current !== null) {
      targetPopProgress = 1
      currentPopIdx = hoverIdx
    } else if (popProgress.current > 0.01) {
      // Keep rendering the previous pop index while it shrinks back
      currentPopIdx = material.uniforms.uPopIdx.value
    }

    // Ease pop progress (Frame-rate independent exponential decay)
    // Growth ~500ms, Shrink ~350ms
    const popSpeed = targetPopProgress === 1 ? 6.0 : 8.0
    const alpha = 1.0 - Math.exp(-popSpeed * dt)
    popProgress.current += (targetPopProgress - popProgress.current) * alpha

    if (popProgress.current < 0.001) {
      popProgress.current = 0
    }

    material.uniforms.uPopIdx.value = currentPopIdx
    material.uniforms.uPopProgress.value = popProgress.current
    material.uniforms.uHoverIdx.value = hoverIdx

    let selIdx = -1
    if (selectedId) {
      // O(1) Map lookup — replaces O(n) songs.findIndex()
      const idx = songMaps.idxById.get(selectedId)
      if (idx !== undefined) selIdx = texIndices.indexOf(idx)
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
