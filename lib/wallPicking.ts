import { Ray, Vector2, Vector3 } from 'three'
import { CARD_W, CARD_H, SPACING_X, SPACING_Y, type GridDims } from './gridCalc'

// Shared with the vertex shader. Picking must use the same surface as rendering.
export const LENS_RADIUS = 10.2
export const LENS_INTENSITY = 5.3
export const PARALLAX_STRENGTH = 0.028
export const MAX_JELLY_DISPLACEMENT = 1.2

export interface DisplacementSampler {
  sample(u: number, v: number, target: Vector2): Vector2
}

/** Allocation-free ray/triangle picking against the four rendered tile vertices. */
export class WallPicker {
  private corners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()]
  private displacement = new Vector2()
  private hit = new Vector3()
  private near = new Vector3()
  private far = new Vector3()

  pick(ray: Ray, dims: GridDims, mouse: Vector2, jelly: DisplacementSampler | null): number {
    if (Math.abs(ray.direction.z) < 1e-8) return -1
    const t0 = -ray.origin.z / ray.direction.z
    const t1 = (LENS_INTENSITY - ray.origin.z) / ray.direction.z
    if (t0 < 0 && t1 < 0) return -1
    ray.at(Math.max(0, t0), this.far)
    ray.at(Math.max(0, t1), this.near)
    const halfC = (dims.COLS - 1) / 2
    const halfR = (dims.ROWS - 1) / 2
    const pad = MAX_JELLY_DISPLACEMENT + Math.max(CARD_W, CARD_H) / 2
    const minX = Math.min(this.near.x, this.far.x) + mouse.x * PARALLAX_STRENGTH - pad
    const maxX = Math.max(this.near.x, this.far.x) + mouse.x * PARALLAX_STRENGTH + pad
    const minY = Math.min(this.near.y, this.far.y) + mouse.y * PARALLAX_STRENGTH - pad
    const maxY = Math.max(this.near.y, this.far.y) + mouse.y * PARALLAX_STRENGTH + pad
    const c0 = Math.max(0, Math.ceil(minX / SPACING_X + halfC))
    const c1 = Math.min(dims.COLS - 1, Math.floor(maxX / SPACING_X + halfC))
    const r0 = Math.max(0, Math.ceil(halfR - maxY / SPACING_Y))
    const r1 = Math.min(dims.ROWS - 1, Math.floor(halfR - minY / SPACING_Y))
    let closest = Infinity
    let index = -1
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = (c - halfC) * SPACING_X
      const y = (halfR - r) * SPACING_Y
      this.displacement.set(0, 0)
      jelly?.sample(c / (dims.COLS - 1), 1 - r / (dims.ROWS - 1), this.displacement)
      for (let i = 0; i < 4; i++) {
        // PlaneGeometry ordering: top-left, top-right, bottom-left, bottom-right.
        const vx = x + (i % 2 ? 1 : -1) * CARD_W / 2 + this.displacement.x
        const vy = y + (i < 2 ? 1 : -1) * CARD_H / 2 + this.displacement.y
        const t = Math.min(1, Math.hypot(vx - mouse.x, vy - mouse.y) / LENS_RADIUS)
        const z = (1 - t * t * (3 - 2 * t)) * LENS_INTENSITY
        this.corners[i].set(vx - mouse.x * PARALLAX_STRENGTH, vy - mouse.y * PARALLAX_STRENGTH, z)
      }
      const [a, b, d, e] = this.corners
      for (let tri = 0; tri < 2; tri++) {
        const hit = tri === 0 ? ray.intersectTriangle(a, d, b, false, this.hit) : ray.intersectTriangle(d, e, b, false, this.hit)
        if (hit) {
          const distance = ray.origin.distanceToSquared(hit)
          if (distance < closest) { closest = distance; index = r * dims.COLS + c }
        }
      }
    }
    return index
  }
}
