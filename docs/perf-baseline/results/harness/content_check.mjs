// Verify which segment of the full video each preview clip corresponds to (frame-signature comparison in the browser).
// Usage: node content_check.mjs <OUT_FILE>
import fs from 'node:fs';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const OUT = process.argv[2];
const STEMS = process.argv[3] ? process.argv[3].split('|') : ['Loser', 'One Of The Girls', 'Gehra Hua', 'God Mode'];
await launchBrave(); const cdp = await connect();
const { s, targetId } = await newPage(cdp, 'about:blank');
const cleanup = async () => { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); };
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cleanup(); process.exit(1); });
process.on('exit', () => {});
await s('Runtime.enable');
// a same-origin page that does not run the app: a static asset URL (favicon) gives the origin without the React app
await s('Page.enable'); await s('Page.navigate', { url: 'https://kadence-musicz.vercel.app/favicon.ico' }); await sleep(2500);
const res = [];
for (const stem of STEMS) {
  const r = await s('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const mk = (src) => new Promise((ok, bad) => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = src; v.onloadeddata = () => ok(v); v.onerror = () => bad(new Error('load ' + src)); });
    const seek = (v, t) => new Promise((ok) => { v.onseeked = () => ok(); v.currentTime = t; });
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; const cx = cv.getContext('2d', { willReadFrequently: true });
    const sig = (v) => { cx.drawImage(v, 0, 0, 24, 24); const d = cx.getImageData(0, 0, 24, 24).data; const a = []; for (let i = 0; i < d.length; i += 4) a.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); return a; };
    const diff = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
    const p = await mk('/videos/' + encodeURIComponent(${JSON.stringify(stem)}) + '_preview_3s.mp4'); const f = await mk('/videos/' + encodeURIComponent(${JSON.stringify(stem)}) + '_30s.mp4');
    const out = { previewDuration: +p.duration.toFixed(3), fullDuration: +f.duration.toFixed(3), pW: p.videoWidth, pH: p.videoHeight, fW: f.videoWidth, fH: f.videoHeight, checks: [] };
    for (const tp of [0.5, 1.5, 2.5]) {
      await seek(p, tp); const sp = sig(p); const row = { previewT: tp, bestFullT: null, bestDiff: 1e9, diffAtSameT: null };
      for (let tf = 0; tf <= 4.51; tf += 0.25) { await seek(f, tf); const d = diff(sp, sig(f)); if (Math.abs(tf - tp) < 0.01) row.diffAtSameT = +d.toFixed(2); if (d < row.bestDiff) { row.bestDiff = +d.toFixed(2); row.bestFullT = tf; } }
      out.checks.push(row);
    }
    p.removeAttribute('src'); p.load(); f.removeAttribute('src'); f.load();
    return out; })()` }, undefined, 420000).then((x) => x.result.value || { error: JSON.stringify(x.exceptionDetails).slice(0, 300) }, (e) => ({ error: e.message }));
  console.log(stem, JSON.stringify(r));
  res.push({ stem, ...r });
}
writeJSON(OUT, { method: 'Frame signature (24x24 luma) of the preview at 0.5/1.5/2.5 s compared against the full video sampled every 0.25 s over 0-4.5 s; bestFullT = best matching full-video time. Run in a clean Brave profile on the production origin (favicon page, app not running).', results: res });
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
