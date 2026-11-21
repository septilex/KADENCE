import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindBeatMotion } from '../lib/beatMotion.ts'
import { releaseHomepageAudio } from '../lib/homepageBeatAudio.ts'
import { beatDebug, debugEnabled } from '../lib/beatDebug.ts'

test('same-origin audible MP4 -> exact source node -> FFT onset -> visible wrapper animation and diagnostics', t => {
  const keys=['window','document','location','matchMedia','requestAnimationFrame','cancelAnimationFrame']
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]})}
  const motion=Object.assign(new EventTarget(),{matches:false})
  const frames=new Map();let id=0, level=-Infinity
  const attached=[],animations=[]
  class Context extends EventTarget {
    state='running';sampleRate=44100;destination={}
    createAnalyser(){return {getFloatFrequencyData(data){data.fill(-Infinity);for(let i=2;i<=7;i++)data[i]=level}}}
    createMediaElementSource(media){attached.push(media);return {connect(){},disconnect(){}}}
    resume(){return Promise.resolve()}close(){return Promise.resolve()}
  }
  globalThis.window=Object.assign(new EventTarget(),{AudioContext:Context,matchMedia:()=>motion,location:{search:'?beatDebug=1'}})
  globalThis.document=Object.assign(new EventTarget(),{hidden:false})
  globalThis.location={href:'http://localhost:3000/',origin:'http://localhost:3000'}
  globalThis.matchMedia=()=>motion
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id}
  globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const video=Object.assign(new EventTarget(),{src:'http://localhost:3000/audio/intro/song.mp4',tagName:'VIDEO',crossOrigin:null,paused:false,ended:false,muted:false,volume:1,readyState:4})
  const wrapper={setAttribute(){},removeAttribute(){},animate(keys,options){animations.push({keys,options});return {cancel(){}}}}
  const stop=bindBeatMotion(wrapper,video,2)
  const step=time=>{const pending=[...frames.entries()];for(const [key,fn] of pending){frames.delete(key);fn(time)}}
  try {
    assert.deepEqual(attached,[video],'must analyse the existing video, not a new audio player')
    for(let time=0;time<400;time+=16)step(time)
    assert.equal(animations.length,0)
    level=-15;step(416)
    assert.equal(animations.length,1)
    assert.equal(beatDebug.media,'VIDEO');assert.equal(beatDebug.context,'running')
    assert.equal(beatDebug.readable,true);assert.ok(beatDebug.bass>0)
    assert.equal(beatDebug.beats,1);assert.equal(beatDebug.animations,1)
    for(let time=432;time<1200;time+=16)step(time)
    assert.equal(animations.length,1,'sustained bass must not pulse')
    video.muted=true;video.dispatchEvent(new Event('volumechange'));assert.equal(frames.size,0)
  } finally {stop();releaseHomepageAudio(video)}
  assert.equal(frames.size,0)
  const env=process.env.NODE_ENV
  try{process.env.NODE_ENV='production';assert.equal(debugEnabled(),false)}finally{if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env}
})
