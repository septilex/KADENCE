// S4 analysis. Usage: node analyze_s4.mjs <OUT>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const OUT = process.argv[2]; const RAW = path.join(OUT, 'raw');
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
const SEG = [['passive', 0, 10000], ['slow_hover', 10000, 25000], ['fast_sweep', 25000, 35000], ['pop_click', 35000, 45000], ['passive2', 45000, 60000]];
const res = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json')).sort()) {
  const T = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  const D = T.dump; const to = D.s2.timeOrigin; const rel = (pageT) => Math.round(to + pageT - T.T0wall);
  const commits = D.s4.commits.map((c) => ({ t: rel(c[0]), rid: c[1], n: c[2], names: c[3], walk: c[4] }));
  const rids = [...new Set(commits.map((c) => c.rid))];
  // the renderer with the largest composite counts is react-dom (R3F tree is small)
  const domRid = rids.sort((a, b) => Math.max(0, ...commits.filter((c) => c.rid === b).map((c) => c.n)) - Math.max(0, ...commits.filter((c) => c.rid === a).map((c) => c.n)))[0];
  const tip = D.s4.tip.map((x) => ({ t: rel(x[0]), txt: x[1] }));
  const pool = D.s4.pool.map((x) => ({ t: rel(x[0]), size: x[1], loading: x[2], loaded: x[3], error: x[4], playing: x[5] }));
  const raf = D.s2.raf.map((x) => ({ t: rel(x[0]), d: x[1] }));
  const frames = D.s3.frames.map((x) => ({ t: rel(x[0]), draws: x[1] }));
  const lt = D.s2.lt.map((x) => ({ t: rel(x[0]), ms: x[1] }));
  const loaf = D.s2.loaf.map((x) => ({ t: rel(x[0]), ms: x[1], blocking: x[2], styleLayout: x[3], scripts: x[4] }));
  const audNew = D.s3.audioNew.map((x) => ({ t: rel(x[0]), file: x[1] }));
  const audEv = (D.s3.audioEv || []).map((x) => ({ t: rel(x[0]), id: x[1], e: x[2], file: x[3] }));
  const playCalls = D.s2.ev.filter((e) => e[2] === 'A' && e[1] === 'play()').map((e) => ({ t: rel(e[0]), file: e[3] }));
  const rejects = D.s2.ev.filter((e) => e[2] === 'A' && e[1] === 'play:rejected').map((e) => ({ t: rel(e[0]), name: e[7] }));
  const m4a = T.network.filter((r) => /audio-ssl|\.m4a|\.aac/.test(r.url));
  const art = T.network.filter((r) => /mzstatic|scdn/.test(r.url));
  const segStats = SEG.map(([name, a, b]) => {
    const inS = (x) => x.t >= a && x.t < b; const sec = (b - a) / 1000;
    const cm = commits.filter(inS); const cdom = cm.filter((c) => c.rid === domRid);
    const homeCommits = cdom.filter((c) => c.names && c.names.includes('Home')).length;
    const rf = raf.filter(inS).map((x) => x.d); const p50 = pct(rf, 0.5) || 6.9;
    const fr = frames.filter(inS);
    const cpu = (T.cpuSeg || []).find((c) => c.segment === (name === 'passive' ? 'passive_start' : name === 'slow_hover' ? 'slow_hover_start' : name === 'fast_sweep' ? 'fast_sweep_start' : name === 'pop_click' ? 'pop_click_start' : 'passive2_start'));
    return { segment: name, commitsTotal: cm.length, commitsPerSec: +(cm.length / sec).toFixed(1), reactDomCommits: cdom.length, reactDomCommitsPerSec: +(cdom.length / sec).toFixed(1), compositesPerDomCommit: { p50: pct(cdom.map((c) => c.n), 0.5), max: cdom.length ? Math.max(...cdom.map((c) => c.n)) : null },
      homeCommits, tooltipChanges: tip.filter(inS).length, newAudio: audNew.filter(inS).length, audioPlayCalls: playCalls.filter(inS).length, audioPlayRejected: rejects.filter(inS).length,
      m4aRequestsStarted: m4a.filter((r) => r.start >= a && r.start < b).length,
      raf: { n: rf.length, p50, p95: pct(rf, 0.95), p99: pct(rf, 0.99), max: rf.length ? Math.max(...rf) : null, over20: rf.filter((d) => d > 20).length, over50: rf.filter((d) => d > 50).length, missed: rf.reduce((s, d) => s + Math.max(0, Math.round(d / p50) - 1), 0) },
      webglFramesWithDrawsPerSec: +(fr.filter((x) => x.draws > 0).length / sec).toFixed(1),
      longTasks: lt.filter(inS).map((x) => [x.t, x.ms]), loaf: { n: loaf.filter(inS).length, max: Math.max(0, ...loaf.filter(inS).map((x) => x.ms)), blocking: loaf.filter(inS).reduce((s, x) => s + x.blocking, 0) },
      cpu: cpu ? Object.fromEntries(cpu.procs.filter((p) => p.type === 'GPU' || p.type === 'renderer').map((p) => [p.type, p.pct])) : null };
  });
  // HY-8: loading entries at sweep end (35 s) +0/+10/+30
  const poolAt = (ms) => { const c = pool.filter((p) => p.t <= ms); return c.length ? c[c.length - 1] : null; };
  const comps = {}; for (const c of commits.filter((c) => c.rid === domRid && c.t >= 0 && c.t < 10000)) for (const n of c.names || []) comps[n] = (comps[n] || 0) + 1;
  const passiveComponents = Object.entries(comps).sort((a, b) => b[1] - a[1]).slice(0, 30);
  const popEvents = { clickPopped: T.actions.find((a) => a.tag === 'click-popped-tile'), clickEdge: T.actions.find((a) => /edge/.test(a.tag)), tipAround: tip.filter((x) => x.t >= 35000 && x.t < 45000).map((x) => [x.t, x.txt.slice(0, 40)]), audioPlayAround: playCalls.filter((x) => x.t >= 35000 && x.t < 45000).map((x) => [x.t, x.file]), audioEvAround: audEv.filter((x) => x.t >= 35000 && x.t < 45000 && /playing|pause/.test(x.e)).map((x) => [x.t, x.id, x.e, x.file]) };
  // slow hover: commits per tile change
  const slow = segStats.find((s) => s.segment === 'slow_hover');
  // trace: TimerFire durations in passive window
  let timerFire = null; const tfj = path.join(OUT, 'traces', `${T.run}_timerfire.json`);
  if (fs.existsSync(tfj)) { const J = JSON.parse(fs.readFileSync(tfj, 'utf8')); const byPid = {}; for (const e of J.timerFires) byPid[e.pid] = (byPid[e.pid] || 0) + 1; const pid = Object.entries(byPid).sort((a, b) => b[1] - a[1])[0][0];
    const mine = J.timerFires.filter((e) => e.pid === pid).map((e) => ({ t: (e.ts - J.tsMin) / 1000 - 300, ms: e.dur / 1000 }));
    const seg = (a, b) => { const d = mine.filter((e) => e.t >= a && e.t < b).map((e) => e.ms); return { n: d.length, perSec: +(d.length / ((b - a) / 1000)).toFixed(1), p50: pct(d, 0.5), p95: pct(d, 0.95), max: d.length ? +Math.max(...d).toFixed(2) : null, sumMs: +d.reduce((s, x) => s + x, 0).toFixed(1), over4ms: d.filter((x) => x > 4).length }; };
    timerFire = { note: 'TimerFire (X) durations on the KADENCE renderer main thread; t aligned to script start assuming trace start = T0-300 ms', rendererPid: pid, passive0to10s: seg(0, 10000), slowHover: seg(10000, 25000), sweep: seg(25000, 35000), popClick: seg(35000, 45000), passive2: seg(45000, 60000) }; }
  res.push({ run: T.run, target: T.target, cpu: T.cpu, traced: T.traced, revealMs: T.revealMs, settleMs: T.settleMs, mapsFound: T.mapsFound, renderers: rids.length, reactDomRendererId: domRid, walkMsP95: pct(commits.map((c) => c.walk), 0.95),
    foreignPointer: D.s2.ptr.filter((p) => p[3] === 1 && !T.actions.some((a) => Math.abs((a.x ?? -99) - p[4]) <= 2 && Math.abs((a.y ?? -99) - p[5]) <= 2)).length,
    segments: segStats, commitsPerTileChangeSlow: slow.tooltipChanges ? +(slow.reactDomCommits / slow.tooltipChanges).toFixed(2) : null,
    audio: { newAudioTotal60s: audNew.filter((x) => x.t < 60000).length, playCalls60s: playCalls.filter((x) => x.t < 60000).length, m4a: { requests: m4a.length, distinct: new Set(m4a.map((r) => r.url)).size, bytes: m4a.reduce((s, r) => s + r.bytes, 0), unfinishedAtDump: m4a.filter((r) => r.end == null && !r.failed).length, failed: m4a.filter((r) => r.failed).length, pendingOver10s: m4a.filter((r) => r.end == null && !r.failed && r.start < 60000).length },
      poolAtSweepEnd: { plus0: poolAt(35000), plus10: poolAt(45000), plus30: poolAt(65000), last: pool.at(-1) } },
    artworkRequestsDuringScript: art.length, atlasUploadsDuringScript: D.s3.up.length,
    passiveRenderedComponentsTop: passiveComponents, popClick: popEvents, timerFire, heap: T.heap, post: T.post,
    refresh: T.extras && T.extras.refresh ? (() => { const R = T.extras.refresh; const rt0 = R.s2.timeOrigin; const ups = R.s3.up.filter((u) => u[2] >= 4096); const rf2 = R.s2.raf.map((x) => x[1]); return { durationMs: R.durationMs, fullUploads: ups.length, uploadCallMax: ups.length ? Math.max(...ups.map((u) => u[4])) : null, raf: { n: rf2.length, p95: pct(rf2, 0.95), max: rf2.length ? Math.max(...rf2) : null, over50: rf2.filter((d) => d > 50).length }, longTasks: R.s2.lt.map((l) => l[1]), api: R.network.filter((r) => r.url.includes('/api/')).map((r) => [r.status, r.xVercelCache, r.end != null ? r.end - r.start : null]), artworkReqs: R.network.filter((r) => /mzstatic/.test(r.url)).length, imgSrcSets: R.s3.img.length }; })() : null,
  });
}
fs.writeFileSync(path.join(OUT, 'S4_metrics.json'), JSON.stringify(res, null, 1));
for (const r of res) { console.log('=====', r.run, 'reveal', r.revealMs, 'settle', r.settleMs, 'maps', r.mapsFound, 'renderers', r.renderers, 'walkP95', r.walkMsP95, 'foreign', r.foreignPointer, 'commits/tile(slow)', r.commitsPerTileChangeSlow);
  for (const s of r.segments) console.log('  ', JSON.stringify(s));
  console.log('   audio', JSON.stringify(r.audio)); console.log('   art', r.artworkRequestsDuringScript, 'uploads', r.atlasUploadsDuringScript, 'heap', JSON.stringify(r.heap), 'timerFire', JSON.stringify(r.timerFire));
  console.log('   passive components', JSON.stringify(r.passiveRenderedComponentsTop).slice(0, 600)); console.log('   pop', JSON.stringify(r.popClick).slice(0, 900)); if (r.refresh) console.log('   refresh', JSON.stringify(r.refresh)); }
