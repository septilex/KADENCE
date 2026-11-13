import fs from 'node:fs'; import path from 'node:path';
const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('_result.json')).sort();
const rows = [];
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const n = r.network; const t0 = n[0].start;
  const ok = n.filter((x) => x.encodedDataLength != null);
  const bytes = ok.reduce((s, x) => s + x.encodedDataLength, 0);
  const lastEnd = Math.max(...ok.map((x) => (x.end - t0) * 1000));
  const js = ok.filter((x) => /\.js$/.test(x.url)); const css = ok.filter((x) => /\.css$|fonts\.googleapis/.test(x.url));
  const big = ok.filter((x) => x.encodedDataLength > 150000).map((x) => ({ url: x.url.split('/').pop(), kb: Math.round(x.encodedDataLength / 1024), ms: Math.round((x.end - x.start) * 1000), kbps: Math.round((x.encodedDataLength * 8) / 1000 / ((x.end - x.start) || 1e-3)) }));
  const globe = n.find((x) => x.url.includes('globe'));
  const renderBlockingEnd = Math.max(...css.map((x) => (x.end - t0) * 1000));
  const jsEnd = Math.max(...js.map((x) => (x.end - t0) * 1000));
  const globeMedia = r.media.filter((m) => m.m === 'Media.playerEventsAdded').flatMap((m) => m.p.events.map((e) => JSON.parse(e.value))).filter((e) => e.event === 'kBufferingStateChanged' && e.pipeline_buffering_state).map((e) => e.pipeline_buffering_state.state);
  const dec = r.media.filter((m) => m.m === 'Media.playerPropertiesChanged').flatMap((m) => m.p.properties).filter((p) => /kVideoDecoderName|kIsPlatformVideoDecoder/.test(p.name)).map((p) => p.name + '=' + p.value);
  rows.push({ run: r.run, cpu: r.cpuThrottle, startedAt: r.startedAt, ttfb: r.load.nav.ttfb, dcl: r.load.nav.dcl, load: r.load.nav.load, fcp: r.load.paint['first-contentful-paint'], lcp: r.load.lcp.at(-1)?.t, lcpEl: r.load.lcp.at(-1)?.url || r.load.lcp.at(-1)?.el, cls: r.load.cls,
    longTasks: r.load.longTasks.length, longTaskMax: Math.max(0, ...r.load.longTasks.map((x) => x.ms)), longTaskTotalBlocking: r.load.longTasks.reduce((s, x) => s + Math.max(0, x.ms - 50), 0), loafMax: Math.max(0, ...r.load.loaf.map((x) => x.ms)),
    requests: n.length, completed: ok.length, bytesExclGlobe: bytes, allFromNetwork: n.every((x) => !x.fromDiskCache), cssAndFontCssDoneMs: Math.round(renderBlockingEnd), allJsDoneMs: Math.round(jsEnd), lastResourceDoneMs: Math.round(lastEnd), effectiveKbpsUntilLastDone: Math.round((bytes * 8) / lastEnd),
    bigTransfers: big, globe: globe ? { status: globe.status ?? 'no-response', ttfbMs: globe.ttfbMs ?? null, xVercelCache: globe.xVercelCache ?? null, finished: globe.encodedDataLength != null } : null, globeDecoder: dec, globePipelineBufferingStates: globeMedia,
    idle: r.idle.frames, idleLongTasks: r.idle.longTasks.length, idleGlDraws: r.idle.webgl.draws, idleGlobe: r.idle.globe, idleHoverVideos: r.idle.hoverVideosWithSrc, idleActivation: r.idle.userActivation,
    idleCpuPctOneCore_TRACING_ON: Object.fromEntries((r.idleProcessCpu || []).filter((p) => p.cpuSec > 0.05).map((p) => [p.type + ':' + p.id, p.cpuPctOfOneCore])), canvasCount: r.load.canvasCount, three: r.load.three });
}
fs.writeFileSync(path.join(DIR, 'S1-cold_summary.json'), JSON.stringify(rows, null, 1));
for (const x of rows) console.log(JSON.stringify(x));
