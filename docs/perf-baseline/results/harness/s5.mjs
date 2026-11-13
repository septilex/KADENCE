// S5: Song Detail 27 s script. Usage: node s5.mjs <OUT> <RUN> <prod|dev> <cpu> <trace 0|1>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const [OUT, RUN, TARGET, CPU, TRACE] = process.argv.slice(2);
const URL_ = TARGET === 'dev' ? 'http://localhost:3000/' : 'https://kadence-musicz.vercel.app/';
const HARN = 'C:/AntiGravity Projects/KADENCE/docs/perf-baseline/results/harness';
const SCRIPTS = ['s2early.js', 's3extra.js', 's4extra.js', 's5extra.js'].map((f) => fs.readFileSync(path.join(HARN, f), 'utf8'));
for (const d of ['raw', 'traces', 'shots']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const log = (...a) => console.log(RUN, new Date().toISOString().slice(11, 19), ...a);
const launch = await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); process.exit(1); });
const net = [], byId = new Map(), media = [];
cdp.on((m, p, sid) => {
  if (sid !== sessionId) return;
  if (m === 'Network.requestWillBeSent') { const r = { url: p.request.url.split('?')[0], ts0: p.timestamp, wall0: p.wallTime * 1000 }; net.push(r); byId.set(p.requestId, r); }
  else if (m === 'Network.responseReceived') { const r = byId.get(p.requestId); if (r) Object.assign(r, { status: p.response.status, fromDiskCache: !!p.response.fromDiskCache }); }
  else if (m === 'Network.dataReceived') { const r = byId.get(p.requestId); if (r) r.bytesRx = (r.bytesRx || 0) + (p.encodedDataLength || 0); }
  else if (m === 'Network.loadingFinished') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, encodedDataLength: p.encodedDataLength }); }
  else if (m === 'Network.loadingFailed') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, failed: p.errorText }); }
  else if (m.startsWith('Media.')) media.push({ wall: Date.now(), m, p });
});
await s('Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 1_000_000 });
await s('Page.enable'); await s('Runtime.enable'); await s('Media.enable').catch(() => {});
for (const src of SCRIPTS) await s('Page.addScriptToEvaluateOnNewDocument', { source: src });
await s('Emulation.setCPUThrottlingRate', { rate: +CPU });
const procCpu = async () => { try { return (await cdp.send('SystemInfo.getProcessInfo')).processInfo; } catch { return null; } };
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: URL_ }, undefined, 180000); await Promise.race([loaded, sleep(150000)]);
let hyd = false; for (let i = 0; i < 150 && !hyd; i++) { hyd = await evaluate(s, `(() => { const e = document.querySelector('#vibe-late-night'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hyd) await sleep(2000); }
await sleep(5000);
const V = await evaluate(s, `({ w: innerWidth, h: innerHeight })`);
const move = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
const down = (x, y) => s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
const up = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
const click = async (x, y) => { await down(x, y); await up(x, y); };
const dragMove = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'mouse' });
// ---- enter Late Night, wait for a settled wall with a track playing ----
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-late-night').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await move(g.x, g.y); await sleep(30); await click(g.x, g.y); const entryWall = Date.now();
let revealed = false; for (let i = 0; i < 240 && !revealed; i++) { revealed = await evaluate(s, `(() => !document.querySelector('.animate-slowOrbit') && !document.querySelector('[id^="vibe-"]'))()`).catch(() => false); if (!revealed) await sleep(500); }
const revealMs = Date.now() - entryWall;
let settleMs = 0; for (let i = 0; i < 120; i++) { const st = await evaluate(s, `(() => { const l = window.__s3.img.filter(x => x[2] != null).map(x => x[2]); return { n: window.__s3.img.length, loaded: l.length, last: l.length ? Math.max(...l) : 0, now: performance.now() }; })()`); if (st.loaded > 0 && st.now - st.last > 3000 && st.loaded >= st.n - 2) { settleMs = Date.now() - entryWall; break; } await sleep(500); }
const playingAtStart = await evaluate(s, `(() => { const ev = window.__s3.audioEv; const last = {}; for (const e of ev) last[e[1]] = e[2]; return Object.values(last).filter(v => v === 'playing').length; })()`);
log('revealed', revealed, revealMs, 'ms; settled', settleMs, 'ms; audio elements in playing state', playingAtStart);
// ---- 27 s Song Detail script ----
await evaluate(s, `(window.__s2.reset(), window.__s3.reset(), window.__s4.reset(), window.__s5.reset(), 1)`);
const netStart = net.length, mediaStart = media.length;
let traceDone = null;
if (TRACE === '1') { traceDone = new Promise((res) => cdp.on((m, p) => { if (m === 'Tracing.tracingComplete') res(p.stream); })); await cdp.send('Tracing.start', { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'latencyInfo', 'gpu', 'viz', 'cc'].join(','), transferMode: 'ReturnAsStream' }); await sleep(300); }
const T0 = Date.now(); const at = (ms) => sleep(Math.max(0, T0 + ms - Date.now()));
const cpuAt = []; const mark = async (name) => cpuAt.push({ name, t: Date.now() - T0, cpu: await procCpu() });
const actions = []; const act = (tag, x, y) => actions.push({ t: Date.now() - T0, tag, x: x == null ? null : Math.round(x), y: y == null ? null : Math.round(y) });
const byTitle = (re) => evaluate(s, `(() => { const re = new RegExp(${JSON.stringify(re)}); const b = [...document.querySelectorAll('[title]')].find(x => re.test(x.getAttribute('title')) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, title: b.getAttribute('title') }; })()`);
const scrubRect = () => evaluate(s, `(() => { const e = document.querySelector('.fixed.left-4.top-4 div.touch-none') || document.querySelector('div.touch-none.relative'); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, width: r.width, y: r.top + r.height / 2 }; })()`);
const clickTitle = async (re, label) => { const b = await byTitle(re); act('click ' + (b ? b.title : label + ' (not found)'), b?.x, b?.y); if (b) { await move(b.x, b.y); await sleep(40); await click(b.x, b.y); } return !!b; };
await mark('idle_wall');
await at(2000); { const x = V.w * 0.62, y = V.h * 0.5; act('move+click tile (not popped)', x, y); await move(x, y); await sleep(250); await click(x, y); }
await mark('detail_open_idle');
await at(10000); await clickTitle('^(Pause|Play)$', 'pause'); await mark('paused');
await at(12000); await clickTitle('^(Pause|Play)$', 'play'); await mark('playing_again');
await at(14000); await mark('scrub');
{ const r = await scrubRect(); if (r) { const x0 = r.left + r.width * 0.2, x1 = r.left + r.width * 0.8; act('scrub press 20%', x0, r.y); await move(x0, r.y); await sleep(30); await down(x0, r.y); const t0 = Date.now(); for (let i = 1; i <= 60; i++) { await dragMove(x0 + (x1 - x0) * i / 60, r.y); const due = t0 + i * 50; if (Date.now() < due) await sleep(due - Date.now()); } await up(x1, r.y); act('scrub release 80%', x1, r.y); await at(18000); const x4 = r.left + r.width * 0.4; act('click 40%', x4, r.y); await move(x4, r.y); await sleep(30); await click(x4, r.y); } else act('scrubber not found'); }
await at(20000); await mark('next'); await clickTitle('^Next Track$', 'next');
await at(24000); await mark('close'); await clickTitle('^Close$', 'close');
await at(27000); await mark('script_end');
if (TRACE === '1') { await cdp.send('Tracing.end'); const st = await traceDone; const ch = []; for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: st, size: 1 << 20 }); ch.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data)); if (eof) break; } await cdp.send('IO.close', { handle: st }); fs.writeFileSync(path.join(OUT, 'traces', `${RUN}_trace.json.gz`), zlib.gzipSync(Buffer.concat(ch))); }
const dump = { s2: JSON.parse(await evaluate(s, 'window.__s2.dump()')), s3: JSON.parse(await evaluate(s, 'window.__s3.dump()')), s4: JSON.parse(await evaluate(s, 'window.__s4.dump()')), s5: JSON.parse(await evaluate(s, 'window.__s5.dump()')) };
// ---- WebGL frames while Song Detail is open and idle (5 s): reopen a tile ----
{ const x = V.w * 0.55, y = V.h * 0.45; await move(x, y); await sleep(200); await click(x, y); await sleep(1500); }
const glOpen = await evaluate(s, `(async () => { const f0 = window.__s3.frames.length; const t0 = performance.now(); await new Promise(r => setTimeout(r, 5000)); const fr = window.__s3.frames.slice(f0); const sec = (performance.now() - t0) / 1000; const wd = fr.filter(x => x[1] > 0).length; return { seconds: +sec.toFixed(2), frames: fr.length, framesWithDraws: wd, framesWithDrawsPerSec: +(wd / sec).toFixed(1), detailOpen: !!document.querySelector('.fixed.left-4.top-4.bottom-4') }; })()`);
const shot = await s('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_detail-open-idle.jpg`), Buffer.from(shot.data, 'base64'));
log('webgl while detail open', JSON.stringify(glOpen));
const cpuSeg = cpuAt.slice(1).map((c, i) => { const a = cpuAt[i]; if (!a.cpu || !c.cpu) return null; const sec = (c.t - a.t) / 1000; return { segment: a.name, sec: +sec.toFixed(1), procs: c.cpu.map((p) => { const q = a.cpu.find((x) => x.id === p.id); return q ? { type: p.type, pct: +(((p.cpuTime - q.cpuTime) / sec) * 100).toFixed(1) } : null; }).filter((x) => x && x.pct > 0.5) }; }).filter(Boolean);
writeJSON(path.join(OUT, 'raw', `${RUN}.json`), { run: RUN, target: TARGET, cpu: +CPU, traced: TRACE === '1', browser: cdp.version.Browser, launch, viewport: V, revealMs, settleMs, playingAtStart, T0wall: T0, actions, cpuSeg, glOpen, dump,
  network: net.slice(netStart).map((r) => ({ url: r.url, status: r.status ?? null, fromDiskCache: !!r.fromDiskCache, start: Math.round(r.wall0 - T0), end: r.endWall ? Math.round(r.endWall - T0) : null, bytes: r.encodedDataLength ?? r.bytesRx ?? 0, failed: r.failed || null })), media: media.slice(mediaStart) });
log('saved; commits', dump.s4.commits.length, 'events', dump.s5.evt.length, 'drawer changes', dump.s5.drawer.length, 'actions', JSON.stringify(actions.map((a) => a.tag)));
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
