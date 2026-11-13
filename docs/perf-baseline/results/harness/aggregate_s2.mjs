// Build markdown tables from S2_metrics.json. Usage: node aggregate_s2.mjs <OUT_DIR>
import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2];
const M = JSON.parse(fs.readFileSync(path.join(OUT, 'S2_metrics.json'), 'utf8')).map((m) => (m.foreignPointerEvents > 0 ? { ...m, id: m.id + ' ⚠ CONTAMINATED (real mouse input)' } : m));
const med = (a) => { const v = a.filter((x) => x != null && !Number.isNaN(x)); if (!v.length) return null; const s = [...v].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const f = (x) => (x == null ? '—' : x);
const lines = [];
const single = M.filter((m) => !m.sweep);
const group = (pred) => single.filter(pred);
const tbl = (title, rows) => {
  lines.push(`\n### ${title}\n`);
  lines.push('| Trial | Cache | play() result | src set | req start | 1st byte | loadeddata | canplay | play() call | 1st presented frame | dim 100% | preview layer visible | first visible motion | frozen visible (ms) | P frames | full src set | full 1st frame | full visible | content offset (s) | dual unmuted (ms) | max playing videos | rAF p95 / max (ms) | rAF >50 ms | LoAF n / max | long tasks n / max | leave: src removed / dim gone (ms) |');
  lines.push('|' + '---|'.repeat(26));
  for (const m of rows) { const h = m.handoff || {}; lines.push(`| ${m.id} | ${m.cacheState} | ${m.playOutcome} | ${f(m.previewSrcSetMs)} | ${f(m.previewReqStartMs)} | ${f(m.previewFirstByteMs)} | ${f(m.loadedDataMs)} | ${f(m.canplayMs)} | ${f(m.playCallMs)} | ${f(m.firstPresentedFrameMs)} | ${f(m.dimFullMs)} | ${f(m.previewLayerVisibleMs)} | ${f(m.firstVisibleMotionMs)} | ${f(m.frozenVisibleMs)} | ${m.previewFramesPresentedInDwell} | ${f(h.fullSrcSet)} | ${f(h.fullFirstPresented)} | ${f(h.fullVisible)} | ${f(h.contentOffsetSec)} | ${f(h.dualUnmutedPlayingMs)} | ${m.maxActivePlayingVideos} | ${f(m.rafDuringDwell.p95)} / ${f(m.rafDuringDwell.max)} | ${m.rafDuringDwell.over50} | ${m.longAnimationFrames.n} / ${m.longAnimationFrames.max} | ${m.longTasks.n} / ${m.longTasks.max} | ${f(m.leave?.srcRemovedMs)} / ${f(m.leave?.dimGoneMs)} |`); }
};
tbl('W — warm cache, no user activation (fresh page, never clicked)', group((m) => m.id.startsWith('W_')));
tbl('B — warm cache, after one activation click', group((m) => m.id.startsWith('B_')));
tbl('C — cold cache (cache cleared before each hover), after activation', group((m) => m.id.startsWith('C_')));
tbl('Recorded (screencast) and traced trials — overhead present, use for visuals only', group((m) => /^(REC|TRACE)_/.test(m.id)));

// medians by phase
const phases = { W: (m) => m.id.startsWith('W_'), B: (m) => m.id.startsWith('B_'), C: (m) => m.id.startsWith('C_') };
lines.push('\n### Medians by phase (single-card trials)\n');
lines.push('| Phase | n | play() resolved | play() rejected (NotAllowedError) | first presented frame (ms) | preview layer visible (ms) | first visible motion (ms) | frozen-visible trials | handoff reached | full first frame (ms) | dual unmuted overlap (ms) | max playing videos | rAF >50 ms per trial | LoAF per trial |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, p] of Object.entries(phases)) {
  const r = single.filter(p); if (!r.length) continue;
  lines.push(`| ${k} | ${r.length} | ${r.filter((m) => m.playResolvedMs != null).length} | ${r.filter((m) => m.playRejected === 'NotAllowedError').length} | ${f(med(r.map((m) => m.firstPresentedFrameMs)))} | ${f(med(r.map((m) => m.previewLayerVisibleMs)))} | ${f(med(r.map((m) => m.firstVisibleMotionMs)))} | ${r.filter((m) => m.frozenVisibleMs > 500).length} | ${r.filter((m) => m.handoff && m.handoff.fullFirstPresented != null).length} | ${f(med(r.map((m) => m.handoff?.fullFirstPresented)))} | ${f(med(r.filter((m) => m.handoff).map((m) => m.handoff.dualUnmutedPlayingMs)))} | ${f(med(r.map((m) => m.maxActivePlayingVideos)))} | ${f(med(r.map((m) => m.rafDuringDwell.over50)))} | ${f(med(r.map((m) => m.longAnimationFrames.n)))} |`);
}

// sweeps
lines.push('\n### Rapid switching (7 adjacent cards, 150 ms apart, then rest on card 7)\n');
lines.push('| Trial | cache | src assignments | preview files that presented a frame | video requests started / canceled | video bytes | play() rejections | last card: first visible motion after its enter (ms) | dim-without-picture before last card motion (ms) | /api prefetches |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const m of M.filter((x) => x.sweep)) { const s = m.sweepDetail; lines.push(`| ${m.id} | ${m.cold ? 'cold' : 'warm'} | ${s.srcAssignments.length} | ${s.previewFilesWithPresentedFrames.length} (${s.previewFilesWithPresentedFrames.join(', ')}) | ${s.videoRequestsStarted} / ${s.videoRequestsCanceled} | ${s.videoBytes} | ${s.playRejections.map((r) => r.name).join(', ') || '0'} | ${f(s.lastCardMotionAfterItsEnterMs)} | ${f(s.dimWithoutPictureMsBeforeLastCardMotion)} | ${s.apiPrefetches} |`); }

// handoff details
lines.push('\n### Preview → full handoff details (trials where the full video presented a frame)\n');
lines.push('| Trial | full src set | full loadedmetadata | seeking / seeked | full play() resolved | full 1st frame (mediaTime) | full visible | preview paused | preview mediaTime at switch | content offset (s) | gap last P → first F frame (ms) | full frame interval p50 / max, >84 ms count (first 1.5 s) | full mediaTime jumps | full `waiting` | rAF max / >50 ms around handoff | dual unmuted (ms) |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const m of M.filter((x) => x.handoff && x.handoff.fullFirstPresented != null)) { const h = m.handoff; lines.push(`| ${m.id} | ${f(h.fullSrcSet)} | ${f(h.fullLoadedMeta)} | ${f(h.fullSeeking)} / ${f(h.fullSeeked)} | ${f(h.fullPlayResolved)} | ${f(h.fullFirstPresented)} (${h.fullFirstMediaTime}) | ${f(h.fullVisible)} | ${f(h.previewPausedAt)} | ${f(h.previewMediaTimeAtSwitch)} | ${f(h.contentOffsetSec)} | ${f(h.gapLastPreviewToFirstFullMs)} | ${f(h.fullFrameIntervalsFirst1500ms.p50)} / ${f(h.fullFrameIntervalsFirst1500ms.max)}, ${h.fullFrameIntervalsFirst1500ms.over84ms} | ${h.fullMediaTimeJumpsFirst1500ms} | ${h.fullWaitingEvents} | ${f(h.rafAroundHandoff.max)} / ${h.rafAroundHandoff.over50} | ${f(h.dualUnmutedPlayingMs)} |`); }

// network per trial for video
lines.push('\n### Video network per trial\n');
lines.push('| Trial | file: requests / bytes / from-cache / canceled | /api/songs |');
lines.push('|---|---|---|');
for (const m of M) lines.push(`| ${m.id} | ${Object.entries(m.network.videoByFile).map(([k, v]) => `${k}: ${v.requests} / ${v.bytes} / ${v.fromCache} / ${v.canceled}`).join('<br>') || '—'} | ${m.network.api.map((a) => `${a.status ?? 'pending'} ${a.xVercelCache ?? ''} ${a.end != null ? a.end - a.start + ' ms' : 'not finished'}`).join('; ') || '—'} |`);

// decoders + GPU cpu
const dec = {}; for (const m of M) for (const d of Object.values(m.decoders || {})) { const k = `${d.kVideoDecoderName || '?'} platform=${d.kIsPlatformVideoDecoder || '?'} ${d.kResolution || ''}`; dec[k] = (dec[k] || 0) + 1; }
lines.push('\n### Decoders seen (Media domain = media-internals)\n'); for (const [k, v] of Object.entries(dec)) lines.push(`- ${k}: ${v} players`);
lines.push('\n### GPU-process CPU per trial (untraced trials only; % of one core over the trial)\n');
lines.push('| Phase | median | min | max |'); lines.push('|---|---|---|---|');
for (const [k, p] of Object.entries(phases)) { const v = M.filter((m) => p(m) && !m.traced).map((m) => m.gpuProcessCpuPct).filter((x) => x != null); if (v.length) lines.push(`| ${k} | ${med(v)} | ${Math.min(...v)} | ${Math.max(...v)} |`); }
lines.push(`\nForeign (non-scripted) pointer events across all trials: ${M.reduce((s, m) => s + m.foreignPointerEvents, 0)}`);
fs.writeFileSync(path.join(OUT, 'S2_tables.md'), lines.join('\n'));
console.log('tables written', M.length);
