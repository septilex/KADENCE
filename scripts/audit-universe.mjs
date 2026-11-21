// Reproducible local production smoke/performance sample. Uses an isolated headless profile.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const label = process.argv[2] || 'sample'
const width = Number(process.env.AUDIT_WIDTH || 1440)
const height = Number(process.env.AUDIT_HEIGHT || 900)
const base = process.env.AUDIT_URL || 'http://localhost:3100'
const out = path.resolve('docs/audit/results/2026-11-21-universe')
await fs.mkdir(out, { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'kadence-audit-'))
const browser = spawn(process.env.AUDIT_BROWSER || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9361', `--user-data-dir=${profile}`, '--window-size=1440,900',
  '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
let ws
try {
  let target
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9361/json')).json()).find(t => t.type === 'page'); if (target) break } catch {}
    await delay(200)
  }
  if (!target) throw new Error('Audit browser did not start')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let sequence = 0
  const pending = new Map()
  const errors = [], failedRequests = [], requests = []
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result) } }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails)
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry)
    if (m.method === 'Network.loadingFailed') failedRequests.push(m.params)
    if (m.method === 'Network.responseReceived') requests.push({ url: m.params.response.url, status: m.params.response.status, type: m.params.type })
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)) }, 30000)
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (process.env.AUDIT_CPU) await send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.AUDIT_CPU) })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__audit = { frames: [], longTasks: [], lcp: [], cls: 0, draws: 0, audioCreated: 0, audioPlay: [], uploads: [] };
    for (const type of ['longtask','largest-contentful-paint','layout-shift']) {
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) {
        if (type === 'longtask') __audit.longTasks.push({t:e.startTime,d:e.duration});
        if (type === 'largest-contentful-paint') __audit.lcp.push(e.startTime);
        if (type === 'layout-shift' && !e.hadRecentInput) __audit.cls += e.value;
      }}).observe({type, buffered:true}); } catch {}
    }
    let prev; function frame(t) { if(prev) __audit.frames.push({t,d:t-prev}); prev=t; requestAnimationFrame(frame) } requestAnimationFrame(frame);
    for (const name of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']) { const original=WebGL2RenderingContext.prototype[name]; WebGL2RenderingContext.prototype[name]=function(...args) { __audit.draws++; return original.apply(this,args) } }
    const NativeAudio = window.Audio; window.Audio = function(...args) { __audit.audioCreated++; return new NativeAudio(...args) }; window.Audio.prototype = NativeAudio.prototype;
    const nativePlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function() { if(this.tagName==='AUDIO') __audit.audioPlay.push({t:performance.now(),url:this.src}); return nativePlay.call(this) };
    for (const name of ['texImage2D','texSubImage2D']) { const native=WebGL2RenderingContext.prototype[name]; WebGL2RenderingContext.prototype[name]=function(...args) { const c=args.find(x=>x instanceof HTMLCanvasElement); if(c) __audit.uploads.push({t:performance.now(),width:c.width,height:c.height}); return native.apply(this,args) } }
    const sub3D=WebGL2RenderingContext.prototype.texSubImage3D; WebGL2RenderingContext.prototype.texSubImage3D=function(...args) { if(args[0]===this.TEXTURE_2D_ARRAY) __audit.uploads.push({t:performance.now(),width:args[5],height:args[6],depth:args[7],bytes:args[5]*args[6]*args[7]*4}); return sub3D.apply(this,args) };
  ` })
  await send('Page.navigate', { url: base })
  await delay(7000)
  const home = await evaluate(`({audit:structuredClone(__audit),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,bytes:e.transferSize,duration:e.duration})),navigation:performance.getEntriesByType('navigation')[0].toJSON(),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,id:b.id}))})`)
  await fs.writeFile(path.join(out, `${label}-home.png`), Buffer.from((await send('Page.captureScreenshot')).data, 'base64'))
  const clicked = await evaluate(`(() => { const el=document.querySelector('#vibe-dev-special') || [...document.querySelectorAll('button')].find(b=>/creator.s universe|dev.s universe/i.test(b.textContent)); if (!el) return false; el.click(); return true })()`)
  if (!clicked) throw new Error(`Chart button not found: ${JSON.stringify(home.buttons)}`)
  await delay(14000)
  const entry = await evaluate(`({t:performance.now(),text:document.body.innerText,canvas:!!document.querySelector('canvas')})`)
  const sweepStart = await evaluate('performance.now()')
  for (let i=0; i<36; i++) { await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:width*.1+i*width*.02,y:height*.47+Math.sin(i/3)*height*.1}); await delay(35) }
  const sweepEnd = await evaluate('performance.now()')
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:Math.round(width*.71),y:Math.round(height*.56)})
  await delay(2000)
  const tooltip = await evaluate('document.body.innerText')
  await fs.writeFile(path.join(out, `${label}-wall.png`), Buffer.from((await send('Page.captureScreenshot')).data, 'base64'))
  await send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,x:Math.round(width*.71),y:Math.round(height*.56)})
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,x:Math.round(width*.71),y:Math.round(height*.56)})
  await delay(2000)
  const detail = await evaluate(`({open:!!document.querySelector('#song-detail-drawer'),text:document.body.innerText})`)
  if (!detail.open) throw new Error('Song click did not open details')
  const coveredDraws = await evaluate('__audit.draws')
  await delay(500)
  const pausedDraws = await evaluate('__audit.draws') - coveredDraws
  if (pausedDraws !== 0) throw new Error('Covered universe kept rendering')
  const switchStart = await evaluate('performance.now()')
  const switches = []
  for (let i = 0; i < 12; i++) {
    switches.push(await evaluate(`(() => { const t=performance.now(); document.querySelector('[title="Next Track"]').click(); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({paintMs:performance.now()-t,backgrounds:document.querySelectorAll('[data-cinematic-layer]').length,title:document.querySelector('#song-detail-drawer')?.getAttribute('aria-label')})))) })()`))
    await delay(100)
  }
  const switchEnd = await evaluate('performance.now()')
  await delay(1500)
  const settledBackgrounds = await evaluate('document.querySelectorAll("[data-cinematic-layer]").length')
  await fs.writeFile(path.join(out, `${label}-detail.png`), Buffer.from((await send('Page.captureScreenshot')).data, 'base64'))
  await evaluate('document.querySelector("#close-detail-btn").click()')
  await delay(700)
  const closed = await evaluate('!document.querySelector("#song-detail-drawer")')
  if (!closed) throw new Error('Details did not close')
  await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='List view')).click()`)
  await delay(200)
  const list = await evaluate(`({canvas:!!document.querySelector('canvas'),buttons:[...document.querySelectorAll('button')].length})`)
  if (list.canvas) throw new Error('List mode did not release canvas')
  const audit = await evaluate('__audit')
  const percentile = (xs,p) => { const a=xs.slice().sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*p))]??null }
  const frameTimes = audit.frames.filter(f=>f.t>=sweepStart && f.t<=sweepEnd).map(f=>f.d)
  const summary = {pausedDraws,list,switches,settledBackgrounds,closed,switchLongTasks:audit.longTasks.filter(e=>e.t>=switchStart&&e.t<=switchEnd),label,base,browser:await send('Browser.getVersion'),headless:true,viewport:`${width}x${height}`,cpuThrottle:Number(process.env.AUDIT_CPU || 1),autoplayPolicy:'no-user-gesture-required (audio policy not tested)',home:{lcpMs:home.audit.lcp.at(-1),cls:home.audit.cls,longTasks:home.audit.longTasks.length,transferBytes:home.resources.reduce((n,r)=>n+r.bytes,0)},entry,sweep:{durationMs:sweepEnd-sweepStart,frameP50:percentile(frameTimes,.5),frameP95:percentile(frameTimes,.95),longTasks:audit.longTasks.filter(e=>e.t>=sweepStart&&e.t<=sweepEnd).length,audioPlay:audit.audioPlay.filter(e=>e.t>=sweepStart&&e.t<=sweepEnd).length},audioCreated:audit.audioCreated,atlasUploads:audit.uploads.length,tooltip,detail,errors,failedRequests,requests,audit,homeRaw:home}
  await fs.writeFile(path.join(out,`${label}.json`),JSON.stringify(summary,null,2))
  console.log(JSON.stringify({...summary,audit:undefined,homeRaw:undefined,requests:undefined,tooltip:undefined,errors:errors.slice(0,3)},null,2))
  if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`)
  if (settledBackgrounds !== 1 || switches.some(s=>s.backgrounds !== 1)) throw new Error('Background layer count is unbounded')
  await send('Browser.close').catch(()=>{})
} finally { ws?.close(); browser.kill() }
