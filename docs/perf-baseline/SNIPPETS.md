# P0.1 — DevTools measurement snippets

These snippets **only observe**. They run in your browser tab, change nothing in the repository, and disappear when you reload the page. They are needed because the P0.2 dev counters do not exist yet. Each snippet fills a gap DevTools cannot measure directly:

| Gap | Snippet |
|---|---|
| How many full 4096² atlas uploads happen, and how long each upload call blocks the main thread (HY-2, CF-10) | K1 |
| How many frames WebGL actually draws per second (CF-12; Song Detail and Switch Chart frozen-canvas targets) | K1 |
| Frame-interval p50/p95/p99 and missed frames (the "wall frame time p95" success metric) | K1 |
| How many `Audio` elements are created; which `play()` calls are rejected and why (CF-7, HY-7) | K1 |
| How many videos decode at once, with decoded and dropped frames per file (CF-14, HY-6) | K1 |
| Long animation frames with script attribution, and interaction latency (INP proxy) | K1 |
| Artwork requests in total vs. unique assets (duplicate loader, CF-9) | K1 |
| Switching blur, blend and SVG filter effects off and on for A/B traces (HY-3, HY-4, HY-5, HY-13) | K2 |
| Time to first frame: preview file vs. full file (HY-15) | K3 |

## How to install a snippet

1. Open DevTools (F12), then **Sources** → left sidebar **»** → **Snippets** → **+ New snippet**.
2. Name it (`kp-observers`, `kp-fx`, `kp-ttff`) and paste the code from the matching block below.
3. Run it with **Ctrl+Enter**, or right-click the snippet → **Run**. The output appears in the Console.
4. Snippets are saved in your DevTools profile. Re-run them after every page reload.

> **Rules**
> - **Never press keys or click inside the page just to install a snippet.** Running a snippet from DevTools does not count as a user activation, so autoplay tests (HY-7) stay valid.
> - **K1 adds very little overhead:** a wrapper around a few WebGL calls, one `requestAnimationFrame` loop, and a 4 Hz video sampler that reads only inline styles. Still, for the **timing** traces the guide says when to install it. Never install K2 or K3 during a trace you'll use for baseline timings, except in the A/B experiments that call for them.
> - **Visual references must never be captured while K2 is active.** Reload the page first.

---

## K1 — `kp-observers` (the main counter set)

Install **after** the page has loaded and **before** the action you want to measure. It survives everything inside the single-page app (entering the Universe, Song Detail, Switch Chart) because no page navigation happens.

```js
/* KADENCE P0.1 observers — read-only measurement. Reload the page to remove. */
(() => {
  if (window.__kp) { console.info('[kp] already installed. Reload the page to remove it.'); return; }
  const now = () => performance.now();
  const pct = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return +s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))].toFixed(2);
  };
  const short = (u) => { try { return decodeURIComponent(String(u).split('?')[0].split('/').pop() || ''); } catch { return String(u); } };
  const artKey = (u) => String(u).split('?')[0].replace(/\/[^/]*$/, ''); // strip the size segment, e.g. /256x256bb.jpg

  const fresh = () => ({
    segmentStart: now(),
    segmentLabel: '',
    atlas: { full: 0, other: 0, ms: [] },
    gl: { drawCalls: 0, framesWithDraws: 0, drew: false },
    raf: { deltas: [], last: 0 },
    media: { audioCreated: 0, playCalls: 0, playResolved: 0, playRejected: [] },
    video: { maxConcurrentPlaying: 0, bySrc: {} },
    loaf: [],
    interactions: [],
  });
  const kp = Object.assign({ installedAt: now() }, fresh());
  window.__kp = kp;
  try { performance.setResourceTimingBufferSize(20000); } catch {}

  // 1) WebGL: texture uploads (atlas = a 4096x4096 source) and draw calls
  const protos = [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean).map((c) => c.prototype);
  for (const P of protos) {
    for (const name of ['texImage2D', 'texSubImage2D']) {
      const orig = P[name];
      if (typeof orig !== 'function') continue;
      P[name] = function (...args) {
        const src = args.find((a) => a && typeof a === 'object' && typeof a.width === 'number' && typeof a.height === 'number');
        const t = now();
        const r = orig.apply(this, args);
        const d = now() - t;
        if (src && src.width >= 4096 && src.height >= 4096) {
          kp.atlas.full++; kp.atlas.ms.push(d);
          try { performance.measure('kp:atlas-upload', { start: t, end: t + Math.max(d, 0.01) }); } catch {}
        } else if (src) {
          kp.atlas.other++;
        }
        return r;
      };
    }
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const orig = P[name];
      if (typeof orig !== 'function') continue;
      P[name] = function (...args) { kp.gl.drawCalls++; kp.gl.drew = true; return orig.apply(this, args); };
    }
  }

  // 2) Frame cadence and "did WebGL draw this frame"
  const tick = (ts) => {
    if (kp.raf.last && kp.raf.deltas.length < 50000) kp.raf.deltas.push(ts - kp.raf.last);
    kp.raf.last = ts;
    if (kp.gl.drew) { kp.gl.framesWithDraws++; kp.gl.drew = false; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // 3) Audio element creation (new Audio()) and play() outcomes for every <audio>/<video>
  const NativeAudio = window.Audio;
  window.Audio = new Proxy(NativeAudio, {
    construct(target, args) { kp.media.audioCreated++; return Reflect.construct(target, args); },
  });
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    kp.media.playCalls++;
    const info = {
      t: Math.round(now()),
      tag: this.tagName.toLowerCase(),
      src: short(this.currentSrc || this.getAttribute('src') || ''),
      muted: this.muted,
      pageActivated: navigator.userActivation ? navigator.userActivation.hasBeenActive : null,
    };
    const p = nativePlay.apply(this, args);
    if (p && typeof p.then === 'function') {
      p.then(
        () => { kp.media.playResolved++; },
        (e) => {
          const rec = { ...info, error: e && e.name, message: e && e.message };
          kp.media.playRejected.push(rec);
          if (rec.error === 'NotAllowedError') console.warn('[kp] AUTOPLAY BLOCKED', rec);
        },
      );
    }
    return p; // the app's own .then/.catch still receive the same promise
  };

  // 4) Video sampler (4 Hz): concurrent decoders, decoded/dropped frames, frozen-frame indicator
  setInterval(() => {
    let playing = 0;
    for (const v of document.querySelectorAll('video')) {
      const src = short(v.currentSrc || v.getAttribute('src') || '');
      if (!src) continue;
      const s = kp.video.bySrc[src] || (kp.video.bySrc[src] = {
        frames: 0, dropped: 0, lastTotal: 0, lastDropped: 0,
        playingSamples: 0, unmutedPlayingSamples: 0, shownButPausedSamples: 0,
      });
      const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
      if (q) {
        if (q.totalVideoFrames < s.lastTotal) { s.frames += s.lastTotal; s.dropped += s.lastDropped; } // element was reloaded
        s.lastTotal = q.totalVideoFrames; s.lastDropped = q.droppedVideoFrames;
      }
      const isPlaying = !v.paused && !v.ended && v.readyState >= 2;
      if (isPlaying) { playing++; s.playingSamples++; if (!v.muted) s.unmutedPlayingSamples++; }
      else if (v.style.opacity === '1') s.shownButPausedSamples++; // visible but not playing = frozen frame
    }
    kp.video.maxConcurrentPlaying = Math.max(kp.video.maxConcurrentPlaying, playing);
  }, 250);

  // 5) Long animation frames (>= 50 ms) with script attribution
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration < 50) continue;
        kp.loaf.push({
          t: Math.round(e.startTime), ms: Math.round(e.duration), blockingMs: Math.round(e.blockingDuration || 0),
          scripts: (e.scripts || []).slice(0, 3).map((s) => ({
            ms: Math.round(s.duration), invoker: s.invoker, fn: s.sourceFunctionName, file: short(s.sourceURL),
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { console.info('[kp] long-animation-frame not supported in this browser'); }

  // 6) Interactions (Event Timing) for an INP-style worst-case
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.interactionId) continue;
        kp.interactions.push({
          t: Math.round(e.startTime), type: e.name, ms: e.duration,
          inputDelay: Math.round(e.processingStart - e.startTime),
          processing: Math.round(e.processingEnd - e.processingStart),
          presentation: Math.round(e.startTime + e.duration - e.processingEnd),
        });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {}

  // API
  kp.mark = (label) => { try { performance.mark('kp:' + label); } catch {} };
  kp.reset = (label = '') => {
    Object.assign(kp, fresh(), { segmentLabel: label });
    try { performance.clearResourceTimings(); } catch {}
    kp.mark('reset ' + label);
    console.info('[kp] counters reset:', label || '(no label)');
  };
  kp.summary = () => {
    const secs = Math.max(0.001, (now() - kp.segmentStart) / 1000);
    const res = performance.getEntriesByType('resource');
    const art = res.filter((r) => /mzstatic\.com/.test(r.name));
    const d = kp.raf.deltas;
    const p50 = pct(d, 50) || 16.7;
    const missed = d.reduce((n, x) => n + Math.max(0, Math.round(x / p50) - 1), 0);
    const ints = kp.interactions.map((i) => i.ms);
    const rejectedByReason = kp.media.playRejected.reduce((m, r) => ((m[r.error] = (m[r.error] || 0) + 1), m), {});
    const perFile = Object.fromEntries(Object.entries(kp.video.bySrc).map(([k, s]) => [k, {
      framesDecoded: s.frames + s.lastTotal,
      framesDropped: s.dropped + s.lastDropped,
      secondsPlaying: s.playingSamples / 4,
      secondsPlayingUnmuted: s.unmutedPlayingSamples / 4,
      secondsVisibleWhilePaused: s.shownButPausedSamples / 4,
    }]));
    return {
      label: kp.segmentLabel, seconds: +secs.toFixed(1),
      viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
      pageActivated: navigator.userActivation ? navigator.userActivation.hasBeenActive : null,
      atlas: {
        fullUploads: kp.atlas.full, otherTextureUploads: kp.atlas.other,
        uploadCallMs: { p50: pct(kp.atlas.ms, 50), p95: pct(kp.atlas.ms, 95), max: pct(kp.atlas.ms, 100) },
      },
      webgl: {
        framesWithDraws: kp.gl.framesWithDraws,
        framesWithDrawsPerSec: +(kp.gl.framesWithDraws / secs).toFixed(1),
        drawCalls: kp.gl.drawCalls,
      },
      frames: {
        count: d.length, intervalMs: { p50: pct(d, 50), p95: pct(d, 95), p99: pct(d, 99), max: pct(d, 100) },
        missedFrames: missed, over50ms: d.filter((x) => x > 50).length,
      },
      longFrames: {
        count: kp.loaf.length,
        maxMs: kp.loaf.reduce((m, e) => Math.max(m, e.ms), 0),
        totalBlockingMs: kp.loaf.reduce((m, e) => m + e.blockingMs, 0),
        worst5: [...kp.loaf].sort((a, b) => b.ms - a.ms).slice(0, 5),
      },
      interactions: { count: ints.length, worstMs: ints.length ? Math.max(...ints) : null, p98Ms: pct(ints, 98) },
      media: {
        audioElementsCreated: kp.media.audioCreated, playCalls: kp.media.playCalls,
        playResolved: kp.media.playResolved, playRejectedByReason: rejectedByReason,
        autoplayBlocked: kp.media.playRejected.filter((r) => r.error === 'NotAllowedError').slice(0, 10),
      },
      video: { maxConcurrentPlaying: kp.video.maxConcurrentPlaying, perFile },
      requests: {
        resourceEntries: res.length,
        artworkTotal: art.length,
        artworkUniqueUrls: new Set(art.map((r) => r.name)).size,
        artworkUniqueAssets: new Set(art.map((r) => artKey(r.name))).size,
        apiCalls: res.filter((r) => /\/api\//.test(r.name)).map((r) => {
          const u = new URL(r.name);
          return { path: u.pathname + u.search, ms: Math.round(r.duration), ttfbMs: Math.round(r.responseStart - r.startTime), kb: Math.round((r.transferSize || 0) / 1024) };
        }),
      },
    };
  };
  kp.print = () => { const s = kp.summary(); console.log(JSON.stringify(s, null, 2)); return s; };

  console.info('[kp] installed.', {
    pageActivated: navigator.userActivation ? navigator.userActivation.hasBeenActive : 'n/a',
    canvases: document.querySelectorAll('canvas').length,
    videos: document.querySelectorAll('video').length,
    viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
  });
  console.info('[kp] commands: __kp.reset("label") · __kp.mark("label") · copy(__kp.summary()) · __kp.print()');
})();
```

### Using K1 during a scenario

| When | Type in the Console |
|---|---|
| Just before the measured action (resets all counters and clears resource entries) | `__kp.reset('S3 chart entry')` |
| Optional marker that shows in the trace's **Timings** track | `__kp.mark('sweep start')` |
| At the end of the segment (copies JSON to the clipboard) | `copy(__kp.summary())` |
| Paste the clipboard into a file named as the guide says | e.g. `LAP_prod_S3_cpu1x_kp.json` |

Notes:
- `copy()` is a DevTools Console utility. Type it in the **Console**, not in a snippet.
- **`artworkTotal` vs `artworkUniqueAssets`:** if total ≈ 2 × unique assets, the two artwork loaders are fetching the same art (CF-9). Turn **Disable cache** on in the Network panel, otherwise the browser memory cache may hide repeated requests.
- **`atlas.uploadCallMs`** is the main-thread cost of the upload call only. The GPU-side cost is read from the trace's GPU track (guide §2.5). The `kp:atlas-upload` measures in the **Timings** track let you find each upload in the trace.
- **`webgl.framesWithDrawsPerSec`:** ≈ the display refresh rate means the wall renders every frame. 0 means the canvas is idle.
- **`media.playRejectedByReason`:** `AbortError` is normal (the app interrupts a load when you leave a tile). `NotAllowedError` means the browser's autoplay policy blocked the call (HY-7).
- **`video.perFile[*].secondsVisibleWhilePaused` > 0** for a hover video means a frozen frame was on screen (HY-7, CF-15).
- **`frames.intervalMs`** measures main-thread `requestAnimationFrame` cadence. Use it as the "frame time p95" proxy. Dropped frames caused purely on the compositor or GPU show up in the trace's **Frames** track instead.
- **Media elements are not reliably reported in Resource Timing**, so audio and video request counts and bytes come from the Network panel or HAR, not from K1.

---

## K2 — `kp-fx` (effect toggles for A/B experiments only)

This snippet injects one `<style>` element that switches off specific compositor effects so you can compare GPU cost with and without them. **It changes what you see**, so use it only inside the A/B steps of HY-3, HY-4, HY-5 and HY-13. Reload the page afterwards.

```js
/* KADENCE P0.1 effect toggles — A/B experiments only. Reload the page to remove. */
(() => {
  const RULES = {
    backdrop:  '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
    blend:     '*, *::before, *::after { mix-blend-mode: normal !important; }',
    svgfilter: '[style*="glass-distortion"] { filter: none !important; }',  // Song Detail glass filter (HY-5)
    cinematic: '[style*="blur(9px)"] { filter: none !important; }',          // CinematicBackground blur (HY-13)
  };
  window.__kpFx = (...names) => {
    let el = document.getElementById('kp-fx');
    if (!el) { el = document.createElement('style'); el.id = 'kp-fx'; document.head.appendChild(el); }
    const unknown = names.filter((n) => !RULES[n]);
    if (unknown.length) console.warn('[kp-fx] unknown effect(s):', unknown, 'valid:', Object.keys(RULES));
    el.textContent = names.map((n) => RULES[n] || '').join('\n');
    try { performance.mark('kp:fx ' + (names.join('+') || 'restored')); } catch {}
    console.info('[kp-fx] disabled:', names.length ? names.join(', ') : '(none, all effects restored)');
  };
  console.info('[kp-fx] ready. __kpFx("backdrop") · __kpFx("backdrop","blend") · __kpFx("svgfilter") · __kpFx("cinematic") · __kpFx() restores');
})();
```

---

## K3 — `kp-ttff` (HY-15: preview vs. full-file time to first frame)

Run this on the **production** intro page, while it is idle, with the throttling and cache settings from guide §HY-15. The snippet adds a small **muted** 160×90 video in the bottom-right corner for each trial, then removes it. Muted playback is used for both designs so the autoplay policy does not affect the comparison.

```js
/* KADENCE P0.1 TTFF experiment (HY-15). Needs DevTools open with "Disable cache" ticked. */
(async () => {
  const PAIRS = [
    ['God Mode', '/videos/God Mode_preview_3s.mp4', '/videos/God Mode_30s.mp4'],
    ['Beat It',  '/videos/Beat It_preview_3s.mp4',  '/videos/Beat It_30s.mp4'],
    ['Loser',    '/videos/Loser_preview_3s.mp4',    '/videos/Loser_30s.mp4'],
  ];
  const TRIALS = 5;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
  const ttff = (url) => new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    Object.assign(v.style, { position: 'fixed', right: '8px', bottom: '8px', width: '160px', height: '90px', zIndex: '2147483647', background: '#000' });
    document.body.appendChild(v);
    let done = false;
    const t0 = performance.now();
    const finish = (ms, how) => {
      if (done) return; done = true;
      v.pause(); v.removeAttribute('src'); v.load(); v.remove();
      resolve({ ms: Math.round(ms), how });
    };
    const timer = setTimeout(() => finish(NaN, 'timeout'), 20000);
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(() => { clearTimeout(timer); finish(performance.now() - t0, 'first-frame'); });
    else v.addEventListener('loadeddata', () => { clearTimeout(timer); finish(performance.now() - t0, 'loadeddata'); }, { once: true });
    v.src = encodeURI(url);
    v.play().catch(() => {});
  });
  const results = [];
  for (const [name, preview, full] of PAIRS) {
    const p = [], f = [];
    for (let i = 0; i < TRIALS; i++) {
      p.push((await ttff(preview)).ms); await sleep(800);
      f.push((await ttff(full)).ms);    await sleep(800);
    }
    const mp = median(p), mf = median(f);
    results.push({ tile: name, previewMedianMs: mp, fullMedianMs: mf, deltaMs: mf - mp, withinThreshold150ms: (mf - mp) <= 150, previewRuns: p.join(','), fullRuns: f.join(',') });
  }
  console.table(results);
  window.__kpTtff = results;
  console.info('[kp-ttff] done. Run copy(__kpTtff) and save the result as LAP_prod_HY15_fast4g_ttff.json');
})();
```

How to read the K3 result:
- **`deltaMs` ≤ 150 for all three tiles:** one-file playback (D7) reaches first frame about as fast as the preview, so prefer D7 over D6.
- **`deltaMs` > 150 for any tile:** keep the two-file design and plan D6.
- **Any `timeout` (NaN) result:** repeat the run and note it.
- The result is **provisional**: the D5 re-encode changes file sizes and moov/keyframe layout, so re-run K3 after D5 before choosing between D6 and D7.
