import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paletteFromPixels } from '../lib/artworkPalette.ts'

const pixels = (...groups) => groups.flatMap(([rgb, n]) => Array.from({ length: n }, () => [...rgb, 255]).flat())
const hue = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return null
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

test('a mostly grey cover with a red accent (e.g. Jailer 2) takes red, not grey', () => {
  const p = paletteFromPixels(pixels([[90, 90, 92], 600], [[240, 240, 240], 200], [[200, 20, 25], 224]))
  const h = hue(p.primary)
  assert.ok(h !== null && (h < 15 || h > 345), `primary ${p.primary} should be red`)
})

test('two distinct hues give a two-colour fill', () => {
  const p = paletteFromPixels(pixels([[30, 80, 230], 500], [[240, 160, 20], 300], [[10, 10, 10], 224]))
  assert.ok(Math.abs(hue(p.primary) - 225) < 20, `primary ${p.primary} blue`)
  assert.ok(Math.abs(hue(p.secondary) - 38) < 20, `secondary ${p.secondary} amber`)
})

test('a black-and-white cover falls back to neutral glass', () => {
  const p = paletteFromPixels(pixels([[0, 0, 0], 512], [[255, 255, 255], 300], [[128, 128, 128], 212]))
  assert.equal(p.primary, '#e9e9f2')
})
