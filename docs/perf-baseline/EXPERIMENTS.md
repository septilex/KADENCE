# P0.1 Profiling Guide — Part 3: Stand-alone hypothesis experiments and visual references

Some hypotheses need an A/B comparison or a special environment that the six scenarios do not provide. Run these after S1–S6, on **LAP prod cpu1x** unless stated otherwise. GPU figures always use the **GPU-track ms/frame** method ([PROFILING_GUIDE.md §2.5](PROFILING_GUIDE.md)).

**A/B rule:** every A/B pair is recorded in the **same tab and the same state**, back to back:
1. A = effects on; B = effects off with K2; then A again to check for drift.
2. Each recording is 10 s with no input, unless stated otherwise.
3. Reload the page when the experiment is finished.

---

## HY-3 — `backdrop-filter`s over the live canvas

**Threshold:** ≥ 2 ms GPU per frame saved → *Confirmed*. Gates B5 (refresh blur) and any proposal to change the Navbar/Search glass buttons.

1. Open a settled **Late Night** wall with a track playing, pointer at the very top edge, no tooltip showing. Install **K2**.
2. **A:** Record 10 s → save `LAP_prod_HY3_cpu1x_A1.json.gz`.
3. **B:** In the Console run `__kpFx('backdrop')` → Record 10 s → save `…_B.json.gz`.
4. **A again:** run `__kpFx()` → Record 10 s → save `…_A2.json.gz`.
5. Repeat steps 2–4 with the **Search panel open** (magnifier icon in the Navbar). Save as `…_HY3search_…`.
6. For each recording, compute GPU ms/frame over the middle 5 s.
7. **Result:** A (mean of A1 and A2) − B, for the wall and for the wall with Search open.

The roadmap's §3.2 row lists the gated tasks as "H1b, H6". Elsewhere in the roadmap, B5 is the task gated on HY-3, and H6 is gated on HY-13. Record the HY-3 result as gating **B5** and any future Navbar/Search glass change.

## HY-4 — Intro card backdrop and blend layers re-evaluated per video frame

**Threshold:** ≥ 2 ms GPU per frame, or visible jank while scrolling the intro → *Confirmed* (H4).

1. Idle intro (globe playing), pointer outside the window. Install **K2**.
2. **A:** Record 10 s.
3. **B:** Run `__kpFx('backdrop','blend')` → Record 10 s.
4. **A again:** run `__kpFx()` → Record 10 s.
5. Save as `LAP_prod_HY4_cpu1x_{A1,B,A2}.json.gz`.
6. **Scroll test:** Record while you scroll with the mouse wheel to the Creator Collection and back (about 4 s). Do this once with effects on and once with `__kpFx('backdrop','blend')`. Count dropped frames in each.
7. **Visual checks (screen recordings, not traces):**
   - Rendering → ☑ **Layer borders** for 5 s, then ☑ **Paint flashing** for 5 s.
   - Save as `LAP_prod_HY4_cpu1x_layers-rec.mp4` and `…_paintflash-rec.mp4`.
   - Green flashing over the cards every frame means they are repainted per video frame.
   - Also take a Layers panel screenshot (count and memory).

## HY-5 — Song Detail SVG glass filter

**Threshold:** ≥ 4 ms raster per frame during the drawer animation → *Confirmed* (H3).

1. Open a settled wall. Install **K2**.
2. **A:** Record while you open Song Detail by clicking a tile, wait 2 s, then click **Close**.
3. **B:** Run `__kpFx('svgfilter')` and repeat the same open/close.
4. **A again:** run `__kpFx()` and repeat.
5. **Compare:** raster time per frame during the open animation, and the idle-open GPU ms/frame.
6. Save as `LAP_prod_HY5_cpu1x_{A1,B,A2}.json.gz`.

## HY-13 — CinematicBackground blur on song switch

**Threshold:** ≥ 4 ms per frame during the 1.2 s transition → *Confirmed* (H6).

1. Open Song Detail. Install **K2**.
2. **A:** Record while you click **Next Track**; wait 2 s, then Stop.
3. **B:** Run `__kpFx('cinematic')` and repeat.
4. **A again:** run `__kpFx()` and repeat.
5. **Compare:** paint + raster + GPU ms/frame over the 1.2 s transition.
6. Save as `LAP_prod_HY13_cpu1x_{A1,B,A2}.json.gz`.

## HY-14 — Animated `box-shadow` (loader ring, card hover)

**Threshold:** ≥ 3 ms paint per frame → *Confirmed* (H5).

No extra run is needed. Read the result from:
- **S3** (loader visible, T3→T4)
- **S2a** (card hover transition)

**Method:**
1. In the normal (not advanced) traces, sum the Main-thread **Paint** time plus the raster time per frame over the window.
2. Use the S5 paint-attribution approach only to confirm *which* element repaints.

## HY-7 — Unmuted hover autoplay rejected for first-time visitors

**Threshold:** any rejection or frozen frame observed → *Confirmed* (D3 becomes required).

Run each browser below **3 times**, every time in a brand-new private window:
- **Chrome Guest:** Chrome menu → Profiles → Open Guest.
- **Edge InPrivate.**
- **Safari Private** (only if a Mac is available).
- **Chrome Android:** not applicable, because there is no hover.

Steps for each attempt:
1. Open the private window, then open DevTools (F12) **before** loading the page.
2. Type `<PROD_URL>` and press Enter. **Do not click, tap or press any key inside the page.**
3. Install **K1**. Its install line must report `pageActivated: false`.
4. Hover **Global Top 50** for 4 s, then **Late Night** for 4 s.
5. Run `copy(__kp.summary())` and save as `LAP_prod_HY7_{chrome,edge,safari}_kp_rN.json`.
6. Observe and note:
   - Did moving video appear, or a still frame?
   - Was there sound?
   - Look at `media.autoplayBlocked`, `media.playRejectedByReason` and `video.perFile[…].secondsVisibleWhilePaused`.
7. Chrome only: open `chrome://media-engagement` and note the score for the origin (expected 0 in Guest).
8. Screen-record one Chrome attempt as `LAP_prod_HY7_chrome_rec.mp4`.

**Interpretation:**
- **`NotAllowedError`** → *Confirmed*: the browser blocked unmuted playback.
- **Frozen frame without `NotAllowedError`** (preview revealed but not playing) → also a CF-15 symptom. Record it.

## HY-9 — iTunes latency and rate limits in production

**Threshold:** p95 cold > 1.5 s, or any 403/429 → *Confirmed* (raise the F6/F7 priority).

### Part 1 — Vercel dashboard (read-only)

Do this right after S3/S6, because log retention may be short on your plan.

1. **Vercel → kadence-musicz → Logs.** Filter by path `/api/songs`. Note for each request in the window:
   - status
   - duration
   - cold/warm (if shown)
   - any upstream error lines (the route logs upstream activity)
2. **Observability → Functions:** note p50, p75 and p95 duration, the invocation count, and the error rate for `/api/songs` over the longest window available.
3. **Search the logs** for `403`, `429`, `rate`, `fetch failed` and `timeout`. Note the counts.
4. **Save:** screenshot each view as `HY9_vercel-logs.png` and `HY9_vercel-observability.png`.

### Part 2 — Controlled timing script

This is run by you, from PowerShell, against production. It calls only `/api/songs`. Each chart request makes about 8 iTunes calls, so the script spaces calls 30 s apart to stay under iTunes's informal limit of about 20 calls per minute. **Do not shorten the sleep.**

```powershell
$base  = "https://<PROD_URL>"          # fill in
$vibes = "global-top-50","late-night","top-kpop"
foreach ($v in $vibes) {
  foreach ($i in 1..2) {
    $out = curl.exe -s -o NUL -D - -w "RESULT vibe=$v run=$i status=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s bytes=%{size_download}`n" "$base/api/songs?vibe=$v"
    $out | Select-String -Pattern "^RESULT|x-vercel-cache|x-vercel-id|cache-control|age:" | ForEach-Object { $_.Line }
    Start-Sleep -Seconds 30
  }
}
```

- Save the output as `HY9_curl.txt`.
- Run 1 of each chart may hit a cold server cache, and run 2 may hit the instance's in-memory cache. Note the `x-vercel-id`: different IDs mean different function instances, which do not share the in-memory cache (CF-24).

## HY-10 — Fragment shader cost at DPR 1.0 vs 1.5

**Threshold:** ≥ 25% GPU time difference → *Confirmed* (B8).

1. Note the native `devicePixelRatio` (K1 prints it). The canvas uses `min(DPR, 1.5)`.
2. Turn on the Device Toolbar (Ctrl+Shift+M):
   - Dimensions: *Responsive*, set to your full window size.
   - **Device pixel ratio = 1**, then reload.
3. Enter **Late Night** and let it settle.
4. Record 10 s at rest, then 10 s with a slow continuous mouse circle over the wall.
5. Set **DPR = 1.5**, reload, and repeat steps 3–4.
6. Save as `LAP_prod_HY10_cpu1x_dpr{1,15}_{rest,move}.json.gz`.
7. **Result:** GPU ms/frame at DPR 1.5 ÷ GPU ms/frame at DPR 1.0 − 1, for both rest and move.
8. Turn off the Device Toolbar when finished.

## HY-15 — One-file playback vs. 3 s preview: time to first frame

**Threshold:** full-file TTFF within 150 ms of preview TTFF → *Confirmed*; choose D7 over D6.

1. Open the production intro, idle, no hover. Network: ☑ **Disable cache**, throttling **Fast 4G**.
2. Install and run **K3** (`kp-ttff`). It takes about 2 minutes.
3. Run `copy(__kpTtff)` and save as `LAP_prod_HY15_fast4g_ttff.json`.
4. Repeat once with **No throttling** and save as `…_HY15_cpu1x_ttff.json`. This is for context only; the decision uses Fast 4G.
5. Set throttling back to No throttling when finished.

**Note:** this measures the *current* encodes. Mark the verdict **provisional** and re-run after D5.

## HY-6 / HY-8 / HY-11 / HY-12 / HY-1 / HY-2

These are measured inside the scenarios:

| Hypothesis | Measured in |
|---|---|
| HY-1 | S4 |
| HY-2 | S3 |
| HY-6 | S2b |
| HY-8 | S4-dev |
| HY-11 | S4 (baseline only; deferred to after Phase 1) |
| HY-12 | S4-dev / S4-prod |

---

## Visual references (for the §8.2 visual-parity protocol)

**Never capture references with K2 active, with Rendering overlays on, or with Device Toolbar DPR overrides other than those listed below.** Reload the page first.

### Make the wall reproducible first

Wall content comes from the live API, and the server assigns `x`/`y`/colour with `Math.random()` (CF-26), so two sessions never render identical walls. Pin the response with **Local Overrides**. This is a browser-side feature that leaves the repo untouched.

1. Create an empty folder **outside the repo**, e.g. `C:\kadence-perf\overrides`.
2. DevTools → **Sources → Overrides** → *Select folder for overrides* → choose that folder → **Allow**.
3. Enter **Late Night** once. In Network, right-click the `/api/songs?vibe=late-night` request → **Override content**. Repeat for `workout`.
4. From now on, those charts always return the same payload, in this profile only.
5. Turn overrides off afterwards: Sources → Overrides → untick *Enable Local Overrides*.

The 0.5% pixel-diff tolerance can only be applied to views that are deterministic with this override. **Video-driven views** (globe, hover video) and **animated views** are compared with screen recordings, not pixel diffs.

### Screenshots

How to capture:
1. Device Toolbar (Ctrl+Shift+M) → Responsive → enter the size and DPR.
2. Ctrl+Shift+P → **Capture screenshot** (viewport).
3. For the intro, also use **Capture full size screenshot**.

Sizes: **1920×1080 @ DPR 1**, **1366×768 @ DPR 1**, **390×844 @ DPR 3**. Name each file `VIS_{view}_{size}.png`, e.g. `VIS_V05_1366x768.png`.

| # | View | How to reach it |
|---|---|---|
| V01 | Intro, top, idle | Load the page; wait 3 s; pointer outside the window |
| V02 | Intro, full page | Capture full size screenshot |
| V03 | Creator Collection section | Scroll to it with the wheel |
| V04 | Intro tile hover state | Hover Global Top 50 for 1 s, then screenshot. The card's state matters; the background video frame will differ between captures. |
| V05 | Wall, settled, no tooltip | Late Night (overridden); pointer at the top edge |
| V06 | Wall with tooltip | Hover a specific tile. Use the same tile each time: note its row and column. |
| V07 | Popped tile | Dwell 1.5 s on the same tile |
| V08 | Preview tint (`PreviewVideoLayer`, AC-1) | Click the popped tile |
| V09 | Song Detail open, playing | Click a tile (not popped) |
| V10 | Song Detail paused at about 40% | Pause, then click the scrubber at about 40% |
| V11 | Search panel with results | Magnifier icon → type `love` → wait for results |
| V12 | Switch Chart overlay | Navbar → Switch Chart; pointer outside the cards |
| V13 | Refresh in progress (blur) | Click Refresh, then screenshot within 0.5 s |
| V14 | Loader | Click a chart on the intro, then screenshot while the ring shows. Network throttling *Slow 4G* helps; turn it off afterwards. |

### Screen recordings (60 fps, 1920×1080)

How to record:
- Use the Windows **Xbox Game Bar** (Win+Alt+R). Set Settings → Gaming → Captures → *Video frame rate* = **60 fps** first.
- OBS works too, if you already use it.

Record each of these:

| # | Recording | Content |
|---|---|---|
| R1 | Intro idle, 10 s | Globe motion, card idle animations |
| R2 | Intro hover, 8 s | Hover Global Top 50 (or Dev's Universe), stay through the handoff at about 3 s, leave |
| R3 | Chart entry | Click Late Night → loader → wall reveal → first track |
| R4 | Wall interaction, 15 s | Slow hover, fast sweep, pop, preview tint |
| R5 | Song Detail | Open, play, scrub, next track, close. This is the **DEC-3 reference** for the drawer feel. |
| R6 | Switch Chart | Open → hover three charts → switch → Esc on a second open. Keep the sound on: this is **DEC-1** evidence. |
| R7 | Refresh | Click Refresh until the wall is complete |
| R8 | Search | Open, type, select a result, close |

Name each file `VIS_R{n}_1920x1080.mp4`. Record R2 and R6 **with system audio**.
