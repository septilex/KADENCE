import * as THREE from 'three'

// ── Tunable Physics Parameters ──────────────────────────────────────────────
// All values are documented in implementation_plan.md §14.
// Adjust these to change the feel of the jelly-water effect.
export const JELLY_PHYSICS = {
  // Simulation grid resolution (64×64 = 4096 cells)
  gridSize:          64,

  // Mouse interaction
  mouseRadius:       0.13,     // Slightly broader influence for softer transitions across neighboring tiles
  mouseStrength:     0.95,     // Generous response that feels supple and dynamic
  velocityCap:       35.0,     // Max mouse velocity before clamping
  velocityExponent:  0.65,     // Organic curve responding gracefully to both slow sweeps and quick flicks

  // Jelly: restoration spring stiffness (s⁻²)
  springK:           32.0,     // Softer restoration gives tiles a delayed, elastic jelly recovery

  // Water: neighbor coupling stiffness (s⁻²)
  neighborK:         24.0,     // Fluid inter-tile wave propagation

  // Exponential velocity decay rate (s⁻¹) — frame-rate independent
  dampingRate:       8.5,      // Lower damping extends momentum into a smooth, graceful glide

  // Safety limits
  maxDisplacement:   1.2,      // Max cell displacement (world units)
  maxVelocity:       10.0,     // Max cell velocity (world units/s)
}

// ── Cell state ──────────────────────────────────────────────────────────────
// Stored as flat arrays for cache-friendly iteration (SoA layout)

/**
 * 2D spring-mass simulation for jelly-water displacement.
 *
 * Each of the 64×64 cells is a point mass connected to:
 *   - its rest position (0,0) via a restoration spring  → jelly elasticity
 *   - its 4 immediate neighbors via coupling springs     → water-like wave propagation
 *
 * The cursor injects force proportional to its VELOCITY (not position),
 * so a stationary cursor creates zero displacement.
 *
 * Integration: semi-implicit Euler with exponential damping (frame-rate independent).
 * Output: RGBA Float32 DataTexture (R=dx, G=dy) for GPU vertex shader sampling.
 */
export class JellyField {
  readonly texture: THREE.DataTexture

  private readonly SIZE: number
  private readonly COUNT: number

  // SoA layout — 4 flat arrays for cache-friendly iteration
  private dx: Float32Array
  private dy: Float32Array
  private vx: Float32Array
  private vy: Float32Array

  // Texture backing buffer (shared reference with DataTexture)
  private textureData: Float32Array

  constructor() {
    const P = JELLY_PHYSICS
    this.SIZE = P.gridSize
    this.COUNT = this.SIZE * this.SIZE

    // Pre-allocate all state at rest (zero-initialized by Float32Array)
    this.dx = new Float32Array(this.COUNT)
    this.dy = new Float32Array(this.COUNT)
    this.vx = new Float32Array(this.COUNT)
    this.vy = new Float32Array(this.COUNT)

    // Pre-allocate texture backing array (RGBA Float32)
    this.textureData = new Float32Array(this.COUNT * 4)

    // Create GPU texture with bilinear interpolation for smooth sampling
    this.texture = new THREE.DataTexture(
      this.textureData,
      this.SIZE,
      this.SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.needsUpdate = true
  }

  /**
   * Run one simulation step.
   *
   * @param mouseWorldX  Mouse X in world-space (same coordinate system as tiles)
   * @param mouseWorldY  Mouse Y in world-space
   * @param mouseVelX    Mouse X velocity (world units/second)
   * @param mouseVelY    Mouse Y velocity (world units/second)
   * @param mouseActive  Whether the mouse is inside the viewport and valid
   * @param rawDt        Frame delta time in seconds
   * @param gridMinX     Left edge of tile grid (world units)
   * @param gridMinY     Bottom edge of tile grid (world units)
   * @param gridMaxX     Right edge of tile grid (world units)
   * @param gridMaxY     Top edge of tile grid (world units)
   */
  update(
    mouseWorldX: number,
    mouseWorldY: number,
    mouseVelX: number,
    mouseVelY: number,
    mouseActive: boolean,
    rawDt: number,
    gridMinX: number,
    gridMinY: number,
    gridMaxX: number,
    gridMaxY: number,
  ): void {
    const P = JELLY_PHYSICS
    const S = this.SIZE
    const { dx, dy, vx, vy, textureData } = this

    // Clamp dt for stability after tab-switching or long pauses
    const dt = Math.min(rawDt, 0.05)
    if (dt <= 0) return

    // ── Pre-compute frame-rate independent damping factor ──
    // exp(-γ·dt) gives identical total damping regardless of frame rate
    const dampFactor = Math.exp(-P.dampingRate * dt)

    // ── Pre-compute mouse response ──
    const gridDiagX = gridMaxX - gridMinX
    const gridDiagY = gridMaxY - gridMinY
    const gridDiag = Math.sqrt(gridDiagX * gridDiagX + gridDiagY * gridDiagY)
    const mouseRadiusWorld = P.mouseRadius * gridDiag
    const mouseRadiusWorldSq = mouseRadiusWorld * mouseRadiusWorld

    let mouseSpeed = 0
    let responseSpeed = 0
    let mouseDirX = 0
    let mouseDirY = 0
    let hasMouseForce = false

    if (mouseActive) {
      mouseSpeed = Math.sqrt(mouseVelX * mouseVelX + mouseVelY * mouseVelY)
      if (mouseSpeed > 0.1) {
        const cappedSpeed = Math.min(mouseSpeed, P.velocityCap)
        // Sublinear response: pow(x, 0.6) — slow movement is 2.5× more visible than linear
        responseSpeed = P.velocityCap * Math.pow(cappedSpeed / P.velocityCap, P.velocityExponent)
        mouseDirX = mouseVelX / mouseSpeed
        mouseDirY = mouseVelY / mouseSpeed
        hasMouseForce = true
      }
    }

    // ── Main simulation loop ──
    // Single-pass Gauss-Seidel iteration (reads already-updated West/North neighbors,
    // which actually accelerates convergence vs. double-buffered Jacobi)
    const springK = P.springK
    const neighborK = P.neighborK
    const maxDisp = P.maxDisplacement
    const maxVel = P.maxVelocity
    const mStr = P.mouseStrength

    for (let row = 0; row < S; row++) {
      for (let col = 0; col < S; col++) {
        const i = row * S + col

        const curDx = dx[i]
        const curDy = dy[i]

        // ── Force A: Restoration spring (pulls toward rest position 0,0) ──
        let Fx = -springK * curDx
        let Fy = -springK * curDy

        // ── Force B: Neighbor coupling (4-connected discrete Laplacian) ──
        // Missing neighbors at boundaries are treated as at rest (0,0),
        // which naturally pins grid edges and prevents edge artifacts
        if (col > 0) {
          const j = i - 1
          Fx += neighborK * (dx[j] - curDx)
          Fy += neighborK * (dy[j] - curDy)
        } else {
          Fx += neighborK * (0 - curDx)
          Fy += neighborK * (0 - curDy)
        }
        if (col < S - 1) {
          const j = i + 1
          Fx += neighborK * (dx[j] - curDx)
          Fy += neighborK * (dy[j] - curDy)
        } else {
          Fx += neighborK * (0 - curDx)
          Fy += neighborK * (0 - curDy)
        }
        if (row > 0) {
          const j = i - S
          Fx += neighborK * (dx[j] - curDx)
          Fy += neighborK * (dy[j] - curDy)
        } else {
          Fx += neighborK * (0 - curDx)
          Fy += neighborK * (0 - curDy)
        }
        if (row < S - 1) {
          const j = i + S
          Fx += neighborK * (dx[j] - curDx)
          Fy += neighborK * (dy[j] - curDy)
        } else {
          Fx += neighborK * (0 - curDx)
          Fy += neighborK * (0 - curDy)
        }

        // ── Force C: Mouse interaction ──
        // Force is proportional to mouse VELOCITY (not position)
        // so a stationary cursor creates zero displacement
        if (hasMouseForce) {
          const cellWorldX = gridMinX + (col + 0.5) / S * gridDiagX
          const cellWorldY = gridMinY + (row + 0.5) / S * gridDiagY
          const ddx = cellWorldX - mouseWorldX
          const ddy = cellWorldY - mouseWorldY
          const distSq = ddx * ddx + ddy * ddy

          // Skip sqrt when outside radius (cheaper squared comparison)
          if (distSq < mouseRadiusWorldSq) {
            const dist = Math.sqrt(distSq)
            const t = 1.0 - dist / mouseRadiusWorld
            // Smoothstep cubic: C¹ continuous, zero derivative at boundary
            const falloff = t * t * (3 - 2 * t)
            Fx += mouseDirX * responseSpeed * mStr * falloff
            Fy += mouseDirY * responseSpeed * mStr * falloff
          }
        }

        // ── Semi-implicit Euler integration ──
        // Step 1: velocity from force (using current position, updating velocity first)
        let newVx = vx[i] + Fx * dt
        let newVy = vy[i] + Fy * dt

        // Step 2: frame-rate independent exponential damping
        newVx *= dampFactor
        newVy *= dampFactor

        // Step 3: velocity safety clamp
        const speed = Math.sqrt(newVx * newVx + newVy * newVy)
        if (speed > maxVel) {
          const scale = maxVel / speed
          newVx *= scale
          newVy *= scale
        }

        vx[i] = newVx
        vy[i] = newVy

        // Step 4: position update (uses NEW velocity — semi-implicit)
        let newDx = curDx + newVx * dt
        let newDy = curDy + newVy * dt

        // Step 5: displacement soft clamp with energy absorption
        const disp = Math.sqrt(newDx * newDx + newDy * newDy)
        if (disp > maxDisp) {
          const scale = maxDisp / disp
          newDx *= scale
          newDy *= scale
          // Absorb kinetic energy at the boundary to prevent bouncing off the limit
          vx[i] *= 0.5
          vy[i] *= 0.5
        }

        dx[i] = newDx
        dy[i] = newDy

        // ── Write to texture (R=dx, G=dy, B=0, A=0) ──
        const ti = i * 4
        textureData[ti]     = newDx
        textureData[ti + 1] = newDy
        // B and A channels stay 0 (initialized by Float32Array)
      }
    }

    // Flag texture for GPU upload (Three.js calls gl.texSubImage2D — 64KB)
    this.texture.needsUpdate = true
  }

  /** Release GPU texture memory */
  dispose(): void {
    this.texture.dispose()
  }
}
