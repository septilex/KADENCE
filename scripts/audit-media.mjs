import { writeFile, mkdir } from 'node:fs/promises'
import { devSpecialData } from '../lib/devSpecialData.ts'
import { CHART_SOURCES } from '../lib/chartSource.ts'
import { SIGNATURE_SONGS } from '../lib/signatureSongs.ts'
import { getOptimizedArtworkUrl } from '../lib/artwork.ts'

const charts = { 'dev-special': devSpecialData, ...Object.fromEntries(Object.entries(CHART_SOURCES).map(([id,c])=>[id,c.songs])), signatures: Object.values(SIGNATURE_SONGS) }
const urls = new Map()
for (const [chart,songs] of Object.entries(charts)) for (const song of songs) {
  for (const [kind,url] of [['audio',song.previewUrl],['artwork',getOptimizedArtworkUrl(song.albumArt)]]) {
    if (!url) continue
    if (!urls.has(url)) urls.set(url,{url,kind,tracks:[]})
    urls.get(url).tracks.push({chart,id:song.id,name:song.name,artist:song.artist})
  }
}
const queue=[...urls.values()],results=[]
async function worker() {
  while(queue.length) {
    const item=queue.shift(),start=performance.now()
    try {
      const response=await fetch(item.url,{method:'HEAD',signal:AbortSignal.timeout(10000)})
      results.push({...item,status:response.status,type:response.headers.get('content-type'),cors:response.headers.get('access-control-allow-origin'),bytes:response.headers.get('content-length'),ms:Math.round(performance.now()-start)})
    } catch(error) { results.push({...item,error:error.message,ms:Math.round(performance.now()-start)}) }
  }
}
await Promise.all(Array.from({length:6},worker))
const summary={charts:Object.fromEntries(Object.entries(charts).map(([id,songs])=>[id,{tracks:songs.length,noPreview:songs.filter(s=>!s.previewUrl).map(s=>s.name),duplicateIds:songs.map(s=>s.id).filter((id,i,a)=>a.indexOf(id)!==i)}])),uniqueUrls:urls.size,ok:results.filter(r=>r.status>=200&&r.status<300).length,failures:results.filter(r=>!r.status||r.status>=400),results}
await mkdir('docs/audit/results/2026-11-15',{recursive:true})
await writeFile('docs/audit/results/2026-11-15/media.json',JSON.stringify(summary,null,2))
console.log(JSON.stringify({...summary,results:undefined},null,2))
