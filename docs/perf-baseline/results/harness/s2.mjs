// S2 intro-card hover measurement on production, clean temp Brave profile, driven via CDP.
// Usage: node s2.mjs <OUT_DIR> <PHASE: pilot|A|B>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';

const OUT = process.argv[2]; const PHASE = process.argv[3] || 'pilot';
const URL_ = 'https://kadence-musicz.vercel.app/';
const EARLY = fs.readFileSync(new URL('./s2early.js', import.meta.url), 'utf8');
const RAW = path.join(OUT, 'raw'); const REC = path.join(OUT, 'recordings'); const TR = path.join(OUT, 'traces');
for (const d of [RAW, REC, TR]) fs.mkdirSync(d, { recursive: true });

const GRID = ['global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central', 'pop-rising', 'dance-hits', 'mood-booster', 'late-night', 'workout', 'chill-hits', 'top-telugu', 'top-tamil', 'top-hindi', 'top-kpop'];
const sel = (t) => (t === 'cue' ? '#explore-dev-universe-btn' : t === 'cc' ? '#vibe-dev-special' : '#vibe-' + t);
const vibeOf = (t) => (t === 'cue' || t === 'cc' ? 'dev-special' : t);

const launch = await launchBrave();
const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); process.exit(1); });
const net = []; const netById = new Map(); const media = []; let frameSink = null;
cdp.on((m, p, sid) => {
  if (sid !== sessionId) return;
  const wallNow = Date.now();
  if (m === 'Network.requestWillBeSent') { const r = { id: p.requestId, url: p.request.url.split('?')[0], range: p.request.headers.Range || p.request.headers.range || null, type: p.type, ts0: p.timestamp, wall0: p.wallTime * 1000 }; net.push(r); netById.set(p.requestId, r); }
  else if (m === 'Network.responseReceived') { const r = netById.get(p.requestId); if (r) Object.assign(r, { status: p.response.status, fromDiskCache: !!p.response.fromDiskCache, fromMemCache: !!p.response.fromMemoryCache, contentRange: p.response.headers['content-range'] || null, contentLength: p.response.headers['content-length'] || null, cacheControl: p.response.headers['cache-control'] || null, xVercelCache: p.response.headers['x-vercel-cache'] || null, respWall: r.wall0 + (p.timestamp - r.ts0) * 1000, proto: p.response.protocol }); }
  else if (m === 'Network.dataReceived') { const r = netById.get(p.requestId); if (r) { r.bytesRx = (r.bytesRx || 0) + (p.encodedDataLength || 0); if (!r.firstByteWall) r.firstByteWall = r.wall0 + (p.timestamp - r.ts0) * 1000; } }
  else if (m === 'Network.loadingFinished') { const r = netById.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, encodedDataLength: p.encodedDataLength }); }
  else if (m === 'Network.loadingFailed') { const r = netById.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, failed: p.errorText, canceled: !!p.canceled }); }
  else if (m === 'Network.requestServedFromCache') { const r = netById.get(p.requestId); if (r) r.servedFromCache = true; }
  else if (m.startsWith('Media.')) media.push({ wall: wallNow, m, p });
  else if (m === 'Page.screencastFrame') { s('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {}); if (frameSink) frameSink(p); }
});
await s('Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 1_000_000 });
await s('Page.enable'); await s('Runtime.enable'); await s('Media.enable').catch(() => {});
await s('Page.addScriptToEvaluateOnNewDocument', { source: EARLY });
// no cache clearing here: warm trials rely on the pre-warmed cache; cold trials clear it per trial
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: URL_ }, undefined, 180000);
await Promise.race([loaded, sleep(120000)]); await sleep(6000);
// wait until React has hydrated the cards (handlers attached), up to 5 min
const hydT0 = Date.now(); let hydrated = false;
for (let i = 0; i < 150 && !hydrated; i++) { hydrated = await evaluate(s, `(() => { const e = document.querySelector('#vibe-global-top-50'); return !!e && Object.keys(e).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); })()`).catch(() => false); if (!hydrated) await sleep(2000); }
console.log('hydrated', hydrated, 'waitedMs', Date.now() - hydT0);

const geo = async (selector) => evaluate(s, `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, vh: innerHeight, vw: innerWidth }; })()`);
const neutralPoint = async () => evaluate(s, `(() => { const cands = [[innerWidth - 24, innerHeight * 0.5], [24, innerHeight * 0.5], [innerWidth - 24, innerHeight - 24], [24, innerHeight - 24], [innerWidth * 0.5, innerHeight - 8]];
  for (const [x, y] of cands) { const e = document.elementFromPoint(x, y); if (!e) continue; if (e.closest('button, a, [class*="kadence-"], canvas, input')) continue; return { x, y, el: e.tagName + '.' + String(e.className).slice(0, 60) }; } return null; })()`);
const move = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
let NEUTRAL = await neutralPoint();
await move(NEUTRAL.x, NEUTRAL.y); await sleep(800);
const env = { phase: PHASE, startedAt: new Date().toISOString(), browser: cdp.version.Browser, launch, neutral: NEUTRAL, page: await evaluate(s, `({ vp: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio, activation: navigator.userActivation.hasBeenActive, conn: navigator.connection ? { et: navigator.connection.effectiveType, down: navigator.connection.downlink, rtt: navigator.connection.rtt } : null, videos: document.querySelectorAll('video').length })`) };
console.log('env', JSON.stringify(env));

async function scrollIntoViewBy(selector) { // wheel at neutral point until target centred-ish (wheel = no user activation)
  for (let i = 0; i < 40; i++) { const g = await geo(selector); if (!g) return null; if (g.top > g.vh * 0.15 && g.top + g.h < g.vh * 0.95) return g; await s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: NEUTRAL.x, y: NEUTRAL.y, deltaX: 0, deltaY: g.top > g.vh * 0.5 ? 240 : -240 }); await sleep(250); }
  return geo(selector);
}
async function scrollTop() { for (let i = 0; i < 40; i++) { const g = await geo('#explore-dev-universe-btn'); if (g && g.top > 0 && g.top < g.vh) return; await s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: NEUTRAL.x, y: NEUTRAL.y, deltaX: 0, deltaY: -480 }); await sleep(250); } }

async function withTrace(file, fn) {
  const chunks = []; const done = new Promise((res) => cdp.on((m, p) => { if (m === 'Tracing.tracingComplete') res(p.stream); }));
  await cdp.send('Tracing.start', { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'loading', 'latencyInfo', 'gpu', 'viz', 'media', 'cc'].join(','), transferMode: 'ReturnAsStream' });
  const r = await fn(); await cdp.send('Tracing.end'); const st = await done;
  for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: st, size: 1 << 20 }); chunks.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data)); if (eof) break; }
  await cdp.send('IO.close', { handle: st }); fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(chunks))); return r;
}

const procCpu = async () => { try { return (await cdp.send('SystemInfo.getProcessInfo')).processInfo; } catch { return null; } };

async function trial(t) {
  // t: { id, targets: [..], cold, dwellMs, leaveMs, stepMs (sweep), record, trace }
  if (t.cold) await s('Network.clearBrowserCache');
  let geos = [];
  if (t.targets[0] === 'cc') { const g = await scrollIntoViewBy('#vibe-dev-special'); NEUTRAL = (await neutralPoint()) || NEUTRAL; await move(NEUTRAL.x, NEUTRAL.y); await sleep(1500); geos = [g]; }
  else geos = await Promise.all(t.targets.map((x) => geo(sel(x))));
  const base = JSON.parse(await evaluate(s, `JSON.stringify(window.__s2.reset())`));
  const netStart = net.length; const mediaStart = media.length;
  const frames = []; let recDir = null;
  if (t.record) { recDir = path.join(REC, t.id); fs.mkdirSync(recDir, { recursive: true }); frameSink = (p) => { const name = `f${String(frames.length).padStart(4, '0')}.jpg`; fs.writeFileSync(path.join(recDir, name), Buffer.from(p.data, 'base64')); frames.push({ name, ts: p.metadata.timestamp * 1000 }); }; await s('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 }); await sleep(300); }
  const cpu0 = await procCpu(); const actions = [];
  const run = async () => {
    await sleep(300);
    for (let i = 0; i < t.targets.length; i++) { const g = geos[i]; actions.push({ wall: Date.now(), action: 'enter', target: t.targets[i], x: Math.round(g.x), y: Math.round(g.y) }); await move(g.x, g.y); if (i < t.targets.length - 1) await sleep(t.stepMs); }
    await sleep(t.dwellMs);
    actions.push({ wall: Date.now(), action: 'leave', x: Math.round(NEUTRAL.x), y: Math.round(NEUTRAL.y) }); await move(NEUTRAL.x, NEUTRAL.y);
    await sleep(t.leaveMs);
  };
  if (t.trace) await withTrace(path.join(TR, `${t.id}_trace.json.gz`), run); else await run();
  const cpu1 = await procCpu();
  if (t.record) { await s('Page.stopScreencast'); frameSink = null; }
  const page = JSON.parse(await evaluate(s, `window.__s2.dump()`));
  const cpu = cpu0 && cpu1 ? cpu1.map((p) => { const a = cpu0.find((q) => q.id === p.id); return a ? { type: p.type, cpuSec: +(p.cpuTime - a.cpuTime).toFixed(3) } : null; }).filter(Boolean) : null;
  const rec = { id: t.id, phase: PHASE, spec: t, base, actions, geos, page, network: net.slice(netStart), media: media.slice(mediaStart), cpu, recording: t.record ? { dir: path.relative(OUT, recDir), frames } : null };
  writeJSON(path.join(RAW, `${t.id}.json`), rec);
  if (t.record) writeFlipbook(recDir, frames, t.id, actions);
  if (t.targets[0] === 'cc') { await scrollTop(); NEUTRAL = (await neutralPoint()) || NEUTRAL; await move(NEUTRAL.x, NEUTRAL.y); await sleep(800); }
  // quick console line
  const ev = page.ev; const to = page.timeOrigin; const enterWall = actions[0].wall;
  const first = (type, role) => { const e = ev.find((x) => x[1] === type && (!role || x[2] === role)); return e ? Math.round(to + e[0] - enterWall) : null; };
  const firstFrame = page.fr.find((f) => f[1] === 'P'); const fullFrame = page.fr.find((f) => f[1] === 'F');
  const rej = ev.filter((x) => x[1] === 'play:rejected').map((x) => x[2] + ':' + x[7]);
  console.log(t.id, '| srcSet', first('srcSet', 'P'), '| canplay', first('canplay', 'P'), '| play()', first('play()', 'P'), '| resolved', first('play:resolved', 'P'), '| P 1st frame', firstFrame ? Math.round(to + firstFrame[0] - enterWall) : null, '| F srcSet', first('srcSet', 'F'), '| F 1st frame', fullFrame ? Math.round(to + fullFrame[0] - enterWall) : null, '| rejected', rej.join(',') || '-', '| videoReqs', rec.network.filter((r) => r.url.includes('/videos/')).length);
  return rec;
}

function writeFlipbook(dir, frames, id, actions) {
  const t0 = frames.length ? frames[0].ts : 0;
  const marks = actions.map((a) => ({ t: a.wall - t0, label: a.action + (a.target ? ' ' + a.target : '') }));
  const html = `<!doctype html><meta charset="utf-8"><title>${id} recording</title><style>body{background:#111;color:#ddd;font:13px system-ui;margin:16px}img{max-width:100%;display:block}#bar{margin:8px 0}</style>
<h3>${id} — screencast (${frames.length} frames)</h3><div id="bar"><button id="p">Play</button> <input id="r" type="range" min="0" max="${Math.max(0, frames.length - 1)}" value="0" style="width:60%"> <span id="l"></span></div><img id="i">
<script>const F=${JSON.stringify(frames.map((f) => [f.name, Math.round(f.ts - t0)]))};const M=${JSON.stringify(marks)};let k=0,timer=null;const show=n=>{k=n;i.src=F[n][0];r.value=n;const t=F[n][1];const m=M.filter(x=>x.t<=t).pop();l.textContent='t='+t+' ms'+(m?'  (after: '+m.label+' @'+Math.round(m.t)+' ms)':'');};
const play=()=>{if(timer){clearTimeout(timer);timer=null;p.textContent='Play';return;}p.textContent='Pause';const step=()=>{if(k>=F.length-1){timer=null;p.textContent='Play';return;}const d=F[k+1][1]-F[k][1];show(k+1);timer=setTimeout(step,d);};step();};p.onclick=play;r.oninput=()=>show(+r.value);show(0);</script>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

// ---------------- plans ----------------
const D = 10000, DG = 12000, LEAVE = 2500, STEP = 150;
const plan = [];
const activate = async () => {
  const h = await evaluate(s, `(() => { const e = [...document.querySelectorAll('h2')].find(x => /listening/i.test(x.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 8, y: r.top + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x: h.x, y: h.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await sleep(300); await move(NEUTRAL.x, NEUTRAL.y); await sleep(1500);
  env.activationClick = { at: h, activation: await evaluate(s, 'navigator.userActivation.hasBeenActive'), stillOnIntro: await evaluate(s, `!!document.querySelector('#vibe-global-top-50')`), wall: Date.now() };
  console.log('activation', JSON.stringify(env.activationClick));
};
if (PHASE === 'wrec') {
  if (env.page.activation) { console.log('ABORT: page already has user activation (not caused by this script)'); plan.length = 0; } else plan.push({ id: 'REC_noact_global-top-50', targets: ['global-top-50'], cold: false, dwellMs: 6000, leaveMs: LEAVE, record: true });
} else if (PHASE === 'pilot') {
  plan.push({ id: 'pilot_warm_hip-hop-central', targets: ['hip-hop-central'], cold: false, dwellMs: D, leaveMs: LEAVE });
} else if (PHASE === 'main') {
  plan.push({ fn: async () => { // untraced idle CPU per process (Task-Manager-like), pointer at neutral, intro idle
    const a = await procCpu(); const w0 = Date.now(); await sleep(15000); const b = await procCpu(); const sec = (Date.now() - w0) / 1000;
    env.idleCpuUntraced = { seconds: sec, perProcess: b.map((p) => { const q = a.find((x) => x.id === p.id); return q ? { type: p.type, id: p.id, pctOfOneCore: +(((p.cpuTime - q.cpuTime) / sec) * 100).toFixed(1) } : null; }).filter((x) => x && x.pctOfOneCore > 0.2), globe: await evaluate(s, `(() => { const g = [...document.querySelectorAll('video')].find(v => (v.currentSrc||'').includes('globe')); return g ? { paused: g.paused, readyState: g.readyState, w: g.videoWidth } : null; })()`) };
    console.log('idleCpuUntraced', JSON.stringify(env.idleCpuUntraced)); } });
  for (const g of [...GRID, 'cue']) plan.push({ id: `W_warm_noact_${g}`, targets: [g], cold: false, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  plan.push({ id: 'W_rapid_warm_noact', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ fn: activate });
  for (const g of [...GRID, 'cue']) plan.push({ id: `B_warm_act_${g}`, targets: [g], cold: false, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  for (const rr of ['r2', 'r3']) { for (const g of ['hip-hop-central', 'late-night', 'global-top-50']) plan.push({ id: `B_warm_act_${g}_${rr}`, targets: [g], cold: false, dwellMs: D, leaveMs: LEAVE }); plan.push({ id: `B_warm_act_cue_${rr}`, targets: ['cue'], cold: false, dwellMs: DG, leaveMs: LEAVE }); }
  plan.push({ id: 'B_warm_act_cc', targets: ['cc'], cold: false, dwellMs: DG, leaveMs: LEAVE });
  plan.push({ id: 'B_rapid_warm_act_r1', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'B_rapid_warm_act_r2', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'REC_warm_act_late-night', targets: ['late-night'], cold: false, dwellMs: D, leaveMs: LEAVE, record: true });
  plan.push({ id: 'REC_warm_act_cue', targets: ['cue'], cold: false, dwellMs: DG, leaveMs: LEAVE, record: true });
  plan.push({ id: 'REC_warm_act_rapid', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE, record: true });
  plan.push({ id: 'TRACE_warm_act_late-night', targets: ['late-night'], cold: false, dwellMs: D, leaveMs: LEAVE, trace: true });
  plan.push({ id: 'TRACE_warm_act_cue', targets: ['cue'], cold: false, dwellMs: DG, leaveMs: LEAVE, trace: true });
  for (const g of [...GRID, 'cue']) plan.push({ id: `C_cold_act_${g}`, targets: [g], cold: true, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  plan.push({ id: 'C_rapid_cold_act', targets: GRID.slice(0, 7), cold: true, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'REC_cold_act_global-top-50', targets: ['global-top-50'], cold: true, dwellMs: D, leaveMs: LEAVE, record: true });
} else if (PHASE === 'A') {
  for (const g of [...GRID, 'cue']) plan.push({ id: `A_cold_${g}`, targets: [g], cold: true, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  for (const g of [...GRID, 'cue']) plan.push({ id: `A_warm_${g}`, targets: [g], cold: false, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  plan.push({ id: 'A_cold_cc', targets: ['cc'], cold: true, dwellMs: DG, leaveMs: LEAVE });
  plan.push({ id: 'A_rapid_warm_r1', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 5000, leaveMs: LEAVE });
  plan.push({ id: 'A_rec_warm_global-top-50', targets: ['global-top-50'], cold: false, dwellMs: D, leaveMs: LEAVE, record: true });
}
if (PHASE === 'B') {
  // user activation: one click on the plain heading text (no handler), then back to neutral
  const h = await evaluate(s, `(() => { const e = [...document.querySelectorAll('h2')].find(x => /listening/i.test(x.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 8, y: r.top + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x: h.x, y: h.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await sleep(300); await move(NEUTRAL.x, NEUTRAL.y); await sleep(1500);
  env.activationClick = { at: h, activation: await evaluate(s, 'navigator.userActivation.hasBeenActive'), step: await evaluate(s, `!!document.querySelector('#vibe-global-top-50')`) };
  console.log('activation', JSON.stringify(env.activationClick));
  for (const g of [...GRID, 'cue']) plan.push({ id: `B_cold_${g}`, targets: [g], cold: true, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  for (const g of [...GRID, 'cue']) plan.push({ id: `B_warm_${g}`, targets: [g], cold: false, dwellMs: g === 'cue' ? DG : D, leaveMs: LEAVE });
  for (const rr of ['r2', 'r3']) for (const g of ['hip-hop-central', 'global-top-50', 'workout']) { plan.push({ id: `B_cold_${g}_${rr}`, targets: [g], cold: true, dwellMs: D, leaveMs: LEAVE }); plan.push({ id: `B_warm_${g}_${rr}`, targets: [g], cold: false, dwellMs: D, leaveMs: LEAVE }); }
  plan.push({ id: 'B_cold_cc_r1', targets: ['cc'], cold: true, dwellMs: DG, leaveMs: LEAVE });
  plan.push({ id: 'B_cold_cc_r2', targets: ['cc'], cold: true, dwellMs: DG, leaveMs: LEAVE });
  plan.push({ id: 'B_rapid_cold_r1', targets: GRID.slice(0, 7), cold: true, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'B_rapid_warm_r1', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'B_rapid_warm_r2', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE });
  plan.push({ id: 'B_rec_cold_global-top-50', targets: ['global-top-50'], cold: true, dwellMs: D, leaveMs: LEAVE, record: true });
  plan.push({ id: 'B_rec_cold_cue', targets: ['cue'], cold: true, dwellMs: DG, leaveMs: LEAVE, record: true });
  plan.push({ id: 'B_rec_warm_rapid', targets: GRID.slice(0, 7), cold: false, stepMs: STEP, dwellMs: 6000, leaveMs: LEAVE, record: true });
  plan.push({ id: 'B_trace_cold_cue', targets: ['cue'], cold: true, dwellMs: DG, leaveMs: LEAVE, trace: true });
  plan.push({ id: 'B_trace_warm_global-top-50', targets: ['global-top-50'], cold: false, dwellMs: D, leaveMs: LEAVE, trace: true });
}
writeJSON(path.join(OUT, `env_phase-${PHASE}.json`), env);
for (const t of plan) { if (t.fn) { await t.fn(); writeJSON(path.join(OUT, `env_phase-${PHASE}.json`), env); continue; } try { await trial(t); } catch (e) { console.log('TRIAL FAILED', t.id, e.message); } await sleep(700); }
writeJSON(path.join(OUT, `env_phase-${PHASE}.json`), { ...env, finishedAt: new Date().toISOString() });
await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
cdp.close();
console.log('done', PHASE, plan.length, 'trials');
