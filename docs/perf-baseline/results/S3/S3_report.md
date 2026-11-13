# S3: Entering the Universe (chart entry) — results

| | |
|---|---|
| Captured | 2026-11-11, 08:51–09:26 UTC (14:21–14:56 IST) |
| Target | Production `https://kadence-musicz.vercel.app/` (build consistent with `e5ab927`) |
| Browser | A **separate** Brave 157 / Chromium 157.0.8103.39 with a throwaway profile, driven over the Chrome DevTools Protocol. **Your own Brave profile was not touched.** |
| Display | 1718×910 CSS px, DPR 1.09. **The panel was at 144 Hz during S3** (S1/S2 ran at 60 Hz), so a normal frame here is 6.9 ms. |
| Charts | **Late Night** (per the guide, cpu1x) and **Workout** (cpu4x) |
| Method | Load the intro (cold = cache cleared first), wait for React hydration + 5 s, then **move onto the card and click within 30 ms; the pointer is never moved again**. Record for 30 s after the click. |
| Instrumentation | S2 page instrumentation (`harness/s2early.js`) plus [`harness/s3extra.js`](../harness/s3extra.js), injected before page scripts. It records: WebGL texture uploads ≥ 1 MP (size, main-thread call ms), draw calls per frame, artwork `Image.src` set/load times, `new Audio()` creation and per-instance audio events, loader/intro DOM state per frame, rAF, long tasks, LoAF. Network, Media and process CPU come from CDP. |
| Evidence | [`raw/*.json`](raw/) per run, [`S3_metrics.json`](S3_metrics.json), [`shots/`](shots/) (screenshot at +20 s and +30 s per run), [`traces/S3_cold_cpu1x_late-night_traced_trace.json.gz`](traces/), [`run_log.txt`](run_log.txt) |

Times are **ms after the page's own `click` event**.

## Validity notes

- **Network.** Slow and lossy (curl ≈ 320 KB/s at 14:20, a cdnjs request failed, 80% ping loss). Cold results are dominated by it.
- **Server timing check.** Separate `curl` requests to `/api/songs` at 14:46 had a **TTFB of 0.6–2.3 s and finished in 2.1–7.3 s** (763–810 KB uncompressed). Every response was `x-vercel-cache: MISS`, `cache-control: public, max-age=0, must-revalidate`, routed `bom1::iad1` (Mumbai edge → US-East function).
- **Contamination.** `S3_cold_cpu1x_late-night_r3` received 13 real mouse events at coordinates the script never sent. It is flagged; its API outcome is still reported because it does not depend on the pointer.
- **No filmstrip.** The traced run's trace contains **no screenshot events**, so there is no filmstrip. The +20 s / +30 s screenshots are the visual evidence.
- **T5 / T7 approximations.** T5 ("wall fully populated") is approximated as the first atlas upload after the last artwork image load. T7 is the end of the last long task in the 30 s window; 0 means there were no long tasks.
- **Pilot.** `pilot_v1` (in `superseded/`) used instrumentation that missed `Audio()` events and wall reveal; it was superseded. `pilot_cold_late-night` (v2) uses the final instrumentation.

## Runs

| Run | Cache / CPU | `/api/songs` done (TTFB) | T3 loader visible | Wall revealed = T4 first artwork drawn | Artwork images loaded: first → last | T6 first audio `playing` | Artwork `src` sets / unique URLs | Full 4096² uploads | Audio in 30 s: requests / bytes | Long tasks in 30 s |
|---|---|---|---|---|---|---|---|---|---|---|
| pilot (v2) | cold, 1× | **22,710** (22,354), MISS | 55 | **26,073** | 25,358 → still loading at 30 s | 398 | 270 / 130 | 20 | 8 / 2.6 MB (7 pending) | 0 |
| r1 | cold, 1× | **no response in 30 s** | 102 | **never** (loader for 30 s) | — | 7,687 | 0 | 0 | 1 / 1.0 MB | 0 |
| r2 | cold, 1× | **no response in 30 s** | 110 | **never** | — | 436 | 0 | 0 | 1 / 1.0 MB | 0 |
| r3 ⚠ contaminated | cold, 1× | headers at 28,719 (MISS), body unfinished at 30 s | 100 | **never** | — | 905 | 0 | 0 | 1 / 1.0 MB | 0 |
| traced | cold, 1×, trace on | **23,849** (23,401), MISS | 119 | **27,886** | 26,647 → 35,346 | 17,298 | 145 / 71 | 30 | 21 / 19.4 MB (3 pending) | 1 (57 ms) |
| Workout | cold, **4×** | **no response in 30 s** | 279 | **never** | — | 6,728 | 0 | 0 | 1 / 1.0 MB | **4: 159, 67, 192, 154 ms** |
| warm | warm, 1× | **2,716** (2,560), MISS | 66 | **5,190** | 4,657 → 22,697 (T5 ≈ 22,703) | 828 | **512 / 241** | 43 | 21 / 1.8 MB (cached) | 0 |
| **globe blocked r1** (experiment) | cold, 1× | **9,535** (8,327), MISS | 54 | **11,754** | 10,470 → still loading at 30 s | 1,155 | 161 / 79 | 34 | 21 / **21.2 MB** | 0 |
| **globe blocked r2** (experiment) | cold, 1× | **1,447** (759), MISS | 98 | **5,458** | 1,747 → 26,659 (T5 ≈ 26,670) | 775 | **512 / 241** | 60 | 11 / 6.7 MB (5 pending) | 0 |

**What the user sees:**
- **Warm:** loader within 66 ms, then the wall with artwork at about 5.2 s ([`shots/S3_warm_cpu1x_late-night_t20s.jpg`](shots/S3_warm_cpu1x_late-night_t20s.jpg)).
- **Cold, 4 of 6 runs with the globe downloading:** only the "MASTERING" loader for the full 30 s ([`shots/S3_cold_cpu1x_late-night_r1_t30s.jpg`](shots/S3_cold_cpu1x_late-night_r1_t30s.jpg)), while the first track plays from the click.

## Findings

### 1. The wall cannot appear until `/api/songs` returns, and in the cold runs it was starved for 22 s to over 30 s

- **The click's first audio and the loader are fast; the wall depends on one API request.** Every run showed the loader within 54–279 ms. But the wall (`introComplete`) waits for `fetchVibeSongs` and then for 32 critical artworks (`app/page.tsx:164`, `:199`).
- **The browser was much slower than the server:**
  - in the browser, cold with the globe downloading: 22.7 s, 23.8 s, or **no response within 30 s (4 of 6 cold runs)**;
  - curl: 2.1–7.3 s;
  - warm browser run: 2.7 s.
- **Globe-blocked experiment** (`Network.setBlockedURLs ['*globe.mp4*']`, throwaway profile only, no app change): `/api/songs` finished in **9.5 s and 1.4 s**, and the wall appeared in **2/2** runs (at 11.8 s and 5.5 s).
- **Interpretation (strongly indicated, not confirmed; 2 vs 6 runs on a variable network):** the 11.8 MB `globe.mp4` (`preload="auto"`) is still downloading on the same connection when the user clicks, and the API response is starved behind it. The globe had received 3.3–11.5 MB by the end of each cold run; in the warm run it came from cache (562 KB transferred).
- This matches S1-cold, where LCP waited on JS chunks while the globe streamed.
- **No CDN caching.** `/api/songs` is uncacheable at the edge (`max-age=0`, always MISS) and is served from US-East to a Mumbai edge (API-01).

### 2. Audio: the first track starts in the click; 20 more preload regardless (AUD-01)

- **T6, the first `playing` on an `Audio` element, ranged 398 ms – 17.3 s.** The signature track is started synchronously inside the click from in-memory data (`page.tsx:142-152`), so audio does not wait for the API. It does wait for the Apple CDN on this network (7.7 s and 17.3 s in two cold runs).
- **Once the API returns, 20 preload `Audio()` elements are created** (21 elements in total). In cold runs that is **19.4–21.2 MB of audio in the first 30 s** (guide C4 baseline ≈ 20 MB, target ≤ 5 MB).
- This audio competes with artwork on the same slow link: the cold runs show 4–11 audio stalls (`waiting` / `stalled`) and up to 7 requests still pending at 30 s.

### 3. Two artwork loaders: each image is set about 2.1×, but fetched once (GL-01 / CF-9)

- In complete entries, **512 `Image.src` assignments for 241 unique artwork URLs** (2.12×).
- The network shows **241 requests for 241 unique 256×256 assets**: the second loader's request is served from the in-page memory cache.
- So the duplication costs **decode + canvas draw + upload work, not bandwidth**.

### 4. Full 64 MiB atlas re-uploads: 20–60 per entry (GL-01 / CF-10, HY-2)

| Run | Full 4096² uploads | Max uploads within 1 s | Upload call (main thread) | Enclosing frame p50 / p95 / max | Mean dropped frames per upload |
|---|---|---|---|---|---|
| pilot | 20 | 11 | ≤ 1.8 ms | 7.0 / **62.5** / 62.5 | 1.10 |
| traced | 30 | 10 | ≤ 3.0 ms | 7.0 / **20.9** / 83.4 | 0.53 |
| warm | 43 | 4 | ≤ 0.1 ms | 6.9 / 7.1 / 20.7 | 0.47 |
| globe blocked r1 | 34 | 12 | ≤ 2.0 ms | 7.0 / **34.6** / 48.6 | 1.15 |
| globe blocked r2 | 60 | 14 | ≤ 0.2 ms | 7.0 / 7.1 / 14.1 | 0.05 |

- **Baseline confirmed:** 20–60 full re-uploads per chart entry, within the guide's ≈ 25–40 expectation and up to 60. Target: ≤ 2 (B2) or ≤ 8 (B1).
- **HY-2 by the guide's rule** (p95 of the enclosing frame ≥ 8 ms, or ≥ 3 dropped frames per upload):
  - **met in 3 of 5 runs** (p95 20.9–62.5 ms): all three cold runs;
  - not met in the warm run or globe-blocked r2 (p95 7.1 ms);
  - criterion (b) was never met (mean 0.05–1.15 dropped frames).
- The worst frames are the first upload after the API returns (49–83 ms), which coincides with `setSongs` and the React commit. The main-thread `texImage2D` call itself is ≤ 3 ms.
- **The GPU-side cost of a 64 MiB upload was not measured.** It is in the traced run's GPU track (`traces/`), not analysed.
- **Verdict: mixed. B2 (per-slot uploads) is supported by the upload count and the cold-run p95, not by the warm runs.**

### 5. WebGL renders every frame from chart entry onward (GL-02 / CF-12)

- After the wall is revealed: **144 frames with draws per second**, i.e. every display frame at 144 Hz.
- Draw calls also start **before** the reveal, while the loader covers the canvas. In the pilot, 2,313 of 2,702 frames had draws in the first 20 s.
- Frame cadence after reveal at 1× CPU: p50 6.9 ms, p95 7.0 ms, max 7.3–13.8 ms, **0 frames over 50 ms**.

### 6. JS after the click: none (CF-20 / RCT-04)

**0 JS chunks were fetched after the click in every run.** The Universe/R3F chunk had already been downloaded on the intro (S1).

### 7. Main thread

- **1× CPU:** 0 long tasks in 7 of 8 runs at 1× CPU (the traced run had one of 57 ms). Long animation frames up to 75–100 ms, mostly with 0 blocking.
- **4× CPU (Workout):** **4 long tasks** within 13.5 s of the click:
  - **159 ms at the click itself** (`#document.onclick` → React);
  - 67 ms;
  - **192 ms and 154 ms around +13 s**.
  - Renderer CPU was 96% of a core over the first 20 s. The API never returned in this run, so the later work is not wall-related.

### 8. Hover media on chart entry (INT-10)

- Moving onto the card started the intro hover pipeline (preview `src` set 32–52 ms before the click; request cancelled).
- **In every run the hover media was cleared within about 140 ms after the click** (preview `pause()` / `src` removed as the card left the pointer). There were 1–5 frames with the dim layer visible after the click and **0 frames with a hover video playing**.
- **INT-10 (hover video or audio persisting into loading or the wall) was not reproduced** with a stationary pointer.

### 9. Process CPU over the first 20 s after the click (`SystemInfo.getProcessInfo`)

| Run | Renderer | GPU process |
|---|---|---|
| warm | 23.1% | 35.0% |
| globe blocked r1 / r2 | 38.2% / 31.5% | 50.6% / 44.5% |
| cold, API never returned (r1/r2) | 40.7% / 43.1% | 51.9% / 57.3% |
| traced (trace overhead included) | 53.9% | 80.5% |
| Workout 4× | **95.8%** | 48.4% |

GPU **memory** is not available through CDP (Task Manager only), so it was not measured.

## Comparison with the audit / guide

| Item | Expected | S3 evidence | Verdict |
|---|---|---|---|
| API-01: live API, no effective cache | Mechanism confirmed | Always `x-vercel-cache: MISS`, `max-age=0`; `bom1::iad1`; server 0.6–2.3 s TTFB by curl; browser 1.4 s → no response in 30 s | **Confirmed** (no CDN caching). The client-side delay is dominated by contention (see 1). |
| CF-20: Universe chunk already on the intro | Confirmed | 0 JS fetched after the click | **Confirmed** |
| CF-9: two artwork loaders | ≈ 2× requests | 2.12× `src` sets, 1× network (memory cache) | **Confirmed**: duplicated work, not duplicated bytes |
| CF-10 / GL-01: full atlas uploads | 25–40 | 20–60 | **Confirmed** |
| HY-2: uploads cause frame drops | p95 ≥ 8 ms or ≥ 3 drops | p95 20.9–62.5 ms in 3/5 runs; 7.1 in 2/5; drops ≤ 1.15 | **Partly confirmed** (cold runs); GPU-side cost not measured |
| CF-12 / GL-02: wall renders every frame | ≈ refresh rate | 144 draw-frames/s; draws also under the loader | **Confirmed** |
| CF-8 / AUD-01: ≈ 20 MB audio in 30 s | ≈ 20 MB | 19.4–21.2 MB cold | **Confirmed** |
| INT-10: hover media not cleared on selection | Hypothesis | Cleared within ≈ 140 ms in all runs (stationary pointer) | **Not reproduced** |
| New: globe download delays the wall | — | API 22–30+ s with the globe vs 1.4–9.5 s blocked | **Strongly indicated** (needs repeats on a stable network) |

## Missing diagnostics

| Item | Why |
|---|---|
| Cold entry on a stable network (and the guide's 3 complete cold runs) | 4/6 cold entries never got the API response within 30 s on this link |
| Filmstrip (T3 → T5 visually) | No screenshot events in the trace; +20 s / +30 s screenshots only |
| GPU-side cost per 64 MiB upload | Trace captured, GPU track not analysed |
| GPU memory before/after entry | Not exposed via CDP |
| Server-side timing (HY-9), Vercel logs | No access to the Vercel project; curl timings only |
| Workout at 4× with the wall loaded | API never returned in that run |
| Android pass | No device |
| 60 Hz comparison | The display ran at 144 Hz during S3 |
