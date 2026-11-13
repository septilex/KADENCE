// S1 cold-load + idle, clean temp Brave profile. Read-only measurement of production.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';

const OUT = process.argv[2];
const URL_ = 'https://kadence-musicz.vercel.app/';
const ALL = [{ id: 'cpu1x_r1', cpu: 1 }, { id: 'cpu1x_r2', cpu: 1 }, { id: 'cpu1x_r3', cpu: 1 }, { id: 'cpu4x_r1', cpu: 4 }, { id: 'cpu1x_noglobe_r1', cpu: 1, block: true }, { id: 'cpu1x_noglobe_r2', cpu: 1, block: true }, { id: 'cpu1x_ctrl_r4', cpu: 1 }];
const RUNS = process.argv[3] ? ALL.filter((r) => process.argv[3].split(',').includes(r.id)) : ALL;
fs.mkdirSync(OUT, { recursive: true });

const EARLY = `(() => { const E = window.__early = { lt: [], loaf: [], lcp: [], cls: [], ev: [] };
  const o = (type, arr, opts = {}) => { try { new PerformanceObserver(l => arr.push(...l.getEntries())).observe({ type, buffered: true, ...opts }); } catch (e) { E[type + '_err'] = String(e); } };
  o('longtask', E.lt); o('long-animation-frame', E.loaf); o('largest-contentful-paint', E.lcp); o('layout-shift', E.cls); o('event', E.ev, { durationThreshold: 16 }); })();`;

const COLLECT_LOAD = `(() => { const E = window.__early, r1 = x => Math.round(x * 10) / 10;
  const strip = u => { try { const x = new URL(u); return (x.host === location.host ? '' : x.host) + x.pathname; } catch { return String(u).split('?')[0]; } };
  const nav = performance.getEntriesByType('navigation')[0];
  return { viewport: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio, userActivation: navigator.userActivation.hasBeenActive,
    nav: { type: nav.type, proto: nav.nextHopProtocol, delivery: nav.deliveryType, transfer: nav.transferSize, encoded: nav.encodedBodySize, decoded: nav.decodedBodySize, dns: r1(nav.domainLookupEnd - nav.domainLookupStart), connect: r1(nav.connectEnd - nav.connectStart), tls: r1(nav.secureConnectionStart ? nav.connectEnd - nav.secureConnectionStart : 0), ttfb: r1(nav.responseStart), responseEnd: r1(nav.responseEnd), domInteractive: r1(nav.domInteractive), dcl: r1(nav.domContentLoadedEventEnd), load: r1(nav.loadEventEnd) },
    paint: Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, r1(p.startTime)])),
    lcp: E.lcp.map(e => ({ t: r1(e.startTime), size: e.size, el: e.element ? e.element.tagName + (e.element.id ? '#' + e.element.id : '') : null, url: strip(e.url || '') })),
    cls: +E.cls.filter(e => !e.hadRecentInput).reduce((s, e) => s + e.value, 0).toFixed(4), clsEntries: E.cls.length,
    longTasks: E.lt.map(e => ({ t: r1(e.startTime), ms: Math.round(e.duration) })), longtaskObserverError: E.longtask_err || null,
    loaf: E.loaf.map(e => ({ t: r1(e.startTime), ms: Math.round(e.duration), blockingMs: Math.round(e.blockingDuration || 0), styleLayoutMs: Math.round(e.startTime + e.duration - e.styleAndLayoutStart), scripts: (e.scripts || []).slice(0, 3).map(s => ({ ms: Math.round(s.duration), forcedLayoutMs: Math.round(s.forcedStyleAndLayoutDuration || 0), invoker: s.invoker, fn: s.sourceFunctionName, file: strip(s.sourceURL || '') })) })),
    canvasCount: document.querySelectorAll('canvas').length, three: window.__THREE__ ?? null, domNodes: document.getElementsByTagName('*').length };
})()`;

const IDLE = (sec) => `(async () => { const r1 = x => Math.round(x * 10) / 10; const E = window.__early; const lt0 = E.lt.length, loaf0 = E.loaf.length;
  const P = WebGL2RenderingContext.prototype, saved = {}, c = { draws: 0, tex: 0 };
  for (const n of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) { saved[n] = P[n]; P[n] = function (...a) { c.draws++; return saved[n].apply(this, a); }; }
  saved.texImage2D = P.texImage2D; P.texImage2D = function (...a) { c.tex++; return saved.texImage2D.apply(this, a); };
  const globe = [...document.querySelectorAll('video')].find(v => (v.currentSrc || '').includes('globe')); const q0 = globe && globe.getVideoPlaybackQuality();
  const d = []; let last = 0; const ti = performance.now();
  await new Promise(res => { const tick = ts => { if (last) d.push(ts - last); last = ts; if (performance.now() - ti >= ${sec * 1000}) return res(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const secs = (performance.now() - ti) / 1000; const q1 = globe && globe.getVideoPlaybackQuality(); for (const n in saved) P[n] = saved[n];
  const s = [...d].sort((a, b) => a - b), pc = q => +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2), p50 = pc(.5);
  return { startMs: r1(ti), seconds: +secs.toFixed(2), focus: document.hasFocus(), visibility: document.visibilityState,
    frames: { count: d.length, fps: +(d.length / secs).toFixed(1), p50, p95: pc(.95), p99: pc(.99), max: pc(1), over20ms: d.filter(x => x > 20).length, over50ms: d.filter(x => x > 50).length, missed: d.reduce((n, x) => n + Math.max(0, Math.round(x / p50) - 1), 0) },
    longTasks: E.lt.slice(lt0).map(e => ({ t: r1(e.startTime), ms: Math.round(e.duration) })), loaf: E.loaf.slice(loaf0).map(e => ({ t: r1(e.startTime), ms: Math.round(e.duration), blockingMs: Math.round(e.blockingDuration || 0) })),
    webgl: c, globe: globe ? { decoded: q1.totalVideoFrames - q0.totalVideoFrames, dropped: q1.droppedVideoFrames - q0.droppedVideoFrames, paused: globe.paused, w: globe.videoWidth, h: globe.videoHeight } : null,
    hoverVideosWithSrc: [...document.querySelectorAll('video')].filter(v => v !== globe && v.currentSrc).length, userActivation: navigator.userActivation.hasBeenActive,
    heapMB: performance.memory ? r1(performance.memory.usedJSHeapSize / 1048576) : null };
})()`;

async function trace(cdp, file, categories, fn) {
  const chunks = [];
  const done = new Promise((res) => cdp.on((m, p) => { if (m === 'Tracing.tracingComplete') res(p.stream); }));
  await cdp.send('Tracing.start', { categories: categories.join(','), transferMode: 'ReturnAsStream', options: 'record-as-much-as-possible' });
  const r = await fn();
  await cdp.send('Tracing.end');
  const stream = await done;
  for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: stream, size: 1 << 20 }); chunks.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data)); if (eof) break; }
  await cdp.send('IO.close', { handle: stream });
  fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(chunks)));
  return r;
}

const CATS_LOAD = ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.screenshot', 'v8.execute', 'blink.user_timing', 'loading', 'latencyInfo', 'disabled-by-default-devtools.timeline.stack', 'gpu', 'viz', 'media', 'disabled-by-default-v8.cpu_profiler'];
const CATS_IDLE = CATS_LOAD.filter((c) => c !== 'disabled-by-default-devtools.screenshot');

const procCpu = async (cdp) => { try { const r = await cdp.send('SystemInfo.getProcessInfo'); return r.processInfo; } catch (e) { return String(e); } };

const launch = await launchBrave();
const cdp = await connect();
const env = { browser: cdp.version.Browser, ua: cdp.version['User-Agent'], launch, startedAt: new Date().toISOString(), runs: [] };
const gpu = await cdp.send('SystemInfo.getInfo').catch((e) => ({ error: String(e) }));
writeJSON(path.join(OUT, 'env_systeminfo.json'), gpu);

for (const run of RUNS) {
  const { s, targetId, sessionId } = await newPage(cdp, 'about:blank'); const pageSid = sessionId;
  const net = new Map(); const media = [];
  cdp.on((m, p, sid) => {
    if (sid !== pageSid) return;
    if (m === 'Network.requestWillBeSent') net.set(p.requestId, { url: p.request.url.split('?')[0], method: p.request.method, range: p.request.headers.Range || p.request.headers.range || null, type: p.type, start: p.timestamp, wall: p.wallTime, initiator: p.initiator?.type });
    else if (m === 'Network.responseReceived') { const r = net.get(p.requestId); if (r) Object.assign(r, { status: p.response.status, mime: p.response.mimeType, proto: p.response.protocol, fromDiskCache: p.response.fromDiskCache, fromMemCache: p.response.fromMemoryCache || false, cacheControl: p.response.headers['cache-control'] || p.response.headers['Cache-Control'] || null, xVercelCache: p.response.headers['x-vercel-cache'] || null, contentRange: p.response.headers['content-range'] || null, contentLength: p.response.headers['content-length'] || null, ttfbMs: p.response.timing ? Math.round(p.response.timing.receiveHeadersEnd - p.response.timing.sendStart) : null, respAt: p.timestamp }); }
    else if (m === 'Network.loadingFinished') { const r = net.get(p.requestId); if (r) Object.assign(r, { end: p.timestamp, encodedDataLength: p.encodedDataLength }); }
    else if (m === 'Network.loadingFailed') { const r = net.get(p.requestId); if (r) Object.assign(r, { end: p.timestamp, failed: p.errorText, canceled: p.canceled }); }
    else if (m === 'Network.requestServedFromCache') { const r = net.get(p.requestId); if (r) r.servedFromCache = true; }
    else if (m.startsWith('Media.')) media.push({ m, p });
  });
  await s('Network.enable', { maxTotalBufferSize: 10_000_000 });
  console.log(run.id, 'clearing cache'); await s('Network.clearBrowserCache'); await s('Network.clearBrowserCookies'); console.log(run.id, 'cache cleared');
  await s('Page.enable'); await s('Runtime.enable'); await s('Performance.enable'); await s('Media.enable').catch(() => {});
  await s('Emulation.setCPUThrottlingRate', { rate: run.cpu }); await s('Network.setBlockedURLs', { urls: run.block ? ['*globe.mp4*'] : [] });
  await s('Page.addScriptToEvaluateOnNewDocument', { source: EARLY });
  await sleep(500);
  const startWall = Date.now();
  const loadMetrics = await trace(cdp, path.join(OUT, `LAP_prod_S1_${run.id}_trace.json.gz`), CATS_LOAD, async () => {
    const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === pageSid && m === 'Page.loadEventFired') res(); }));
    await s('Page.navigate', { url: URL_ });
    await loaded; await sleep(10000);
    return evaluate(s, COLLECT_LOAD);
  });
  await sleep(5000);
  const cpu0 = await procCpu(cdp); const pm0 = (await s('Performance.getMetrics')).metrics;
  const idle = await trace(cdp, path.join(OUT, `LAP_prod_S1_${run.id}_idle-trace.json.gz`), CATS_IDLE, () => evaluate(s, IDLE(15)));
  const cpu1 = await procCpu(cdp); const pm1 = (await s('Performance.getMetrics')).metrics;
  const shot = await s('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  fs.writeFileSync(path.join(OUT, `LAP_prod_S1_${run.id}_shot.jpg`), Buffer.from(shot.data, 'base64'));
  const cpuDelta = Array.isArray(cpu0) && Array.isArray(cpu1) ? cpu1.map((p) => { const a = cpu0.find((q) => q.id === p.id); return a ? { type: p.type, id: p.id, cpuSec: +(p.cpuTime - a.cpuTime).toFixed(3), cpuPctOfOneCore: +(((p.cpuTime - a.cpuTime) / idle.seconds) * 100).toFixed(1) } : null; }).filter(Boolean) : { cpu0, cpu1 };
  const pmDelta = Object.fromEntries(pm1.map((m) => [m.name, +(m.value - (pm0.find((x) => x.name === m.name)?.value ?? 0)).toFixed(3)]));
  const reqs = [...net.values()];
  const result = { run: run.id, cpuThrottle: run.cpu, startedAt: new Date(startWall).toISOString(), load: loadMetrics, idle, idleProcessCpu: cpuDelta, idlePerfMetricsDelta: pmDelta, perfMetricsEnd: Object.fromEntries(pm1.map((m) => [m.name, m.value])),
    network: reqs.map((r) => ({ ...r, startMs: r.start && reqs[0].start ? Math.round((r.start - reqs[0].start) * 1000) : null, durMs: r.end && r.start ? Math.round((r.end - r.start) * 1000) : null })),
    media: media.map((x) => ({ m: x.m, p: x.p })) };
  writeJSON(path.join(OUT, `LAP_prod_S1_${run.id}_result.json`), result);
  const bytes = reqs.reduce((a, r) => a + (r.encodedDataLength || 0), 0);
  console.log(run.id, 'FCP', loadMetrics.paint['first-contentful-paint'], 'LCP', loadMetrics.lcp.at(-1)?.t, 'reqs', reqs.length, 'bytes', bytes, 'idle fps', idle.frames.fps, 'idle max', idle.frames.max);
  await cdp.send('Target.closeTarget', { targetId });
  await sleep(1000);
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
cdp.close();
