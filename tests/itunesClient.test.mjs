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
test('top-songs charts parse Apple RSS entries into playable tracks with their rank', async () => {
  let url = ''
  const entry = (id, name) => ({
    'im:name': { label: name }, 'im:artist': { label: 'Anirudh Ravichander' },
    'im:collection': { 'im:name': { label: 'Jailer 2 (Original Motion Picture Soundtrack)' } },
    'im:image': [{ label: 'https://is1-ssl.mzstatic.com/a/cover.jpg/55x55bb.png' }, { label: 'https://is1-ssl.mzstatic.com/a/cover.jpg/170x170bb.png' }],
    'im:releaseDate': { label: '2026-09-30T00:00:00-07:00' },
    category: { attributes: { 'im:id': '1264', term: 'Tamil' } },
    id: { attributes: { 'im:id': String(id) } },
    link: [
      { attributes: { rel: 'alternate', href: `https://music.apple.com/in/album/x/1?i=${id}` } },
      { attributes: { rel: 'enclosure', 'im:assetType': 'preview', href: `https://audio-ssl.itunes.apple.com/${id}.m4a` } },
    ],
  })
  const client = new ItunesClient(async u => { url = String(u); return Response.json({ feed: { entry: [entry(11, 'Jailer 2 Theme'), entry(12, 'One Name')] } }) })
  const tracks = await client.topSongs('IN', 1264)
  assert.equal(url, 'https://itunes.apple.com/in/rss/topsongs/limit=100/genre=1264/json')
  assert.deepEqual(tracks.map(t => [t.trackId, t.chartRank, t.primaryGenreName]), [[11, 1, 'Tamil'], [12, 2, 'Tamil']])
  assert.equal(tracks[0].artworkUrl100, 'https://is1-ssl.mzstatic.com/a/cover.jpg/100x100bb.jpg')
  assert.equal(tracks[0].previewUrl, 'https://audio-ssl.itunes.apple.com/11.m4a')
  // a single-entry feed is an object, not an array
  const one = new ItunesClient(async () => Response.json({ feed: { entry: entry(13, 'Solo') } }))
  assert.equal((await one.topSongs('us')).length, 1)
  await assert.rejects(new ItunesClient(async () => Response.json({ nope: 1 })).topSongs('us'))
})
