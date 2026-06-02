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

  // Margin (+20 cols, +16 rows) to ensure the physical grid covers the FOV
  // even when edges curve away into perspective depth.
  const COLS = Math.ceil((halfW * 2) / SPACING_X) + 20
  const ROWS = Math.ceil((halfH * 2) / SPACING_Y) + 16

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
