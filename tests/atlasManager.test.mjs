import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AtlasManager } from '../lib/atlasManager.ts'

test('late critical images trigger their own upload; obsolete charts cannot repaint slots', async t => {
  t.mock.timers.enable({apis:['setTimeout']})
  const images=[],draws=[]
  const oldDocument=globalThis.document,oldImage=globalThis.Image
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){},getImageData(){return {data:new Uint8Array(256*256*4)}},drawImage(img){draws.push(img.src)}})})}
  globalThis.Image=class { constructor(){images.push(this)} }
  try {
    const atlas=new AtlasManager()
    const first=atlas.prepareCriticalVibe([{albumArt:'https://test/slow',color:'#333'}],()=>{})
    t.mock.timers.tick(3501);await first
    const texture=atlas.getTexture(),before=texture.version
    images[0].onload()
    t.mock.timers.tick(1300)
    assert.ok(texture.layerUpdates.has(0))
    assert.ok(texture.version>before,'late image schedules GPU upload after prepare has returned')
    const old=atlas.prepareCriticalVibe([{albumArt:'https://test/old'}],()=>{})
    const fresh=atlas.prepareCriticalVibe([{albumArt:'https://test/new'}],()=>{})
    images[2].onload();await fresh
    images[1].onload();await old
    assert.deepEqual(draws,['https://test/slow','https://test/new'])
    t.mock.timers.tick(2000)
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage;t.mock.timers.reset()}
})
