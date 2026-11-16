import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ItunesClient } from '../lib/itunesClient.ts'

const ok = () => Response.json({results:[{trackId:1,trackName:'Song',artworkUrl100:'https://example.test/a.jpg'}]})
test('concurrent duplicate queries make one upstream request and reuse fresh results', async () => {
  let calls=0
  const client=new ItunesClient(async()=>{calls++;return ok()})
  const results=await Promise.all(Array.from({length:20},()=>client.search('test')))
  assert.equal(calls,1)
  assert.ok(results.every(r=>r[0].trackId===1))
  await client.search('test')
  assert.equal(calls,1)
})
test('concurrency is capped and failures release slots', async () => {
  let active=0,max=0,calls=0
  const client=new ItunesClient(async()=>{
    active++;max=Math.max(max,active);calls++
    await new Promise(resolve=>setTimeout(resolve,5))
    active--
    if(calls%2===0) return new Response('',{status:503})
    return ok()
  })
  await Promise.allSettled(Array.from({length:12},(_,i)=>client.search(`test-${i}`)))
  assert.equal(max,3)
  assert.equal(calls,12)
})
test('a transient provider failure serves bounded stale data; new failures remain errors', async () => {
  let now=0,fail=false
  const client=new ItunesClient(async()=>fail?new Response('',{status:503}):ok(),()=>now)
  await client.search('test')
  now=31*60000;fail=true
  assert.equal((await client.search('test'))[0].trackId,1)
  await assert.rejects(client.search('uncached'))
  now=25*60*60000
  await assert.rejects(client.search('test'))
})
test('request budget and upstream payload validation fail explicitly', async () => {
  let calls=0
  const client=new ItunesClient(async()=>{calls++;return ok()},()=>0)
  await Promise.all(Array.from({length:20},(_,i)=>client.search(`query-${i}`)))
  await assert.rejects(client.search('over-budget'))
  assert.equal(calls,20)
  const invalid=new ItunesClient(async()=>Response.json({results:'invalid'}))
  await assert.rejects(invalid.search('test'))
})
