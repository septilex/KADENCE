/* KADENCE S5 extra instrumentation (Song Detail) — read-only. Injected after s2early/s3extra/s4extra.
   - Event Timing (interaction latency: input delay / processing / presentation)
   - getBoundingClientRect call counter (100 ms buckets) — CF-31 forced-layout source
   - Song Detail drawer state per frame (transform/opacity changes) — drawer open/close animation, CF-30
   - CinematicBackground / canvas wrapper filter changes */
(() => {
  const Z = { evt: [], gbcr: [], drawer: [], wrap: [] };
  window.__s5 = Z;
  const now = () => performance.now(); const r1 = (x) => Math.round(x * 10) / 10;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) Z.evt.push([r1(e.startTime), e.name, Math.round(e.duration), Math.round(e.processingStart - e.startTime), Math.round(e.processingEnd - e.processingStart), Math.round(e.startTime + e.duration - e.processingEnd), e.interactionId || 0, e.target && e.target.closest ? (e.target.closest('[title]') || {}).title || e.target.tagName : null]); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch {}
  const G = Element.prototype.getBoundingClientRect; let bucket = -1, cnt = 0;
  Element.prototype.getBoundingClientRect = function () { const b = Math.floor(now() / 100); if (b !== bucket) { if (bucket >= 0 && cnt) Z.gbcr.push([bucket * 100, cnt]); bucket = b; cnt = 0; } cnt++; return G.call(this); };
  let lastD = '', lastW = '';
  const tick = (ts) => {
    const d = document.querySelector('.fixed.left-4.top-4.bottom-4');
    let s = 'none';
    if (d) { const cs = getComputedStyle(d); s = `${cs.transform}|${(+cs.opacity).toFixed(3)}|${Math.round(d.getBoundingClientRect.call ? G.call(d).left : 0)}`; }
    if (s !== lastD) { Z.drawer.push([r1(ts), s]); lastD = s; }
    const c = document.querySelector('canvas'); let w = c; for (let i = 0; w && i < 8 && !(w.style && w.style.filter); i++) w = w.parentElement; // the motion.div wrapper animating filter (page.tsx:336-343)
    if (w) { const cs = getComputedStyle(w); const v = `${(+cs.opacity).toFixed(2)}|${cs.filter}`; if (v !== lastW) { Z.wrap.push([r1(ts), v]); lastW = v; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  Z.reset = () => { for (const k of ['evt', 'gbcr', 'drawer', 'wrap']) Z[k].length = 0; lastD = ''; lastW = ''; return now(); };
  Z.dump = () => { if (cnt) Z.gbcr.push([bucket * 100, cnt]); cnt = 0; return JSON.stringify({ evt: Z.evt, gbcr: Z.gbcr, drawer: Z.drawer, wrap: Z.wrap, evtFields: 't,type,duration,inputDelay,processing,presentation,interactionId,targetTitle', gbcrFields: 'bucketStartMs,calls', drawerFields: 't,transform|opacity|left', wrapFields: 't,opacity|filter (canvas wrapper)' }); };
})();
