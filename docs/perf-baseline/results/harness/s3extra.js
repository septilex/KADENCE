/* KADENCE S3 extra instrumentation (chart entry) — read-only pass-through wrappers. Injected before page scripts, after s2early.js. */
(() => {
  const X = { up: [], img: [], frames: [], canvasOp: [], audioNew: [] };
  window.__s3 = X;
  const now = () => performance.now(); const r1 = (x) => Math.round(x * 10) / 10;
  // --- WebGL texture uploads + draw calls ---
  let drawsThisFrame = 0, drawCalls = 0;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const P = C.prototype;
    for (const n of ['texImage2D', 'texSubImage2D']) {
      const o = P[n]; if (typeof o !== 'function') continue;
      P[n] = function (...a) {
        const src = a.find((x) => x && typeof x === 'object' && typeof x.width === 'number' && typeof x.height === 'number');
        const w = src ? src.width : (typeof a[3] === 'number' ? a[3] : 0), h = src ? src.height : (typeof a[4] === 'number' ? a[4] : 0);
        const t = now(); const r = o.apply(this, a); const d = now() - t;
        if (w * h >= 1024 * 1024) X.up.push([r1(t), n, w, h, +d.toFixed(2)]);
        return r;
      };
    }
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const o = P[n]; if (typeof o !== 'function') continue;
      P[n] = function (...a) { drawsThisFrame++; drawCalls++; return o.apply(this, a); };
    }
  }
  // --- artwork image loads (new Image(); img.src = mzstatic/scdn) ---
  const IP = HTMLImageElement.prototype; const d = Object.getOwnPropertyDescriptor(IP, 'src');
  Object.defineProperty(IP, 'src', { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); },
    set(v) {
      const s = String(v);
      if (/mzstatic|scdn/.test(s)) {
        const rec = [r1(now()), s.replace(/^https?:\/\//, '').slice(0, 160), null, null];
        X.img.push(rec);
        this.addEventListener('load', () => { rec[2] = r1(now()); }, { once: true });
        this.addEventListener('error', () => { rec[3] = r1(now()); }, { once: true });
      }
      return d.set.call(this, v);
    } });
  // --- Audio constructor count ---
  const NA = window.Audio; X.audioEv = []; let audN = 0;
  const audName = (el) => String(el.currentSrc || el.src || '').split('/').pop().split('?')[0].slice(0, 60);
  window.Audio = new Proxy(NA, { construct(t, a) {
    const el = Reflect.construct(t, a); const id = audN++;
    X.audioNew.push([r1(now()), String(a[0] || '').split('/').pop().split('?')[0].slice(0, 60), id]);
    // detached Audio() elements do not propagate events to document: listen on the instance
    for (const e of ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'playing', 'pause', 'waiting', 'stalled', 'error', 'abort', 'emptied'])
      el.addEventListener(e, () => X.audioEv.push([r1(now()), id, e, audName(el), el.paused ? 1 : 0, +el.volume.toFixed(2), +el.currentTime.toFixed(2)]));
    return el; } });
  // --- per frame: draws in this frame + canvas effective opacity ---
  let lastOp = -1; X.dom = []; let lastDom = '';
  const effOp = (el) => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const v = +getComputedStyle(e).opacity; o *= v; if (o === 0) break; } return +o.toFixed(3); };
  const tick = (ts) => {
    X.frames.push([r1(ts), drawsThisFrame]); drawsThisFrame = 0;
    const c = document.querySelector('canvas');
    if (c) { const o = effOp(c); if (o !== lastOp) { X.canvasOp.push([r1(ts), o, c.width, c.height]); lastOp = o; } }
    const ld = document.querySelector('.animate-slowOrbit'); const loaderOp = ld ? effOp(ld) : 0;
    const dom = `${ld ? 1 : 0}|${loaderOp >= 0.5 ? 1 : 0}|${document.querySelector('[id^="vibe-"]') ? 1 : 0}`;
    if (dom !== lastDom) { X.dom.push([r1(ts), ...dom.split('|').map(Number)]); lastDom = dom; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  X.reset = () => { for (const k of ['up', 'img', 'frames', 'canvasOp', 'audioNew', 'audioEv', 'dom']) X[k].length = 0; lastOp = -1; lastDom = ''; return now(); };
  X.dump = () => JSON.stringify({ up: X.up, img: X.img, frames: X.frames, canvasOp: X.canvasOp, audioNew: X.audioNew, audioEv: X.audioEv, dom: X.dom, drawCalls,
    audioEvFields: 't,id,event,file,paused,volume,currentTime', domFields: 't,loaderPresent,loaderVisible,introCardsPresent',
    upFields: 't,fn,w,h,ms', imgFields: 'tSrcSet,url,tLoad,tError', framesFields: 't,drawsInFrame', canvasOpFields: 't,effectiveOpacity,w,h' });
})();
