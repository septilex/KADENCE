// Artwork pipeline check on a target URL: chart entry (atlas uploads, image src sets vs unique, blank-slot sampling),
// then a search that appends songs (do the new songs get artwork?). Usage: node atlascheck.mjs <OUT> <RUN> <url>
import fs from 'node:fs'; import path from 'node:path';
import { launchBrave, connect, newPage, evaluate, sleep, writeJSON } from './cdp.mjs';
const [OUT, RUN, URL_] = process.argv.slice(2);
const HARN = 'C:/AntiGravity Projects/KADENCE/docs/perf-baseline/results/harness';
const SCRIPTS = ['s2early.js', 's3extra.js'].map((f) => fs.readFileSync(path.join(HARN, f), 'utf8'));
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
process.on('unhandledRejection', async (e) => { console.log('FATAL', e && e.message); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); process.exit(1); });
await s('Page.enable'); await s('Runtime.enable');
for (const src of SCRIPTS) await s('Page.addScriptToEvaluateOnNewDocument', { source: src });
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: URL_ }, undefined, 180000); await Promise.race([loaded, sleep(150000)]);
let hyd = false; for (let i = 0; i < 150 && !hyd; i++) { hyd = await evaluate(s, `(() => { const e = document.querySelector('#vibe-late-night'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hyd) await sleep(2000); }
await sleep(3000);
await evaluate(s, `(window.__s3.reset(), 1)`);
const move = (x, y) => s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }); };
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-late-night').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await move(g.x, g.y); await sleep(30); await click(g.x, g.y); const t0 = Date.now();
// wait for artwork to settle (no new image load for 4 s) or 60 s
for (let i = 0; i < 120; i++) { const st = await evaluate(s, `(() => { const l = window.__s3.img.filter(x => x[2] != null || x[3] != null).map(x => x[2] ?? x[3]); return { n: window.__s3.img.length, done: l.length, last: l.length ? Math.max(...l) : 0, now: performance.now() }; })()`); if (st.done > 30 && st.now - st.last > 4000 && st.done >= st.n) break; await sleep(500); }
await sleep(1500);
const entry = await evaluate(s, `(() => { const up = window.__s3.up.filter(u => u[2] >= 4096); const img = window.__s3.img; return { fullUploads: up.length, maxUploadCallMs: up.length ? Math.max(...up.map(u => u[4])) : null, imgSrcSets: img.length, uniqueUrls: new Set(img.map(i => i[1])).size, loaded: img.filter(i => i[2] != null).length, errored: img.filter(i => i[3] != null).length }; })()`);
const shot1 = await s('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_wall.jpg`), Buffer.from(shot1.data, 'base64'));
console.log(RUN, 'entry settled after', Date.now() - t0, 'ms', JSON.stringify(entry));
// ---- search: open panel, type a query, let results merge into the wall ----
await evaluate(s, `(window.__s3.reset(), 1)`);
const sb = await evaluate(s, `(() => { const b = [...document.querySelectorAll('button')].find(x => /search by vibe/i.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
let search = { opened: false };
if (sb) {
  await move(sb.x, sb.y); await sleep(30); await click(sb.x, sb.y); await sleep(800);
  const inp = await evaluate(s, `(() => { const i = document.querySelector('input[placeholder*="late night drive"]'); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  if (inp) { await click(inp.x, inp.y); await s('Input.insertText', { text: 'summer love' }); search.opened = true; }
  const before = await evaluate(s, `document.querySelector('.fixed.top-0, nav') ? 0 : 0`);
  for (let i = 0; i < 40; i++) { await sleep(500); const n = await evaluate(s, `window.__s3.img.length`); if (n > 0 && i > 8) { const st = await evaluate(s, `(() => { const l = window.__s3.img.filter(x => x[2] != null || x[3] != null).map(x => x[2] ?? x[3]); return { n: window.__s3.img.length, done: l.length, last: l.length ? Math.max(...l) : 0, now: performance.now() }; })()`); if (st.done >= st.n && st.now - st.last > 3000) break; } }
  search = { ...search, ...(await evaluate(s, `(() => { const up = window.__s3.up.filter(u => u[2] >= 4096); const img = window.__s3.img; const count = document.querySelector('nav') ? (document.body.innerText.match(/(\\d[\\d,]*)\\s+tracks?/i) || [])[1] : null; return { fullUploads: up.length, imgSrcSets: img.length, uniqueUrls: new Set(img.map(i => i[1])).size, loaded: img.filter(i => i[2] != null).length, errored: img.filter(i => i[3] != null).length, sizeVariants: [...new Set(img.map(i => (i[1].match(/\\/(\\d+x\\d+)bb/) || [])[1]))], trackCountText: count }; })()`)) };
}
const shot2 = await s('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(OUT, 'shots', `${RUN}_after-search.jpg`), Buffer.from(shot2.data, 'base64'));
console.log(RUN, 'search', JSON.stringify(search));
writeJSON(path.join(OUT, `${RUN}.json`), { run: RUN, url: URL_, entry, search, capturedAt: new Date().toISOString() });
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
