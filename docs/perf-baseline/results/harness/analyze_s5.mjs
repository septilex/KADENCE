// S5 analysis. Usage: node analyze_s5.mjs <OUT>
import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2]; const RAW = path.join(OUT, 'raw');
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
const res = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json')).sort()) {
  const T = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); const D = T.dump; const to = D.s2.timeOrigin; const rel = (p) => Math.round(to + p - T.T0wall);
  const A = (re) => T.actions.find((a) => re.test(a.tag));
  const clicks = D.s2.ptr.filter((p) => p[1] === 'click').map((p) => ({ t: rel(p[0]), key: p[2], x: p[4], y: p[5] }));
  const openClick = clicks.find((c) => c.t >= 2000 && c.t < 3000); const closeClick = clicks.find((c) => c.t >= 24000 && c.t < 25000);
  const raf = D.s2.raf.map((x) => ({ t: rel(x[0]), d: x[1] })); const p50 = pct(raf.filter((r) => r.t < 2000).map((r) => r.d), 0.5) || 6.9;
  const win = (a, b) => { const r = raf.filter((x) => x.t >= a && x.t < b).map((x) => x.d); return { n: r.length, p50: pct(r, 0.5), p95: pct(r, 0.95), max: r.length ? Math.max(...r) : null, over20: r.filter((d) => d > 20).length, over50: r.filter((d) => d > 50).length, missed: r.reduce((s, d) => s + Math.max(0, Math.round(d / p50) - 1), 0) }; };
  const drawer = D.s5.drawer.map((x) => ({ t: rel(x[0]), v: x[1] }));
  const openAnim = openClick ? drawer.filter((d) => d.t >= openClick.t && d.t < openClick.t + 4000) : [];
  const closeAnim = closeClick ? drawer.filter((d) => d.t >= closeClick.t && d.t < closeClick.t + 3000) : [];
  const lt = D.s2.lt.map((x) => ({ t: rel(x[0]), ms: x[1] })); const loaf = D.s2.loaf.map((x) => ({ t: rel(x[0]), ms: x[1], blocking: x[2], scripts: x[4] }));
  const ltIn = (a, b) => lt.filter((x) => x.t >= a && x.t < b).map((x) => [x.t, x.ms]); const loafIn = (a, b) => loaf.filter((x) => x.t >= a && x.t < b);
  const commits = D.s4.commits.map((c) => ({ t: rel(c[0]), rid: c[1], n: c[2], names: c[3] }));
  const rids = [...new Set(commits.map((c) => c.rid))]; const dom = rids.sort((a, b) => Math.max(0, ...commits.filter((c) => c.rid === b).map((c) => c.n)) - Math.max(0, ...commits.filter((c) => c.rid === a).map((c) => c.n)))[0];
  const cIn = (a, b) => commits.filter((c) => c.rid === dom && c.t >= a && c.t < b);
  const idleOpen = [3000, 10000]; const ci = cIn(...idleOpen); const sec = (idleOpen[1] - idleOpen[0]) / 1000;
  const named = (n) => ci.filter((c) => c.names && c.names.includes(n)).length;
  const gb = D.s5.gbcr.map((x) => ({ t: rel(x[0]), n: x[1] })); const gbIn = (a, b) => gb.filter((x) => x.t >= a && x.t < b).reduce((s, x) => s + x.n, 0);
  const evt = D.s5.evt.map((e) => ({ t: rel(e[0]), type: e[1], dur: e[2], inDelay: e[3], proc: e[4], pres: e[5], iid: e[6], title: e[7] }));
  const inter = {}; for (const e of evt.filter((x) => x.iid)) { const k = e.iid; if (!inter[k] || e.dur > inter[k].dur) inter[k] = e; }
  const interactions = Object.values(inter).sort((a, b) => a.t - b.t).map((e) => ({ t: e.t, type: e.type, ms: e.dur, inputDelay: e.inDelay, processing: e.proc, presentation: e.pres, target: e.title }));
  const playCalls = D.s2.ev.filter((e) => e[2] === 'A' && e[1] === 'play()').map((e) => ({ t: rel(e[0]), file: e[3] }));
  const pauseCalls = D.s2.ev.filter((e) => e[2] === 'A' && e[1] === 'pause()').map((e) => ({ t: rel(e[0]), file: e[3] }));
  const fr = D.s3.frames.map((x) => ({ t: rel(x[0]), d: x[1] })); const draws = (a, b) => +(fr.filter((x) => x.t >= a && x.t < b && x.d > 0).length / ((b - a) / 1000)).toFixed(1);
  const wrap = D.s5.wrap.map((x) => ({ t: rel(x[0]), v: x[1] }));
  const cpu = Object.fromEntries((T.cpuSeg || []).map((c) => [c.segment, Object.fromEntries(c.procs.filter((p) => p.type === 'GPU' || p.type === 'renderer').map((p) => [p.type, p.pct]))]));
  res.push({ run: T.run, target: T.target, cpu: T.cpu, traced: T.traced, revealMs: T.revealMs, settleMs: T.settleMs,
    foreignPointer: D.s2.ptr.filter((p) => p[3] === 1 && !T.actions.some((a) => a.x != null && Math.abs(a.x - p[4]) <= 3 && Math.abs(a.y - p[5]) <= 3) && !(p[1] || '').startsWith('pointermove')).length,
    drawerOpen: openClick ? { clickAt: openClick.t, firstChangeAfterClickMs: openAnim[0] ? openAnim[0].t - openClick.t : null, lastChangeAfterClickMs: openAnim.length ? openAnim.at(-1).t - openClick.t : null, stateChanges: openAnim.length, frames: win(openClick.t, openClick.t + 1200), longTasks: ltIn(openClick.t, openClick.t + 1500), loaf: loafIn(openClick.t, openClick.t + 1500).map((l) => [l.t - openClick.t, l.ms, l.blocking]) } : null,
    idleOpen: { reactDomCommitsPerSec: +(ci.length / sec).toFixed(1), compositesPerCommit: pct(ci.map((c) => c.n), 0.5), homeCommitsPerSec: +(named('Home') / sec).toFixed(1), songDetailCommitsPerSec: +(named('SongDetail') / sec).toFixed(1), liquidScrubberCommitsPerSec: +(named('LiquidScrubber') / sec).toFixed(1), getBoundingClientRectPerSec: +(gbIn(...idleOpen) / sec).toFixed(1), frames: win(...idleOpen), webglDrawFramesPerSec: draws(...idleOpen), longTasks: ltIn(...idleOpen), loafN: loafIn(...idleOpen).length, cpu: cpu.detail_open_idle || null, canvasWrapper: wrap.filter((w) => w.t < 10000).map((w) => [w.t, w.v]).slice(-3) },
    idleWall: { frames: win(0, 2000), webglDrawFramesPerSec: draws(0, 2000), reactDomCommitsPerSec: +(cIn(0, 2000).length / 2).toFixed(1), getBoundingClientRectPerSec: +(gbIn(0, 2000) / 2).toFixed(1), cpu: cpu.idle_wall || null },
    pausePlay: { interactions: interactions.filter((i) => i.t >= 9900 && i.t < 13000), commitsPerSecWhilePaused: +(cIn(10300, 12000).length / 1.7).toFixed(1), gbcrPerSecWhilePaused: +(gbIn(10300, 12000) / 1.7).toFixed(1) },
    scrub: { interactions: interactions.filter((i) => i.t >= 13900 && i.t < 20000), worstMs: Math.max(0, ...interactions.filter((i) => i.t >= 13900 && i.t < 20000).map((i) => i.ms)), frames: win(14000, 19000), longTasks: ltIn(14000, 20000), reactDomCommitsPerSec: +(cIn(14000, 17100).length / 3.1).toFixed(1), gbcrPerSec: +(gbIn(14000, 17100) / 3.1).toFixed(1) },
    next: { interaction: interactions.filter((i) => i.t >= 19900 && i.t < 21000), playCallsAfter: playCalls.filter((p) => p.t >= 20000 && p.t < 24000).length, drawerChangesAfter: drawer.filter((d) => d.t >= 20100 && d.t < 24000).length, commitsAfter1s: cIn(20100, 21100).length, wrapperChanges: wrap.filter((w) => w.t >= 20000 && w.t < 24000).length },
    drawerClose: closeClick ? { firstChangeAfterClickMs: closeAnim[0] ? closeAnim[0].t - closeClick.t : null, lastChangeAfterClickMs: closeAnim.length ? closeAnim.at(-1).t - closeClick.t : null, stateChanges: closeAnim.length, frames: win(closeClick.t, closeClick.t + 1200), longTasks: ltIn(closeClick.t, closeClick.t + 1500) } : null,
    trk06: { audioPlayCallsWhileOpen: playCalls.filter((p) => p.t > 2600 && p.t < 24000).map((p) => [p.t, p.file.slice(0, 28)]), distinctFilesWhileOpen: new Set(playCalls.filter((p) => p.t > 2600 && p.t < 24000).map((p) => p.file)).size },
    glOpen: T.glOpen, cpuSeg: cpu, interactionsWorst: interactions.sort((a, b) => b.ms - a.ms).slice(0, 5) });
}
fs.writeFileSync(path.join(OUT, 'S5_metrics.json'), JSON.stringify(res, null, 1));
for (const r of res) console.log(JSON.stringify(r).slice(0, 4500), '\n');
