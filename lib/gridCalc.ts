/**
 * Shared grid math — imported by NodeField & CameraController.
 *
 * Design targets (all at BROWSE_Z = 46, FOV = 60°):
 *   visible height  = 2 * tan(30°) * 46 ≈ 53.1 world-units
 *   visible width   ≈ 53.1 * aspect        (1920/1080 → ~94.4)
 *   card size       = 2.8 × 2.8  → ~33 cols × 19 rows on 1080p ≈ 627 tiles
 *
 * Why the bigger tiles (2.8 vs old 1.6)?
 *   1.6 wu at BROWSE_Z 55 rendered ~27px on 1080p — far too small to identify
 *   album art. 2.8 wu at BROWSE_Z 46 renders ~57px, giving a readable premium
 *   discovery wall. With the elastic warp magnifying center tiles to ~80-100px,
 *   the hierarchy becomes natural and explorable.
 *
 * Why BROWSE_Z 46 (was 55)?
 *   Camera closer + bigger tiles = 2× perceived tile size with minimal GPU cost
 *   increase. Tile count drops from ~3375 → ~990 — much better GPU budget.
 */

// ── Card geometry ────────────────────────────────────────────────────────────
// Square tiles for Spotify album art (1:1 aspect ratio)
export const CARD_W    = 1.6    // world units wide (extreme density)
export const CARD_H    = 1.6    // world units tall (square tiles)
export const GAP       = 0.12   // tight visual breathing room
export const SPACING_X = CARD_W + GAP   // 1.54
export const SPACING_Y = CARD_H + GAP   // 1.54

// ── Camera distances ─────────────────────────────────────────────────────────
export const FOV_DEG   = 60
export const FOV_RAD   = (FOV_DEG * Math.PI) / 180
export const BROWSE_Z  = 30    // closer browse camera Z to fit massive wall curvature
export const INTRO_Z   = 70    // zoom-in start point

export interface GridDims {
  COLS:         number
  ROWS:         number
  virtualCount: number
}

/**
 * Compute how many columns & rows are needed to guarantee the viewport is
 * fully covered at BROWSE_Z, including a generous margin so the elastic
 * warp never exposes background.
 */
export function computeGrid(songCount: number, viewW: number, viewH: number): GridDims {
  // Sensible safe fallback that's always dense
  if (!songCount || !viewW || !viewH) {
    return { COLS: 40, ROWS: 26, virtualCount: 1040 }
  }

  const aspect = viewW / viewH
  // Visible world-space extents at the wall plane (z = 0)
  const halfH  = Math.tan(FOV_RAD / 2) * BROWSE_Z
  const halfW  = halfH * aspect

  // Margin (+6 cols, +6 rows) to ensure the physical grid covers the FOV
  // even when edges shift due to lens deformation and parallax.
  const COLS = Math.ceil((halfW * 2) / SPACING_X) + 6
  const ROWS = Math.ceil((halfH * 2) / SPACING_Y) + 6

  return { COLS, ROWS, virtualCount: COLS * ROWS }
}

/**
 * Return the maximum X/Y camera pan offsets before the edge of the tile
 * grid becomes visible. Used by CameraController to apply elastic bounds.
 */
export function computeBounds(
  dims: GridDims,
  viewW: number,
  viewH: number,
  camZ: number,
): { maxX: number; maxY: number } {
  const aspect    = viewW / viewH
  const halfH_vis = Math.tan(FOV_RAD / 2) * camZ
  const halfW_vis = halfH_vis * aspect

  // Total tile-grid extents
  const gridHalfW = (dims.COLS / 2) * SPACING_X
  const gridHalfH = (dims.ROWS / 2) * SPACING_Y

  // How far the camera can wander before a visible edge appears
  const maxX = Math.max(0, gridHalfW - halfW_vis - SPACING_X)
  const maxY = Math.max(0, gridHalfH - halfH_vis - SPACING_Y)

  return { maxX, maxY }
}

/**
 * Which artwork slot every wall tile shows. Deterministic (fixed-seed shuffle) so the wall
 * renderer and the artwork loader agree on the layout without sharing state.
 * `slotCount` is the number of distinct artworks available (songs, capped by the atlas depth).
 */
export function buildTileSlots(tileCount: number, slotCount: number, cols: number): Float32Array {
  const arr = new Float32Array(tileCount)
  if (slotCount <= 0) return arr

  // Pool that wraps through all slots once, then repeats as needed
  const pool = new Int32Array(tileCount)
  for (let i = 0; i < tileCount; i++) pool[i] = i % slotCount

  // Deterministic xorshift32 (fast, good quality); result strictly in [0, 1)
  let seed = 0xA3C7_9B1D
  const rng = () => {
    seed ^= seed << 13
    seed ^= seed >> 17
    seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }

  // Fisher-Yates shuffle — O(n), stable seed → same layout on every render
  for (let i = tileCount - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
  }

  // Neighbour-conflict resolution: a tile never matches its left or top neighbour
  for (let i = cols + 1; i < tileCount; i++) {
    const left = pool[i - 1]
    const top  = pool[i - cols]
    if (pool[i] === left || pool[i] === top) {
      for (let j = i + 1; j < Math.min(i + 8, tileCount); j++) {
        if (pool[j] !== left && pool[j] !== top) {
          const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
          break
        }
      }
    }
  }

  for (let i = 0; i < tileCount; i++) arr[i] = pool[i]
  return arr
}

/**
 * Artwork slots ordered by how close to the centre of the wall they first appear.
 * Loading in this order fills the wall from the middle of the screen outwards.
 */
export function slotPriority(tileSlots: ArrayLike<number>, cols: number, rows: number, slotCount: number): number[] {
  const best = new Float64Array(slotCount).fill(Infinity)
  const halfC = (cols - 1) / 2
  const halfR = (rows - 1) / 2
  for (let i = 0; i < tileSlots.length; i++) {
    const slot = tileSlots[i]
    if (slot >= slotCount) continue
    const dx = ((i % cols) - halfC) * SPACING_X
    const dy = (Math.floor(i / cols) - halfR) * SPACING_Y
    const d = dx * dx + dy * dy
    if (d < best[slot]) best[slot] = d
  }
  return Array.from({ length: slotCount }, (_, i) => i).sort((a, b) => best[a] - best[b] || a - b)
}
