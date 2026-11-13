// Capture console errors/warnings and exceptions during intro + chart entry. Usage: node errcheck.mjs <url>
import { launchBrave, connect, newPage, evaluate, sleep } from './cdp.mjs';
const URL_ = process.argv[2];
await launchBrave(); const cdp = await connect();
const { s, sessionId, targetId } = await newPage(cdp, 'about:blank');
const out = []; const t0 = Date.now();
cdp.on((m, p, sid) => {
  if (sid !== sessionId) return;
  if (m === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) out.push([Date.now() - t0, 'console.' + p.type, (p.args || []).map((a) => a.value ?? a.description ?? '').join(' || ').slice(0, 2500), (p.stackTrace?.callFrames?.[0] ? `${p.stackTrace.callFrames[0].url.split('/').pop()}:${p.stackTrace.callFrames[0].lineNumber}` : '')]);
  else if (m === 'Runtime.exceptionThrown') out.push([Date.now() - t0, 'exception', (p.exceptionDetails.exception?.description || p.exceptionDetails.text || '').slice(0, 400), '']);
  else if (m === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) out.push([Date.now() - t0, 'log.' + p.entry.level + '/' + p.entry.source, (p.entry.text || '').slice(0, 300), (p.entry.url || '').split('?')[0].slice(-80)]);
});
await s('Runtime.enable'); await s('Log.enable'); await s('Page.enable');
const loaded = new Promise((res) => cdp.on((m, p, sid) => { if (sid === sessionId && m === 'Page.loadEventFired') res(); }));
await s('Page.navigate', { url: URL_ }, undefined, 180000); await Promise.race([loaded, sleep(120000)]);
let hyd = false; for (let i = 0; i < 90 && !hyd; i++) { hyd = await evaluate(s, `(() => { const e = document.querySelector('#vibe-late-night'); return !!e && Object.keys(e).some(k => k.startsWith('__react')); })()`).catch(() => false); if (!hyd) await sleep(2000); }
await sleep(3000); out.push([Date.now() - t0, 'MARK', 'intro ready, entering Late Night', '']);
const g = await evaluate(s, `(() => { const r = document.querySelector('#vibe-late-night').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y, button: 'none' }); await sleep(30);
for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x: g.x, y: g.y, button: 'left', clickCount: 1 });
await sleep(25000);
const badge = await evaluate(s, `(() => { const r = document.querySelector('nextjs-portal')?.shadowRoot; if (!r) return null; const t = r.textContent.replace(/\\s+/g, ' '); const m = t.match(/(\\d+)\\s*Issues?/); return m ? m[0] : 'no badge text'; })()`).catch((e) => 'err ' + e.message);
console.log('next overlay badge:', badge);
for (const o of out) console.log(JSON.stringify(o));
await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();

