/**
 * Generates the WebP derivatives the chart-loading overlay serves, from the PNG masters in
 * public/images/chart_loading/ (masters are read, never modified).
 *
 *   node scripts/build-chart-loading-art.mjs
 *
 * The chart-ID → master mapping comes from lib/chartLoadingArt.ts (single source of truth).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// sharp (already installed with Next.js) must load before the TypeScript hooks are registered:
// the hooks resolve relative CommonJS requires inside node_modules incorrectly.
const sharp = createRequire(import.meta.url)('sharp')
await import('./test-loader.mjs')
const { CHART_LOADING_ART, CHART_LOADING_WIDTHS } = await import('../lib/chartLoadingArt.ts')

const dir = path.resolve('public/images/chart_loading')
const out = path.join(dir, 'optimized')
fs.mkdirSync(out, { recursive: true })

let failed = 0
for (const [vibe, art] of Object.entries(CHART_LOADING_ART)) {
  if (!art) { console.log(`${vibe}: no artwork (fallback)`); continue }
  const master = path.join(dir, art.master)
  if (!fs.existsSync(master)) { console.error(`${vibe}: MISSING master "${art.master}"`); failed++; continue }
  const meta = await sharp(master).metadata()
  const sizes = []
  for (const width of CHART_LOADING_WIDTHS) {
    const file = path.join(out, `${vibe}-${width}.webp`)
    // Never upscale: the largest derivative is the master's own width.
    await sharp(master)
      .resize({ width: Math.min(width, meta.width), withoutEnlargement: true })
      .webp({ quality: 84, effort: 6, smartSubsample: true })
      .toFile(file)
    sizes.push(`${width}w ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
  }
  console.log(`${vibe}: ${art.master} (${meta.width}x${meta.height}) → ${sizes.join(', ')}`)
}
if (failed) process.exit(1)
