// Reproducible local production smoke/performance sample. Uses an isolated headless profile.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const label = process.argv[2] || 'live'
const width = Number(process.env.AUDIT_WIDTH || 1440)
const height = Number(process.env.AUDIT_HEIGHT || 900)
const base = process.env.AUDIT_URL || 'http://localhost:3000/?beatDebug=1'
const out = path.resolve('docs/audit/results/2026-11-21-beats')
await fs.mkdir(out, { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'kadence-audit-'))
const browser = spawn(process.env.AUDIT_BROWSER || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9372', `--user-data-dir=${profile}`, '--window-size=1440,900',
  'about:blank',
], { windowsHide: true, stdio: 'ignore' })
let ws
try {
  let target
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9372/json')).json()).find(t => t.type === 'page'); if (target) break } catch {}
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
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `
    window.beatSamples=[];window.beatSources=[];
    const create=AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource=function(media){beatSources.push({src:media.currentSrc||media.src,tag:media.tagName});return create.call(this,media)};
    function record(t){
      const panel=document.querySelector('[data-beat-debug]');let debug=null;
      try{debug=JSON.parse(panel.textContent.slice(panel.textContent.indexOf('{')))}catch{}
      const el=document.querySelector('[data-beat-surface="active"]');
      if(debug)beatSamples.push({t,debug,transform:el?getComputedStyle(el).transform:null});
      if(beatSamples.length>20000)beatSamples.splice(0,1000);
      requestAnimationFrame(record);
    }requestAnimationFrame(record);
  `});
  await send('Page.navigate',{url:base});await delay(7000);
  const buttons=await evaluate(`[...document.querySelectorAll('button')].map(b=>({id:b.id,text:b.textContent}))`);
  console.log(JSON.stringify({buttons}));
  const ids=[...buttons.filter(b=>b.id.startsWith('vibe-')).map(b=>b.id),'explore-dev-universe-btn'];
  const trials=[];
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:10,y:10});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:10,y:10});
  for(const id of ids.filter(id=>!process.env.BEAT_IDS || process.env.BEAT_IDS.split(',').includes(id))){
    const exists=await evaluate(`!!document.getElementById(${JSON.stringify(id)})`);if(!exists)continue;
    await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'center'})`);await delay(300);
    const box=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    const start=await evaluate('performance.now()');
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await delay(6500);
    const data=await evaluate(`({samples:beatSamples.filter(s=>s.t>=${start}),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,paused:v.paused,muted:v.muted,time:v.currentTime,ready:v.readyState})),sources:beatSources})`);
    const samples=data.samples;const seen=samples.filter(s=>s.debug.status==='analysing');
    const scales=samples.map(s=>s.transform?.match(/^matrix\(([^,]+)/)?.[1]).map(Number).filter(Number.isFinite);
    const beats=seen.length?Math.max(...seen.map(s=>s.debug.beats))-Math.min(...seen.map(s=>s.debug.beats)):0;
    const summary={id,beats,maxBass:Math.max(0,...seen.map(s=>s.debug.bass)),readable:seen.some(s=>s.debug.readable),minScale:Math.min(...scales),maxScale:Math.max(...scales),last:samples.at(-1)?.debug,videos:data.videos};
    trials.push({...summary,...data});console.log(JSON.stringify(summary));
    await fs.writeFile(path.join(out,label+'.json'),JSON.stringify({base,trials,errors,failedRequests},null,2));
    if(id===ids[0])await fs.writeFile(path.join(out,label+'.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});await delay(250);
  }

  if(process.env.BEAT_UNIVERSE){
    await evaluate(`document.getElementById('explore-dev-universe-btn').click()`);await delay(14000);
    const start=await evaluate('performance.now()');await delay(1500);
    const data=await evaluate(`({samples:beatSamples.filter(s=>s.t>=${start}),canvas:!!document.querySelector('canvas'),activeWrappers:document.querySelectorAll('[data-beat-surface="active"]').length,text:document.body.innerText})`);
    await fs.writeFile(path.join(out,label+'-universe.json'),JSON.stringify(data,null,2));
    console.log(JSON.stringify({canvas:data.canvas,activeWrappers:data.activeWrappers,first:data.samples[0]?.debug,last:data.samples.at(-1)?.debug}));
  }
  if(process.env.BEAT_CONTROLS){
    const snap=()=>evaluate(`(()=>{const p=document.querySelector('[data-beat-debug]');return JSON.parse(p.textContent.slice(p.textContent.indexOf('{')))})()`);
    await evaluate(`document.querySelector('video[src="/videos/globe-hq.mp4"]').muted=true`);await delay(500);const mutedStart=await snap();await delay(1300);const mutedEnd=await snap();
    await evaluate(`document.querySelector('video[src="/videos/globe-hq.mp4"]').muted=false`);await delay(1500);
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(500);const reducedStart=await snap();await delay(1300);const reducedEnd=await snap();
    await send('Emulation.setEmulatedMedia',{features:[]});await delay(500);
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Search').click()`);await delay(500);
    await evaluate(`document.querySelector('[aria-label="Search songs"]').focus()`);
    await send('Input.insertText',{text:'Daft Punk'});await delay(10000);
    const search=await evaluate(`({text:document.body.innerText,plays:[...document.querySelectorAll('button[aria-label^="Play "]')].map(b=>b.getAttribute('aria-label'))})`);
    console.log(JSON.stringify({search}));
    if(search.plays.length){
      await evaluate(`document.querySelector('button[aria-label^="Play "]').click()`);
      await delay(6000);const track=await snap();
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(1500);
      const start=await evaluate('performance.now()');await delay(5000);
      const trackSamples=await evaluate(`beatSamples.filter(s=>s.t>=${start})`);
      await fs.writeFile(path.join(out,label+'-track.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
      await fs.writeFile(path.join(out,label+'-controls.json'),JSON.stringify({mutedStart,mutedEnd,reducedStart,reducedEnd,search,track,trackSamples,errors},null,2));
      console.log(JSON.stringify({mutedStable:mutedStart.beats===mutedEnd.beats,reducedStable:reducedStart.beats===reducedEnd.beats,track,last:trackSamples.at(-1),errors}));
    }else await fs.writeFile(path.join(out,label+'-controls.json'),JSON.stringify({mutedStart,mutedEnd,reducedStart,reducedEnd,search,errors},null,2));
  }
  console.log(JSON.stringify({total:trials.length,errors}));
  await send('Browser.close').catch(()=>{});
}finally{ws?.close();browser.kill()}
