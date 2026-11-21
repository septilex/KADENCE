import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BassOnset } from '../lib/bassOnset.ts'

function spectrum(level, high = false) {
  const bins = new Float32Array(1024).fill(-Infinity)
  for (let i = high ? 80 : 2; i <= (high ? 100 : 7); i++) bins[i] = level
  return bins
}
test('silence, sustained bass and high-frequency attacks do not repeatedly trigger', () => {
  for (const [level, high] of [[-Infinity, false], [-20, false], [-10, true]]) {
    const detector = new BassOnset()
    let beats = 0
    for (let t = 0; t < 3000; t += 16) beats += !!detector.sample(spectrum(level, high), 44100, 2048, t)
    assert.equal(beats, 0)
  }
})
test('isolated bass attacks work at different mastering levels and reject sustained retriggers', () => {
  for (const level of [-36, -24, -10]) {
    const detector = new BassOnset(); const hits = []
    for (let t = 0; t < 3000; t += 16) {
      const attack = (t >= 512 && t < 850) || (t >= 1600 && t < 2100)
      if (detector.sample(spectrum(attack ? level : -80), 44100, 2048, t)) hits.push(t)
    }
    assert.equal(hits.length, 2, JSON.stringify({level,hits}))
    assert.equal(hits[0], 512); assert.equal(hits[1], 1600)
    detector.reset()
    assert.equal(detector.sample(spectrum(-10), 44100, 2048, 4000), 0)
  }
})
