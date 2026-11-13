# S4: 60 s Universe interaction, audio playback and rapid tile hovering — results

| | |
|---|---|
| Captured | 2026-11-11, 09:31–09:57 UTC (15:01–15:27 IST) |
| Targets | **Production** `https://kadence-musicz.vercel.app/` (build consistent with `e5ab927`) and the **local dev server** `http://localhost:3000` (Next 16.2.6 Turbopack, started earlier at your request) |
| Browser | A separate Brave 157 / Chromium 157.0.8103.39 with a throwaway profile, driven over the Chrome DevTools Protocol. Your Brave profile was not touched. |
| Display | 1718×910 CSS px, DPR 1.09, **144 Hz** (6.9 ms frames) |
| Runs | Production 1× CPU: `pilot`, `r1` (+ heap counts, Refresh, Switch-to-Workout), `r2` (retry after a navigation timeout), `r3` (traced). Production 4× CPU: `r1`. Dev 1× CPU: `r1`. **0 foreign pointer events** in every run. |
| Instrumentation | `harness/s2early.js` + `s3extra.js` + [`s4extra.js`](../harness/s4extra.js), injected before page scripts. `s4extra.js` adds: a minimal **React DevTools global hook** (counts commits per renderer and, per commit, the composite components that performed work, as React DevTools does; component names only on the dev build); tooltip-text changes per frame; and a sampler of `GlobalAudioPlayer`'s `poolRef` / `loadingStatusRef` Maps, located through the fiber hooks. Plus CDP `Runtime.queryObjects(HTMLAudioElement.prototype)` for live audio-element counts, `SystemInfo` CPU per segment, network and Media. |
| Evidence | [`raw/*.json`](raw/), [`S4_metrics.json`](S4_metrics.json), [`shots/`](shots/) (settled wall and end state per run), [`traces/S4_prod_cpu1x_r3_traced_trace.json.gz`](traces/) (55.9 MB gz) + [`…_timerfire.json`](traces/) (extracted `TimerFire` events), [`run_log.txt`](run_log.txt) |

## The 60 s script (as executed; times after script start)

| Time | Action (dispatched with CDP `Input`) |
|---|---|
| 0–10 s | **Hands off.** The pointer has not moved since the click that entered the chart, so NodeField's hover is inactive (`rawMouseNDC = -10,-10`). |
| 10–25 s | **Slow hover:** 10 positions across one row (y = 55% of height, x from 25% to 75% of width), 1.5 s each, with 5 small moves to reach each. This produced **20–21 tile changes** (the intermediate moves cross tiles). |
| 25–35 s | **Fast sweep:** 200 points in a zig-zag over 4 rows in 5 s, then back along the same path (25 ms per move). This produced **204–209 tile changes**. |
| 35–45 s | Move to the centre and rest 1.4 s (the tile pops after 1 s), **click it** at 36.6 s, then **click the left edge of the wall** at 39.6 s (the guide's "click empty space"). |
| 45–60 s | **Hands off.** |

## Validity notes

- **When the 8 Hz loop runs depends on audio.** In `r1` and the 4× run the wall took 50.5 s and 17.5 s to appear. By the time the script started, the 30 s first-track preview had already ended, so **nothing was playing in 0–10 s and there were 0 commits**. In the other runs the first track was still playing.
- **"Click empty space" did not clear the preview: it opened Song Detail** for the tile under the left edge, in every run (screenshot [`shots/pilot_prod_cpu1x_end.jpg`](shots/pilot_prod_cpu1x_end.jpg)). So **45–60 s is "Song Detail open"**, not "wall idle".
- **Dev run:** the artwork was still loading when the script began (38 atlas uploads during it), so its frame and CPU numbers are noisier. It is used for **component names**.
- **Network:** slow and unstable. The pilot logged `ERR_INTERNET_DISCONNECTED`, `ERR_NAME_NOT_RESOLVED` and `ERR_CONNECTION_RESET` on audio requests, and `r2`'s first attempt timed out on navigation. Pending and failed audio counts include network effects.
- **Instrumentation cost:** the fiber walk per commit had a p95 of 0.1–0.2 ms.

## Results by segment

React-dom commits per second, with composite components re-rendered per commit (median):

| Run | 0–10 passive | 10–25 slow hover | 25–35 sweep | 35–45 pop/click | 45–60 Song Detail open |
|---|---|---|---|---|---|
| pilot | **8.0** (53) | 6.1 (57) | **53.0** (57) | 6.5 (90) | 8.0 (90) |
| r1 | 0 (no audio playing) | 9.7 (57) | **73.1** (57) | 10.8 (58) | 8.0 (90) |
| r2 | **8.0** (53) | 10.7 (57) | **50.6** (57) | 5.5 (90) | 8.1 (90) |
| r3 traced | **8.0** (53) | 5.7 (57) | **55.7** (57) | 9.5 (90) | 8.0 (90) |
| 4× | 0 (no audio playing) | 9.9 (57) | **51.8** (57) | 7.8 (90) | 8.0 (90) |
| dev | **8.0** (53) | 3.7 (57) | 46.0 (57) | 2.1 (58) | 1.0 (90) |

R3F's own reconciler also commits; total commits are 16/s at rest and 78–122/s during the sweep.

### HY-1 / RCT-01: the 8 Hz full-tree loop

> **Correction (2026-11-13).** The S4 commit hook counted every composite whose `PerformedWork` flag was set while walking the *whole* committed tree. React reuses untouched subtrees as-is, and those keep stale `PerformedWork` flags from earlier renders, so **the "composites per commit" counts in this report (53/57/58/90) and the dev per-component counts are upper bounds**. Commit *rates* are unaffected. The hook was fixed (`harness/s4extra.js`: subtrees whose fiber objects are identical to the previous commit are skipped, as React DevTools does).
>
> A re-measurement with the corrected hook on the dev server, original code, still shows **`Home` re-rendering on every progress tick**: with Song Detail open, `Home` and `SongDetail` each rendered 8.3/s, a median of 89 composites per commit. Source: [`../P0-verify/S5-dev-ab`](../P0-verify/S5-dev-ab), run `A_before_p0`. So the RCT-01 conclusion stands.

- **Production:** while a track plays and the user does nothing, react-dom commits **exactly 8.0 times per second**, and every commit re-renders **53 composite components** (90 with Song Detail mounted).
- **Dev build, with names** (component render counts in 0–10 s, 80 commits): **`Home` 80/80**, `GlobalAudioPlayer` 80, `HeroBackgroundVideo` 80, `HoverMediaBackground` 80, `PreviewVideoLayer` 80, `Universe` 80, `Canvas` / `CanvasImpl` 80, `CinematicBackground` 80, `Navbar` 80, `SearchPanel` 80, `SongDetail` 80, `GlassFilter` 80, `GlassButton` 400 (5 per commit), `motion.div` 800, `AnimatePresence` 640.
  - That is the whole tree on every progress tick, as the audit described (`page.tsx:117-119`).
  - Guide baseline ≈ 80 `Home` commits in 10 s: measured 80. Target 0.
- **Production cost per update** (trace, `TimerFire` tasks on the KADENCE renderer, run r3):

  | Window | TimerFire/s | p50 | p95 | max | main-thread ms per second |
  |---|---|---|---|---|---|
  | 0–10 s, wall, track playing | 10.0 | **1.41 ms** | 3.93 ms | 4.56 ms | **≈ 17 ms/s** |
  | 45–60 s, Song Detail open | 9.9 | **2.82 ms** | 4.60 ms | 7.03 ms | **≈ 26 ms/s** |

- **HY-1 verdict:**
  - wall idle: p50 1.41 ms, below the template's 2 ms working threshold;
  - Song Detail open: p50 2.82 ms, above it.
  - **Partly confirmed:** the loop is real and continuous; its per-update cost is small on this machine at 1× CPU and doubles with Song Detail open.

### TRK-03: renders per tile change

- **Slow hover:** react-dom commits within 160 ms of each tile change averaged **3.1–4.9**. Minus the ≈ 1.3 expected from the 8 Hz loop, that is **≈ 2–3.6 full-tree commits per tile change** (57–58 composites each).
- **Dev:** `Home` rendered in **every** react-dom commit during hover and sweep (56/56 and 460/460).
- **Sweep:** **46–73 react-dom commits per second**, each re-rendering 57–58 composites.
- **Confirmed** (the audit predicted ≥ 3 per change; 2–3.6 measured net of the baseline).

### Frames and main thread

| Run | Segment | rAF p50 / p95 / max (ms) | frames > 50 ms | missed frames | WebGL frames with draws / s | long tasks |
|---|---|---|---|---|---|---|
| prod 1× (pilot, r1–r3) | passive | 6.9 / 7.1 / 7.5–8.6 | 0 | 0 | **144** | 0 |
| | slow hover | 6.9 / 7.0–7.1 / 13.8–27.7 | 0 | 1–7 | 143.6–143.9 | 0 |
| | **sweep** | 6.9 / 7.0–7.1 / 7.3–14.0 | **0** | 0–5 | 143.5–144 | **0** |
| | pop/click (Song Detail opens) | 6.9–7.0 / 7.1–13.8 / **62.6–257.3** | 1–5 | 113–150 | 129–133 | 0–1 (52 ms) |
| | Song Detail open | 6.9 / 7.1 / 13.9–54.5 | 0–1 | 4–46 | **141–144** | 0 |
| prod **4×** | slow hover | 6.9 / 7.1 / 62.5 | 2 | 161 | 133.3 | 1 (69 ms) |
| | **sweep** | **27.7** / 41.6 / 69.5 | 2 | 28 | **41.8** | 2 (55, 61 ms) |
| | pop/click | 7.0 / 27.8 / **256.9** | 10 | 589 | 85.0 | **7: 229, 101, 54, 157, 65, 63, 66 ms** |
| | Song Detail open | 13.9 / 34.8 / 131.9 | 3 | 255 | 52.8 | 0 |
| dev 1× | sweep | 7.0 / 20.9 / 41.7 | 0 | 458 | 98.2 | 0 |

- **At 1× CPU on this machine (144 Hz), the wall keeps full frame rate even during the sweep.** There were no long tasks; 50–73 React commits per second fit within the frame budget.
- **At 4×, the sweep drops the wall to about 36 fps** (rAF p50 27.7 ms; WebGL drawing 41.8 frames/s).
- **Opening Song Detail is the only 1× hitch:** a 62–257 ms frame. At 4× it costs **7 long tasks totalling 735 ms**.
- **HY-11 baseline** (hover-attributable long tasks during the sweep): **0 at 1×**; 55 and 61 ms at 4×.

### CF-12 / GL-02: the wall renders every frame, including under Song Detail

- **WebGL draws in 141–144 frames per second** while Song Detail covers the wall (45–60 s), the same as on the open wall. Guide baseline ≈ 60 at 60 Hz; target 0.
- **Process CPU per segment** (% of one core, `SystemInfo.getProcessInfo`):

  | Run | passive wall: renderer / GPU | sweep: renderer / GPU | Song Detail open: renderer / GPU |
  |---|---|---|---|
  | pilot | 17.9 / 35.6 | 58.4 / 63.6 | 75.9 / **123.1** |
  | r1 | 29.9 / 53.8 | 104.4 / 88.1 | 102.9 / **163.1** |
  | r2 | 32.2 / 53.2 | 68.6 / 78.5 | 92.6 / **154.5** |
  | r3 (traced) | 0.9* / 72.6 | 68.9 / 73.9 | 90.2 / **152.6** |
  | 4× | 115.3 / 41.5 | 136 / 22.1 | 143 / 113.8 |

  \* r3's renderer process id changed between samples, so its passive renderer figure is not reliable.
- **With Song Detail open, the GPU process roughly triples** (to 123–163% of one core) and the renderer roughly triples as well. That is consistent with GL-02 plus SD-01 (the hidden canvas still rendering every frame under a full-screen `blur(10px) brightness(0)`; SVG filter, 8 Hz commits with 90 composites).

### Audio pool (CF-7 / TRK-04) and preload queue (HY-8)

**Live `HTMLAudioElement` objects** (`Runtime.queryObjects`, r1):

| Moment | Count |
|---|---|
| heap1, idle intro | 0 |
| heap2, settled wall | 21 |
| heap3, 60 s script + 10 s | **114** |
| heap4, 15 s after switching to Workout | **117** |

- **The pool grows with every tile hovered and is not released on chart switch.** Guide target ≤ 10.
- **`new Audio()` during the 60 s script:** 93–98 per run (18 in the slow hover, 73 in the sweep).
- **Pool size** from `poolRef`: 111–118 elements at the end of every run.
- **`play()` calls:** 253–267 per run; **rejected with `AbortError` 18–242 times** (plays interrupted by the next hover; none were `NotAllowedError`).
- **HY-8** (`loadingStatusRef` entries still `'loading'` after the sweep ends at 35 s):

  | Run | +0 s | +10 s | +30 s |
  |---|---|---|---|
  | pilot | 55 | 35 | **1** |
  | r1 | 2 | 2 | **2** |
  | r2 | 78 | 67 | **56** |
  | r3 | 56 | 61 | **61** |
  | 4× | 55 | 58 | **58** |
  | dev | 95 | 98 | **84** |

  **Entries remain `'loading'` 30 s after the sweep in 6/6 runs → HY-8 confirmed by the guide's rule.** These entries count against the concurrency limit of 4, so background preloading stalls. Network stalls on this link contribute; the code never times them out.
- **Audio network** during the script: 99–105 distinct previews requested, 109–244 requests. In r2/r3/4×, **55–59 requests were still pending after > 10 s**.

### TRK-05: the tooltip fetches 600×600 artwork for every hovered song

**240–247 requests for `600x600` artwork during each 60 s script**, one per newly hovered song, displayed at 48 px. The 256 px versions already in the atlas are not reused. `r1` also shows 242 × `256x256` from its Refresh segment.

### TRK-10: "click empty space" selects a hidden tile

The click at the wall's left edge (x = 4) **opened Song Detail** for the tile under it in every run, instead of clearing the preview. The hover had already moved to that tile when the pointer reached the edge.

### Refresh segment (HY-3 / B5 baseline, r1)

- Duration **8.2 s**; `/api/songs` 3.3 s (MISS).
- **7 full 4096² atlas uploads**; 242 artwork requests; **512 `Image.src` sets** (the two loaders again).
- rAF max 104 ms (2 frames > 50 ms); 0 long tasks.

## Comparison with the audit / guide

| Item | Guide expectation | Measured | Verdict |
|---|---|---|---|
| CF-3 / RCT-01 / HY-1: 8 Hz full-tree loop | ≈ 80 `Home` commits in 10 s | 80/80 `Home` (dev); 8.0/s × 53 composites (prod); 1.41 ms p50 per update (2.82 with Song Detail) | **Confirmed.** Cost per update is small at 1× on this machine |
| TRK-03: ≥ 3 full renders per tile change | 1–3 | ≈ 2–3.6 net of the 8 Hz baseline; `Home` in every commit | **Confirmed** |
| CF-7 / TRK-04: unbounded audio pool | ≈ number of tiles hovered | 114 live after the script, 117 after a chart switch | **Confirmed** |
| HY-8: preload queue stalls | `'loading'` at +10/+30 s | Present at +30 s in 6/6 runs (1–84 entries) | **Confirmed** |
| CF-12 / GL-02: wall renders under Song Detail | ≈ refresh rate | 141–144 draw-frames/s; GPU ×3 | **Confirmed** |
| TRK-05: tooltip 600 px art | 600 px per hover | 240–247 × 600×600 per script | **Confirmed** |
| TRK-10: click outside selects another song | Confirmed by code | Left-edge click opened Song Detail in every run | **Confirmed** |
| HY-11: hover long tasks | baseline only | 0 at 1×; 55–61 ms at 4× | Baseline recorded, deferred |
| HY-12: jelly `update` self-time | > 0.5 ms/frame | Not measured (needs a dev trace bottom-up) | **Missing** |

## Missing diagnostics

| Item | Why |
|---|---|
| HY-12 (jelly `update` self-time), NodeField frame-loop attribution | Needs a CPU-profile bottom-up on a dev trace; not done |
| Three.js object counts (CF-11: `BufferGeometry`, `InstancedMesh`) | Only `HTMLAudioElement` was counted; the three.js prototypes are not reachable from a global in production |
| INP from the clicks | Event Timing was not recorded in S4; long frames around the clicks are reported instead |
| Forced reflows per second (CF-29) | Not counted; available in the r3 trace |
| `chrome://media-internals` count of live `.m4a` players | The CDP Media domain was enabled, but players were not tallied |
| 60 Hz comparison | The display ran at 144 Hz |
| Android tap variant | No device |
