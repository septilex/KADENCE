# S1: Cold homepage load and idle intro (partial, run r1)

> **Superseded for frame data** by [LAP_prod_S1_brave-ext-fg_summary.md](LAP_prod_S1_brave-ext-fg_summary.md) (foreground runs r1–r3 at a verified 60 fps). The production-commit verification (§1) and the static resource facts in this file still stand.

| | |
|---|---|
| Captured | 2026-11-11, 04:32–04:36 UTC (10:02–10:06 IST) |
| Target | `https://kadence-musicz.vercel.app/` (production) |
| Production build | **Consistent with `e5ab927`.** See §1. |
| Browser | Brave 157 (Chromium 157), Windows 11, the user's own profile. Driven by the Claude in Chrome extension in a new tab group window. |
| Machine | 10 logical cores; Intel UHD (active display, 1920×1080 at 60 Hz) plus an RTX 3050 Laptop GPU; plugged in (charging); Windows "Balanced" power plan |
| Viewport | 1718×876 CSS px, DPR 1.09. This is not one of the guide's reference sizes. |
| Runs | **r1 only.** The guide asks for 3 runs at cpu1x, 1 at cpu4x and 1 on Android. Only one run was done, with no throttling. |
| Method | In-page JavaScript only: Navigation, Resource, Paint, LCP, Layout-Shift and Long-Animation-Frame timing (buffered observers attached after load), plus DOM, media and WebGL state. No DevTools panels were used. |
| Raw data | [`LAP_prod_S1_brave-ext_load-raw_r1.json`](LAP_prod_S1_brave-ext_load-raw_r1.json). The SHA-256 computed in the page matches the file: `67ec35c9…7b66f709`, 11,901 B. |
| Screenshot | [`LAP_prod_S1_brave-ext_shot_r1.jpg`](LAP_prod_S1_brave-ext_shot_r1.jpg) (idle intro, 0.5× scale) |

## ⚠ Validity limits: read these before using any number

1. **This was not a cold load.** Brave's HTTP cache already held the site:
   - The document and 17 subresources were revalidated. `transferSize` was 300 B each, i.e. headers only, consistent with `304 Not Modified`. This is a heuristic.
   - 12 subresources, including `globe.mp4` and every JS/CSS chunk, came straight from cache (`transferSize` 0).
   - Only about 5.4 KB crossed the network.

   As a result:
   - **Load timings (TTFB, FCP, LCP, DCL, Load) are warm-cache figures.** They are not cold first-visit figures.
   - **Byte figures below are body sizes (`encodedBodySize`), not measured transfer.**
   - I did not clear the cache, because that would change your browser data.
2. **Brave capped this window's frame rate.**
   - `requestAnimationFrame` ran at about 33–36 ms (≈ 28–30 fps) for about 6 frames after each tool interaction, then fell to **about 1,016 ms (≈ 1 fps)**.
   - Long-animation-frame entries from 1.16 s to 31 s are a steady run of ~1,016 ms frames with **0 ms blocking and no script attribution**. That pattern is a browser-imposed cap, not app work.
   - The likely causes are that the window was not in the foreground or unobstructed, and/or Brave's Energy Saver. Neither was confirmed.
   - **Every frame-cadence, idle-GPU and dropped-frame figure is therefore invalid**, and none is reported below.
3. **The extension drives the tab through a debugger-style connection.** That may add small overhead. It does not affect resource sizes or DOM state.
4. **Long tasks were not reliably captured.** The `longtask` observer was attached after load and returned 0 entries. The long-animation-frame data contradicts that (see §3), so the 0 is not used.

## 1. Production commit verification

Method: I fetched each production JS chunk from the browser cache inside the page and counted string literals. I then compared the counts with local source (`git show`).

| Literal | `e5ab927^` source | `e5ab927` source | Expected at runtime for `e5ab927` (type-only uses are stripped) | Production chunk `0eeoal4h.6o6h.js` |
|---|---|---|---|---|
| `'DWELLING'` | 2 | 0 | 0 (parent build would have 1) | **0** |
| `'PREVIEWING'` | 3 | 3 | 2 | **2** |
| `'FULL_PLAYBACK'` | 2 | 2 | 1 | **1** |

**Result:** the production hover-video code matches `e5ab927`, not its parent. This does not rule out a later commit that leaves this file unchanged. Local `main` and `origin/main` are both at `e5ab927`.

## 2. Measured results (S1 metrics)

| S1 metric | Value | Status |
|---|---|---|
| Navigation | `navigate`, h2, `deliveryType: cache`, status 200; document body 8.6 KiB compressed / 57.3 KiB decoded | Measured (warm) |
| DNS / connect / TTFB | 74.2 ms / 141.5 ms / 304.6 ms | Measured (warm: includes the revalidation round trip) |
| DOMContentLoaded / Load | 398.1 ms / 602.2 ms | Measured (warm) |
| FCP | **508 ms** | Measured (warm, before the 1 fps cap began) |
| LCP | **692 ms**; final element `IMG` = `/kadence-chrome-logo.png` (230.2 KiB file, 1110×342 natural, shown 899×277) | Measured (warm) |
| LCP candidates | 508 ms nav `BUTTON` text → 572 ms `/kadence-horizontal-logo.png` → 692 ms `/kadence-chrome-logo.png` | Measured |
| CLS | **0** (one layout-shift entry, value 0) | Measured |
| Long animation frames during load | 373 ms: **110 ms frame, 33 ms blocking, ~71 ms in style + layout**; 598 ms: 61 ms frame, 0 blocking. No script attribution was returned. | Measured. The 33 ms blocking implies a task of ≈ 83 ms during hydration. |
| Resources | 29 entries: 17 revalidated, 12 from cache | Measured |
| **JS (all chunks)** | **9 chunks, 480.9 KiB compressed / 1,707.5 KiB decoded** | Measured (body sizes) |
| JS loaded before hydration (start < 500 ms) | 8 chunks, **335.7 KiB compressed** | Measured |
| JS loaded after hydration with **no input** | `13-nfzv1f1bkb.js` at 570 ms: **145.2 KiB compressed / 535 KiB decoded**. Contains 36 × `WebGLRenderer` and 12 × `frameloop`, i.e. the R3F / WebGL renderer chunk. | Measured (content by string match) |
| three.js on the intro | `window.__THREE__ === "184"`, so three.js was evaluated on the idle intro. Initial chunk `02hvssugk.d_m.js` (101.6 KiB compressed) contains `CanvasTexture` ×3 and `"184"` ×3. | Measured (global). Chunk attribution by string match. |
| CSS | 1 app stylesheet, 10.1 KiB compressed, **render-blocking** | Measured |
| Google Fonts | `fonts.googleapis.com/css2` is **render-blocking**, 37.1 KiB decoded. It declares **91 `@font-face`** rules. On the idle intro, **5** faces were loaded: Inter ×3, Space Grotesk ×1, Syne ×1. Anton (3), Google Sans Flex (10), Prompt (28) and Syncopate (2) had 0 loaded. | Measured. The `.woff2` files did **not** appear in Resource Timing, so font bytes were not measured. |
| Logos | `kadence-horizontal-logo.png` **782.5 KiB**, 2172×724, shown at **132×44**; `kadence-chrome-logo.png` **230.2 KiB**, 1110×342, shown at 899×277 | Measured |
| Tile images | 14 WebPs, **1,021.7 KiB total**, each 1024×1024, shown at **157×157** CSS px. Tiles 01–07 are `eager` (preloaded via `<link>`). **Tiles 08–14 are `loading="lazy"`**; at this viewport the second row is partly visible above the fold (screenshot). | Measured |
| All images | 16 files, 2,034.4 KiB | Measured |
| `globe.mp4` | **11.25 MiB** (11,797,872 B) body, status 206, served from cache. 1080×1080, 30 s loop, `preload="auto"`, muted autoplay, CSS `filter: contrast(1.3) brightness(1.4) saturate(1.2)`. Fully buffered [0, 30 s] by 36 s. | Measured. Bytes in the first 10 s over the network: **not measurable** (cached). |
| Total body bytes the intro needs | **13.73 MiB** including the globe; **2.48 MiB** without it. Excludes `.woff2` fonts, which were not reported. | Measured as body sizes, a lower bound for a cold visit. **Not** measured transfer. |
| Canvas on the intro | **1** WebGL canvas, backing store 1873×955 (= 1718×876 × 1.09) | Measured |
| Idle WebGL activity (10.01 s, no input) | **0 draw calls, 0 `texImage2D` calls** | Measured. A zero count is valid despite the frame cap. |
| Globe decode while idle (same 10.01 s) | **241 frames decoded (24.1 fps), 0 dropped**; `currentTime` advanced 7.25 → 17.26 s | Measured. Decode rate only; presentation and compositing cost not measured. |
| Hover video elements while idle | 2 elements, no `src`, `preload="none"`, `readyState` 0, opacity 0. No preview was fetched. | Measured |
| User activation | `navigator.userActivation.hasBeenActive === false` throughout | Measured |
| Compositing census (idle intro) | **15** elements with `backdrop-filter`, **57** with a non-normal `mix-blend-mode`, **22** with `will-change`, **20** with `filter`, **22** running animations (`document.getAnimations()`) | Measured (counts only; cost not measured) |
| DOM nodes / JS heap | 299 nodes; `usedJSHeapSize` 7.5 MB (Chromium coarse value) | Measured |

## 3. What this run supports (evidence only, no fixes)

| Audit item | What this run shows | Strength |
|---|---|---|
| RCT-04 / CF-20: canvas and Universe chunk on the intro | 1 WebGL canvas exists; the 145 KiB WebGL/R3F chunk is fetched at 570 ms with no input; `__THREE__` is set | **Confirmed in production** |
| BND-01 / CF-19: three.js in the initial bundle | three.js evaluated on the intro; three.js markers found in a chunk loaded before hydration | Strongly indicated. A bundle analyser (R13) is still needed for module-level attribution. |
| BND-02 / CF-21: render-blocking Google Fonts | Google Fonts CSS has `renderBlockingStatus: blocking`; 91 faces declared, 5 used on the intro | **Confirmed** (render-blocking). Font bytes not measured. |
| BND-03 / CF-22: oversized logos and tiles | 782.5 KiB logo shown at 132×44; LCP element is the 230 KiB chrome logo; 1024² tiles shown at 157² | **Confirmed** |
| INT-14: lazy above-the-fold tiles | Tiles 08–14 are `lazy` and partly visible at 1718×876 | Confirmed at this viewport |
| CF-14 (idle globe) | The globe decodes continuously at 24 fps with a full-screen CSS filter on the idle intro | Decode confirmed; GPU cost **not measured** |
| GL-02 on the intro (frameloop) | 0 draw calls while idle, consistent with `frameloop='demand'` when there are no songs | Measured |
| "Cold bytes ≈ 14 MB" estimate | Body-size total 13.73 MiB (fonts excluded) | Consistent. Real transfer still unmeasured. |

## 4. Missing diagnostics (not captured, and why)

| S1 item | Why it is missing |
|---|---|
| Lighthouse Desktop/Mobile (FCP, LCP, TBT, Speed Index, scores) | DevTools Lighthouse cannot be driven by the extension |
| True cold load (Disable cache) and transferred bytes, `globe.mp4` bytes in the first 10 s | No cache control from the extension; your profile's cache was warm |
| Performance trace (`S1_trace`, `S1_idle-trace`), Summary breakdown, GPU ms/frame, dropped frames | No DevTools Performance panel access. Frame data is also invalidated by the 1 fps cap. |
| HAR | No DevTools Network export |
| CPU 4× throttle pass | Not available from the extension |
| Task Manager (tab memory, GPU memory, GPU-process CPU %) | Browser UI, not reachable |
| `chrome://media-internals` (globe hardware/software decoder) | JavaScript and navigation on `chrome://` pages are blocked |
| Layers panel (layer count, memory) | DevTools only |
| Long-task count and maximum during load | `longtask` entries were not buffered for a late observer |
| Runs r2, r3; Android (AND) pass | Not done; one run only |

## 5. Needed before S1 can be completed

1. **Make frame measurements valid:**
   - Bring the Brave window that Claude opens to the foreground, unobstructed, and leave it there during runs.
   - Turn off Brave's Energy Saver (Settings → System → Performance) for the session.
   - Then re-measure idle frame cadence and long-animation frames.
2. **Get a cold load:**
   - Either you clear the site data for `kadence-musicz.vercel.app` in Brave before each run (your browser data, your call),
   - or you run S1b manually in DevTools with "Disable cache" on.
3. **DevTools-only items** (Lighthouse, trace, HAR, Task Manager, media-internals, Layers) have to be captured by you, following the guide on branch `origin/docs/perf-recovery-plan` (`docs/perf-baseline/SCENARIOS.md` §S1).
