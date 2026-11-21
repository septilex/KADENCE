import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindBeatMotion } from '../lib/beatMotion.ts'
import { emitBeat, isBeatSurfaceActive } from '../lib/beatEvents.ts'
test('each beat replaces the impact, returns to identity with no fill, and cleanup cancels it', t => {
  const media = Object.assign(new EventTarget(), { matches: false })
  globalThis.matchMedia = () => media
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  t.after(()=>{ delete globalThis.matchMedia; delete globalThis.document })
  const animations=[]
  const element={animate(keys,options){ const animation={keys,options,canceled:false,cancel(){this.canceled=true}};animations.push(animation);return animation }}
  const video=Object.assign(new EventTarget(), {paused:false,ended:false})
  const stop=bindBeatMotion(element,video)
  try {
    assert.equal(isBeatSurfaceActive(),true)
    emitBeat(0.2); emitBeat(1)
    assert.equal(animations.length,2); assert.equal(animations[0].canceled,true)
    assert.equal(animations[1].keys.at(-1).transform,'translate3d(0,0,0) scale(1)')
    assert.equal(animations[1].options.fill,undefined)
    assert.ok(animations[1].keys[1].transform.includes('1.075'))
    media.matches=true;media.dispatchEvent(new Event('change'));emitBeat(1)
    assert.equal(animations.length,2);assert.equal(isBeatSurfaceActive(),false)
  } finally {stop()}
  assert.ok(animations.every(a=>a.canceled));assert.equal(isBeatSurfaceActive(),false)
})
