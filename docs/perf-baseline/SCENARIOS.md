# P0.1 Profiling Guide — Part 2: Scenarios S1–S6

Read [PROFILING_GUIDE.md](PROFILING_GUIDE.md) first. It covers setup, the tool primer (§2), the run protocol (§3) and file names (§4). Stand-alone hypothesis experiments and the visual references are in [EXPERIMENTS.md](EXPERIMENTS.md).

**Passes per scenario**

| Scenario | LAP prod cpu1x (×3) | LAP prod cpu4x (×1) | LAP dev (×1) | AND prod (×1) |
|---|---|---|---|---|
| S1 Cold load and idle intro | ✔ | ✔ | — | ✔ |
| S2 Hover five intro tiles, plus a sustained hover | ✔ | ✔ | React Profiler (recommended) | n/a (no hover) — run the S2-touch variant |
| S3 Chart entry | ✔ | ✔ | — | ✔ |
| S4 60 s Universe interaction | ✔ | ✔ | **React Profiler + HY-8 + heap** | adapted (taps) |
| S5 Song Detail | ✔ | ✔ | **React Profiler** | ✔ |
| S6 Switch Chart | ✔ | ✔ | React Profiler (recommended) | ✔ (tap) |

In the steps, *"(t = 10 s)"* means 10 seconds after the recording started.

---

## S1 — Cold homepage load and idle performance

**Covers:** CF-19, CF-20, CF-21, CF-22, CF-14 (idle globe), HY-4 (idle part); metrics *Initial JS*, *Third-party render-blocking requests*, *Cold first-visit bytes*, LCP.

**Panels:** Lighthouse · Performance · Network · Memory (Task Manager) · `chrome://media-internals` · Layers.

### S1a — Lighthouse (LAP only; once Desktop, once Mobile)
1. `perf-clean` profile, a new tab on `<PROD_URL>`, DevTools → **Lighthouse** → Navigation, Performance only.
2. Run **Desktop** and save HTML + JSON as `LAP_prod_S1_na_lh-desktop.html/.json`.
3. Run **Mobile** and save as `LAP_prod_S1_na_lh-mobile.html/.json`.

### S1b — Load trace plus HAR
1. New tab with `about:blank`. Open DevTools.
   - **Network:** ☑ Preserve log, ☑ **Disable cache**, clear the log.
   - **Performance:** ☑ Screenshots, ☑ Memory; CPU = the pass (No throttling / 4×).
2. Type `<PROD_URL>` into the address bar but do not press Enter yet. In Performance press **Record and reload** (Ctrl+Shift+E). If Record and reload starts from about:blank, first navigate once to `<PROD_URL>` and then use Record and reload; with Disable cache on, it is still cold.
3. **Do not touch the mouse or keyboard.** Let it record until the globe plays and the network is quiet (about 8–10 s), then **Stop**.
4. Save the trace as `…_S1_{pass}_trace_rN.json.gz`.
5. Network panel: read the footer (requests, transferred, resources, Finish, DOMContentLoaded, Load) **before** saving the HAR as `…_S1_{pass}_har.har` (run r1 only).

### S1c — Idle intro (15 s, no input)
1. Still on the same page, wait 5 s, then **Record** for exactly **15 s** with no input → Stop. Save as `…_S1_{pass}_idle-trace.json.gz`.
2. In the Console, type `document.querySelectorAll('canvas').length` and note the result. A value ≥ 1 on the intro is evidence for CF-20 (WebGL canvas created before a chart is chosen).
3. **Shift+Esc (Task Manager):** note the tab's Memory footprint, the tab's GPU memory, the GPU Process memory and the GPU Process CPU%. Screenshot it as `…_S1_cpu1x_taskmgr.png`.
4. `chrome://media-internals` → the `globe.mp4` player: screenshot its properties (decoder, hardware, dimensions) as `…_S1_cpu1x_media.png`.
5. Layers panel (cpu1x r1 only): screenshot it and note the total layer count and memory estimate as `LAP_prod_S1_cpu1x_layers.png`.

### Metrics to capture

| Metric | Where to read it |
|---|---|
| FCP, LCP, TBT, CLS, Speed Index | Lighthouse; LCP and CLS also from the trace's **Timings** track / Live metrics |
| LCP element | Lighthouse → "Largest Contentful Paint element" |
| Requests / transferred bytes / Finish / Load | Network footer (Disable cache on) |
| JS transferred (gzip) and the **list of JS chunks** | Network → **JS** filter; sort by Size. Note any chunk ≥ 100 KB. On Vercel the hashes differ from the local build, so identify chunks by size: the three.js core is ≈ 100 KB gz, the Universe chunk ≈ 140 KB gz. Was the Universe chunk downloaded **on the intro**? (CF-20) |
| Font requests: count, bytes, and is the CSS render-blocking? | Network filter `fonts.`; Lighthouse "Eliminate render-blocking resources" (CF-21) |
| Logo and tile image bytes | Network **Img** filter; note `logo*` sizes and the 14 tile WebPs (CF-22) |
| `globe.mp4` bytes in the first 10 s | Network filter `globe` → transferred column (CF-18) |
| Long tasks during load: count and max | Trace Main track |
| Idle 15 s: Scripting / Rendering / Painting / System ms | Summary tab over the whole idle trace |
| Idle: GPU ms/frame, GPU busy %, dropped frames | GPU method (guide §2.5) over 5 s of the idle trace |
| Idle main-thread activity | Repeating tasks while idle (e.g. `mousemove` listeners only fire with input; a busy main thread at rest is a finding) |
| Canvas count on the intro | Console |
| Memory and GPU memory | Task Manager |
| Globe decoder: hardware or software | media-internals |

### How to interpret
- **Initial JS > 300 KB gz** and the **three.js / Universe chunks present before any click** confirm CF-19 and CF-20 and set the baseline for E1/E2 (target ≤ 235 KB gz).
- **Requests to `fonts.googleapis.com` / `fonts.gstatic.com` before the first paint** = third-party render-blocking requests (target 0). Note how many `.woff2` files load.
- **Cold bytes before interaction** = the Network "transferred" total after 10 s with no input. The audit estimated ~14 MB, most of it `globe.mp4` and the logos (target ≤ 3 MB).
- **Idle GPU busy %:**
  - On the intro, the only things that should move are the globe video and CSS animations.
  - A high GPU ms/frame here is the cost of decoding and compositing the globe under the intro cards; it feeds HY-4 in EXPERIMENTS.md.
  - If the WebGL canvas draws frames while idle, the trace shows WebGL draw activity in the main thread's animation frames. Run K1 afterwards and check `webgl.framesWithDrawsPerSec` (expected 0, because the frameloop is `demand` while there are no songs).
- **LCP element:** if LCP is a logo image, its 783 KB / 230 KB size (CF-22) is on the critical path.

---

## S2 — Hovering across five intro tiles (and one sustained hover)

**Covers:** CF-13, CF-14, CF-15, CF-16, CF-17; HY-6, HY-7 (first-hover part), HY-14 (card-hover part); metric *Concurrent video decoders during hover*.

**Panels:** Performance · Network · `chrome://media-internals` (required) · Console (K1) · optional React Profiler on dev.

**The five tiles, in reading order** (consecutive in the grid, so moving from one to the next crosses no other tile):

| # | Tile | Preview / full file | Full size |
|---|---|---|---|
| 1 | Global Top 50 | `Beat It` | 14.1 MB (keyframes at 0 / 7.17 s) |
| 2 | Viral 50 | `Radhimaa` | 24.9 MB |
| 3 | New Music Friday | `Alaakaa Loova` | 19.5 MB |
| 4 | Hip-Hop Central | `Loser` | 6.8 MB (smallest) |
| 5 | Pop Rising | `Kiss Kiss Bang Bang` | 14.3 MB (scaled 1.35×) |

**Sustained-hover tile:** ✨ **Dev's Universe** (`God Mode`, 30.6 MB, 8.1 Mbps, keyframes at 0 / 4.33 / 14.75 s; the heaviest file). It sits in the *Creator Collection* section further down the intro.

> If your grid wraps differently and tiles 1–5 are not adjacent, move the pointer through the gaps between cards. If the pointer crosses another tile, note which one: each tile crossed starts its own preview download.

### Setup
1. `perf-clean`, `<PROD_URL>`, Network: ☑ Preserve log, ☑ **Disable cache**, clear. Open `chrome://media-internals` in a second tab, then return.
2. Load the page. **Do not click anything in the page.** Wait 5 s.
3. Install **K1** from Sources → Snippets → Ctrl+Enter. Check that the Console shows `pageActivated: false`; this is your HY-7 first-hover observation on Chrome.
4. Type `__kp.reset('S2a')` in the Console.

### S2a — Five tiles × 2 s
1. Performance: ☑ Screenshots, CPU = the pass → **Record**.
2. (t = 2 s) Move onto **tile 1**. Hold still for **2 s** while watching the background: does video appear and move, or does a still frame appear?
3. Move directly to **tile 2** for 2 s, then **tile 3**, **tile 4** and **tile 5**, 2 s each.
4. (t ≈ 13 s) Move the pointer to empty space (no tile) and wait **3 s** for the globe to return.
5. **Stop.** In the Console run `copy(__kp.summary())` and save it as `…_S2a_{pass}_kp_rN.json`.
6. Save the trace as `…_S2a_{pass}_trace_rN.json.gz` and the HAR (r1 only) as `…_S2a_{pass}_har.har`.

### S2b — Sustained hover (10 s) on Dev's Universe
1. Scroll to the Creator Collection section with the mouse wheel, or click the *Creator Collection* cue. A click is a user activation, so for HY-7 purity prefer the wheel; scrolling with the wheel does not activate the page.
2. `__kp.reset('S2b')` → **Record**.
3. Hover **Dev's Universe** and hold perfectly still for **10 s**. The handoff from preview to full video should happen at about 3 s.
4. Move off, wait 3 s, then **Stop**.
5. Run `copy(__kp.summary())` and save as `…_S2b_{pass}_kp_rN.json`. Save the trace as `…_S2b_{pass}_trace_rN.json.gz`.
6. Switch to `chrome://media-internals` (cpu1x r1 only). For the `globe`, `God Mode_preview_3s` and `God Mode_30s` players, screenshot properties and event log as `LAP_prod_S2_cpu1x_media-*.png`. Also open the `Radhimaa_30s` player from S2a and check that it was destroyed or stopped.
7. While the full video plays (repeat the hover if needed), open Task Manager (Shift+Esc) and note the **GPU Process CPU %**. Save as `LAP_prod_S2b_cpu1x_taskmgr.png`.

### S2-touch (phone only)
Tapping a tile on a phone opens its chart, so there is no hover. On AND, record only: load the intro, scroll the intro to the Creator Collection and back over 10 s, Stop. Save as `AND_prod_S2_na_trace.json.gz`. This measures scroll smoothness over the card stack (HY-4 on mobile).

### Optional — dev React Profiler (LAP dev, `perf-react`)
- On `http://localhost:3000`, start the React Profiler, hover tiles 1–5 for 2 s each, then stop. Save as `LAP_dev_S2_cpu1x_react.json`.
- Count the commits in which `Home` rendered. Each hover writes `hoveredVibe` to `useUIStore`, and `Home` subscribes to the whole store (CF-1).

### Metrics to capture

| Metric | Where to read it |
|---|---|
| Video bytes transferred (S2a, S2b) and number of `/videos/` requests and distinct files | Network filter `/videos/`; footer with the filter on |
| **Full-video downloads started for tiles hovered only 2 s** (CF-16) | Network: `_30s.mp4` rows in S2a. Each one is a download that started after the preview played, then was abandoned. Note bytes per row. |
| Time hover → first video frame, per tile | Trace: the screenshot filmstrip from the `mouseover` (Interactions/Main track) to the first frame where video is visible. Or the K3 experiment for a cleaner figure. |
| `video.maxConcurrentPlaying` | K1 (expected 3 during the S2b handoff: globe + preview + full; target 1) |
| Decoded and dropped frames per file | K1 `video.perFile` |
| `secondsPlayingUnmuted` for preview and full, overlapping in time | K1. Both > 0 during the crossfade = two audible soundtracks (CF-17). |
| `secondsVisibleWhilePaused` per hover file | K1. > 0 = a frozen frame shown (HY-7, CF-15). |
| `playRejectedByReason` | K1. Note `NotAllowedError` and `AbortError` counts. |
| Handoff stutter | Trace around t ≈ 3 s of S2b: dropped or partial frames in the Frames track; in media-internals, a `kSeek` to 3 s on the full player followed by `BUFFERING_HAVE_NOTHING` |
| Decoder type (hardware/software) per player | media-internals |
| GPU ms/frame: globe-only (from the S1c idle) vs. during the S2b handoff | GPU method over 2 s windows |
| Paint per frame while hovering a card (HY-14 part) | Trace Main → **Paint** events during the 400–500 ms card-hover shadow transition; sum per frame |
| GPU Process CPU % during the full video | Task Manager |

### How to interpret
- **`maxConcurrentPlaying` = 3** confirms that the globe keeps decoding under the hover video (CF-14). That is the D2 baseline; target 1.
- **HY-6 (three decoders drop frames):** dropped frames > 1% of decoded frames for any file, **or** Frames-track drops during the S2b handoff, **or** a software decoder in media-internals → *Confirmed*. The result informs the D5 encode targets.
- **`_30s.mp4` rows in S2a** are wasted bytes (CF-16; the D4 baseline). Sum their transferred bytes.
- **Seek to 3.0 s with no keyframe there:**
  - On God Mode the nearest keyframes are 0 s and 4.33 s.
  - A seek to 3 s forces a decode from 0 s. Expect a visible hitch or `BUFFERING_HAVE_NOTHING` around the handoff. That evidence quantifies CF-17 for D5/D6.
- **First hover in a never-activated page:**
  - If `NotAllowedError` appears, or the background shows a still frame for > 0.5 s, HY-7 is *Confirmed* for Chrome.
  - Chrome may allow it because of Media Engagement on a profile with history; that is why HY-7's own experiment uses fresh Guest/InPrivate windows (EXPERIMENTS.md).

---

## S3 — Entering the Universe and chart-loading performance

**Covers:** CF-8, CF-9, CF-10, CF-11, CF-20, CF-24, CF-26; HY-2, HY-9 (client side), HY-14 (loader part); metrics *Artwork requests per chart entry*, *Full atlas uploads per chart entry*, *Audio bytes in first 30 s*.

**Panels:** Performance (Screenshots ☑) · Network · Console (K1) · Task Manager.

**The chart to click:** **Late Night** for runs r1–r3. On the cpu4x run and the phone run, use **Workout**, so that each run has a chance of hitting a cold server cache (the server cache TTL is 20 min). Write down the time of each run; HY-9 matches it against the Vercel logs.

### Steps
1. `perf-clean`, `<PROD_URL>`, Network ☑ Preserve log, ☑ **Disable cache**, clear. Load the page and wait 5 s on the intro.
2. Install **K1**, then run `__kp.reset('S3')`.
3. Performance: ☑ Screenshots, ☑ Memory, CPU = the pass → **Record**.
4. (t = 2 s) **Click the chart tile.** Do not move the mouse afterwards: leave the pointer where it is, or move it to the very top edge of the window. Hovering wall tiles would add hover audio.
5. Keep recording until the wall is full of artwork **and** the first track is audible, **plus 5 s**. Stop at **t = 20 s** at the latest (the trace buffer gets large).
6. **Stop.** Run `copy(__kp.summary())` and save as `…_S3_{pass}_kp_rN.json`.
7. **Do not move the mouse.** Leave the page alone until **30 s after the click**. Then, in the Network panel, filter `.m4a` and note the request count and the transferred total; this is *audio bytes in the first 30 s*. Then filter `mzstatic` and note the count and bytes.
8. Save the trace as `…_S3_{pass}_trace_rN.json.gz` and the HAR (r1) as `…_S3_{pass}_har.har`.
9. Task Manager: note the tab's GPU memory and the GPU Process memory (compare with S1c). Save as `…_S3_cpu1x_taskmgr.png`.

### Timeline to extract from the trace (all relative to the click)

| Mark | How to find it |
|---|---|
| **T0** click | Interactions track (the `click` bar) |
| **T1** `/api/songs?vibe=…` request start, and **T2** response end | Network panel (Timing tab of the request); K1 `requests.apiCalls` gives `ms` and `ttfbMs` |
| **T3** loader visible | Screenshot filmstrip |
| **T4** first artwork visible on the wall | Filmstrip |
| **T5** wall fully populated (no blank tiles) | Filmstrip; scrub until no tile changes |
| **T6** first audio audible | media-internals `kPlay` on an `.m4a` player, or the first `.m4a` request finishing plus a `play` call (K1 `playResolved`) |
| **T7** wall interactive | End of the last long task (> 50 ms) followed by ≥ 1 s with no long task, on the Main track |

### Metrics to capture

| Metric | Where to read it |
|---|---|
| T0→T2 (API), T0→T4, T0→T5, T0→T6, T0→T7 | As above |
| `/api/songs` TTFB, duration, size; `x-vercel-cache` and `cache-control` headers | Network (custom header columns) |
| JS chunks downloaded **after** the click | Network JS filter, rows after T0. Expected **0** because Universe is already loaded (CF-20). |
| **Artwork requests:** total / unique URLs / unique assets | K1 `requests.artwork*` + Network `mzstatic` count (CF-9; baseline ~512, target ≤ 256) |
| **Full atlas uploads** | K1 `atlas.fullUploads` (CF-10; baseline ~25–40, target ≤ 2 with B2 / ≤ 8 with B1 only) |
| Upload call p50/p95/max (main thread) | K1 `atlas.uploadCallMs` |
| **Per-upload frame impact (HY-2)** | For the 5 largest `kp:atlas-upload` measures in the Timings track: (a) the duration of the enclosing **Animation frame fired** / long task on Main; (b) the GPU-track block right after it; (c) the number of dropped frames in the 100 ms after it. Record p95 of (a) and the mean of (c). |
| `webgl.framesWithDrawsPerSec` | K1 (expected ≈ refresh rate from wall reveal onward; CF-12) |
| Long frames: count, max, total blocking | K1 `longFrames` |
| Frame interval p95 and missed frames, T4→T5 | K1 `frames` (whole segment); for T4→T5 only, count dropped frames in the Frames track |
| Audio requests and bytes in the first 30 s | Network `.m4a` (CF-8; baseline ~20 MB; target ≤ 5 MB) |
| GPU memory before and after entry | Task Manager |
| Loader paint per frame (HY-14 part) | Main → Paint events while the loader ring shows (T3→T4) |

### How to interpret
- **HY-2 decision:**
  - **p95 of (a) ≥ 8 ms, or mean (c) ≥ 3 dropped frames per upload** → *Confirmed*; B2 (per-slot GPU uploads) is required.
  - Otherwise *Rejected*: B1 plus flush throttling is enough.
  - The main-thread `uploadCallMs` alone is a lower bound. The upload can also cost GPU time, visible as a GPU-track block after each measure.
- **`artworkTotal` ≈ 2 × `artworkUniqueAssets`** proves that both loaders fetch every image (CF-9). `artworkUniqueUrls` > `artworkUniqueAssets` means the two loaders use different size variants of the same art.
- **T0→T2 > 1.5 s** with `x-vercel-cache: MISS` (or no cache header) shows the upstream fetch on the critical path. This is client-side evidence for HY-9; the server-side numbers come from EXPERIMENTS.md §HY-9.
- **Audio > 5 MB in 30 s with no user hover** is the C4 baseline (20 tracks with `preload='auto'`).
- **No JS fetched after the click** means the Universe chunk was already paid for on the intro (CF-20, E2).

---

## S4 — 60 s of Universe interaction, audio playback and rapid tile hovering

**Covers:** CF-1, CF-2, CF-3, CF-4, CF-5, CF-6, CF-7, CF-11, CF-12, CF-29; HY-1, HY-3 (refresh part), HY-8, HY-11 (baseline only), HY-12; metrics *`Home` commits*, *Live audio elements after a sweep*, *Wall frame time p95*, INP.

**Panels:** Performance · Network · Memory (**heap snapshots, required**) · React Profiler (**dev, required**) · `chrome://media-internals` · Task Manager · Console (K1).

### The 60-second script (identical in every run)

| Time | Action | What it measures |
|---|---|---|
| 0–10 s | **Hands off.** The first track plays. Do not move the mouse; the pointer rests on the Navbar area or the top edge. | HY-1 / CF-3: passive 8 Hz re-renders |
| 10–25 s | **Slow hover:** 10 tiles, about 1.5 s each, along one row from left to right | Per-tile audio switching, tooltip, CF-4/CF-5 |
| 25–35 s | **Fast sweep:** about 50 tiles in about 5 s (a fast zig-zag across 3–4 rows), then back the same way | CF-7 audio-element growth, HY-8, HY-11 baseline |
| 35–45 s | Rest on one tile for **1.5 s** until it pops (≈ 1 s dwell). **Click it** (preview tint, plays it). Then click **empty space** (clears the preview). | Popped-tile preview path |
| 45–60 s | **Hands off** again | Does preloading continue after the sweep? (HY-8) |

### S4-prod (LAP prod: cpu1x ×3, cpu4x ×1)
1. `perf-clean`, `<PROD_URL>`, Network ☑ Preserve log, Disable cache **off** (this is a warm interaction scenario), clear the log.
2. Enter the **Late Night** chart, wait until the wall is complete and the first track is playing, **plus 10 s**.
3. Install **K1**, run `__kp.reset('S4')`, open Task Manager (Shift+Esc) on the side.
4. **Memory → Take snapshot** = **heap2** (heap1 is taken on the idle intro; see step 11). Save it later.
5. Performance: ☑ Screenshots, ☑ Memory → **Record**, then perform the 60 s script.
6. **Stop** at 60 s. Run `copy(__kp.summary())` and save as `…_S4_{pass}_kp_rN.json`.
7. Wait until **10 s** after the end of the script, then **Memory → Take snapshot** = **heap3**.
8. Run `__kp.summary().media.audioElementsCreated` in the Console and note it.
9. Network: filter `.m4a`. Note the total requests, the distinct files, the transferred total, and whether any rows are still **pending** (no status or "Pending" for > 10 s).
10. `chrome://media-internals` (r1): count players whose URL ends in `.m4a` that have **no** `kWebMediaPlayerDestroyed` event. Screenshot as `LAP_prod_S4_cpu1x_media.png`.
11. **heap1** (r1 only): in a fresh tab on the idle intro, take a snapshot before entering any chart. **heap4**: from the heap3 state, open **Switch Chart** → choose **Workout** → wait 15 s → take a snapshot. This checks whether audio elements and geometry from the first chart are released.
12. Save the trace, the HAR (r1) and the heap snapshots (`…_S4_cpu1x_heap1…heap4.heapsnapshot`, r1 only).
13. **Refresh segment (HY-3 / B5, r1 only):**
    - Run `__kp.reset('S4 refresh')` → **Record**.
    - Click **Refresh** in the Navbar and wait until the wall is complete, plus 3 s → **Stop**.
    - Save as `LAP_prod_S4R_cpu1x_trace.json.gz` and `…_kp.json`.

### S4-dev (LAP dev, `perf-react`, ×1)
1. On `http://localhost:3000`, enter **Late Night**, wait for the wall and the first track, plus 10 s.
2. **React Profiler → Record**, then perform the **same 60 s script**, then stop. Save as `LAP_dev_S4_cpu1x_react.json`.
3. **HY-8 inspection** (right after the script):
   - React DevTools **Components** tab → search `GlobalAudioPlayer` → in the right panel, open **hooks**.
   - One `Ref` holds a `Map` of URL → `'loading' | 'loaded' | 'error'` (it is `loadingStatusRef`; the Map has string status values).
   - Expand it and count the `'loading'` entries at **+0 s**, **+10 s** and **+30 s** after the sweep. Screenshot each as `LAP_dev_S4_cpu1x_hy8-{0,10,30}s.png`.
4. **Console:** the dev build prints `[AUDIO DEBUG] … Network preloading started` and `… Audio buffered & ready` lines. Right-click the Console → **Save as…** → `LAP_dev_S4_cpu1x_console.log`. URLs that "started" but never become "ready" are the stuck entries.
5. **Dev heap snapshot after the script:** filter `BufferGeometry`, `InstancedMesh`, `InstancedBufferAttribute` and `HTMLAudioElement`. Note the counts and save as `LAP_dev_S4_cpu1x_heap.heapsnapshot`.
6. **Dev trace for attribution:**
   - Record the 0–10 s and 25–35 s segments again as one Performance trace. Save as `LAP_dev_S4_cpu1x_trace.json.gz`.
   - In Bottom-Up, find the **self time of `update` from `jellyField.ts`** (HY-12) and the frame-loop callbacks from `NodeField.tsx`.

### S4-phone (AND)
On a touch screen, the hover sweep cannot be reproduced. Record instead:
- 0–10 s: hands off.
- 10–40 s: tap 5 different tiles about 5 s apart. A tap may open Song Detail; if it does, close it with **Close** each time, and note what a tap actually does.
- 40–60 s: hands off.

Save the trace as `AND_prod_S4_na_trace.json.gz` (K1 works in the remote Console too).

### Metrics to capture

| Metric | Where to read it |
|---|---|
| **`Home` commits in 0–10 s passive** (HY-1, CF-3) | Dev React Profiler: Flamegraph → `Home` → "Rendered at" entries between 0 and 10 s (baseline ~80; target 0) |
| Components re-rendered per passive commit, and why | Dev Profiler: pick one passive commit; list the components rendered (`Home`, `Navbar`, `GlassButton` …) and the "why" text |
| **`Home` commits per tile crossed** | Dev Profiler: commits in 10–25 s ÷ 10 tiles (baseline 1; target 0) |
| Total commits in 60 s | Dev Profiler counter |
| **Production cost per 8 Hz update** (HY-1 magnitude) | Prod trace, 0–10 s: click about 10 consecutive **Timer fired** tasks at 125 ms spacing; note mean and max duration including the React work under them. Also note Scripting ms per second for the window. |
| Frame interval p50/p95/p99 and missed frames | K1 `frames` (target p95 ≤ 16.7 ms on 60 Hz) |
| GPU ms/frame, 0–10 s (idle wall) and 25–35 s (sweep) | GPU method |
| **Hover-attributable long tasks** during the sweep (HY-11 baseline) | Prod trace 25–35 s: the longest 5 Animation-frame tasks; note duration and whether React commit work is inside them |
| `webgl.framesWithDrawsPerSec` | K1 (≈ refresh rate; CF-12) |
| Long frames, interactions worst/p98 | K1 `longFrames`, `interactions` (INP proxy from the clicks at 35–45 s) |
| **`audioElementsCreated`** | K1 |
| **Live `HTMLAudioElement` count** heap2 → heap3 → heap4 | Heap snapshots, class filter (baseline unbounded ≈ tiles hovered; target ≤ 10) |
| Live `.m4a` players | media-internals (not destroyed) |
| `.m4a` requests: total, distinct, bytes, pending > 10 s | Network |
| `'loading'` entries at +0/+10/+30 s | Dev Components inspection (HY-8) |
| Jelly `update` self-time per frame (HY-12) | Dev trace Bottom-Up self time ÷ frames in the window; cross-check in the prod trace by searching `update` within the Universe chunk |
| three.js objects after the script and after a chart switch | Dev heap (CF-11) |
| Forced reflows during the sweep | Prod trace: Layout events with the red warning triangle, count per second (GlassButton `getBoundingClientRect`, CF-29) |
| Refresh: GPU ms/frame and dropped frames during the blur | `S4R` trace (HY-3 / B5) |
| Tab memory and GPU memory at the end | Task Manager |

### How to interpret
- **HY-1:** Dev commits ≈ 8 per second at rest confirm CF-3 (the confirmed issue stands either way). The **production Timer-fired task duration** sets the expected gain of A1–A3. For example, 3 ms × 8 Hz ≈ 24 ms of main-thread time per second that A1–A3 removes. Record it; the threshold only sizes the gain.
- **CF-7:** `HTMLAudioElement` count in heap3 ≫ 20 and close to the number of distinct tiles hovered = unbounded pool. If heap4 (after a chart switch) is still high, eviction across charts also fails.
- **HY-8:** any `'loading'` entry still present at **+10 s** (and still there at +30 s) → *Confirmed*; C3 must include stall timeouts. A matching sign in production is `.m4a` rows pending > 10 s, with preloading not resuming in 45–60 s.
- **HY-11:** cannot be decided before Phase 1. Record the baseline (longest hover-attributable tasks) and mark it **Deferred**.
- **HY-12:** jelly `update` self-time **> 0.5 ms per frame** → *Confirmed* (B7). Measure it separately while settled (0–10 s) and during the sweep.
- **Refresh (HY-3 part):** GPU ms/frame during the refresh blur, compared with the idle wall. Use it together with the A/B result in EXPERIMENTS.md §HY-3.

---

## S5 — Song Detail opening, playback, scrubbing and closing

**Covers:** CF-2, CF-3, CF-12, CF-30, CF-31, CF-29; HY-5, HY-13; metric *R3F frames rendered while Song Detail is open*.

**Panels:** Performance · React Profiler (**dev, required**) · Console (K1) · Rendering (paint flashing, separately) · Memory (Task Manager).

### Script (identical in every run; starts from a settled wall with a track playing)

| Time | Action |
|---|---|
| 0–2 s | Hands off |
| 2 s | **Click a tile that has not popped** (move onto it and click within 0.5 s, before the 1 s dwell pops it). Song Detail opens and the drawer animates in. |
| 3–10 s | Hands off; the track plays with the drawer open |
| 10 s | Click **Pause**; at 12 s click **Play** |
| 14–19 s | **Scrub:** press on the progress bar, drag slowly from about 20% to about 80% over 3 s, release; then click once at about 40% |
| 20 s | Click **Next Track**. The song switches and the CinematicBackground transitions (≈ 1.2 s). |
| 24 s | Click **Close** (×). The drawer animates out. |
| 24–27 s | Hands off |

### S5-prod (LAP prod: cpu1x ×3, cpu4x ×1; AND ×1)
1. On a settled wall (as S4 step 2), install **K1** and run `__kp.reset('S5')`.
2. Performance: ☑ Screenshots → **Record**, perform the script → **Stop** at 27 s.
3. Run `copy(__kp.summary())` and save as `…_S5_{pass}_kp_rN.json`.
4. Save the trace as `…_S5_{pass}_trace_rN.json.gz`.
5. **WebGL frames while open:** run `__kp.reset('S5 open idle')`, open Song Detail again, wait exactly **5 s**, then type `__kp.summary().webgl`. Note `framesWithDrawsPerSec` (baseline ≈ 60; target 0).
6. **Paint attribution run** (cpu1x, ×1): enable ☑ *Enable advanced paint instrumentation (slow)* and record only the drawer open (2–4 s) and the song switch (20–22 s). Save as `LAP_prod_S5_cpu1x_paint-trace.json.gz`. Use this run for attribution only, not for timings.
7. **Paint flashing** (visual only): Rendering → ☑ Paint flashing. Record a 10 s screen capture with the drawer open and playing as `LAP_prod_S5_cpu1x_paintflash-rec.mp4`. The waveform and scrubber flash at 8 Hz. Untick Paint flashing afterwards.

### S5-dev (LAP dev, `perf-react`)
React Profiler → **Record** → run the script → stop. Save as `LAP_dev_S5_cpu1x_react.json`. Count the commits where `SongDetail` and `Home` rendered during 3–10 s, and note the "why".

### Metrics to capture

| Metric | Where to read it |
|---|---|
| **Drawer open:** dropped frames over the animation, and the longest task in it | Trace Frames + Main, window from the click to drawer settled (≈ 0.7 s; note the CSS `duration-700` on top of the spring, CF-30) |
| Click → drawer first visible movement | Interactions track (click duration) plus the filmstrip |
| **Raster time per frame** during the drawer animation (HY-5) | Trace → **Raster** / Thread-pool rows, window = drawer animation: sum of *Rasterize paint* / raster tasks ÷ frames |
| Idle-open raster and GPU ms/frame (3–10 s) | Same, plus the GPU method |
| `webgl.framesWithDrawsPerSec` while open | Step 5 |
| `SongDetail` / `Home` commits per second during playback | Dev Profiler (CF-2, CF-3; expected ≈ 8/s each) |
| **Forced reflows per second** during playback (3–10 s) | Prod trace: Layout events with the red triangle; Bottom-Up `getBoundingClientRect` (CF-31 `LiquidScrubber`) |
| Scrub: interaction latency (pointerdown/move/up), worst | Interactions track; K1 `interactions.worstMs` |
| Play/Pause click latency | Interactions track |
| **Song switch (20 s):** per-frame paint + raster + GPU during the 1.2 s CinematicBackground transition (HY-13) | Trace window 20–21.5 s |
| Drawer close: dropped frames | Frames track 24–25 s |
| Paint attribution (which layer repaints) | paint-trace: click a Paint event → Paint profiler |

### How to interpret
- **HY-5:** raster ≥ **4 ms per frame** during the drawer animation → *Confirmed* (H3, which needs design sign-off). Confirm the attribution with the K2 A/B run in EXPERIMENTS.md §HY-5.
- **HY-13:** paint + raster + GPU ≥ **4 ms per frame** during the 1.2 s song switch → *Confirmed* (H6). Confirm with the K2 `cinematic` A/B run.
- **WebGL frames while Song Detail is open ≈ 60/s** confirms CF-12 for this view (B4a target 0).
- **Forced reflows at ≈ 8/s** during playback confirm CF-31 (A7).
- **Drawer movement after the spring has settled**, or a visible overshoot beyond the spring, shows the CSS transition conflict (CF-30). Recordings go to DEC-3.

---

## S6 — Switch Chart opening, hovering and switching

**Covers:** CF-13, CF-12 (overlay case), CF-7 and CF-11 across a chart switch, H9 (overlay blur over the live canvas); DEC-1 evidence.

**Panels:** Performance · Network · Console (K1) · `chrome://media-internals` · React Profiler (dev, recommended) · Task Manager.

### Script (starts from a settled **Late Night** wall with a track playing)

| Time | Action |
|---|---|
| 0–2 s | Hands off |
| 2 s | Click **Switch Chart** (Navbar). The overlay opens with its full-screen blur. |
| 3–5 s | Hands off with the overlay open |
| 5–11 s | Hover three charts in the overlay, **2 s each**: **Global Top 50**, **Hip-Hop Central**, **Top K-Pop** |
| 11–13 s | Pointer on an empty part of the overlay |
| 13 s | Click **Workout** to switch charts |
| 13–28 s | Hands off until the new wall is complete and its first track plays, plus 3 s |
| (separately) | Open Switch Chart again and press **Esc**. Note whether it closes cleanly. |

### Steps (LAP prod: cpu1x ×3, cpu4x ×1; AND ×1 with taps — tapping a chart switches immediately, so skip the hover part)
1. Settled wall, Network ☑ Preserve log, ☑ Disable cache, cleared. `chrome://media-internals` open in another tab.
2. Install **K1** and run `__kp.reset('S6')`.
3. Performance: ☑ Screenshots → **Record**, perform the script → **Stop**.
4. Run `copy(__kp.summary())` and save as `…_S6_{pass}_kp_rN.json`.
5. Save the trace and the HAR (r1).
6. Separately (r1), measure **WebGL frames while the overlay is open:** `__kp.reset('S6 overlay idle')`, open the overlay, wait 5 s with no hover, then `__kp.summary().webgl`.
7. During step 5–11 of the script (repeat if needed), **listen:** is the wall track still audible while the hover video plays with its own soundtrack? Note yes/no for each chart (DEC-1).
8. media-internals: screenshot the hover video players opened from the overlay.
9. Optional dev run (`perf-react`): React Profiler over the same script. Count `Home` commits during the three hovers (`useChartHover` → `hoveredVibe` → whole-store subscriber).

### Metrics to capture

| Metric | Where to read it |
|---|---|
| Overlay open: click latency, dropped frames during the open animation | Interactions + Frames |
| **GPU ms/frame with the overlay open and idle (3–5 s)** | GPU method (H9; `backdrop-blur-3xl` over a canvas that keeps drawing) |
| `webgl.framesWithDrawsPerSec` with the overlay open | Step 6 (baseline ≈ 60; B4a target 0) |
| Hover videos started from inside the overlay | Network `/videos/` rows during 5–11 s; K1 `video.perFile` (CF-13) |
| `maxConcurrentPlaying` | K1 |
| Wall audio and hover-video audio audible together | Your observation plus K1 `secondsPlayingUnmuted` |
| Switch: click → new wall complete → first track audible | Filmstrip, as in S3 (T0…T7) |
| Atlas full uploads and artwork requests for the **second** chart | K1 (compare with S3) |
| `/api/songs?vibe=workout`: TTFB and cache header | Network |
| Long frames and worst interaction | K1 |
| Audio elements before/after the switch | heap3 vs heap4 from S4 (already captured) |
| Tab and GPU memory after the switch | Task Manager (compare with S3) |

### How to interpret
- **Hover videos load and play behind the overlay** = CF-13 confirmed in production. Together with the audio observation, this goes to the **DEC-1** decision ("is it intended?").
- **WebGL ≈ 60 frames/s with the overlay open**, plus a high GPU ms/frame, quantifies the gain from B4a (which also resolves H9).
- **Atlas uploads and artwork requests for the second chart** similar to S3 show the pipeline costs repeat on every switch (B1/B2).
- **GPU memory rises after the switch, and heap4 is not lower than heap3** = resources from the first chart are not released (CF-7, CF-11).

Continue with **[EXPERIMENTS.md](EXPERIMENTS.md)** for the stand-alone hypothesis experiments and the visual references.
