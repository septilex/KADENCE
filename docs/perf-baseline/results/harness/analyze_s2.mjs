// Analyse S2 raw trials -> per-trial metrics JSON + CSV. Usage: node analyze_s2.mjs <OUT_DIR>
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2]; const RAW = path.join(OUT, 'raw');
const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.json')).sort();
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
const R = (x) => (x == null ? null : Math.round(x));
const VIBE_FILE = { 'global-top-50': 'Beat It', 'viral-50': 'Radhimaa', 'new-music-friday': 'Alaakaa Loova', 'hip-hop-central': 'Loser', 'pop-rising': 'Kiss Kiss Bang Bang', 'dance-hits': 'Yeshanagula', 'mood-booster': 'Sunflower', 'late-night': 'One Of The Girls', workout: 'Big Dawgs', 'chill-hits': 'Pavazha Malli', 'top-telugu': "Baby Won't You Tell Me", 'top-tamil': 'Monica', 'top-hindi': 'Gehra Hua', 'top-kpop': 'Dynamite', 'dev-special': 'God Mode' };
const vibeOf = (t) => (t === 'cue' || t === 'cc' ? 'dev-special' : t);
const idOf = (t) => (t === 'cue' ? 'explore-dev-universe-btn' : t === 'cc' ? 'vibe-dev-special' : 'vibe-' + t);

const out = [];
for (const f of files) {
  const T = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  const P = T.page; const to = P.timeOrigin; const W = (t) => to + t; // page ms -> wall ms
  const ev = P.ev.map((e) => ({ w: W(e[0]), type: e[1], role: e[2], file: e[3], rs: e[4], ct: e[5], paused: e[6], x: e[7] }));
  const fr = P.fr.map((e) => ({ w: W(e[0]), role: e[1], mt: e[2], pf: e[3], file: e[6] }));
  const smp = P.smp.map((e) => ({ w: W(e[0]), c: e[1], p: e[2], f: e[3], pP: e[4], pT: e[5], pR: e[6], fP: e[7], fT: e[8], fR: e[9], gP: e[10], gT: e[11], act: e[12], pM: e[13], fM: e[14] }));
  const raf = P.raf.map((e) => ({ w: W(e[0]), d: e[1] }));
  const ptr = P.ptr.map((e) => ({ w: W(e[0]), type: e[1], key: e[2], trusted: e[3], x: e[4], y: e[5] }));
  const enters = T.actions.filter((a) => a.action === 'enter'); const leave = T.actions.find((a) => a.action === 'leave');
  const isSweep = enters.length > 1;
  const lastTarget = enters[enters.length - 1].target; const vibe = vibeOf(lastTarget); const stem = VIBE_FILE[vibe];
  // page-side pointer enter for each target
  const enterPage = enters.map((a) => { const p = ptr.find((x) => x.type === 'pointerover' && x.key === idOf(a.target) && x.w >= a.wall - 50); return p ? p.w : null; });
  const T0 = enterPage[enterPage.length - 1] ?? enters[enters.length - 1].wall; // reference: (last) pointer enter in page
  const rel = (w) => (w == null ? null : R(w - T0));
  const afterT0 = (x) => x.w >= T0 - 5;
  const isP = (x) => x.role === 'P' && x.file && x.file.startsWith(stem + '_preview');
  const isF = (x) => x.role === 'F' && x.file && x.file.startsWith(stem + '_30s');
  const firstEv = (type, pred) => ev.find((e) => e.type === type && afterT0(e) && pred(e));
  const leaveW = leave ? leave.wall : null; const leavePage = leave ? (ptr.find((x) => x.type === 'pointerout' && x.w >= leave.wall - 50) || {}).w ?? leave.wall : null;
  const inDwell = (x) => x.w >= T0 && (leavePage == null || x.w < leavePage);

  // ---- preview path ----
  const srcP = firstEv('srcSet', (e) => e.role === 'P' && e.x && e.x.startsWith(stem + '_preview'));
  const pFile = srcP ? srcP.x : null;
  const evP = (type) => (pFile ? ev.find((e) => e.type === type && e.role === 'P' && e.file === pFile && e.w >= (srcP ? srcP.w : T0)) : null);
  const playCallP = evP('play()'); const resP = evP('play:resolved'); const rejP = evP('play:rejected');
  const frP = fr.filter((x) => x.role === 'P' && x.file === pFile && x.w >= T0);
  const firstFrP = frP[0];
  const dimStart = smp.find((x) => afterT0(x) && x.c > 0.05); const dimFull = smp.find((x) => afterT0(x) && x.c >= 0.99);
  const pVisible = smp.find((x) => afterT0(x) && inDwell(x) && x.p >= 0.5 && x.c >= 0.5);
  const motion = pVisible ? frP.find((x, i) => i > 0 && x.w >= pVisible.w && x.mt > frP[0].mt) : null;
  // frozen frame: preview layer visible (>=0.5) while paused and full not covering
  let frozenMs = 0; for (let i = 1; i < smp.length; i++) { const a = smp[i - 1]; if (inDwell(a) && a.p >= 0.5 && a.c >= 0.5 && a.pP === 1 && a.f < 0.5) frozenMs += smp[i].w - a.w; }
  const visibleDwellMs = smp.filter(inDwell).reduce((s, a, i, arr) => (i && arr[i - 1].p >= 0.5 && arr[i - 1].c >= 0.5 ? s + (a.w - arr[i - 1].w) : s), 0);
  const pFramesInDwell = frP.filter(inDwell);
  const pMediaAdvance = pFramesInDwell.length ? +(Math.max(...pFramesInDwell.map((x) => x.mt)) - Math.min(...pFramesInDwell.map((x) => x.mt))).toFixed(2) : 0;
  const lumP = P.lum.find((l) => l[1] === 'P' && l[2] === pFile && W(l[0]) >= T0);

  // ---- full / handoff ----
  const srcF = firstEv('srcSet', (e) => e.role === 'F' && e.x && e.x.startsWith(stem + '_30s'));
  const fFile = srcF ? srcF.x : null;
  const evF = (type) => (fFile ? ev.find((e) => e.type === type && e.role === 'F' && e.file === fFile && e.w >= srcF.w) : null);
  const frFall = fr.filter((x) => x.role === 'F' && x.file === fFile && x.w >= T0);
  const fStart = fFile ? (evF('play:resolved') || evF('playing')) : null; // full playback actually started
  const frF = fStart ? frFall.filter((x) => x.w >= fStart.w - 1) : [];   // frames presented while full is playing
  const seekFrameF = frFall.find((x) => !fStart || x.w < fStart.w - 1) || null; // frame presented after the paused seek (layer still invisible)
  const firstFrF = frF[0];
  const fVisible = smp.find((x) => afterT0(x) && inDwell(x) && x.f >= 0.5 && x.c >= 0.5);
  let handoff = null;
  if (srcF && !firstFrF) {
    handoff = { reached: false, fullSrcSet: rel(srcF.w), fullLoadedMeta: rel(evF('loadedmetadata')?.w), fullSeeking: rel(evF('seeking')?.w), fullSeeked: rel(evF('seeked')?.w), fullSeekFramePresented: rel(seekFrameF?.w), fullPlayCall: rel(evF('play()')?.w), fullWaitingEvents: ev.filter((e) => e.type === 'waiting' && e.role === 'F' && e.file === fFile).length,
      fullBytesDuringDwell: T.network.filter((r) => r.url.includes('/videos/') && decodeURIComponent(r.url.split('/').pop()) === fFile).reduce((s, r) => s + (r.encodedDataLength ?? r.bytesRx ?? 0), 0), fullFromCache: T.network.some((r) => r.url.includes('/videos/') && decodeURIComponent(r.url.split('/').pop()) === fFile && (r.fromDiskCache || r.servedFromCache)) };
  }
  if (firstFrF) {
    const lastPBefore = [...frP].filter((x) => x.w <= firstFrF.w).pop();
    const fInt = []; const fWin = frF.filter((x) => x.w <= firstFrF.w + 1500); for (let i = 1; i < fWin.length; i++) fInt.push(R(fWin[i].w - fWin[i - 1].w));
    const fMt = frF.filter((x) => x.w <= firstFrF.w + 1500).map((x) => x.mt);
    let mtJumps = 0; for (let i = 1; i < fMt.length; i++) if (fMt[i] - fMt[i - 1] > 0.2 || fMt[i] < fMt[i - 1]) mtJumps++;
    const rafWin = raf.filter((x) => x.w >= firstFrF.w - 500 && x.w <= firstFrF.w + 1000).map((x) => x.d);
    let overlapMs = 0; for (let i = 1; i < smp.length; i++) { const a = smp[i - 1]; if (inDwell(a) && a.pP === 0 && a.fP === 0 && a.pM === 0 && a.fM === 0) overlapMs += smp[i].w - a.w; }
    const pPausedAfter = ev.find((e) => e.type === 'pause()' && e.role === 'P' && e.w >= firstFrF.w);
    handoff = {
      reached: true, fullSeekFramePresented: rel(seekFrameF?.w),
      fullSrcSet: rel(srcF.w), fullLoadedMeta: rel(evF('loadedmetadata')?.w), fullSeeking: rel(evF('seeking')?.w), fullSeeked: rel(evF('seeked')?.w),
      fullPlayCall: rel(evF('play()')?.w), fullPlayResolved: rel(evF('play:resolved')?.w), fullPlayRejected: evF('play:rejected')?.x || null, fullPlaying: rel(evF('playing')?.w),
      fullFirstPresented: rel(firstFrF.w), fullFirstMediaTime: firstFrF.mt, fullVisible: rel(fVisible?.w), previewPausedAt: rel(pPausedAfter?.w),
      previewMediaTimeAtSwitch: lastPBefore ? lastPBefore.mt : null, contentOffsetSec: lastPBefore ? +(firstFrF.mt - lastPBefore.mt).toFixed(3) : null,
      gapLastPreviewToFirstFullMs: lastPBefore ? R(firstFrF.w - lastPBefore.w) : null,
      fullFrameIntervalsFirst1500ms: { n: fInt.length, p50: pct(fInt, 0.5), max: fInt.length ? Math.max(...fInt) : null, over84ms: fInt.filter((x) => x > 84).length },
      fullMediaTimeJumpsFirst1500ms: mtJumps, fullWaitingEvents: ev.filter((e) => e.type === 'waiting' && e.role === 'F' && e.file === fFile).length,
      rafAroundHandoff: { n: rafWin.length, max: rafWin.length ? Math.max(...rafWin) : null, over20: rafWin.filter((x) => x > 20).length, over50: rafWin.filter((x) => x > 50).length },
      dualUnmutedPlayingMs: R(overlapMs), handoffDelayFromPreviewMotionMs: motion ? R(firstFrF.w - motion.w) : null,
    };
  }

  // ---- network ----
  const vreq = T.network.filter((r) => r.url.includes('/videos/')).map((r) => ({ file: decodeURIComponent(r.url.split('/').pop()), start: rel(r.wall0), firstByte: rel(r.firstByteWall), end: rel(r.endWall), status: r.status ?? null, range: r.range, contentRange: r.contentRange, fromDiskCache: !!r.fromDiskCache, servedFromCache: !!r.servedFromCache, bytes: r.encodedDataLength ?? r.bytesRx ?? 0, canceled: !!r.canceled, failed: r.failed || null }));
  const byFile = {}; for (const r of vreq) { const k = r.file; byFile[k] = byFile[k] || { requests: 0, bytes: 0, fromCache: 0, canceled: 0, firstStart: r.start, firstByte: r.firstByte }; const b = byFile[k]; b.requests++; b.bytes += r.bytes; if (r.fromDiskCache || r.servedFromCache) b.fromCache++; if (r.canceled || r.failed) b.canceled++; }
  const api = T.network.filter((r) => r.url.includes('/api/')).map((r) => ({ path: r.url.replace(/^https?:\/\/[^/]+/, ''), start: rel(r.wall0), end: rel(r.endWall), status: r.status ?? null, bytes: r.encodedDataLength ?? 0, xVercelCache: r.xVercelCache }));
  const art = T.network.filter((r) => /mzstatic|scdn/.test(r.url));
  const pReq = vreq.find((r) => r.file === pFile);
  const cacheState = pReq ? (pReq.fromDiskCache || pReq.servedFromCache ? 'warm(disk-cache)' : 'network') : 'no-request';

  // ---- frames / long tasks during dwell ----
  const dwellRaf = raf.filter(inDwell).map((x) => x.d);
  const loaf = P.loaf.map((e) => ({ w: W(e[0]), ms: e[1], blocking: e[2], styleLayout: e[3], scripts: e[4] })).filter((x) => x.w >= T0 - 100 && (leavePage == null || x.w < leavePage + 3000));
  const lt = P.lt.map((e) => ({ w: W(e[0]), ms: e[1] })).filter((x) => x.w >= T0 - 100 && (leavePage == null || x.w < leavePage + 3000));
  const actMax = Math.max(0, ...smp.filter(inDwell).map((x) => x.act));

  // ---- leave ----
  let leaveM = null;
  if (leavePage) {
    const L0 = leavePage; const relL = (w) => (w == null ? null : R(w - L0));
    const rm = ev.find((e) => e.type === 'srcRemoved' && e.role === 'P' && e.w >= L0);
    const dimGone = smp.find((x) => x.w >= L0 && x.c <= 0.05);
    const after = smp.filter((x) => x.w >= L0 + 1000);
    const lastS = smp[smp.length - 1];
    const vAfter = T.network.filter((r) => r.url.includes('/videos/') && r.wall0 < L0 && (!r.endWall || r.endWall > L0));
    leaveM = { srcRemovedMs: relL(rm?.w), dimGoneMs: relL(dimGone?.w), stillPlayingAt1s: after.length ? after[0].pP === 0 || after[0].fP === 0 : null, endState: lastS ? { containerOp: lastS.c, previewPaused: lastS.pP, fullPaused: lastS.fP, globePaused: lastS.gP, activePlaying: lastS.act } : null,
      videoRequestsInFlightAtLeave: vAfter.map((r) => ({ file: decodeURIComponent(r.url.split('/').pop()), endAfterLeaveMs: r.endWall ? R(r.endWall - L0) : null, canceled: !!r.canceled, failed: r.failed || null, bytes: r.encodedDataLength ?? r.bytesRx ?? 0 })) };
  }

  // ---- sweep specifics ----
  let sweep = null;
  if (isSweep) {
    const firstW = enterPage[0] ?? enters[0].wall;
    const srcSets = ev.filter((e) => e.type === 'srcSet' && e.w >= firstW - 5).map((e) => ({ t: R(e.w - firstW), role: e.role, file: e.x }));
    const presentedFiles = [...new Set(fr.filter((x) => x.w >= firstW && x.role === 'P').map((x) => x.file))];
    const rej = ev.filter((e) => e.type === 'play:rejected' && e.w >= firstW).map((e) => ({ t: R(e.w - firstW), role: e.role, file: e.file, name: e.x }));
    // dim profile during sweep: fraction of time container >= .5 before last card shows motion
    const endW = motion ? motion.w : (leavePage ?? firstW + 3000);
    const win = smp.filter((x) => x.w >= firstW && x.w <= endW);
    let dimMs = 0, darkGapMs = 0; for (let i = 1; i < win.length; i++) { const a = win[i - 1], d = win[i].w - a.w; if (a.c >= 0.5) dimMs += d; if (a.c >= 0.5 && a.p < 0.5 && a.f < 0.5) darkGapMs += d; }
    sweep = { cards: enters.map((a, i) => ({ target: a.target, enterMs: enterPage[i] ? R(enterPage[i] - firstW) : null })), srcAssignments: srcSets, previewFilesWithPresentedFrames: presentedFiles, playRejections: rej,
      videoRequestsStarted: vreq.length, videoRequestsCanceled: vreq.filter((r) => r.canceled || r.failed).length, videoBytes: vreq.reduce((s, r) => s + r.bytes, 0),
      lastCardMotionAfterItsEnterMs: motion ? R(motion.w - T0) : null, dimWithoutPictureMsBeforeLastCardMotion: R(darkGapMs), apiPrefetches: api.length };
  }

  const media = T.media || [];
  const props = media.filter((m) => m.m === 'Media.playerPropertiesChanged').flatMap((m) => m.p.properties.map((p) => [m.p.playerId, p.name, p.value]));
  const decoders = {}; for (const [pid, n, v] of props) if (/kVideoDecoderName|kIsPlatformVideoDecoder|kFrameUrl|kResolution|kAudioDecoderName|kIsVideoDecryptingDemuxerStream/.test(n)) { decoders[pid] = decoders[pid] || {}; decoders[pid][n] = v; }
  const mediaErrors = media.filter((m) => m.m === 'Media.playerErrorsRaised').length;
  const gpuCpu = T.cpu ? T.cpu.filter((c) => c.type === 'GPU').reduce((s, c) => s + c.cpuSec, 0) : null;
  const trialSec = T.actions.length && leave ? (leave.wall - T.actions[0].wall) / 1000 + (T.spec.leaveMs || 0) / 1000 : null;

  const handedOff = handoff && handoff.reached && handoff.fullVisible != null;
  const fullMotion = handedOff ? frF.filter(inDwell).length : 0;
  const playOutcome = !srcP ? 'no-preview-src' : rejP ? 'rejected:' + rejP.x : resP ? (handedOff ? (fullMotion >= 20 ? 'playing→handoff-to-full (full playing)' : 'playing→handoff-to-full (full not advancing)') : (pMediaAdvance >= 1 && pFramesInDwell.length >= 20 ? 'playing-visible-motion' : 'resolved-but-no-motion')) : playCallP ? 'play()-pending' : 'no-play()-call';
  out.push({
    id: T.id, phase: T.phase, target: lastTarget, vibe, sweep: !!isSweep, cold: !!T.spec.cold, recorded: !!T.spec.record, traced: !!T.spec.trace, activation: P.activation, cacheState,
    inputDeliveryMs: enterPage[enterPage.length - 1] != null ? R(enterPage[enterPage.length - 1] - enters[enters.length - 1].wall) : null,
    previewFile: pFile, previewSrcSetMs: rel(srcP?.w), previewReqStartMs: pReq ? pReq.start : null, previewFirstByteMs: pReq ? pReq.firstByte : null, previewReqStatus: pReq ? pReq.status : null,
    dimStartMs: rel(dimStart?.w), dimFullMs: rel(dimFull?.w), loadedMetadataMs: rel(evP('loadedmetadata')?.w), loadedDataMs: rel(evP('loadeddata')?.w), canplayMs: rel(evP('canplay')?.w),
    playCallMs: rel(playCallP?.w), playCallMuted: playCallP?.x?.muted ?? null, playCallActivation: playCallP?.x?.activation ?? null, playResolvedMs: rel(resP?.w), playRejected: rejP?.x || null, playingEventMs: rel(evP('playing')?.w),
    firstPresentedFrameMs: rel(firstFrP?.w), firstPresentedLuma: lumP ? lumP[4] : null, previewLayerVisibleMs: rel(pVisible?.w), firstVisibleMotionMs: rel(motion?.w),
    previewFramesPresentedInDwell: pFramesInDwell.length, previewMediaAdvanceSec: pMediaAdvance, frozenVisibleMs: R(frozenMs), previewVisibleMs: R(visibleDwellMs), playOutcome,
    handoff, maxActivePlayingVideos: actMax,
    rafDuringDwell: { n: dwellRaf.length, p50: pct(dwellRaf, 0.5), p95: pct(dwellRaf, 0.95), p99: pct(dwellRaf, 0.99), max: dwellRaf.length ? Math.max(...dwellRaf) : null, over20: dwellRaf.filter((x) => x > 20).length, over50: dwellRaf.filter((x) => x > 50).length },
    longAnimationFrames: { n: loaf.length, max: loaf.length ? Math.max(...loaf.map((x) => x.ms)) : 0, blockingTotal: loaf.reduce((s, x) => s + x.blocking, 0), top: loaf.sort((a, b) => b.ms - a.ms).slice(0, 3).map((x) => ({ at: rel(x.w), ms: x.ms, blocking: x.blocking, styleLayout: x.styleLayout, scripts: x.scripts })) },
    longTasks: { n: lt.length, max: lt.length ? Math.max(...lt.map((x) => x.ms)) : 0, list: lt.map((x) => [rel(x.w), x.ms]) },
    network: { videoByFile: byFile, videoRequests: vreq, api, artworkRequests: art.length },
    leave: leaveM, sweepDetail: sweep, decoders, mediaErrors, gpuProcessCpuSec: gpuCpu, gpuProcessCpuPct: gpuCpu != null && trialSec ? +((gpuCpu / trialSec) * 100).toFixed(1) : null,
    foreignPointerEvents: ptr.filter((x) => x.trusted && !T.actions.some((a) => Math.abs(a.x - x.x) <= 2 && Math.abs(a.y - x.y) <= 2) && !x.type.startsWith('pointermove')).length,
  });
}
fs.writeFileSync(path.join(OUT, 'S2_metrics.json'), JSON.stringify(out, null, 1));
const cols = ['id', 'cold', 'activation', 'cacheState', 'previewSrcSetMs', 'previewReqStartMs', 'previewFirstByteMs', 'dimStartMs', 'dimFullMs', 'loadedDataMs', 'canplayMs', 'playCallMs', 'playResolvedMs', 'playRejected', 'firstPresentedFrameMs', 'previewLayerVisibleMs', 'firstVisibleMotionMs', 'frozenVisibleMs', 'playOutcome', 'maxActivePlayingVideos'];
const hcols = ['fullSrcSet', 'fullSeeked', 'fullPlayResolved', 'fullFirstPresented', 'fullVisible', 'previewMediaTimeAtSwitch', 'contentOffsetSec', 'dualUnmutedPlayingMs', 'handoffDelayFromPreviewMotionMs'];
const csv = [[...cols, ...hcols.map((h) => 'handoff.' + h), 'raf.p95', 'raf.max', 'raf.over50', 'loaf.n', 'loaf.max', 'longtasks.n', 'leave.srcRemovedMs', 'leave.dimGoneMs'].join(',')];
for (const o of out) csv.push([...cols.map((c) => JSON.stringify(o[c] ?? '')), ...hcols.map((h) => JSON.stringify(o.handoff ? o.handoff[h] ?? '' : '')), o.rafDuringDwell.p95, o.rafDuringDwell.max, o.rafDuringDwell.over50, o.longAnimationFrames.n, o.longAnimationFrames.max, o.longTasks.n, o.leave?.srcRemovedMs ?? '', o.leave?.dimGoneMs ?? ''].join(','));
fs.writeFileSync(path.join(OUT, 'S2_metrics.csv'), csv.join('\n'));
console.log('analysed', out.length, 'trials');
