import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BeatAnalyser } from '../lib/beatAnalyser.ts'
import { setBeatSurfaceActive } from '../lib/beatEvents.ts'

test('only eligible homepage playback is sampled; sources reuse, switches and cleanup are bounded', t => {
  for (const key of ['window','document','requestAnimationFrame','cancelAnimationFrame']) {
    if (!(key in globalThis)) { Object.defineProperty(globalThis, key, {value: undefined, writable: true, configurable: true}); t.after(()=>{delete globalThis[key]}) }
  }
  const frames = new Map(); let sequence = 0, created = 0, closed = 0
  const media = Object.assign(new EventTarget(), { matches: false })
  const sources = []
  class Context extends EventTarget {
    state = 'running'; sampleRate = 44100; destination = {}
    createAnalyser() { return { getFloatFrequencyData(data) { data.fill(-Infinity) } } }
    createMediaElementSource(audio) { created++; const source = { audio, edges: new Set(), connect(n) { this.edges.add(n) }, disconnect(n) { if(n) this.edges.delete(n); else this.edges.clear() } }; sources.push(source); return source }
    resume() { return Promise.resolve() }
    close() { closed++; return Promise.resolve() }
  }
  t.mock.property(globalThis, 'window', Object.assign(new EventTarget(), { AudioContext: Context, matchMedia: () => media }))
  t.mock.property(globalThis, 'document', Object.assign(new EventTarget(), { hidden: false }))
  t.mock.property(globalThis, 'requestAnimationFrame', fn => { frames.set(++sequence, fn); return sequence })
  t.mock.property(globalThis, 'cancelAnimationFrame', id => frames.delete(id))
  const audio = () => Object.assign(new EventTarget(), { crossOrigin: 'anonymous', paused: false, ended: false, readyState: 4 })
  const beats = new BeatAnalyser(), a = audio(), b = audio()
  try {
    beats.setActive(a); assert.equal(created, 0)
    beats.setEnabled(false); setBeatSurfaceActive(true); assert.equal(created, 0)
    beats.setEnabled(true); assert.equal(created, 1); assert.equal(frames.size, 1)
    beats.setActive(b); assert.equal(created, 2); assert.equal(frames.size, 1)
    assert.equal(sources[0].edges.size, 1, 'previous source retains only audible route')
    beats.setActive(a); assert.equal(created, 2)
    a.paused = true; a.dispatchEvent(new Event('pause')); assert.equal(frames.size, 0)
    a.paused = false; a.dispatchEvent(new Event('playing')); assert.equal(frames.size, 1)
    a.seeking = true; a.dispatchEvent(new Event('seeking')); assert.equal(frames.size, 0)
    a.seeking = false; a.dispatchEvent(new Event('seeked')); assert.equal(frames.size, 1)
    a.ended = true; a.dispatchEvent(new Event('ended')); assert.equal(frames.size, 0)
    a.ended = false; a.dispatchEvent(new Event('playing')); assert.equal(frames.size, 1)
    a.error = {}; a.dispatchEvent(new Event('error')); assert.equal(frames.size, 0)
    a.error = null; a.dispatchEvent(new Event('playing'))
    media.matches = true; media.dispatchEvent(new Event('change')); assert.equal(frames.size, 0)
    media.matches = false; media.dispatchEvent(new Event('change'))
    const opaque = audio(); opaque.crossOrigin = null
    beats.setActive(opaque); assert.equal(created, 2); assert.equal(frames.size, 0)
    beats.setActive(a)
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); assert.equal(frames.size, 0)
    beats.release(b); assert.equal(sources[1].edges.size, 0)
    setBeatSurfaceActive(false); assert.equal(frames.size, 0)
  } finally { beats.dispose(); setBeatSurfaceActive(false) }
  assert.equal(closed, 1); assert.equal(frames.size, 0)
  assert.ok(sources.every(s=>s.edges.size===0))
  let resumed = 0
  window.AudioContext = class extends Context {
    state = 'suspended'
    resume() { resumed++; return Promise.resolve() }
  }
  document.hidden = false; media.matches = false
  const suspended = new BeatAnalyser()
  try {
    setBeatSurfaceActive(true); suspended.setActive(audio())
    assert.equal(created, 2, 'suspended context must not capture native audio')
    assert.ok(resumed > 0); assert.equal(frames.size, 0)
  } finally { suspended.dispose(); setBeatSurfaceActive(false) }
})
