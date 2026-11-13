// Capture the full console.error payload (args + JS stack + async/owner stack) for React's duplicate-key warning.
import fs from 'node:fs';
import { launchBrave, connect, newPage, evaluate, sleep } from './cdp.mjs';
const URL_ = process.argv[2]; const OUTF = process.argv[3];
await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
const hits = []; const t0 = Date.now();
const frames = (st) => { const out = []; for (let x = st, d = 0; x && d < 6; x = x.parent, d++) out.push({ description: x.description || null, frames: (x.callFrames || []).slice(0, 25).map((f) => `${f.functionName || '(anon)'} @ ${f.url.split('/').pop()}:${f.lineNumber}:${f.columnNumber}`) }); return out; };
cdp.on((m, p, sid) => {
  if (sid !== sessionId || m !== 'Runtime.consoleAPICalled' || p.type !== 'error') return;
  const first = (p.args?.[0]?.value || '') + '';
  if (!/same key/i.test(first)) return;
  hits.push({ t: Date.now() - t0, args: (p.args || []).map((a) => ({ type: a.type, subtype: a.subtype, value: a.value, description: a.description })), stack: frames(p.stackTrace) });
});
await s('Runtime.enable'); await s('Page.enable');
await s('Runtime.setAsyncCallStackDepth', { maxDepth: 32 });
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: URL_ }, undefined, 180000); await Promise.race([loaded, sleep(120000)]);
let hyd = false; for (let i = 0; i < 90 && !hyd; i++) { hyd = await evaluate(s, `(() => { const e = document.querySelector('#vibe-late-night'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hyd) await sleep(2000); }
await sleep(3000);
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-late-night').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y, button: 'none' }); await sleep(30);
for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x: g.x, y: g.y, button: 'left', clickCount: 1 });
await sleep(20000);
fs.writeFileSync(OUTF, JSON.stringify(hits, null, 1));
console.log('duplicate-key errors captured:', hits.length);
if (hits[0]) { console.log('args:', JSON.stringify(hits[0].args).slice(0, 600)); for (const seg of hits[0].stack) { console.log('--', seg.description || 'sync'); console.log(seg.frames.join('\n')); } }
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
