// Reproducible local production smoke/performance sample. Uses an isolated headless profile.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const label = process.argv[2] || 'sample'
const base = 'https://kadence-musicz.vercel.app'
const out = path.resolve('docs/audit/results/2026-11-18-vercel')
await fs.mkdir(out, { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'kadence-audit-'))
const browser = spawn(process.env.AUDIT_BROWSER || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9345', `--user-data-dir=${profile}`, '--window-size=1440,900',
  'about:blank',
], { windowsHide: true, stdio: 'ignore' })
let ws
try {
  let target
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9345/json')).json()).find(t => t.type === 'page'); if (target) break } catch {}
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
    if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) } }
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.events=[];
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const el=this,src=el.src,t=performance.now();
      events.push({event:'play',src,t,muted:el.muted});
      if(el.requestVideoFrameCallback) el.requestVideoFrameCallback(()=>events.push({event:'frame',src,t:performance.now(),muted:el.muted}));
      const p=play.call(el);p.then(()=>events.push({event:'resolved',src,t:performance.now(),muted:el.muted}),e=>events.push({event:'rejected',src,t:performance.now(),name:e.name}));return p;
    };
  `});
  await send('Network.clearBrowserCache'); await send('Page.navigate',{url:base});await delay(7000); await send('Page.reload',{ignoreCache:true});await delay(7000);
  const buttons=await evaluate(`[...document.querySelectorAll('button')].map(b=>({id:b.id,text:b.textContent}))`);
  console.log(JSON.stringify({base,buttons}));
  const ids=['explore-dev-universe-btn'];
  const trials=[];
  for(const phase of ['activated']){
    if(phase==='activated'){
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:20,y:20});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:20,y:20});
    }
    for(const id of ids){
      await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'center'})`);await delay(180);
      const box=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      const start=await evaluate('performance.now()');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await delay(34000);
      const result=await evaluate(`({events:events.filter(e=>e.t>=${start}),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,time:v.currentTime,duration:v.duration,width:v.videoWidth,height:v.videoHeight,paused:v.paused,muted:v.muted,ready:v.readyState,frames:v.getVideoPlaybackQuality().totalVideoFrames})),active:navigator.userActivation.hasBeenActive})`);
      trials.push({phase,id,start,...result});console.log(JSON.stringify(trials.at(-1)));
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});await delay(200);
    }
  }
  await fs.writeFile(path.join(out,'original-quality.json'),JSON.stringify({base,browser:await send('Browser.getVersion'),buttons,trials,errors,failedRequests,requests},null,2));
  await send('Browser.close').catch(()=>{});
} finally {ws?.close();browser.kill()}
