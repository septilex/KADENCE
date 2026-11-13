// Extract Screenshot events from a Chromium trace into JPEGs + flipbook. Usage: node filmstrip.mjs <trace.json.gz> <outDir> <rawRun.json>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const [TR, OUTD, RAWF] = process.argv.slice(2);
const t = JSON.parse(zlib.gunzipSync(fs.readFileSync(TR))); const ev = t.traceEvents || t;
const shots = ev.filter((e) => e.name === 'Screenshot' && e.args && e.args.snapshot).sort((a, b) => a.ts - b.ts);
// align: find the click EventDispatch in the trace
const clickEv = ev.find((e) => e.name === 'EventDispatch' && e.args && e.args.data && e.args.data.type === 'click');
const t0 = clickEv ? clickEv.ts : shots[0].ts;
fs.mkdirSync(OUTD, { recursive: true });
const frames = []; let last = -1e9;
for (const s of shots) { const ms = Math.round((s.ts - t0) / 1000); if (ms - last < 100) continue; last = ms; const name = `s${String(frames.length).padStart(4, '0')}.jpg`; fs.writeFileSync(path.join(OUTD, name), Buffer.from(s.args.snapshot, 'base64')); frames.push([name, ms]); }
const html = `<!doctype html><meta charset="utf-8"><title>S3 filmstrip</title><style>body{background:#111;color:#ddd;font:13px system-ui;margin:16px}img{max-width:100%;display:block}</style>
<h3>S3 traced chart entry: trace screenshots (≥100 ms apart), t relative to the click event in the trace</h3><div><button id="p">Play</button> <input id="r" type="range" min="0" max="${frames.length - 1}" value="0" style="width:60%"> <span id="l"></span></div><img id="i">
<script>const F=${JSON.stringify(frames)};let k=0,tm=null;const show=n=>{k=n;i.src=F[n][0];r.value=n;l.textContent='t = '+F[n][1]+' ms after click';};p.onclick=()=>{if(tm){clearTimeout(tm);tm=null;p.textContent='Play';return;}p.textContent='Pause';const st=()=>{if(k>=F.length-1){tm=null;p.textContent='Play';return;}const d=F[k+1][1]-F[k][1];show(k+1);tm=setTimeout(st,d);};st();};r.oninput=()=>show(+r.value);show(0);</script>`;
fs.writeFileSync(path.join(OUTD, 'index.html'), html);
console.log('screenshots', shots.length, 'kept', frames.length, 'click found in trace', !!clickEv, 'span ms', frames[0]?.[1], frames.at(-1)?.[1]);
