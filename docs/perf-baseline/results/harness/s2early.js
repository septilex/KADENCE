/* KADENCE S2 instrumentation — read-only observers + passive wrappers around media APIs. Injected before page scripts. */
(() => {
  const L = { ev: [], fr: [], raf: [], smp: [], loaf: [], lt: [], ptr: [], lum: [] };
  window.__s2 = L;
  const now = () => performance.now();
  const r1 = (x) => Math.round(x * 10) / 10;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const fname = (el) => { try { return decodeURIComponent(String(el.currentSrc || el.getAttribute('src') || '').split('/').pop().split('?')[0]); } catch { return ''; } };
  const role = (el) => { const z = el && el.style && el.style.zIndex; if (z === '10') return 'P'; if (z === '20') return 'F'; return fname(el).includes('globe') ? 'G' : (el && el.tagName === 'AUDIO' ? 'A' : 'X'); };
  const log = (type, el, extra) => L.ev.push([r1(now()), type, el ? role(el) : null, el ? fname(el) : null, el ? el.readyState : null, el ? r3(el.currentTime || 0) : null, el ? (el.paused ? 1 : 0) : null, extra === undefined ? null : extra]);

  // --- passive wrappers (call through unchanged) ---
  const MP = HTMLMediaElement.prototype;
  const srcD = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, enumerable: srcD.enumerable, get() { return srcD.get.call(this); },
    set(v) { const r = srcD.set.call(this, v); log('srcSet', this, decodeURIComponent(String(v).split('/').pop())); return r; } });
  const rmAttr = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (n) { const was = this instanceof HTMLMediaElement && n === 'src' ? fname(this) : null; const r = rmAttr.call(this, n); if (was !== null) log('srcRemoved', this, was); return r; };
  const load = MP.load; MP.load = function () { log('load()', this); return load.call(this); };
  const pause = MP.pause; MP.pause = function () { log('pause()', this); return pause.call(this); };
  const play = MP.play;
  MP.play = function () {
    const el = this; log('play()', el, { muted: el.muted, volume: el.volume, activation: navigator.userActivation ? navigator.userActivation.hasBeenActive : null });
    const p = play.call(el);
    if (p && p.then) p.then(() => log('play:resolved', el), (e) => log('play:rejected', el, e && e.name));
    return p;
  };

  // --- media events (capture phase on document) ---
  for (const t of ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'play', 'playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'emptied', 'abort', 'error', 'suspend', 'ended']) {
    document.addEventListener(t, (e) => {
      const el = e.target; if (!(el instanceof HTMLMediaElement)) return;
      const ro = role(el);
      if (ro === 'G' && !['loadstart', 'playing', 'pause', 'waiting', 'stalled', 'error'].includes(t)) return; // keep globe log small
      log(t, el, t === 'error' && el.error ? el.error.code : null);
      if (t === 'loadstart' && (ro === 'P' || ro === 'F')) startRVFC(el);
    }, true);
  }

  // --- presented frames via requestVideoFrameCallback ---
  const tok = new WeakMap();
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; const cx = cv.getContext('2d', { willReadFrequently: true });
  const lum = (el, tag) => { try { cx.drawImage(el, 0, 0, 16, 16); const d = cx.getImageData(0, 0, 16, 16).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; L.lum.push([r1(now()), role(el), fname(el), tag, Math.round(s / 256)]); } catch (e) { L.lum.push([r1(now()), role(el), fname(el), tag, 'err:' + e.name]); } };
  function startRVFC(el) {
    if (!el.requestVideoFrameCallback) return;
    const k = (tok.get(el) || 0) + 1; tok.set(el, k); let n = 0;
    const cb = (t, md) => {
      if (tok.get(el) !== k) return;
      L.fr.push([r1(now()), role(el), r3(md.mediaTime), md.presentedFrames, r1(md.expectedDisplayTime), r1(t), fname(el)]);
      n++; // (luminance readback removed: it caused a ~60 ms sync GPU readback long task)
      el.requestVideoFrameCallback(cb);
    };
    el.requestVideoFrameCallback(cb);
  }

  // --- per-frame sampler: rAF interval + visibility/playback state ---
  let P = null, F = null, C = null, G = null, last = 0;
  const find = () => { for (const v of document.querySelectorAll('video')) { const ro = role(v); if (ro === 'P') P = v; else if (ro === 'F') F = v; else if (ro === 'G') G = v; } C = P ? P.parentElement : null; };
  const op = (el) => (el ? +getComputedStyle(el).opacity : null);
  const tick = (ts) => {
    if (last) L.raf.push([r1(ts), r1(ts - last)]);
    last = ts;
    if (!P || !F || !G || !P.isConnected) find();
    if (P && F && C) {
      let active = 0; for (const v of document.querySelectorAll('video')) if (!v.paused && v.readyState >= 2 && v.currentSrc) active++;
      L.smp.push([r1(ts), +op(C).toFixed(3), +op(P).toFixed(3), +op(F).toFixed(3), P.paused ? 1 : 0, r3(P.currentTime), P.readyState, F.paused ? 1 : 0, r3(F.currentTime), F.readyState, G ? (G.paused ? 1 : 0) : null, G ? r3(G.currentTime) : null, active, P.muted ? 1 : 0, F.muted ? 1 : 0]);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // --- long frames / long tasks ---
  const strip = (u) => String(u || '').split('?')[0].split('/').pop();
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.loaf.push([r1(e.startTime), Math.round(e.duration), Math.round(e.blockingDuration || 0), Math.round(e.startTime + e.duration - e.styleAndLayoutStart), (e.scripts || []).slice(0, 3).map((s) => [Math.round(s.duration), s.invoker, s.sourceFunctionName, strip(s.sourceURL), Math.round(s.forcedStyleAndLayoutDuration || 0)])]); }).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.lt.push([r1(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}

  // --- pointer events (which card, trusted?) ---
  const key = (t) => { const c = t && t.closest ? t.closest('.kadence-3d-pop, .kadence-dev-cue-pop, [class*="kadence-collection"], [class*="kadence-creator"]') : null; const idEl = c ? c.querySelector('[id^="vibe-"], #explore-dev-universe-btn') : null; return idEl ? idEl.id : (t && t.id) || (t && t.tagName) || null; };
  for (const t of ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'click', 'wheel']) document.addEventListener(t, (e) => L.ptr.push([r1(now()), t, key(e.target), e.isTrusted ? 1 : 0, Math.round(e.clientX), Math.round(e.clientY)]), true);
  let moves = 0; document.addEventListener('pointermove', (e) => { moves++; if (moves % 10 === 1) L.ptr.push([r1(now()), 'pointermove#' + moves, key(e.target), e.isTrusted ? 1 : 0, Math.round(e.clientX), Math.round(e.clientY)]); }, true);

  L.reset = () => { for (const k of ['ev', 'fr', 'raf', 'smp', 'loaf', 'lt', 'ptr', 'lum']) L[k].length = 0; return { timeOrigin: performance.timeOrigin, now: now() }; };
  L.dump = () => JSON.stringify({ timeOrigin: performance.timeOrigin, now: now(), activation: navigator.userActivation ? navigator.userActivation.hasBeenActive : null, ev: L.ev, fr: L.fr, raf: L.raf, smp: L.smp, loaf: L.loaf, lt: L.lt, ptr: L.ptr, lum: L.lum,
    smpFields: 't,containerOp,previewOp,fullOp,pPaused,pTime,pReady,fPaused,fTime,fReady,gPaused,gTime,activePlaying,pMuted,fMuted', evFields: 't,type,role,file,readyState,currentTime,paused,extra', frFields: 't,role,mediaTime,presentedFrames,expectedDisplayTime,rvfcNow,file' });
})();
