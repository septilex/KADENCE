// S3 chart entry on production, throwaway Brave profile. Usage: node s3.mjs <OUT> <runId> <vibe> <cold 0|1> <cpu> <trace 0|1>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const [OUT, RUN, VIBE, COLD, CPU, TRACE] = process.argv.slice(2);
const HARN = 'C:/AntiGravity Projects/KADENCE/docs/perf-baseline/results/harness';
const EARLY = fs.readFileSync(path.join(HARN, 's2early.js'), 'utf8'); const EXTRA = fs.readFileSync(path.join(HARN, 's3extra.js'), 'utf8');
fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'traces'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const launch = await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); process.exit(1); });
const net = [], byId = new Map(), media = [];
cdp.on((m, p, sid) => {
  if (sid !== sessionId) return;
  if (m === 'Network.requestWillBeSent') { const r = { id: p.requestId, url: p.request.url.split('?')[0], q: (p.request.url.split('?')[1] || '').slice(0, 80), type: p.type, range: p.request.headers.Range || p.request.headers.range || null, ts0: p.timestamp, wall0: p.wallTime * 1000, prio: p.request.initialPriority }; net.push(r); byId.set(p.requestId, r); }
  else if (m === 'Network.responseReceived') { const r = byId.get(p.requestId); if (r) Object.assign(r, { status: p.response.status, fromDiskCache: !!p.response.fromDiskCache, fromMem: !!p.response.fromMemoryCache, xVercelCache: p.response.headers['x-vercel-cache'] || null, cacheControl: p.response.headers['cache-control'] || null, contentLength: p.response.headers['content-length'] || null, respWall: r.wall0 + (p.timestamp - r.ts0) * 1000, proto: p.response.protocol, mime: p.response.mimeType }); }
  else if (m === 'Network.dataReceived') { const r = byId.get(p.requestId); if (r) { r.bytesRx = (r.bytesRx || 0) + (p.encodedDataLength || 0); if (!r.firstByteWall) r.firstByteWall = r.wall0 + (p.timestamp - r.ts0) * 1000; } }
  else if (m === 'Network.loadingFinished') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, encodedDataLength: p.encodedDataLength }); }
  else if (m === 'Network.loadingFailed') { const r = byId.get(p.requestId); if (r) Object.assign(r, { endWall: r.wall0 + (p.timestamp - r.ts0) * 1000, failed: p.errorText, canceled: !!p.canceled }); }
  else if (m === 'Network.requestServedFromCache') { const r = byId.get(p.requestId); if (r) r.servedFromCache = true; }
  else if (m.startsWith('Media.')) media.push({ wall: Date.now(), m, p });
});
await s('Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 1_000_000 });
await s('Page.enable'); await s('Runtime.enable'); await s('Performance.enable'); await s('Media.enable').catch(() => {});
await s('Page.addScriptToEvaluateOnNewDocument', { source: EARLY }); await s('Page.addScriptToEvaluateOnNewDocument', { source: EXTRA });
if (COLD === '1') { await s('Network.clearBrowserCache', {}, undefined, 180000); await s('Network.clearBrowserCookies'); }
await s('Emulation.setCPUThrottlingRate', { rate: +CPU });
if (process.env.BLOCK_GLOBE === '1') { await s('Network.setBlockedURLs', { urls: ['*globe.mp4*'] }); console.log(RUN, 'globe.mp4 BLOCKED (experiment)'); }
const navWall = Date.now();
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: 'https://kadence-musicz.vercel.app/' }, undefined, 180000);
await Promise.race([loaded, sleep(150000)]);
let hydrated = false; const h0 = Date.now();
for (let i = 0; i < 150 && !hydrated; i++) { hydrated = await evaluate(s, `(() => { const e = document.querySelector('#vibe-${VIBE}'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hydrated) await sleep(2000); }
await sleep(5000);
const pre = await evaluate(s, `({ activation: navigator.userActivation.hasBeenActive, vp: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio, canvases: document.querySelectorAll('canvas').length, hoverVideosWithSrc: [...document.querySelectorAll('video')].filter(v => v.currentSrc && !v.currentSrc.includes('globe')).length })`);
console.log(RUN, 'hydrated', hydrated, 'after', Date.now() - h0, 'ms; pre', JSON.stringify(pre));
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-${VIBE}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await evaluate(s, `(window.__s2.reset(), window.__s3.reset(), 1)`);
const netStart = net.length, mediaStart = media.length;
const procCpu = async () => { try { return (await cdp.send('SystemInfo.getProcessInfo')).processInfo; } catch { return null; } };
const cpu0 = await procCpu(); const pm0 = (await s('Performance.getMetrics')).metrics;
let traceDone = null;
if (TRACE === '1') { traceDone = new Promise((res) => cdp.on((m, p) => { if (m === 'Tracing.tracingComplete') res(p.stream); })); await cdp.send('Tracing.start', { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.screenshot', 'v8.execute', 'blink.user_timing', 'loading', 'latencyInfo', 'gpu', 'viz', 'media'].join(','), transferMode: 'ReturnAsStream' }); await sleep(500); }
// ---- T0: move onto the card and click immediately; then never move the pointer again ----
const actions = [];
actions.push({ a: 'move', wall: Date.now(), ...g }); await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y, button: 'none', pointerType: 'mouse' });
await sleep(30);
actions.push({ a: 'press', wall: Date.now() }); await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: g.x, y: g.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: g.x, y: g.y, button: 'left', clickCount: 1, pointerType: 'mouse' }); actions.push({ a: 'release', wall: Date.now() });
const clickWall = actions[1].wall;
await sleep(20000 - (Date.now() - clickWall));
if (TRACE === '1') {
  await cdp.send('Tracing.end'); const st = await traceDone; const chunks = [];
  for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: st, size: 1 << 20 }); chunks.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data)); if (eof) break; }
  await cdp.send('IO.close', { handle: st }); fs.writeFileSync(path.join(OUT, 'traces', `${RUN}_trace.json.gz`), zlib.gzipSync(Buffer.concat(chunks)));
}
const cpu20 = await procCpu();
const shot = await s('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_t20s.jpg`), Buffer.from(shot.data, 'base64'));
await sleep(Math.max(0, 30000 - (Date.now() - clickWall)));
const page20 = JSON.parse(await evaluate(s, `window.__s2.dump()`)); const x20 = JSON.parse(await evaluate(s, `window.__s3.dump()`));
const shot30 = await s('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_t30s.jpg`), Buffer.from(shot30.data, 'base64'));
const pm1 = (await s('Performance.getMetrics')).metrics;
const post = await evaluate(s, `({ activation: navigator.userActivation.hasBeenActive, canvases: document.querySelectorAll('canvas').length, audioEls: document.querySelectorAll('audio').length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null })`);
const cpuDelta = (a, b, sec) => (a && b ? b.map((p) => { const q = a.find((x) => x.id === p.id); return q ? { type: p.type, pct: +(((p.cpuTime - q.cpuTime) / sec) * 100).toFixed(1) } : null; }).filter((x) => x && x.pct > 0.5) : null);
writeJSON(path.join(OUT, 'raw', `${RUN}.json`), { run: RUN, vibe: VIBE, cold: COLD === '1', cpu: +CPU, traced: TRACE === '1', browser: cdp.version.Browser, launch, navWall, clickWall, actions, pre, post, hydrated,
  page: page20, x: x20, network: net.slice(netStart), preClickNetwork: net.slice(0, netStart).map((r) => ({ url: r.url, status: r.status, fromDiskCache: r.fromDiskCache, bytes: r.encodedDataLength ?? r.bytesRx ?? 0 })), media: media.slice(mediaStart),
  cpuFirst20s: cpuDelta(cpu0, cpu20, (Date.now() - clickWall) / 1000), perfMetricsDelta: Object.fromEntries(pm1.map((m) => [m.name, +(m.value - (pm0.find((q) => q.name === m.name)?.value ?? 0)).toFixed(3)])) });
const n = net.slice(netStart);
console.log(RUN, 'reqs after click', n.length, 'api', JSON.stringify(n.filter((r) => r.url.includes('/api/')).map((r) => [r.status, r.xVercelCache, r.endWall ? Math.round(r.endWall - clickWall) : null])), 'art', n.filter((r) => /mzstatic|scdn/.test(r.url)).length, 'audio', n.filter((r) => /\.m4a|audio-ssl/.test(r.url)).length, 'uploads>=1MP', x20.up.length, 'post', JSON.stringify(post));
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
