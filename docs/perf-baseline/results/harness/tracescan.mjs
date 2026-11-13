// Stream-scan a gzip trace for TimerFire (X) events and CrRendererMain thread ids. Usage: node tracescan.mjs <trace.gz> <out.json>
import fs from 'node:fs'; import zlib from 'node:zlib';
const [IN, OUTF] = process.argv.slice(2);
const reTF = /"dur":(\d+),"name":"TimerFire","ph":"X","pid":(\d+),"tdur":(\d+),"tid":(\d+),"ts":(\d+)/g;
const reTN = /"args":\{"name":"CrRendererMain"\},"cat":"__metadata","name":"thread_name","ph":"M","pid":(\d+),"tid":(\d+)/g;
const reTS = /"ts":(\d{6,})/g;
const tf = [], mains = new Set(); let tsMin = Infinity, tail = '';
const st = fs.createReadStream(IN).pipe(zlib.createGunzip());
st.on('data', (b) => { const s = tail + b.toString('utf8'); let m;
  reTF.lastIndex = 0; while ((m = reTF.exec(s))) tf.push({ dur: +m[1], pid: m[2], tdur: +m[3], tid: m[4], ts: +m[5] });
  reTN.lastIndex = 0; while ((m = reTN.exec(s))) mains.add(m[1] + ':' + m[2]);
  reTS.lastIndex = 0; while ((m = reTS.exec(s))) { const v = +m[1]; if (v > 0 && v < tsMin) tsMin = v; }
  tail = s.slice(-400); });
st.on('end', () => { const seen = new Set(); const u = tf.filter((e) => { const k = e.ts + ':' + e.tid; if (seen.has(k)) return false; seen.add(k); return true; });
  fs.writeFileSync(OUTF, JSON.stringify({ tsMin, mains: [...mains], timerFires: u.filter((e) => mains.has(e.pid + ':' + e.tid)) })); console.log('timerFires(main)', u.filter((e) => mains.has(e.pid + ':' + e.tid)).length, 'all', u.length, 'mains', [...mains].join(',')); });
