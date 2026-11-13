# S2 method, instrumentation and limits

## Context

- **Browser:** a second, separate Brave 157 instance (Chromium 157.0.8103.39) with a throwaway profile in Claude's scratchpad. **Your Brave profile, data and settings were not touched.** Same launch flags as [S1-cold](../S1-cold/S1-cold_report.md).
- **Viewport:** 1718×910 CSS px, DPR 1.09, on a 60 Hz display. The laptop was unlocked, and a `SetThreadExecutionState(ES_DISPLAY_REQUIRED)` hold kept the display on for the run (no settings changed).
- **Control:** Chrome DevTools Protocol from Node 26 (built-ins only).
- **Hover input:** `Input.dispatchMouseEvent` `mouseMoved` from a neutral point (x 1694, y 455: empty page area, outside every card and button) straight to the card centre.
  - These events are trusted browser input. Mouse moves **do not** grant user activation; I verified this (`navigator.userActivation.hasBeenActive === false` before the activation click).
  - The real OS pointer was parked on the taskbar. The *foreign pointer events* counter (pointer events at coordinates I did not dispatch) is reported in the tables.
- **Reference point "pointer enter":** the time the page's own `pointerover` listener saw the card, read from the page clock. Every timing is in ms relative to it.
  - CDP dispatch to page delivery took about 20–35 ms. That latency is excluded from all figures.

## What was recorded (all before any page script ran, via `Page.addScriptToEvaluateOnNewDocument`)

| Signal | How |
|---|---|
| Video source assignment / removal, `load()`, `play()`, `pause()` | Pass-through wrappers on `HTMLMediaElement.prototype` (`src` setter, `load`, `play`, `pause`) and `Element.prototype.removeAttribute('src')`. Each `play()` promise outcome (resolved / rejected + error name) is logged with `muted`, `volume` and `navigator.userActivation.hasBeenActive`. |
| Media events | Capture-phase listeners on `document` for `loadstart` … `ended` (e.g. `loadeddata`, `canplay`, `playing`, `waiting`, `seeked`) |
| **Presented frames** | `requestVideoFrameCallback` on the preview and full elements. It fires only when a frame is handed to the compositor for display, with `mediaTime` and `presentedFrames`. **A resolved `play()` is never treated as "playing".** "First visible motion" needs a *second* presented frame with advancing `mediaTime` while the layer is visible. |
| On-screen visibility | Every animation frame: computed `opacity` of the hover container (dim layer), the preview layer and the full layer; `paused` / `currentTime` / `readyState` / `muted` of all three videos; and the count of videos actually playing. |
| Frame intervals | `requestAnimationFrame` deltas (main-thread cadence; not GPU or compositor drops) |
| Long frames / tasks | `long-animation-frame` (with script attribution) and `longtask` observers |
| Network | CDP `Network` events: per-request start, first byte, end, bytes, status, `Range`, `fromDiskCache`, cancellation, `x-vercel-cache` |
| media-internals | CDP `Media` domain: decoder name, platform (hardware) decoder flag, resolution, pipeline and buffering events |
| GPU process CPU | `SystemInfo.getProcessInfo` CPU-time deltas per trial |
| Recordings | `Page.startScreencast` (JPEG, max 960×540) in separate `REC_*` trials. Each folder has an `index.html` flipbook with time labels. |
| Traces | Full Chromium traces (`TRACE_*`, gzip; open in the DevTools Performance panel) |

## Trial plan (single page, single session, in this order)

1. **Idle CPU, untraced:** 15 s on the intro.
2. **W: warm cache, no user activation.** All 14 grid cards + the "Explore Dev's Universe" cue (God Mode). Dwell 10 s (cue 12 s), then leave for 2.5 s. Then one rapid sweep.
3. **One activation click** on the plain heading text "What are you listening to?", which has no handler.
4. **B: warm cache, after activation.**
   - All 15 targets.
   - Repeats r2/r3 for Hip-Hop Central, Late Night and Global Top 50, and r2/r3 for the God Mode cue.
   - The Creator Collection God Mode card (`#vibe-dev-special`, reached by mouse wheel, which does not grant activation).
   - Two rapid sweeps.
5. **REC / TRACE:** recorded or traced warm trials (Late Night, God Mode cue, rapid sweep).
6. **C: cold cache.** `Network.clearBrowserCache` before every hover; all 15 targets plus a rapid sweep and one recorded cold hover.

**What "warm" means here:** before the run, every preview clip was fully pre-fetched into the throwaway profile's HTTP cache from a same-origin page ([`prewarm_log.json`](prewarm_log.json)). Fully pre-fetched:
- the full videos for Hip-Hop Central (Loser), Late Night (One Of The Girls) and Top Hindi (Gehra Hua);
- the first 5 MiB of God Mode's full video.

Other full videos were not cached, so in warm trials only the **preview** comes from cache for those cards. Each trial's network table shows what actually came from cache.

## Known limits

- **Network:** slow and lossy throughout (curl ≈ 250 KB/s; ping loss 40–80%). Cold trials and any network-bound step (full-video download, `/api/songs` prefetch) reflect that.
- **rAF intervals** measure main-thread frame cadence. Dropped frames purely on the compositor or GPU show only in the traces.
- **Audio:** whether sound actually reached the speakers was not recorded. "Audible" is inferred from `muted === false`, `volume`, `paused === false` and an advancing `currentTime`.
- **Instrumentation cost:** the per-frame sampler calls `getComputedStyle` on 3 elements and counts videos. A brightness readback from the first presented frame was used in the pilot only and then **removed**, because it caused a ≈ 60 ms long task ([pilot](../S2-pilot/)).
- **Recordings and traces add overhead.** Their timings are not mixed into the W/B/C tables.
- **Brave vs Chrome:** autoplay results are for Brave 157 with a fresh profile (no media-engagement history). Chrome, Edge, Firefox and Safari were not tested.
