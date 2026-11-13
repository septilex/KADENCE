# S1: Homepage load and idle intro (Brave, foreground, runs r1–r3)

| | |
|---|---|
| Captured | 2026-11-11, 05:31–05:34 UTC (11:01–11:04 IST) |
| Target | `https://kadence-musicz.vercel.app/` (production). The build matches `e5ab927`; see the [earlier summary §1](LAP_prod_S1_brave-ext_summary_r1.md). |
| Browser | Brave 157 (Chromium 157), your profile, driven by the Claude in Chrome extension |
| Window | Brought to the foreground by Claude (Win32 `SetForegroundWindow`, auto mode). The mouse pointer was parked on the taskbar at (1900, 1075) before the runs. |
| Viewport | **1718×820** CSS px, DPR 1.09. The earlier throttled run had 1718×876. |
| Machine | 10 logical cores; Intel UHD (display: 1920×1080 at 60 Hz) plus an RTX 3050 Laptop GPU; plugged in; Windows Energy Saver Disabled |
| Runs | r1, r2, r3, one after another. No CPU throttling. No cpu4x pass, no Android pass. |
| Method | Same in-page script for every run: navigate, wait until t = 10 s, read buffered Navigation/Resource/Paint/LCP/CLS/Long-Animation-Frame timing, wait 5 s, then record 15 s of idle (rAF intervals, live LoAF/longtask observers, WebGL draw and texture calls via prototype wrapping, globe `getVideoPlaybackQuality`). |
| Raw data | [`r1`](LAP_prod_S1_brave-ext-fg_raw_r1.json) `2fd65c2f…cf83d518` · [`r2`](LAP_prod_S1_brave-ext-fg_raw_r2.json) `737a0189…42d92beb` · [`r3`](LAP_prod_S1_brave-ext-fg_raw_r3.json) `cfb4f8af…dec3462f`. Each SHA-256 was computed in the page and matches the saved file byte for byte. |

## Frame-cap gate (why these frame numbers are valid)

- Before these runs, Brave's window sat behind the Claude app and Brave limited it to 30 fps, then about 1 fps.
- After the window was brought to the foreground, an 8 s check on a neutral page measured **60.1 fps: p50 16.7 ms, p99 16.9 ms, max 17.0 ms, 0 intervals over 20 ms**.
- Every idle window below kept `document.hasFocus() === true` at start and end, with `visibilityState: visible`.

**Cause confirmed:** the cap in the earlier run came from the window being behind Claude, not from Energy Saver. Frame data from the [earlier run](LAP_prod_S1_brave-ext_summary_r1.md) is superseded by this file.

## ⚠ Cache: all three runs are warm

The cold-load condition was **not** met. The Brave cache still held the site, and no resource body came over the network in any run (**0 bytes**):

| Run | Headers only (≤ 400 B transferred) | From cache (0 B) |
|---|---|---|
| r1 | 16 | 11 |
| r2 | 16 | 14 |
| r3 | 16 | 14 |

In every run the document had `deliveryType: cache` with 300 B transferred.

- Load timings below are **warm repeat-visit timings**, not first-visit timings.
- The raw files' `cacheClass` column says `net` for the r2/r3 images. **That label is wrong.** They transferred 300 B with `encodedBodySize` 0, i.e. headers only. The transfer numbers in the raw data are correct; only my label was wrong.

## Results

| Metric | r1 | r2 | r3 | **Median** |
|---|---|---|---|---|
| TTFB (ms) | 179.4 | 405.8 | 91.7 | **179.4** |
| Document response end (ms) | 248.5 | 407.4 | 201.7 | **248.5** |
| DOMContentLoaded (ms) | 445.4 | 429.8 | 220.4 | **429.8** |
| Load event (ms) | 656.3 | 780.9 | 652.2 | **656.3** |
| **FCP** (ms) | 416 | 520 | 316 | **416** |
| **LCP** (ms) | 548 | 620 | 416 | **548** |
| LCP element | `IMG` `/kadence-chrome-logo.png` (all runs) | | | |
| **CLS** | 0 | 0 | 0 | **0** |
| Long animation frames (≥ 50 ms) during load | 2 | 2 | 1 | 2 |
| Longest load frame (ms) / its blocking (ms) | 124 / **51** | 78 / 0 | 70 / 0 | 78 / 0 |
| **Idle 15 s: fps** | 60.0 | 60.0 | 60.0 | **60.0** |
| Idle frame interval p95 / p99 / max (ms) | 16.8 / 16.8 / 16.9 | 16.8 / 16.8 / 17.1 | 16.8 / 16.9 / 17.2 | 16.8 / 16.8 / 17.1 |
| Idle missed frames | 0 | 0 | 0 | **0** |
| Idle long animation frames / long tasks | 0 / 0 | 0 / 0 | 0 / 0 | **0 / 0** |
| Idle WebGL draw calls / `texImage2D` calls | 0 / 0 | 0 / 0 | 0 / 0 | **0 / 0** |
| Globe decode (fps) / dropped frames | 23.8 / 0 | 23.9 / 0 | 24.0 / 0 | **23.9 / 0** |
| JS heap used (MB, Chromium coarse) | 7.7 | 7.9 | 8.0 | 7.9 |
| Hover video elements with a `src` / user activation | 0 / false | 0 / false | 0 / false | none |

Load-frame detail:
- **r1:** a 124 ms frame at 260 ms with 51 ms blocking (a task of ≈ 101 ms), 86 ms of it in style and layout.
- **r2:** the 51 ms frame at 582 ms carried 48 ms of script from `MessagePort.onmessage` in `07lhk_q6pmm3r.js`. That is the React scheduler, so this is hydration work.
- **r3:** a single 70 ms frame.

### Resource facts (identical in all runs; body sizes, not transfer)

- **JS:** 9 chunks, 480.9 KiB compressed.
  - The 145.2 KiB WebGL/R3F chunk `13-nfzv1f1bkb.js` starts at 258–477 ms **with no input**.
- **WebGL on the intro:** 1 WebGL canvas, and `window.__THREE__ === "184"`, in every run.
- **Fonts:**
  - The Google Fonts CSS declares 91 faces. Five are loaded on the intro (Inter ×3, Space Grotesk ×1, Syne ×1), from **3 `.woff2` files totalling 102.7 KiB** (r2/r3 data).
  - Anton, Google Sans Flex, Prompt and Syncopate had 0 faces loaded.
  - The Google Fonts CSS had `renderBlockingStatus` **`blocking` in r1** and **`non-blocking` in r2/r3**, when it came from cache with 0 ms duration. Don't treat the r2/r3 value as "not render-blocking"; a cold load is needed.
- **Images:** logos are 782.5 KiB + 230.2 KiB; the 14 tiles total 1,021.7 KiB. Tiles 08–14 are `loading="lazy"`.
- **`globe.mp4`:** 1080×1080, fully buffered [0, 30 s]. **It does not appear in Resource Timing in r1–r3** (it did in the throttled run, 11.25 MiB). Media requests are not reported reliably here, so globe bytes still need the Network panel.

## Interpretation (evidence only; no fixes proposed)

- **The idle intro is cheap on the main thread when the window is in the foreground.**
  - 900/900 frames on time.
  - No long frames and no long tasks across 45 s of idle in total.
  - The WebGL canvas issues no draw calls (frameloop `demand`).
- The globe keeps decoding at its native ~24 fps with 0 dropped frames.
- **What this does not show:** GPU or compositor cost (the full-screen filter, 15 `backdrop-filter` elements, 57 blend-mode elements). Main-thread rAF cadence cannot see GPU-side cost. That needs the Performance panel's GPU track or Frame Rendering Stats (R4).
- **The load has one hydration-time hitch** of 70–124 ms per frame, with up to 51 ms blocking (r1). It shows up even with everything cached, so it is CPU work, not network.
- **Unchanged from the earlier run:**
  - The canvas and 3D chunk are present on the intro (RCT-04).
  - three.js is evaluated on the intro (BND-01).
  - Oversized logos and tiles; the LCP element is the 230 KiB chrome logo (BND-03).
  - 91 font faces declared, 5 used on the intro (BND-02).

## Still missing for S1

| Item | Status |
|---|---|
| True cold load and transferred bytes (incl. `globe.mp4` in the first 10 s) | Not measured: warm cache. Needs a site-data clear in Brave, or DevTools "Disable cache". |
| Lighthouse Desktop/Mobile, Performance trace, HAR, Layers, Task Manager, `chrome://media-internals` | Not reachable from the extension |
| GPU ms/frame and compositor cost while idle | Not measurable from page JavaScript |
| cpu4x pass, Android pass | Not done |
