// Wall flicker / artwork-fill probe. Usage: node flicker.mjs <outDir> <runName> [url]
// Opens a chart, records how fast the wall fills with artwork, then sweeps the pointer in a circle
// while capturing every rendered frame (downscaled) and counts pixels that blink for a single frame.
import fs from 'node:fs'; import path from 'node:path';
import { launchBrave, connect, newPage, evaluate, sleep } from './cdp.mjs';
const [OUT, RUN, URL_ = 'http://localhost:3000/'] = process.argv.slice(2);
await launchBrave(); const cdp = await connect(); const { targetId, s } = await newPage(cdp);
try {
  await s('Page.enable'); await s('Runtime.enable');
  await s('Page.navigate', { url: URL_ }); await sleep(6000);
  let card = null;
  for (let i = 0; i < 40 && !card; i++) { card = await evaluate(s, `(()=>{const el=document.querySelector('[id^="vibe-"]'); if(!el||!Object.keys(el).some(k=>k.startsWith('__react'))) return null; const r=el.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2,id:el.id}:null})()`); if (!card) await sleep(1000); }
  if (!card) throw new Error('chart card not found');
  const mouse = (type, x, y, extra = {}) => s('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
  await mouse('mouseMoved', card.x, card.y); await sleep(300);
  await mouse('mousePressed', card.x, card.y, { button: 'left', clickCount: 1 }); await mouse('mouseReleased', card.x, card.y, { button: 'left', clickCount: 1 });
  const tClick = Date.now();
  // wait for the wall (canvas present and intro gone)
  let reveal = null;
  for (let i = 0; i < 200; i++) { await sleep(150); if (await evaluate(s, `!!document.querySelector('canvas') && /Switch Chart/.test(document.body.innerText)`)) { reveal = Date.now() - tClick; break; } }
  if (reveal === null) throw new Error('wall never revealed');
  const V = await evaluate(s, `({w:innerWidth,h:innerHeight})`);
  await mouse('mouseMoved', V.w - 5, V.h / 2); // park pointer at the edge
  // fill curve: share of dark pixels in the canvas over time
  const darkExpr = `new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const cv=document.querySelector('canvas');const W=160,H=90;const oc=document.createElement('canvas');oc.width=W;oc.height=H;const c=oc.getContext('2d');c.drawImage(cv,0,0,W,H);const d=c.getImageData(0,0,W,H).data;let dark=0;for(let i=0;i<d.length;i+=4){if(d[i]+d[i+1]+d[i+2]<60)dark++}res(+(dark/(W*H)).toFixed(3))})))`;
  const fill = [];
  for (let i = 0; i < 30; i++) { fill.push([Date.now() - tClick - reveal, await evaluate(s, darkExpr)]); await sleep(500); }
  // flicker capture at native resolution (no downscale aliasing): two 400x300 crops, centre and top-left
  const capture = async (label, moving) => {
    await evaluate(s, `(()=>{const cv=document.querySelector('canvas');const W=400,H=300;const sx=cv.width/cv.clientWidth;const mk=()=>{const oc=document.createElement('canvas');oc.width=W;oc.height=H;return oc.getContext('2d',{willReadFrequently:true})};const cA=mk(),cB=mk();window.__fl={A:[],B:[],t:[],on:true,W,H,cA};const ox=(cv.width-W)/2-W*0.9,oy=(cv.height-H)/2;const step=()=>{const F=window.__fl;if(!F.on)return;cA.drawImage(cv,ox,oy,W,H,0,0,W,H);F.A.push(cA.getImageData(0,0,W,H).data);cB.drawImage(cv,40,140*sx,W,H,0,0,W,H);F.B.push(cB.getImageData(0,0,W,H).data);F.t.push(performance.now());requestAnimationFrame(step)};requestAnimationFrame(step)})()`);
    const t0 = Date.now(); let k = 0;
    while (Date.now() - t0 < 2500) { if (moving) { const a = k++ * 0.12; await mouse('mouseMoved', V.w * 0.5 + Math.cos(a) * V.w * 0.12, V.h * 0.5 + Math.sin(a) * V.h * 0.18); } await sleep(8); }
    const r = await evaluate(s, `(()=>{const F=window.__fl;F.on=false;const {W,H}=F;const an=(frames)=>{const map=new Uint16Array(W*H);const per=[];
      for(let f=2;f<frames.length;f++){const a=frames[f-2],b=frames[f-1],c=frames[f];let fl=0;for(let p=0,i=0;p<a.length;p+=4,i++){const l0=a[p]+a[p+1]+a[p+2],l1=b[p]+b[p+1]+b[p+2],l2=c[p]+c[p+1]+c[p+2];if(Math.abs(l1-l0)>150&&Math.abs(l1-l2)>150&&Math.abs(l0-l2)<50){fl++;map[i]++}}per.push(fl)}
      return {map,per,total:per.reduce((x,y)=>x+y,0),framesWithFlicker:per.filter(v=>v>20).length,max:Math.max(...per),blink3plus:[...map].filter(v=>v>=3).length}};
      const A=an(F.A),B=an(F.B);const c=F.cA;const png=(d)=>{c.putImageData(new ImageData(d,W,H),0,0);return c.canvas.toDataURL('image/png')};
      const w=A.per.indexOf(A.max)+1;const heat=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++){const v=Math.min(255,A.map[i]*40);heat[i*4]=v;heat[i*4+1]=v;heat[i*4+2]=v;heat[i*4+3]=255}
      const dt=F.t.slice(1).map((v,i)=>v-F.t[i]).sort((x,y)=>x-y);
      const strip=(o)=>({total:o.total,framesWithFlicker:o.framesWithFlicker,maxPerFrame:o.max,pixelsBlinking3plus:o.blink3plus});
      return {frames:F.A.length,frameMsP50:+dt[dt.length>>1].toFixed(1),nearPointer:strip(A),topLeft:strip(B),shots:[png(F.A[Math.max(0,w-1)]),png(F.A[w]),png(F.A[Math.min(F.A.length-1,w+1)]),png(heat)]}})()`);
    r.shots.forEach((d, i) => fs.writeFileSync(path.join(OUT, `${RUN}_${label}_${['prev', 'worst', 'next', 'heat'][i]}.png`), Buffer.from(d.split(',')[1], 'base64'))); delete r.shots;
    return r;
  };
  fs.mkdirSync(OUT, { recursive: true });
  await mouse('mouseMoved', V.w * 0.62, V.h * 0.5); await sleep(1500);
  const res = { still: await capture('still', false), moving: await capture('moving', true) };
  fs.mkdirSync(OUT, { recursive: true });
  const big = await s('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, `${RUN}_end.jpg`), Buffer.from(big.data, 'base64'));
  const out = { run: RUN, url: URL_, viewport: V, revealMs: reveal, darkShareOverTime: fill, flicker: res };
  fs.writeFileSync(path.join(OUT, `${RUN}.json`), JSON.stringify(out, null, 1));
  const first = (th) => (fill.find(f => f[1] <= th) || [null])[0];
  console.log(JSON.stringify({ revealMs: reveal, darkAtReveal: fill[0][1], darkAt5s: (fill.find(f => f[0] >= 5000) || [])[1], msToDarkBelow10pct: first(0.10), finalDark: fill.at(-1)[1], flicker: res }));
} finally { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close(); }
