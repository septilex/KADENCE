'use client'

import { useRef, useEffect } from 'react'
import { globalAudioManager } from '@/lib/audioManager'

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════════

const PERIM_COUNT = 420    // Points along the rectangular perimeter
const DEPTH_COUNT = 45     // Depth rows (structured particle strands)
const NUM_LAYERS = 6       // Instanced layers (single draw call)
const CORNER_FRAC = 0.035  // Corner radius as fraction of min(halfW, halfH)
const MARGIN = 0.025       // Inset from viewport edges
const MAX_DPR = 1.5        // Cap device pixel ratio for performance

// ════════════════════════════════════════════════════════════════════════════════
// GLSL SHADERS
// ════════════════════════════════════════════════════════════════════════════════

const PARTICLE_VERT = `#version 300 es
precision highp float;

in float aS;
in float aD;
in vec2 aPos;
in vec2 aNorm;

uniform float uTime;
uniform vec2 uHalfRes;
uniform float uAudioFinal;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;

out float vDepth;
out float vBrightness;

// ── 3D Gradient Noise ──────────────────────────────────────────────────────────
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx) * 2.0 - 1.0;
}

float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
            dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
            dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
            dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
            dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

// ── FBM (NCS-style octave noise) ────────────────────────────────────────────
float fbm(vec3 p) {
  float v = 0.0, a = 1.0, t = 0.0;
  for (int i = 0; i < 3; i++) {
    v += gnoise(p) * a;
    t += a;
    p *= 2.0;
    a *= 0.45;
  }
  return v / t;
}

void main() {
  float layerIdx = float(gl_InstanceID);
  float numLayers = float(${NUM_LAYERS});

  // ── Layer-specific variation ──────────────────────────────────────────────
  // Each layer shares the same noise field but evaluates at shifted coordinates.
  // This creates interleaved deformation: some layers bulge where others recede.
  float layerPhase = layerIdx * 0.73;
  float layerFreq = 1.0 + layerIdx * 0.12;
  float layerSpeed = 1.0 + layerIdx * 0.055;
  float layerDepthBias = (layerIdx / numLayers - 0.5) * 12.0;

  // ── Noise coordinates (continuous around perimeter via aS) ────────────────
  float fScale = 3.8;
  float timeBase = uTime * 0.014;
  vec3 noiseCoord = vec3(
    aS * 6.2832 * layerFreq + layerPhase,
    aD * 2.5 + layerPhase * 0.2,
    timeBase * layerSpeed
  );

  // Audio-modulated displacement (core NCS concept)
  // Always has subtle ambient motion; audio intensifies it
  float audioMod = max(0.15, uAudioFinal);

  // Primary displacement: perpendicular to perimeter edge (in/out)
  float dispNormal = fbm(noiseCoord * fScale) * audioMod;

  // Secondary displacement: along perimeter (stretch/compress)
  vec3 noiseCoord2 = noiseCoord.yxz + vec3(17.3, 5.7, 0.0);
  float dispTangent = fbm(noiseCoord2 * fScale * 0.65) * audioMod * 0.35;

  // Tertiary: slow large-scale breathing wave
  float breathe = sin(aS * 6.2832 * 2.0 + timeBase * 3.0 + layerPhase) * 0.12 * (0.3 + uBass * 0.7);

  // ── Position computation ──────────────────────────────────────────────────
  float normalOffset = dispNormal * 65.0 + uBass * 20.0 + breathe * 30.0;
  float maxInward = min(uHalfRes.x, uHalfRes.y) * 0.16;
  float depthOffset = aD * maxInward + layerDepthBias;

  vec2 tangent = vec2(-aNorm.y, aNorm.x);
  float tangentOffset = dispTangent * 20.0 + uMid * 6.0;

  vec2 pos = aPos + aNorm * (depthOffset + normalOffset) + tangent * tangentOffset;

  gl_Position = vec4(pos / uHalfRes, 0.0, 1.0);

  // ── Point size: contour particles large + soft, inner particles small ─────
  float contourFactor = smoothstep(0.06, 0.0, aD);
  float baseSize = mix(2.5, 7.0, contourFactor);
  float audioSize = uBass * 3.5 + uEnergy * 1.5;
  gl_PointSize = max(1.0, baseSize + audioSize);

  // ── Varyings ──────────────────────────────────────────────────────────────
  vDepth = aD;
  vBrightness = abs(dispNormal) + contourFactor * 0.4 + uBass * 0.3;
}
`

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in float vDepth;
in float vBrightness;

uniform vec3 uColor;
uniform float uBass;
uniform float uEnergy;

out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;

  // Core: sharp luminous center
  float core = smoothstep(0.65, 0.0, r);

  // Halo: soft atmospheric glow extending beyond core
  float halo = exp(-r * r * 3.5);

  // Depth-based opacity: outer (d~0) = bright, inner (d~1) = dim
  float depthFade = mix(1.0, 0.08, pow(vDepth, 0.55));

  // Contour boost for outermost particles (forms the bright outer ring)
  float contour = smoothstep(0.06, 0.0, vDepth);

  // Audio-driven brightness
  float audioBright = 1.0 + uEnergy * 0.5;

  // White-hot highlights on extreme bass transients (contour region only)
  float whiteHot = clamp((uBass - 0.65) * 4.0, 0.0, 0.75);
  vec3 col = mix(uColor, vec3(1.0), whiteHot * contour);

  // Final intensity: core particles + atmospheric halo via additive overlap
  float intensity = (core * 0.14 + halo * 0.022)
                  * depthFade
                  * audioBright
                  * (1.0 + contour * 2.8)
                  * (0.6 + vBrightness * 0.6);

  // Premultiplied alpha for correct compositing over the page
  fragColor = vec4(col * intensity, intensity);
}
`

// ════════════════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS (NCS-style multi-band sorting + nonlinear mixing)
// ════════════════════════════════════════════════════════════════════════════════

interface AudioData {
  bass: number
  mid: number
  high: number
  energy: number
  final: number
}

const ZERO_AUDIO: AudioData = { bass: 0, mid: 0, high: 0, energy: 0, final: 0 }

function analyzeAudio(analyser: AnalyserNode | null, dataArray: Uint8Array<ArrayBuffer> | null): AudioData {
  if (!analyser || !dataArray) return ZERO_AUDIO
  analyser.getByteFrequencyData(dataArray)
  const n = analyser.frequencyBinCount

  // Frequency band averages (normalized 0-1)
  let subBass = 0, bass = 0, lowMid = 0, mid = 0
  let upperMid = 0, high = 0, presence = 0, air = 0

  for (let i = 0; i < 2 && i < n; i++) subBass += dataArray[i]
  subBass /= Math.max(1, Math.min(2, n)) * 255

  for (let i = 2; i < 6 && i < n; i++) bass += dataArray[i]
  bass /= Math.max(1, Math.min(4, n - 2)) * 255

  for (let i = 6; i < 14 && i < n; i++) lowMid += dataArray[i]
  lowMid /= Math.max(1, Math.min(8, n - 6)) * 255

  for (let i = 14; i < 30 && i < n; i++) mid += dataArray[i]
  mid /= Math.max(1, Math.min(16, n - 14)) * 255

  for (let i = 30; i < 50 && i < n; i++) upperMid += dataArray[i]
  upperMid /= Math.max(1, Math.min(20, n - 30)) * 255

  for (let i = 50; i < 70 && i < n; i++) high += dataArray[i]
  high /= Math.max(1, Math.min(20, n - 50)) * 255

  for (let i = 70; i < 100 && i < n; i++) presence += dataArray[i]
  presence /= Math.max(1, Math.min(30, n - 70)) * 255

  for (let i = 100; i < n; i++) air += dataArray[i]
  air /= Math.max(1, n - 100) * 255

  // Overall energy
  let total = 0
  for (let i = 0; i < n; i++) total += dataArray[i]
  const energy = total / (n * 255)

  // NCS-style 8-band sorting + nonlinear mixing
  // The original uses a bitonic merge sort then combines via nested mix()
  const bands = [subBass, bass, lowMid, mid, upperMid, high, presence, air]
  bands.sort((a, b) => a - b)
  const a = bands

  const fracMul = 9.0
  const fracMix = 0.5
  const t1L = a[7] * a[6] - a[1] * a[0]
  const t1 = t1L * (1 - a[5]) + a[7] * a[6] * a[5]
  const inner = a[6] * ((a[7] - a[0]) * (1 - a[7] * a[6]) + (a[6] - a[3]) * a[7] * a[6])
  const t2L = inner - Math.pow(Math.max(0, a[1] * a[0]), 1.05)
  const t2 = t2L * (1 - a[5] * a[4]) + a[7] * a[6] * a[5] * a[4]
  const finalAudio = fracMul * (t1 * (1 - fracMix) + t2 * fracMix)

  return {
    bass: (subBass + bass) / 2,
    mid: (lowMid + mid) / 2,
    high: (upperMid + high) / 2,
    energy,
    final: Math.max(0, isFinite(finalAudio) ? finalAudio : 0),
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// GEOMETRY GENERATION (Rounded Rectangle Perimeter Particle Grid)
// ════════════════════════════════════════════════════════════════════════════════

function generateGeometry(width: number, height: number): Float32Array {
  const STRIDE = 6 // aS, aD, aPx, aPy, aNx, aNy

  const hw = width * 0.5 * (1 - MARGIN)
  const hh = height * 0.5 * (1 - MARGIN)
  const cr = Math.min(hw, hh) * CORNER_FRAC

  // Segment lengths
  const edgeW = hw * 2 - cr * 2
  const edgeH = hh * 2 - cr * 2
  const arc = Math.PI * cr / 2
  const totalLen = 2 * edgeW + 2 * edgeH + 4 * arc

  const data = new Float32Array(PERIM_COUNT * DEPTH_COUNT * STRIDE)
  let idx = 0

  for (let pi = 0; pi < PERIM_COUNT; pi++) {
    const s = pi / PERIM_COUNT
    let d = s * totalLen
    let px: number, py: number, nx: number, ny: number

    if (d < edgeW) {
      // Top edge (left → right)
      px = -hw + cr + d
      py = hh
      nx = 0; ny = -1
    } else {
      d -= edgeW
      if (d < arc) {
        // Top-right corner
        const theta = (Math.PI / 2) * (1 - d / arc)
        px = hw - cr + Math.sin(Math.PI / 2 - theta) * cr
        py = hh - cr + Math.cos(Math.PI / 2 - theta) * cr
        // Proper inward normal at this arc position
        const a = Math.PI / 2 - theta
        nx = -Math.sin(a)
        ny = -Math.cos(a)
      } else {
        d -= arc
        if (d < edgeH) {
          // Right edge (top → bottom)
          px = hw
          py = hh - cr - d
          nx = -1; ny = 0
        } else {
          d -= edgeH
          if (d < arc) {
            // Bottom-right corner
            const t = d / arc
            const a = t * Math.PI / 2
            px = hw - cr + Math.cos(a) * cr
            py = -hh + cr - Math.sin(a) * cr
            nx = -Math.cos(a)
            ny = Math.sin(a)
          } else {
            d -= arc
            if (d < edgeW) {
              // Bottom edge (right → left)
              px = hw - cr - d
              py = -hh
              nx = 0; ny = 1
            } else {
              d -= edgeW
              if (d < arc) {
                // Bottom-left corner
                const t = d / arc
                const a = t * Math.PI / 2
                px = -hw + cr - Math.sin(a) * cr
                py = -hh + cr + (1 - Math.cos(a)) * cr - cr
                // Simplify
                py = -hh + cr - Math.cos(a) * cr
                nx = Math.sin(a)
                ny = Math.cos(a)
              } else {
                d -= arc
                if (d < edgeH) {
                  // Left edge (bottom → top)
                  px = -hw
                  py = -hh + cr + d
                  nx = 1; ny = 0
                } else {
                  d -= edgeH
                  // Top-left corner
                  const t = Math.min(d / arc, 1)
                  const a = t * Math.PI / 2
                  px = -hw + cr - Math.cos(a) * cr
                  py = hh - cr + Math.sin(a) * cr
                  nx = Math.cos(a)
                  ny = -Math.sin(a)
                }
              }
            }
          }
        }
      }
    }

    // Generate depth rows for this perimeter point
    for (let di = 0; di < DEPTH_COUNT; di++) {
      const depth = di / (DEPTH_COUNT - 1)
      data[idx++] = s      // aS
      data[idx++] = depth  // aD
      data[idx++] = px     // aPx
      data[idx++] = py     // aPy
      data[idx++] = nx     // aNx
      data[idx++] = ny     // aNy
    }
  }

  return data
}

// ════════════════════════════════════════════════════════════════════════════════
// WEBGL UTILITIES
// ════════════════════════════════════════════════════════════════════════════════

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Kadence Reactor: Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Kadence Reactor: Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ]
}

// ════════════════════════════════════════════════════════════════════════════════
// REACT COMPONENT
// ════════════════════════════════════════════════════════════════════════════════

interface NCSReactorProps {
  color?: string
  isActive: boolean
}

export function NCSReactor({ color = '#ffffff', isActive }: NCSReactorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mutable refs (no React re-renders in the render loop)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const vaoRef = useRef<WebGLVertexArrayObject | null>(null)
  const bufRef = useRef<WebGLBuffer | null>(null)
  const vertCountRef = useRef(0)
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({})
  const rafRef = useRef(0)

  const targetColorRef = useRef<[number, number, number]>([1, 1, 1])
  const currentColorRef = useRef<[number, number, number]>([1, 1, 1])
  const isActiveRef = useRef(false)
  const audioDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const smoothedRef = useRef({ bass: 0, mid: 0, high: 0, energy: 0, final: 0 })

  // ── Initialize WebGL2 ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      desynchronized: true,
    })
    if (!gl) {
      console.warn('Kadence Reactor: WebGL2 not available')
      return
    }
    glRef.current = gl

    // Compile shaders
    const vs = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERT)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAG)
    if (!vs || !fs) return

    const program = linkProgram(gl, vs, fs)
    if (!program) return
    programRef.current = program

    // Clean up shader objects (program retains them)
    gl.deleteShader(vs)
    gl.deleteShader(fs)

    // Cache uniform locations
    uniformsRef.current = {
      uTime: gl.getUniformLocation(program, 'uTime'),
      uHalfRes: gl.getUniformLocation(program, 'uHalfRes'),
      uAudioFinal: gl.getUniformLocation(program, 'uAudioFinal'),
      uBass: gl.getUniformLocation(program, 'uBass'),
      uMid: gl.getUniformLocation(program, 'uMid'),
      uHigh: gl.getUniformLocation(program, 'uHigh'),
      uEnergy: gl.getUniformLocation(program, 'uEnergy'),
      uColor: gl.getUniformLocation(program, 'uColor'),
    }

    // Prepare audio data buffer
    const analyser = globalAudioManager.getAnalyser()
    if (analyser) {
      audioDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
    }

    return () => {
      gl.deleteProgram(program)
      programRef.current = null
      if (vaoRef.current) gl.deleteVertexArray(vaoRef.current)
      if (bufRef.current) gl.deleteBuffer(bufRef.current)
      vaoRef.current = null
      bufRef.current = null
      glRef.current = null
    }
  }, [])

  // ── Geometry setup + resize handling ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const gl = glRef.current
    const program = programRef.current
    if (!canvas || !gl || !program) return

    const setupGeometry = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const w = Math.floor(window.innerWidth * dpr)
      const h = Math.floor(window.innerHeight * dpr)
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)

      // Generate particle grid
      const data = generateGeometry(w, h)
      const count = PERIM_COUNT * DEPTH_COUNT
      vertCountRef.current = count

      // Delete old buffer/VAO
      if (vaoRef.current) gl.deleteVertexArray(vaoRef.current)
      if (bufRef.current) gl.deleteBuffer(bufRef.current)

      // Create new buffer
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      bufRef.current = buf

      // Create VAO
      const vao = gl.createVertexArray()!
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)

      const STRIDE = 6 * 4 // 6 floats × 4 bytes
      const aS = gl.getAttribLocation(program, 'aS')
      const aD = gl.getAttribLocation(program, 'aD')
      const aPos = gl.getAttribLocation(program, 'aPos')
      const aNorm = gl.getAttribLocation(program, 'aNorm')

      if (aS >= 0) { gl.enableVertexAttribArray(aS); gl.vertexAttribPointer(aS, 1, gl.FLOAT, false, STRIDE, 0) }
      if (aD >= 0) { gl.enableVertexAttribArray(aD); gl.vertexAttribPointer(aD, 1, gl.FLOAT, false, STRIDE, 4) }
      if (aPos >= 0) { gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 8) }
      if (aNorm >= 0) { gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 2, gl.FLOAT, false, STRIDE, 16) }

      gl.bindVertexArray(null)
      vaoRef.current = vao
    }

    setupGeometry()

    const onResize = () => setupGeometry()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Track active state ─────────────────────────────────────────────────────
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // ── Track target color ─────────────────────────────────────────────────────
  useEffect(() => {
    if (color) targetColorRef.current = hexToRGB(color)
  }, [color])

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const render = () => {
      rafRef.current = requestAnimationFrame(render)

      const gl = glRef.current
      const program = programRef.current
      const vao = vaoRef.current
      if (!gl || !program || !vao) return

      // ── Color interpolation (smooth morph between tracks) ──
      const cc = currentColorRef.current
      const tc = targetColorRef.current
      cc[0] += (tc[0] - cc[0]) * 0.045
      cc[1] += (tc[1] - cc[1]) * 0.045
      cc[2] += (tc[2] - cc[2]) * 0.045

      // ── Audio analysis ──
      // Lazily acquire analyser (it might be created after first render)
      if (!audioDataArrayRef.current) {
        const an = globalAudioManager.getAnalyser()
        if (an) audioDataArrayRef.current = new Uint8Array(an.frequencyBinCount)
      }
      const rawAudio = analyzeAudio(globalAudioManager.getAnalyser(), audioDataArrayRef.current)

      // ── Smooth audio (envelope following) ──
      const sm = smoothedRef.current
      sm.bass += (rawAudio.bass - sm.bass) * 0.18
      sm.mid += (rawAudio.mid - sm.mid) * 0.14
      sm.high += (rawAudio.high - sm.high) * 0.12
      sm.energy += (rawAudio.energy - sm.energy) * 0.12
      sm.final += (rawAudio.final - sm.final) * 0.14

      // Skip GPU work if fully inactive and audio has decayed
      if (!isActiveRef.current && sm.energy < 0.003 && sm.bass < 0.003) return

      // ── Draw ──
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE) // Additive accumulation

      gl.useProgram(program)

      const u = uniformsRef.current
      gl.uniform1f(u.uTime, performance.now() / 1000)
      gl.uniform2f(u.uHalfRes, gl.canvas.width / 2, gl.canvas.height / 2)
      gl.uniform1f(u.uAudioFinal, sm.final + 0.1)  // Ambient baseline
      gl.uniform1f(u.uBass, sm.bass)
      gl.uniform1f(u.uMid, sm.mid)
      gl.uniform1f(u.uHigh, sm.high)
      gl.uniform1f(u.uEnergy, sm.energy)
      gl.uniform3f(u.uColor, cc[0], cc[1], cc[2])

      gl.bindVertexArray(vao)
      gl.drawArraysInstanced(gl.POINTS, 0, vertCountRef.current, NUM_LAYERS)
      gl.bindVertexArray(null)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        opacity: isActive ? 1 : 0,
        transition: 'opacity 1.2s ease',
      }}
    />
  )
}
