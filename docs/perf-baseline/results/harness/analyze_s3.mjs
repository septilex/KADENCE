// S3 analysis. Usage: node analyze_s3.mjs <OUT>
import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2]; const RAW = path.join(OUT, 'raw');
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
const R = (x) => (x == null ? null : Math.round(x));
const res = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json')).sort()) {
  const T = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  const to = T.page.timeOrigin; const W = (t) => to + t;
  // T0 = page-side click (pointerup/click event), fallback to dispatch wall
  const clickEv = T.page.ptr.find((p) => p[1] === 'click'); const T0 = clickEv ? W(clickEv[0]) : T.clickWall;
  const rel = (w) => (w == null ? null : R(w - T0));
  const N = T.network.map((r) => ({ ...r, start: rel(r.wall0), fb: rel(r.firstByteWall), end: rel(r.endWall), bytes: r.encodedDataLength ?? r.bytesRx ?? 0 }));
  const api = N.filter((r) => r.url.includes('/api/'));
  const art = N.filter((r) => /mzstatic|scdn/.test(r.url));
  const artKey = (u) => u.replace(/\/[^/]*$/, '');
  const aud = N.filter((r) => /\.m4a|audio-ssl|\.aac|\.mp3/.test(r.url));
  const js = N.filter((r) => /\.js$/.test(r.url));
  const vids = N.filter((r) => r.url.includes('/videos/'));
  const in30 = (r) => r.start != null && r.start <= 30000;
  // atlas uploads
  const up = T.x.up.map((u) => ({ t: rel(W(u[0])), fn: u[1], w: u[2], h: u[3], ms: u[4] }));
  const full = up.filter((u) => u.w >= 4096 && u.h >= 4096);
  // images
  const img = T.x.img.map((i) => ({ set: rel(W(i[0])), url: i[1], load: i[2] != null ? rel(W(i[2])) : null, err: i[3] != null ? rel(W(i[3])) : null }));
  const imgLoaded = img.filter((i) => i.load != null);
  // frames
  const fr = T.x.frames.map((f) => ({ t: rel(W(f[0])), draws: f[1] }));
  const raf = T.page.raf.map((r) => ({ t: rel(W(r[0])), d: r[1] }));
  const canvasOp = T.x.canvasOp.map((c) => ({ t: rel(W(c[0])), op: c[1], w: c[2], h: c[3] }));
  const dom = (T.x.dom || []).map((d) => ({ t: rel(W(d[0])), loader: d[1], loaderVis: d[2], cards: d[3] }));
  const T3 = dom.find((d) => d.t >= 0 && d.loaderVis === 1) || null;
  const reveal = dom.find((d) => d.t >= 0 && d.loader === 0 && d.cards === 0) || null;
  const canvasVisible = reveal;
  const firstDrawAfter = (t) => fr.find((f) => f.t >= t && f.draws > 0);
  // T4: first full upload after the canvas is visible and after the first artwork image loaded, then the next frame with draws
  const firstImg = imgLoaded.length ? Math.min(...imgLoaded.map((i) => i.load)) : null;
  const upAfterImg = firstImg != null ? up.find((u) => u.t >= firstImg) : null;
  const T4 = upAfterImg && canvasVisible ? firstDrawAfter(Math.max(upAfterImg.t, canvasVisible.t)) : null;
  const audEv = (T.x.audioEv || []).map((a) => ({ t: rel(W(a[0])), id: a[1], e: a[2], file: a[3], paused: a[4], vol: a[5], ct: a[6] }));
  // T5: last upload in the 20 s window that follows the last image load (wall populated as far as the client got)
  const lastImg = imgLoaded.length ? Math.max(...imgLoaded.map((i) => i.load)) : null;
  const upAfterLast = lastImg != null ? up.find((u) => u.t >= lastImg) : null;
  // audio
  const ev = T.page.ev.map((e) => ({ t: rel(W(e[0])), type: e[1], role: e[2], file: e[3], x: e[7] }));
  const audPlaying = audEv.filter((e) => e.e === 'playing');
  const audPlayCalls = ev.filter((e) => e.role === 'A' && e.type === 'play()');
  const audRes = ev.filter((e) => e.role === 'A' && e.type === 'play:resolved'); const audRej = ev.filter((e) => e.role === 'A' && e.type === 'play:rejected');
  // hover video during entry (INT-10)
  const hv = ev.filter((e) => (e.role === 'P' || e.role === 'F'));
  const smp = T.page.smp.map((x) => ({ t: rel(W(x[0])), c: x[1], p: x[2], f: x[3], pP: x[4], fP: x[7], act: x[12] }));
  const hoverVisibleAfterClick = smp.filter((x) => x.t > 0 && x.c >= 0.5).length;
  const hoverPlayingAfter = smp.filter((x) => x.t > 0 && (x.pP === 0 || x.fP === 0));
  // long tasks / frames
  const lt = T.page.lt.map((l) => ({ t: rel(W(l[0])), ms: l[1] })).filter((l) => l.t >= -50 && l.t <= 20000);
  const lt30 = T.page.lt.map((l) => ({ t: rel(W(l[0])), ms: l[1] })).filter((l) => l.t >= -50 && l.t <= 30000);
  const loaf = T.page.loaf.map((l) => ({ t: rel(W(l[0])), ms: l[1], blocking: l[2], styleLayout: l[3], scripts: l[4] })).filter((l) => l.t >= -50 && l.t <= 20000);
  // T7: end of last long task in 0-20 s followed by >= 1 s without long task
  let T7 = null; const lts = [...lt30].sort((a, b) => a.t - b.t);
  for (let i = lts.length - 1; i >= 0; i--) { const end = lts[i].t + lts[i].ms; if (end <= 29000) { T7 = end; break; } }
  if (lts.length === 0) T7 = 0;
  for (let i = 0; i < 0; i++) { const end = lts[i].t + lts[i].ms; const next = lts[i + 1]; if (!next || next.t - end >= 1000) { if (!next || i === lts.length - 1) { T7 = end; break; } } }
  // per-upload frame impact: rAF delta spanning each full upload
  const upImpact = full.map((u) => { const fd = raf.find((r) => r.t >= u.t); const lo = loaf.find((l) => l.t <= u.t && l.t + l.ms >= u.t); const drop = raf.filter((r) => r.t > u.t && r.t <= u.t + 100).reduce((s, r) => s + Math.max(0, Math.round(r.d / 16.7) - 1), 0); return { t: u.t, callMs: u.ms, frameMs: fd ? R(fd.d) : null, loafMs: lo ? lo.ms : null, droppedIn100ms: drop }; });
  const rafWall = raf.filter((r) => canvasVisible && r.t >= canvasVisible.t && r.t <= 20000).map((r) => r.d);
  const drawFramesAfterVisible = fr.filter((f) => canvasVisible && f.t >= canvasVisible.t && f.t <= 20000);
  const decoders = {}; for (const m of T.media || []) if (m.m === 'Media.playerPropertiesChanged') for (const p of m.p.properties) if (/kVideoDecoderName|kAudioDecoderName|kFrameUrl/.test(p.name)) { decoders[m.p.playerId] = decoders[m.p.playerId] || {}; decoders[m.p.playerId][p.name] = p.value; }
  const foreign = T.page.ptr.filter((p) => p[3] === 1 && Math.abs(p[4] - T.actions[0].x) > 2 && Math.abs(p[5] - T.actions[0].y) > 2).length;
  res.push({
    run: T.run, vibe: T.vibe, cold: T.cold, cpu: T.cpu, traced: T.traced, preActivation: T.pre.activation, foreignPointerEvents: foreign, clickDispatchToPageMs: clickEv ? R(W(clickEv[0]) - T.actions[1].wall) : null,
    T1_apiStart: api[0]?.start ?? null, T2_apiEnd: api[0]?.end ?? null, apiTtfb: api[0] ? api[0].fb - api[0].start : null, apiStatus: api[0]?.status ?? null, apiXVercelCache: api[0]?.xVercelCache ?? null, apiCacheControl: api[0]?.cacheControl ?? null, apiBytes: api[0]?.bytes ?? null, apiCalls: api.length,
    canvasVisibleMs: canvasVisible?.t ?? null, T4_firstArtworkDrawnMs: T4?.t ?? null, firstImageLoadMs: firstImg, lastImageLoadMs: lastImg, imagesSet: img.length, imagesLoaded: imgLoaded.length, imagesErrored: img.filter((i) => i.err != null).length,
    T5_lastUploadAfterLastImageMs: upAfterLast?.t ?? null,
    T3_loaderVisibleMs: T3?.t ?? null, wallRevealedMs: reveal?.t ?? null, T6_firstAudioPlayingMs: audPlaying[0]?.t ?? null, firstAudioFile: audPlaying[0]?.file ?? null, audioPlayingEvents: audPlaying.length, audioStalls: audEv.filter((e) => e.e === 'waiting' || e.e === 'stalled').length, audioErrors: audEv.filter((e) => e.e === 'error').length, imagesUniqueUrls: new Set(img.map((i) => i.url)).size, imagesLoadedBy20s: imgLoaded.filter((i) => i.load <= 20000).length, imageLoadStillRunningAt30s: lastImg != null && lastImg > 28000, audioPlayCalls: audPlayCalls.length, audioPlayResolved: audRes.length, audioPlayRejected: audRej.map((r) => r.x), audioElementsCreated: T.x.audioNew.length,
    T7_interactiveMs: T7,
    jsAfterClick: js.map((r) => ({ url: r.url.split('/').pop(), start: r.start, bytes: r.bytes, fromCache: !!r.fromDiskCache })),
    artwork: { requests: art.length, uniqueUrls: new Set(art.map((r) => r.url + '?' + r.q)).size, uniqueAssets: new Set(art.map((r) => artKey(r.url))).size, bytes: art.reduce((s, r) => s + r.bytes, 0), failed: art.filter((r) => r.failed).length, sizeVariants: [...new Set(art.map((r) => (r.url.match(/\/(\d+x\d+)[^/]*$/) || [])[1]))] },
    audioNet30s: { requests: aud.filter(in30).length, distinct: new Set(aud.filter(in30).map((r) => r.url)).size, bytes: aud.filter(in30).reduce((s, r) => s + r.bytes, 0), pendingAtEnd: aud.filter((r) => !r.endWall).length, failed: aud.filter((r) => r.failed).length },
    hoverVideoNet: vids.map((r) => ({ file: decodeURIComponent(r.url.split('/').pop()), start: r.start, bytes: r.bytes, canceled: !!r.canceled })),
    hoverMedia: { events: hv.slice(0, 12).map((e) => `${e.t} ${e.role} ${e.type} ${e.file || ''} ${e.x ? JSON.stringify(e.x) : ''}`), dimVisibleFramesAfterClick: hoverVisibleAfterClick, hoverPlayingSamplesAfterClick: hoverPlayingAfter.length, lastHoverPlayingAtMs: hoverPlayingAfter.length ? hoverPlayingAfter.at(-1).t : null },
    atlas: { uploadsGe1MP: up.length, fullUploads4096: full.length, uploadCallMs: { p50: pct(full.map((u) => u.ms), 0.5), p95: pct(full.map((u) => u.ms), 0.95), max: full.length ? Math.max(...full.map((u) => u.ms)) : null }, firstFullAt: full[0]?.t ?? null, lastFullAt: full.at(-1)?.t ?? null, top5Impact: [...upImpact].sort((a, b) => (b.frameMs || 0) - (a.frameMs || 0)).slice(0, 5) },
    webgl: { framesWithDrawsPerSecAfterVisible: drawFramesAfterVisible.length ? +(drawFramesAfterVisible.filter((f) => f.draws > 0).length / ((20000 - canvasVisible.t) / 1000)).toFixed(1) : null, drawCalls20s: T.x.drawCalls },
    framesAfterCanvasVisible: { n: rafWall.length, p50: pct(rafWall, 0.5), p95: pct(rafWall, 0.95), p99: pct(rafWall, 0.99), max: rafWall.length ? Math.max(...rafWall) : null, over50: rafWall.filter((d) => d > 50).length, missed: rafWall.reduce((s, d) => s + Math.max(0, Math.round(d / 16.7) - 1), 0) },
    longTasks0to20s: { n: lt.length, max: lt.length ? Math.max(...lt.map((l) => l.ms)) : 0, totalBlocking: lt.reduce((s, l) => s + Math.max(0, l.ms - 50), 0), list: lt.map((l) => [l.t, l.ms]) },
    longAnimationFrames0to20s: { n: loaf.length, max: loaf.length ? Math.max(...loaf.map((l) => l.ms)) : 0, blockingTotal: loaf.reduce((s, l) => s + l.blocking, 0), top: [...loaf].sort((a, b) => b.ms - a.ms).slice(0, 6) },
    cpuFirst20s: T.cpuFirst20s, perfMetricsDelta: T.perfMetricsDelta && { TaskDuration: T.perfMetricsDelta.TaskDuration, ScriptDuration: T.perfMetricsDelta.ScriptDuration, LayoutDuration: T.perfMetricsDelta.LayoutDuration, RecalcStyleDuration: T.perfMetricsDelta.RecalcStyleDuration, JSHeapUsedSize: T.perfMetricsDelta.JSHeapUsedSize },
    post: T.post, decoders,
  });
}
fs.writeFileSync(path.join(OUT, 'S3_metrics.json'), JSON.stringify(res, null, 1));
for (const r of res) console.log(JSON.stringify(r).slice(0, 3500), '\n');
