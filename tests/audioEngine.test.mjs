import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AudioEngine } from '../lib/audioEngine.ts'

class FakeAudio extends EventTarget {
  src = ''; volume = 0; currentTime = 0; duration = 30; paused = true; ended = false
  plays = []
  load() {}
  pause() { this.paused = true }
  removeAttribute() { this.src = '' }
  play() { this.paused = false; return new Promise((resolve, reject) => this.plays.push({ resolve, reject })) }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function setup() {
  const audio = [], playing = [], errors = [], progress = []
  const engine = new AudioEngine({ playing: v => playing.push(v), error: v => errors.push(v), progress: (...v) => progress.push(v) }, () => { const a = new FakeAudio(); audio.push(a); return a })
  return { engine, audio, playing, errors, progress }
}
test('a rejected old play cannot pause a newer track', async () => {
  const s = setup()
  try {
    s.engine.setSource('one', true)
    s.engine.setSource('two', true)
    s.audio[1].plays[0].resolve(); await tick()
    s.audio[0].plays[0].reject(new Error('obsolete network error')); await tick()
    assert.deepEqual(s.playing, [true])
    assert.equal(s.audio[1].paused, false)
    assert.equal(s.errors.filter(Boolean).length, 0)
    assert.equal(s.audio[0].src, '')
  } finally { s.engine.dispose() }
})
test('pause during a pending play stays paused and disposing releases every source', async () => {
  const s = setup()
  s.engine.setSource('one', true)
  s.engine.setPlaying(false)
  s.audio[0].plays[0].resolve(); await tick()
  assert.equal(s.audio[0].paused, true)
  assert.deepEqual(s.playing, [])
  s.engine.dispose()
  assert.equal(s.engine.pool.size, 0)
  assert.ok(s.audio.every(a => a.src === '' && a.paused))
})
test('pool and speculative downloads remain bounded through a long session', () => {
  const s = setup()
  try {
    s.engine.preload(Array.from({ length: 200 }, (_, i) => `preload-${i}`))
    assert.equal(s.audio.length, 2)
    s.audio[0].dispatchEvent(new Event('loadeddata'))
    s.audio[1].dispatchEvent(new Event('loadeddata'))
    assert.equal(s.audio.length, 4)
    for (let i = 0; i < 60; i++) {
      s.engine.setSource(`track-${i}`, false)
      s.audio.at(-1).dispatchEvent(new Event('loadeddata'))
      assert.ok(s.engine.pool.size <= AudioEngine.MAX_POOL)
    }
  } finally { s.engine.dispose() }
})
test('failed current media reports an error and can be retried', async () => {
  const s = setup()
  try {
    s.engine.setSource('one', true)
    s.audio[0].dispatchEvent(new Event('error'))
    assert.equal(s.playing.at(-1), false)
    assert.ok(s.errors.at(-1))
    s.engine.setPlaying(true)
    assert.equal(s.audio.length, 2)
    s.audio[1].plays[0].resolve(); await tick()
    assert.equal(s.playing.at(-1), true)
    s.engine.seek(200)
    assert.equal(s.audio[1].currentTime, 30)
  } finally { s.engine.dispose() }
})
