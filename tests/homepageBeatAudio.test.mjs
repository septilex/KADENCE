import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HomepageBeatAudio } from '../lib/homepageBeatAudio.ts'

test('audible hover video wins over track; muted, paused and unregistered preload media cannot drive beats', () => {
  const selected=[], released=[]
  const broker=new HomepageBeatAudio({setActive:m=>selected.push(m),release:m=>released.push(m),dispose(){}})
  const make=()=>Object.assign(new EventTarget(),{paused:false,ended:false,muted:false,volume:1})
  const track=make(),hover=make(),preload=make()
  const stopTrack=broker.register(track,1)
  hover.muted=true
  const stopHover=broker.register(hover,2)
  assert.equal(selected.at(-1),track)
  preload.dispatchEvent(new Event('playing'));assert.equal(selected.at(-1),track)
  hover.muted=false;hover.dispatchEvent(new Event('volumechange'));assert.equal(selected.at(-1),hover)
  hover.paused=true;hover.dispatchEvent(new Event('pause'));assert.equal(selected.at(-1),track)
  hover.paused=false;hover.dispatchEvent(new Event('playing'));assert.equal(selected.at(-1),hover)
  stopHover();assert.equal(selected.at(-1),track)
  broker.release(hover);assert.deepEqual(released,[hover])
  stopTrack();assert.equal(selected.at(-1),null)
  broker.dispose()
})
