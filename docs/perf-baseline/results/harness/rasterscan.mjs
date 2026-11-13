// Stream-scan a gzip trace: collect rendering-pipeline events (Paint, RasterTask, Layout, UpdateLayoutTree, PrePaint, Layerize, GPUTask, FireAnimationFrame, Commit)
// and click EventDispatch timestamps. Usage: node rasterscan.mjs <trace.gz> <out.json>
import fs from 'node:fs'; import zlib from 'node:zlib';
const [IN, OUTF] = process.argv.slice(2);
const NAMES = 'Paint|RasterTask|PrePaint|Layout|UpdateLayoutTree|Layerize|GPUTask|FireAnimationFrame|Commit|PaintArtifactCompositor|Decode Image|ImageDecodeTask';
const reEv = new RegExp(`"cat":"[^"]*","dur":(\\d+),"name":"(${NAMES})","ph":"X","pid":(\\d+)(?:,"tdur":\\d+)?,"tid":(\\d+),"ts":(\\d+)`, 'g');
const reClick = /"data":\{[^{}]*"type":"(click|pointerdown)"[^{}]*\}\},"cat":"[^"]*","dur":\d+,"name":"EventDispatch","ph":"X","pid":(\d+)(?:,"tdur":\d+)?,"tid":(\d+),"ts":(\d+)/g;
const reTN = /"args":\{"name":"([^"]+)"\},"cat":"__metadata","name":"thread_name","ph":"M","pid":(\d+),"tid":(\d+)/g;
const ev = [], clicks = [], threads = {}; let tail = '';
const st = fs.createReadStream(IN).pipe(zlib.createGunzip());
st.on('data', (b) => { const s = tail + b.toString('utf8'); let m;
  reEv.lastIndex = 0; while ((m = reEv.exec(s))) ev.push([+m[5], +m[1], m[2], m[3] + ':' + m[4]]);
  reClick.lastIndex = 0; while ((m = reClick.exec(s))) clicks.push([+m[4], m[1], m[2] + ':' + m[3]]);
  reTN.lastIndex = 0; while ((m = reTN.exec(s))) threads[m[2] + ':' + m[3]] = m[1];
  tail = s.slice(-600); });
st.on('end', () => { const seen = new Set(); const u = ev.filter((e) => { const k = e.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
  const cu = [...new Map(clicks.map((c) => [c.join(','), c])).values()].sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(OUTF, JSON.stringify({ threads, clicks: cu, events: u, fields: 'ts,durUs,name,pid:tid' })); console.log('events', u.length, 'clicks', cu.length, 'threads', Object.keys(threads).length); });
