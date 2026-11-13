/* KADENCE S4 extra instrumentation — read-only. Injected before page scripts (after s2early.js and s3extra.js).
   1) Minimal React DevTools global hook: counts commits per renderer; walks the committed tree to list composite
      components that performed work (PerformedWork flag, as React DevTools' didFiberRender does).
   2) Tooltip text changes per frame (hovered song shown to the user).
   3) GlobalAudioPlayer pool / loading-status Map sampler (located via fiber hooks; works in prod and dev). */
(() => {
  const Y = { commits: [], tip: [], pool: [], notes: [] };
  window.__s4 = Y;
  const now = () => performance.now(); const r1 = (x) => Math.round(x * 10) / 10;
  const WALK = true; // composite-render census per commit
  const COMPOSITE = new Set([0, 1, 11, 14, 15]);
  const nameOf = (f) => { const t = f.type; if (!t) return '?'; if (typeof t === 'function') return t.displayName || t.name || 'anon'; if (t.displayName) return t.displayName; if (t.render) return t.render.displayName || t.render.name || 'fwd'; if (t.type) return (t.type.displayName || t.type.name || 'memo'); return '?'; };
  let rid = 0; const roots = new Set();
  // Fiber objects present in each root's previous commit. A fiber object that is identical to
  // last commit's was not touched by this render (React reuses untouched subtrees as-is, and those
  // keep stale PerformedWork flags) — so we skip it and its subtree, as React DevTools does.
  const prevFibers = new WeakMap(); // root -> WeakSet<fiber>
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(),
    inject(r) { rid++; this.renderers.set(rid, r); Y.notes.push(['inject', rid, r.rendererPackageName || '', r.version || '']); return rid; },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {}, setStrictMode() {},
    onCommitFiberRoot(id, root) {
      const t = now(); roots.add(root);
      let rendered = 0, names = null;
      if (WALK) {
        names = location.hostname === 'localhost' ? [] : null; // component names only meaningful in the dev build
        const prev = prevFibers.get(root) || new WeakSet(); const seen = new WeakSet();
        // full walk to record this commit's fiber objects; count only fibers React processed this commit
        const stack = [[root.current, false]]; let n = 0;
        while (stack.length && n < 50000) { const [f, untouched] = stack.pop(); n++; seen.add(f);
          const reused = untouched || prev.has(f);
          if (!reused && COMPOSITE.has(f.tag) && (f.flags & 1) === 1 && f.alternate) { rendered++; if (names && names.length < 400) names.push(nameOf(f)); }
          if (f.sibling) stack.push([f.sibling, untouched]); if (f.child) stack.push([f.child, reused]); }
        prevFibers.set(root, seen);
      }
      Y.commits.push([r1(t), id, rendered, names, r1(now() - t)]);
    },
  };
  // tooltip
  let lastTip = null;
  const tick = (ts) => { const p = document.querySelector('.fixed.bottom-8 p.font-bold'); const txt = p ? p.textContent : ''; if (txt !== lastTip) { Y.tip.push([r1(ts), txt]); lastTip = txt; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // audio pool maps: located once on demand
  let maps = null;
  Y.locateAudioMaps = () => {
    for (const root of roots) {
      const stack = [root.current]; let n = 0;
      while (stack.length && n < 50000) { const f = stack.pop(); n++;
        if (f.tag === 0 && f.memoizedState) {
          let h = f.memoizedState; let status = null, pool = null;
          while (h) { const v = h.memoizedState; if (v && typeof v === 'object' && 'current' in v && v.current instanceof Map) { const vals = [...v.current.values()]; if (vals.length && vals.every((x) => x === 'loading' || x === 'loaded' || x === 'error')) status = v.current; else if (vals.length && vals.every((x) => x instanceof HTMLMediaElement)) pool = v.current; } h = h.next; }
          if (status && pool) { maps = { status, pool }; Y.notes.push(['audioMapsFound', nameOf(f), status.size, pool.size]); return true; }
        }
        if (f.sibling) stack.push(f.sibling); if (f.child) stack.push(f.child); }
    }
    return false;
  };
  setInterval(() => { if (!maps) return; let loading = 0, loaded = 0, err = 0; for (const v of maps.status.values()) { if (v === 'loading') loading++; else if (v === 'loaded') loaded++; else err++; } let playing = 0; for (const a of maps.pool.values()) if (!a.paused) playing++; Y.pool.push([r1(now()), maps.pool.size, loading, loaded, err, playing]); }, 500);
  Y.reset = () => { for (const k of ['commits', 'tip', 'pool']) Y[k].length = 0; return now(); };
  Y.dump = () => JSON.stringify({ commits: Y.commits, tip: Y.tip, pool: Y.pool, notes: Y.notes, commitsFields: 't,rendererId,compositesRendered,names,walkMs', poolFields: 't,poolSize,loading,loaded,error,poolPlaying' });
})();
