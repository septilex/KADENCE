// Pre-load intro media into the clean profile's HTTP cache (top-frame site = production origin), logging what was fetched.
// Usage: node prewarm.mjs <OUT_FILE>
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const OUT = process.argv[2];
const STEMS = ['Beat It', 'Radhimaa', 'Alaakaa Loova', 'Loser', 'Kiss Kiss Bang Bang', 'Yeshanagula', 'Sunflower', 'One Of The Girls', 'Big Dawgs', 'Pavazha Malli', "Baby Won't You Tell Me", 'Monica', 'Gehra Hua', 'Dynamite', 'God Mode'];
const JOBS = [...STEMS.map((s) => ({ url: `/videos/${s}_preview_3s.mp4` })), ...['Loser', 'One Of The Girls', 'Gehra Hua'].map((s) => ({ url: `/videos/${s}_30s.mp4` })), { url: '/videos/God Mode_30s.mp4', range: 'bytes=0-5242879' }];
await launchBrave(); const cdp = await connect();
const { s, targetId } = await newPage(cdp, 'about:blank');
const cleanup = async () => { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); };
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cleanup(); process.exit(1); });
process.on('exit', () => {});
await s('Runtime.enable'); await s('Page.enable');
await s('Page.navigate', { url: 'https://kadence-musicz.vercel.app/favicon.ico' }, undefined); await sleep(3000);
const log = [];
for (const j of JOBS) {
  const t0 = Date.now();
  const r = await s('Runtime.evaluate', { expression: `(async () => { const res = await fetch(${JSON.stringify(encodeURI(j.url))}, { cache: 'default'${j.range ? `, headers: { Range: ${JSON.stringify(j.range)} }` : ''} }); const b = await res.arrayBuffer(); return { status: res.status, bytes: b.byteLength, cc: res.headers.get('cache-control'), ct: res.headers.get('content-type') }; })()`, awaitPromise: true, returnByValue: true }, undefined, 600000).then((x) => x.result.value || x.exceptionDetails, (e) => ({ error: e.message }));
  const row = { ...j, ...r, ms: Date.now() - t0, kBps: r && r.bytes ? Math.round(r.bytes / 1024 / ((Date.now() - t0) / 1000)) : null };
  console.log(JSON.stringify(row)); log.push(row);
}
writeJSON(OUT, { purpose: 'Warm the clean profile HTTP cache before warm-cache S2 trials. fetch() from a same-origin page (favicon.ico) so the cache partition matches the app.', finishedAt: new Date().toISOString(), jobs: log });
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
