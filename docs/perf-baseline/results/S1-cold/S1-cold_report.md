# S1: True cold-cache homepage load (clean browser context)

| | |
|---|---|
| Captured | 2026-11-11, 06:03–06:29 UTC (11:33–11:59 IST) |
| Target | `https://kadence-musicz.vercel.app/` (production; build consistent with `e5ab927`, see [the earlier S1 summary](../LAP_prod_S1_brave-ext_summary_r1.md) §1) |
| Browser context | **A second, separate Brave 157 instance** (Chromium 157.0.8103.39) launched with a throwaway `--user-data-dir` in Claude's scratchpad. **Your own Brave profile, its data and its settings were not touched.** |
| Launch flags (this instance only) | `--remote-debugging-port=9333 --no-first-run --no-default-browser-check --start-maximized --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`. The last three stop the window from being throttled when another window covers it. |
| Control | Chrome DevTools Protocol from a Node script (Node 26 built-ins only; nothing installed) |
| Cache | Before each run: `Network.clearBrowserCache` + `Network.clearBrowserCookies` in the throwaway profile. Every resource in every run came from the network (`fromDiskCache: false` on all 33 requests). |
| Viewport | 1718×910 CSS px, DPR 1.09 |
| Runs | `cpu1x_r1`, `cpu1x_r2`, `cpu1x_r3`, `cpu4x_r1` (CPU throttled 4× via `Emulation.setCPUThrottlingRate`) |
| Evidence per run | `*_trace.json.gz` (load trace with screenshots; open in the DevTools Performance panel), `*_idle-trace.json.gz` (15 s idle), `*_result.json` (network log, media events, in-page metrics, process CPU), `*_shot.jpg`. Summary: [`S1-cold_summary.json`](S1-cold_summary.json). |

## ⚠ The network was slow and highly variable during these runs

Measured outside the browser with `curl`:

| Time (IST) | Check | Result |
|---|---|---|
| ≈ 11:54–11:56 (**before** standby) | `kadence-horizontal-logo.png` (801 KB) | 65 KB/s |
| same | `globe.mp4` | 5.07 MB received in a 60 s cutoff, 84 KB/s |
| same | cdnjs `three.module.min.js` (671 KB) | 95 KB/s |
| same | cdnjs `pdf.worker.min.mjs` (1.03 MB) | 33 KB/s |
| 12:01–12:07 (**during** Modern Standby, see below) | cdnjs `three.module.min.js`, 3 attempts | 72, 262, 26 KB/s |
| same | `ping 1.1.1.1` / `ping kadence-musicz.vercel.app` | 66% and 40% loss / 50% loss |

**Modern Standby.** Windows' Kernel-Power log shows the laptop entering Modern Standby (display off) at **11:59:49 IST** (event 506), with no user input since ≈ 11:49.
- All four S1 cold runs happened **before** that point. By the run timeline, `cpu4x_r1`'s idle window ended at about 11:59:44.
- The 12:01–12:07 packet-loss and throughput figures were taken **during standby**, when Windows throttles networking. **They are not evidence about the link itself.**

Before standby, throughput was still only ≈ 33–95 KB/s (≈ 0.3–0.8 Mbps), and the in-browser runs varied 8× (r1 LCP 6.1 s vs r3 49.1 s). The cold timings below are **real but dominated by a slow, variable network**. They should not be read as typical first-visit timings. Repeat on a stable connection, or with a fixed DevTools network profile, before using them as a baseline.

## Results

| Metric | cpu1x r1 | cpu1x r2 | cpu1x r3 | cpu4x r1 |
|---|---|---|---|---|
| TTFB (ms) | 334 | 10,485 | 2,529 | 617 |
| FCP (ms) | **1,720** | **13,104** | **7,868** | **5,156** |
| LCP (ms) | **6,120** | **26,104** | **49,148** | **26,640** |
| LCP element | `/kadence-chrome-logo.png` (all runs) | | | |
| DOMContentLoaded / Load (ms) | 1,633 / 5,657 | 13,065 / 25,300 | 7,834 / 49,013 | 5,180 / 26,258 |
| CLS | 0 | 0 | 0 | 0 |
| Long tasks during load (≥ 50 ms; observer active from document start) | 0 | 0 | 0 | **4**: 168, 51, 166, 63 ms |
| Requests (all from network) | 33 | 33 | 33 | 33 |
| Bytes transferred, excluding `globe.mp4` | 2.72 MB | 2.56 MB | 2.56 MB | 2.72 MB |
| `globe.mp4` | **no response within the run** (≈ 30 s) | 206 after 6.4 s; `x-vercel-cache: HIT` | 206 after 1.3 s | 206 after 0.8 s |
| Globe player state | media player created, never decoded | repeated `BUFFERING_HAVE_NOTHING` (`DEMUXER_UNDERFLOW`) | same | same |
| Globe decoder | — | `D3D11VideoDecoder`, platform (hardware) decoder = true | same | same |

### Why LCP is so late: it waits for the last initial JS chunk

The LCP element is the chrome logo inside the client-rendered intro. Across all four runs, **LCP lands 0.1–0.9 s after the last initial JS chunk finishes downloading**, not when the logo image arrives (the logo finished in 1.1–4.0 s in every run):

| Run | Last initial JS chunk done (ms) | Which chunk | LCP (ms) |
|---|---|---|---|
| cpu1x r1 | 5,610 | `0dbhjjzl8qfwv.js` | 6,120 |
| cpu1x r2 | 25,260 | `0eeoal4h.6o6h.js` | 26,104 |
| cpu1x r3 | 48,972 | **`02hvssugk.d_m.js`** (the chunk with three.js markers) | 49,148 |
| cpu4x r1 | 26,074 | **`02hvssugk.d_m.js`** | 26,640 |

- These chunks downloaded **at the same time as `globe.mp4`** (`preload="auto"`, 11.8 MB), all over the same HTTP/2 connection.
- In r3 the 102 KB three.js chunk took **25.5 s** from first byte to completion.

**Interpretation:**
- **Confirmed:** the first meaningful paint of the intro depends on every initial JS chunk, including the three.js chunk (BND-01).
- **Hypothesis, not confirmed:** the globe download slows those chunks down. I tried an A/B with `globe.mp4` blocked (`Network.setBlockedURLs`, throwaway profile only), but its first navigation timed out at ≈ 12:00, **during Modern Standby**, so **the experiment is inconclusive**. It should be repeated on a stable connection.

### Main thread at 4× CPU

- `07lhk_q6pmm3r.js` (framework) evaluation: **168 ms** long task.
- `02hvssugk.d_m.js` (three.js markers) evaluation: **166 ms** long task.
- At 1× CPU, no task exceeded 50 ms.
- The longest load-time animation frames (1.2–5.3 s) had little blocking time (0–468 ms). Their length comes from waiting on the network, not from script.

### Idle intro (15 s, starting 15 s after load, no input)

| | cpu1x r1 | cpu1x r2 | cpu1x r3 | cpu4x r1 |
|---|---|---|---|---|
| fps / max frame interval (ms) / missed frames | 60.1 / 17.1 / 0 | 60.1 / 17.1 / 0 | 60.1 / 17.0 / 0 | **52.8 / 915.5 / 80** |
| Long animation frames ≥ 50 ms | 0 | 0 | 0 | 3 (135, 796, 514 ms; 0 ms blocking) |
| Globe frames decoded / dropped | 0 / 0 (not loaded) | 90 / 2 | 27 / 0 | 130 / 13 |
| WebGL draw calls | 0 | 0 | 0 | 0 |
| Canvas present at +10 s | 1 | **0** | **0** | **0** |
| Hover videos with `src` / user activation | 0 / false | 0 / false | 0 / false | 0 / false |

- **Canvas 0 in r2–r4 is not a contradiction of RCT-04.** On the slow link, the Universe chunk `13-nfzv1f1bkb.js` only started at 25–49 s (after hydration), so the canvas had not been created yet when sampled.
- **Globe decode counts are low because the globe was still starved of data** (repeated underflow), not because of decoder load.
- The 4× idle hitches (796 ms and 514 ms frames) had 0 ms script blocking. Their cause is **not attributed**; it is in `LAP_prod_S1_cpu4x_r1_idle-trace.json.gz` for DevTools inspection.

### Process CPU while idle: contaminated, do not use

Per-process CPU was sampled with `SystemInfo.getProcessInfo` **while a trace was recording**:
- the tracing service itself used 22–25% of a core;
- the GPU process showed 71–109% of one core;
- the renderer showed 28–31% (161% at 4×).

Tracing with the `gpu`/`viz` categories inflates these figures, so they are **not** idle-cost evidence. S2 records an untraced idle sample instead.

## Still not captured for S1

| Item | Why |
|---|---|
| Lighthouse Desktop/Mobile | Needs the Lighthouse package or DevTools UI; nothing was installed |
| Cold load on a stable network | The link was slow and variable (≈ 0.3–0.8 Mbps by curl before standby); repeat later |
| Globe-blocked A/B | Inconclusive (navigation timed out while the laptop was in Modern Standby) |
| Android pass | No device connected |
| HAR file | Not exported as HAR; the equivalent per-request log is in each `*_result.json` (`network`) |
