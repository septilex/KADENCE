import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Ray, Vector2, Vector3 } from 'three'
import { WallPicker, LENS_RADIUS, LENS_INTENSITY, PARALLAX_STRENGTH } from '../lib/wallPicking.ts'
import { CARD_W, CARD_H, SPACING_X, SPACING_Y, computeGrid } from '../lib/gridCalc.ts'
import { JellyField } from '../lib/jellyField.ts'

test('rendered tile centres are picked across wide and mobile views, with lens and jelly', () => {
  const picker = new WallPicker()
  let samples = 0, flatMismatches = 0
  for (const [width, height] of [[1440,900],[390,844]]) {
    const dims = computeGrid(80,width,height)
    for (const mouse of [new Vector2(0,0),new Vector2(16,7),new Vector2(-12,-8)]) {
      for (const displacement of [new Vector2(0,0),new Vector2(.7,-.4)]) {
        const jelly = { sample: (_u,_v,target) => target.copy(displacement) }
        for (let r=3;r<dims.ROWS-3;r+=3) for(let c=3;c<dims.COLS-3;c+=3) {
          const cx=(c-(dims.COLS-1)/2)*SPACING_X, cy=((dims.ROWS-1)/2-r)*SPACING_Y
          // Average vertices on a rendered triangle (not the undeformed z=0 plane).
          const verts=[[-1,1],[-1,-1],[1,1]].map(([sx,sy])=>{
            const x=cx+sx*CARD_W/2+displacement.x, y=cy+sy*CARD_H/2+displacement.y
            const t=Math.min(1,Math.hypot(x-mouse.x,y-mouse.y)/LENS_RADIUS)
            return new Vector3(x-mouse.x*PARALLAX_STRENGTH,y-mouse.y*PARALLAX_STRENGTH,(1-t*t*(3-2*t))*LENS_INTENSITY)
          })
          const target=verts[0].clone().add(verts[1]).add(verts[2]).multiplyScalar(1/3)
          const origin=new Vector3(0,0,30), ray=new Ray(origin,target.clone().sub(origin).normalize())
          assert.equal(picker.pick(ray,dims,mouse,jelly),r*dims.COLS+c)
          const flat=ray.at(-30/ray.direction.z,new Vector3())
          const oldC=Math.round(flat.x*(1+PARALLAX_STRENGTH)/SPACING_X+(dims.COLS-1)/2)
          const oldR=Math.round(-flat.y*(1+PARALLAX_STRENGTH)/SPACING_Y+(dims.ROWS-1)/2)
          if(oldR*dims.COLS+oldC!==r*dims.COLS+c) flatMismatches++
          samples++
        }
      }
    }
  }
  assert.ok(samples>300)
  assert.ok(flatMismatches>20)
})
test('empty gaps and rays behind the wall do not select a track', () => {
  const picker=new WallPicker(), dims={COLS:3,ROWS:3,virtualCount:9}
  const mouse=new Vector2(100,100)
  const x=SPACING_X/2-mouse.x*PARALLAX_STRENGTH
  assert.equal(picker.pick(new Ray(new Vector3(x,-mouse.y*PARALLAX_STRENGTH,30),new Vector3(0,0,-1)),dims,mouse,null),-1)
  assert.equal(picker.pick(new Ray(new Vector3(0,0,30),new Vector3(0,0,1)),dims,mouse,null),-1)
})
test('CPU jelly sampling matches GPU bilinear texel centres and edge clamping', () => {
  const field=new JellyField()
  const target=new Vector2()
  field.update(0,0,20,5,true,.016,-20,-20,20,20)
  const data=field.texture.image.data, size=field.texture.image.width
  field.sample((24+.5)/size,(24+.5)/size,target)
  assert.equal(target.x,data[(24*size+24)*4])
  assert.equal(target.y,data[(24*size+24)*4+1])
  field.sample(-1,-1,target)
  assert.equal(target.x,data[0])
  field.dispose()
})
