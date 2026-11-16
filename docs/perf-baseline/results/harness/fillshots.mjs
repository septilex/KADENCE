// Screenshots of the wall filling with artwork on a cold image cache. Usage: node fillshots.mjs <outDir> <runName> [url]
import fs from 'node:fs'; import path from 'node:path';
import { launchBrave, connect, newPage, evaluate, sleep } from './cdp.mjs';
const [OUT, RUN, URL_ = 'http://localhost:3000/'] = process.argv.slice(2);
await launchBrave(); const cdp = await connect(); const { targetId, s } = await newPage(cdp);
try {
  await s('Page.enable'); await s('Network.enable'); await s('Network.setCacheDisabled', { cacheDisabled: true });
  await s('Page.navigate', { url: URL_ });
  let card = null;
  for (let i = 0; i < 60 && !card; i++) { await sleep(1000); card = await evaluate(s, `(()=>{const el=document.querySelector('[id^="vibe-"]'); if(!el||!Object.keys(el).some(k=>k.startsWith('__react'))) return null; const r=el.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null})()`); }
  if (!card) throw new Error('chart card not found');
  await sleep(2000);
  const mouse = (type, x, y, extra = {}) => s('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
  await mouse('mouseMoved', card.x, card.y); await sleep(200);
  await mouse('mousePressed', card.x, card.y, { button: 'left', clickCount: 1 }); await mouse('mouseReleased', card.x, card.y, { button: 'left', clickCount: 1 });
  const tClick = Date.now(); let reveal = null;
  for (let i = 0; i < 400; i++) { await sleep(50); if (await evaluate(s, `!!document.querySelector('canvas') && /Switch Chart/.test(document.body.innerText)`)) { reveal = Date.now() - tClick; break; } }
  fs.mkdirSync(OUT, { recursive: true }); const log = { revealMs: reveal, shots: [] };
  for (const at of [300, 1000, 2000, 3500, 6000, 10000, 15000]) {
    const wait = tClick + reveal + at - Date.now(); if (wait > 0) await sleep(wait);
    const shot = await s('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
    fs.writeFileSync(path.join(OUT, `${RUN}_fill_${at}ms.jpg`), Buffer.from(shot.data, 'base64'));
    const imgs = await evaluate(s, `performance.getEntriesByType('resource').filter(e=>/mzstatic/.test(e.name)&&e.responseEnd>0).length`);
    log.shots.push({ afterRevealMs: Date.now() - tClick - reveal, artworkResponses: imgs });
  }
  console.log(JSON.stringify(log));
} finally { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close(); }
