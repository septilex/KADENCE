// S4: 60 s Universe interaction script. Usage: node s4.mjs <OUT> <RUN> <prod|dev> <cpu> <trace 0|1> <extras 0|1 (heap + refresh + switch)>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const [OUT, RUN, TARGET, CPU, TRACE, EXTRAS] = process.argv.slice(2);
const URL_ = TARGET === 'dev' ? 'http://localhost:3000/' : 'https://kadence-musicz.vercel.app/';
const HARN = 'C:/AntiGravity Projects/KADENCE/docs/perf-baseline/results/harness';
const SCRIPTS = ['s2early.js', 's3extra.js', 's4extra.js'].map((f) => fs.readFileSync(path.join(HARN, f), 'utf8'));
for (const d of ['raw', 'traces', 'shots']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const log = (...a) => console.log(RUN, new Date().toISOString().slice(11, 19), ...a);
const launch = await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); process.exit(1); });
const net = [], byId = new Map(), media = [], consoleLines = [];
cdp.on((m, p, sid) => {
  if (sid !== sessionId) return;
  if (m === 'Network.requestWillBeSent') { const r = { id: p.requestId, url: p.request.url.split('?')[0], type: p.type, ts0: p.timestamp, wall0: p.wallTime * 1000 }; net.push(r); byId.set(p.requestId, r); }
  else if (m === 'Network.responseReceived') { const r = byId.get(p.requestId); if (r) Object.assign(r, { status: p.response.status, fromDiskCache: !!p.response.fromDiskCache, xVercelCache: p.response.headers['x-vercel-cache'] || null }); }
  else if (m === 'Network.dataReceived') { const r = byId.get(p.requestId); if (r) r.bytesRx = (r.bytesRx || 0) + (p.encodedDataLength || 0); }
  else if (m === 'Network.loadingFinished') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, encodedDataLength: p.encodedDataLength }); }
  else if (m === 'Network.loadingFailed') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, failed: p.errorText, canceled: !!p.canceled }); }
  else if (m.startsWith('Media.')) media.push({ wall: Date.now(), m, p });
  else if (m === 'Runtime.consoleAPICalled') { const txt = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' '); if (/AUDIO|PERF|KADENCE/i.test(txt)) consoleLines.push([Date.now(), txt.slice(0, 300)]); }
});
await s('Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 1_000_000 });
await s('Page.enable'); await s('Runtime.enable'); await s('Performance.enable'); await s('Media.enable').catch(() => {});
for (const src of SCRIPTS) await s('Page.addScriptToEvaluateOnNewDocument', { source: src });
await s('Emulation.setCPUThrottlingRate', { rate: +CPU });
const procCpu = async () => { try { return (await cdp.send('SystemInfo.getProcessInfo')).processInfo; } catch { return null; } };
const countAudio = async () => { try { const { result } = await s('Runtime.evaluate', { expression: 'HTMLAudioElement.prototype' }); const q = await s('Runtime.queryObjects', { prototypeObjectId: result.objectId }, undefined, 120000); const n = await s('Runtime.callFunctionOn', { objectId: q.objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true }); return n.result.value; } catch (e) { return 'err:' + e.message; } };
const heap = {};
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
const navWall = Date.now();
await s('Page.navigate', { url: URL_ }, undefined, 180000); await Promise.race([loaded, sleep(150000)]);
let hyd = false; for (let i = 0; i < 150 && !hyd; i++) { hyd = await evaluate(s, `(() => { const e = document.querySelector('#vibe-late-night'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hyd) await sleep(2000); }
await sleep(5000);
if (EXTRAS === '1') heap.heap1_idleIntro = await countAudio();
const V = await evaluate(s, `({ w: innerWidth, h: innerHeight, act: navigator.userActivation.hasBeenActive })`);
const move = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
const click = async (x, y) => { await s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }); await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }); };
// ---- enter Late Night (move + click on the card, then no pointer movement) ----
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-late-night').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await move(g.x, g.y); await sleep(30); await click(g.x, g.y); const entryWall = Date.now(); log('entered; hydrated', hyd, 'preActivation', V.act);
let revealed = false; for (let i = 0; i < 240 && !revealed; i++) { revealed = await evaluate(s, `(() => !document.querySelector('.animate-slowOrbit') && !document.querySelector('[id^="vibe-"]'))()`).catch(() => false); if (!revealed) await sleep(500); }
const revealMs = Date.now() - entryWall; log('wall revealed', revealed, revealMs, 'ms');
let audioOn = false; for (let i = 0; i < 60 && !audioOn; i++) { audioOn = await evaluate(s, `window.__s3.audioEv.some(e => e[2] === 'playing')`).catch(() => false); if (!audioOn) await sleep(500); }
let settleMs = 0; for (let i = 0; i < 120; i++) { const st = await evaluate(s, `(() => { const l = window.__s3.img.filter(x => x[2] != null).map(x => x[2]); return { n: window.__s3.img.length, loaded: l.length, last: l.length ? Math.max(...l) : 0, now: performance.now() }; })()`); if (st.loaded > 0 && st.now - st.last > 3000 && st.loaded >= st.n - 2) { settleMs = Date.now() - entryWall; break; } await sleep(500); }
log('audio playing', audioOn, 'artwork settled at', settleMs || 'not settled (cap)', 'ms');
await sleep(10000);
const mapsFound = await evaluate(s, `window.__s4.locateAudioMaps()`);
if (EXTRAS === '1') heap.heap2_settledWall = await countAudio();
const shot0 = await s('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_settled.jpg`), Buffer.from(shot0.data, 'base64'));
// ---- 60 s script ----
await evaluate(s, `(window.__s2.reset(), window.__s3.reset(), window.__s4.reset(), 1)`);
const netStart = net.length, mediaStart = media.length, consStart = consoleLines.length;
let traceDone = null;
if (TRACE === '1') { traceDone = new Promise((res) => cdp.on((m, p) => { if (m === 'Tracing.tracingComplete') res(p.stream); })); await cdp.send('Tracing.start', { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'loading', 'latencyInfo', 'gpu', 'viz', 'media'].join(','), transferMode: 'ReturnAsStream' }); await sleep(300); }
const segs = []; const cpuAt = []; const T0 = Date.now(); const at = (ms) => sleep(Math.max(0, T0 + ms - Date.now()));
const mark = async (name) => { segs.push({ name, wall: Date.now(), t: Date.now() - T0 }); cpuAt.push({ name, t: Date.now() - T0, cpu: await procCpu() }); };
const actions = []; const mv = async (x, y, tag) => { actions.push({ t: Date.now() - T0, x: Math.round(x), y: Math.round(y), tag }); await move(x, y); };
await mark('passive_start');
await at(10000); await mark('slow_hover_start');
{ const y = V.h * 0.55; let px = V.w * 0.2; for (let i = 0; i < 10; i++) { const tx = V.w * (0.25 + i * 0.5 / 9); for (let k = 1; k <= 5; k++) { await mv(px + (tx - px) * k / 5, y, 'slow'); await sleep(30); } px = tx; await at(10000 + (i + 1) * 1500); } }
await mark('fast_sweep_start');
{ const rows = [0.35, 0.45, 0.55, 0.65].map((r) => V.h * r); const pts = []; rows.forEach((y, ri) => { for (let k = 0; k < 50; k++) { const f = k / 49; const x = V.w * (ri % 2 === 0 ? 0.15 + 0.7 * f : 0.85 - 0.7 * f); pts.push([x, y]); } });
  const t0 = Date.now(); for (let i = 0; i < pts.length; i++) { await mv(pts[i][0], pts[i][1], 'sweep'); const due = t0 + (i + 1) * 25; if (Date.now() < due) await sleep(due - Date.now()); }
  const t1 = Date.now(); const back = [...pts].reverse(); for (let i = 0; i < back.length; i++) { await mv(back[i][0], back[i][1], 'sweep-back'); const due = t1 + (i + 1) * 25; if (Date.now() < due) await sleep(due - Date.now()); } }
await at(25000 + 10000); await mark('pop_click_start');
{ const cx = V.w * 0.5, cy = V.h * 0.5; for (let k = 1; k <= 5; k++) { await mv(V.w * 0.4 + (cx - V.w * 0.4) * k / 5, V.h * 0.6 + (cy - V.h * 0.6) * k / 5, 'to-pop'); await sleep(30); }
  await at(35000 + 1600); actions.push({ t: Date.now() - T0, tag: 'click-popped-tile', x: Math.round(cx), y: Math.round(cy) }); await click(cx, cy);
  await at(35000 + 4600); actions.push({ t: Date.now() - T0, tag: 'click-left-edge (empty space attempt)', x: 4, y: Math.round(cy) }); await mv(4, cy, 'to-edge'); await sleep(50); await click(4, cy); }
await at(45000); await mark('passive2_start');
await at(60000); await mark('script_end');
if (TRACE === '1') { await cdp.send('Tracing.end'); const st = await traceDone; const ch = []; for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: st, size: 1 << 20 }); ch.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data)); if (eof) break; } await cdp.send('IO.close', { handle: st }); fs.writeFileSync(path.join(OUT, 'traces', `${RUN}_trace.json.gz`), zlib.gzipSync(Buffer.concat(ch))); }
await at(70000); await mark('plus10s');
if (EXTRAS === '1') heap.heap3_after60sScriptPlus10s = await countAudio();
const dump = { s2: JSON.parse(await evaluate(s, 'window.__s2.dump()')), s3: JSON.parse(await evaluate(s, 'window.__s3.dump()')), s4: JSON.parse(await evaluate(s, 'window.__s4.dump()')) };
const shot1 = await s('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_end.jpg`), Buffer.from(shot1.data, 'base64'));
const extras = {};
if (EXTRAS === '1') {
  // refresh segment (HY-3 / B5 baseline)
  await evaluate(s, `(window.__s2.reset(), window.__s3.reset(), window.__s4.reset(), 1)`); const rs = net.length; const rT0 = Date.now();
  const btn = await evaluate(s, `(() => { const b = [...document.querySelectorAll('button')].find(x => /refresh/i.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (btn) { await click(btn.x, btn.y); let busy = true; let sawBusy = false; for (let i = 0; i < 180 && busy; i++) { const d = await evaluate(s, `(() => { const b = [...document.querySelectorAll('button')].find(x => /refresh/i.test(x.textContent)); return b ? b.disabled : false; })()`); if (d) sawBusy = true; busy = d || (!sawBusy && i < 6); await sleep(500); } await sleep(3000); }
  extras.refresh = { clicked: !!btn, durationMs: Date.now() - rT0, s2: JSON.parse(await evaluate(s, 'window.__s2.dump()')), s3: JSON.parse(await evaluate(s, 'window.__s3.dump()')), network: net.slice(rs).map((r) => ({ url: r.url, status: r.status, xVercelCache: r.xVercelCache, start: Math.round(r.wall0 - rT0), end: r.endWall ? Math.round(r.endWall - rT0) : null, bytes: r.encodedDataLength ?? r.bytesRx ?? 0 })) };
  log('refresh done', extras.refresh.durationMs, 'ms');
  // switch chart to Workout, then heap4
  const sw = await evaluate(s, `(() => { const b = [...document.querySelectorAll('button')].find(x => /switch chart/i.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (sw) { await click(sw.x, sw.y); await sleep(1500); const wk = await evaluate(s, `(() => { const e = document.querySelector('#vibe-modal-workout'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`); if (wk) { await move(wk.x, wk.y); await sleep(30); await click(wk.x, wk.y); await sleep(15000); extras.switched = true; } }
  heap.heap4_afterSwitchToWorkout15s = await countAudio();
  log('heap', JSON.stringify(heap));
}
const post = await evaluate(s, `({ act: navigator.userActivation.hasBeenActive, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null })`);
const cpuSeg = cpuAt.slice(1).map((c, i) => { const a = cpuAt[i]; if (!a.cpu || !c.cpu) return null; const sec = (c.t - a.t) / 1000; return { segment: a.name, sec: +sec.toFixed(1), procs: c.cpu.map((p) => { const q = a.cpu.find((x) => x.id === p.id); return q ? { type: p.type, pct: +(((p.cpuTime - q.cpuTime) / sec) * 100).toFixed(1) } : null; }).filter((x) => x && x.pct > 0.5) }; }).filter(Boolean);
writeJSON(path.join(OUT, 'raw', `${RUN}.json`), { run: RUN, target: TARGET, url: URL_, cpu: +CPU, traced: TRACE === '1', browser: cdp.version.Browser, launch, viewport: V, navWall, entryWall, revealMs, revealed, audioOn, settleMs, mapsFound, T0wall: T0, segs, actions, cpuSeg, heap, post, dump,
  network: net.slice(netStart).map((r) => ({ url: r.url, type: r.type, status: r.status ?? null, fromDiskCache: !!r.fromDiskCache, start: Math.round(r.wall0 - T0), end: r.endWall ? Math.round(r.endWall - T0) : null, bytes: r.encodedDataLength ?? r.bytesRx ?? 0, failed: r.failed || null, canceled: !!r.canceled })),
  media: media.slice(mediaStart), console: consoleLines.slice(consStart).map(([w, t]) => [w - T0, t]), extras });
log('saved; commits', dump.s4.commits.length, 'tipChanges', dump.s4.tip.length, 'poolSamples', dump.s4.pool.length, 'audioNew', dump.s3.audioNew.length, 'uploads', dump.s3.up.length, 'post', JSON.stringify(post));
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
