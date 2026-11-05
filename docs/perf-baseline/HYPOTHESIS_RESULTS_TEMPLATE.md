# P0.1 baseline results — template

> Copy this file to `RESULTS_P0.1.md` and fill it in. Medians for ×3 runs. Leave a cell as `—` if the item does not apply, and write `NM` (not measured) with a reason if you skipped it.

**Two kinds of result go in this document. Keep them apart.**

| Part | Content | Is there a verdict? |
|---|---|---|
| **A — Confirmed issues (CF)** | Proven from source or build output (roadmap §3.1). The baseline only *quantifies* them, so later PRs can show the gain. | **No.** These issues are real whatever the numbers say. Do not mark them "rejected". |
| **B — Hypotheses (HY)** | Unproven (roadmap §3.2). Each one has a threshold, and the gated task starts only if it is met. | **Yes.** One of the verdicts below. |

**Verdicts for Part B**

| Verdict | Meaning | Effect on the gated task |
|---|---|---|
| **CONFIRMED** | Threshold met on the reference laptop (cpu1x unless stated) | Gated task proceeds |
| **REJECTED** | Measured, and below the threshold | Gated task is dropped or parked; note why |
| **INCONCLUSIVE** | Measured, but noisy or borderline (within ±10% of the threshold), or runs disagree | Re-run with more repetitions before deciding |
| **DEFERRED** | Can only be decided after a later phase; the baseline is still recorded | Revisit at the named phase |
| **PROVISIONAL** | Decided on current assets that a later task will change | Re-run after the named task |

---

## §0 Environment

| Field | LAP | AND |
|---|---|---|
| Date / time of the session | | |
| Device model, CPU, RAM | | |
| GPU and driver (`chrome://gpu`) | | — |
| Hardware video decode (`chrome://gpu`) | | |
| Chrome version | | |
| OS version | | |
| Display refresh rate / Windows scaling / `devicePixelRatio` | | |
| Window inner size used | | |
| Power: plugged in / power mode / Energy saver off | | |
| Production URL | | |
| **Production deployment commit** (expected `e5ab927`) | | |
| Dev server URL and commit | `http://localhost:3000` @ | — |
| Artefact folder / link | | |

---

## Part A — Confirmed issues: baseline quantification (no verdict)

"Audit expectation" is the estimate in the audit and roadmap §10. Fill in what you measured.

| CF | Metric | Source | Audit expectation | LAP cpu1x | LAP cpu4x | AND | Target (roadmap §10) |
|---|---|---|---|---|---|---|---|
| CF-1, CF-3 | `Home` commits in 10 s of passive playback | S4-dev Profiler | ~80 | | — | — | 0 |
| CF-1, CF-4 | `Home` commits per wall tile crossed | S4-dev Profiler | 1 | | — | — | 0 |
| CF-1 | `Home` commits per intro tile hover | S2-dev Profiler (optional) | 1 | | — | — | — |
| CF-2 | `SongDetail` commits per second during playback | S5-dev Profiler | ~8 | | — | — | — |
| CF-3 | Production "Timer fired" task, mean / max ms (8 Hz) | S4 prod trace 0–10 s | unmeasured | | | | — |
| CF-7 | `Audio` elements created during the 60 s script | S4 K1 | ≈ tiles hovered | | | | — |
| CF-7 | Live `HTMLAudioElement` heap2 → heap3 → heap4 | S4 heap | unbounded | → → | — | — | ≤ 10 |
| CF-7 | Live `.m4a` players (media-internals) after the script | S4 | unbounded | | — | — | — |
| CF-8 | Audio bytes in the first 30 s of the Universe, no hover | S3 Network | ~20 MB | | | | ≤ 5 MB |
| CF-9 | Artwork requests total / unique assets per chart entry | S3 K1 | ~512 / 256 | / | / | / | ≤ 256 total |
| CF-10 | Full 4096² atlas uploads per chart entry | S3 K1 | 25–40 | | | | ≤ 2 (B2) / ≤ 8 (B1) |
| CF-10 | Upload call ms p50 / p95 / max (main thread) | S3 K1 | unmeasured | / / | / / | / / | — |
| CF-11 | three.js geometry/mesh objects after the script → after a switch | S4-dev heap | grows | → | — | — | stable |
| CF-12 | WebGL frames/s: idle wall / Song Detail open / Switch Chart open | S4, S5, S6 K1 | 60 / 60 / 60 | / / | / / | / / | — / 0 / 0 |
| CF-13 | Hover videos started from inside Switch Chart (count) | S6 Network / K1 | > 0 | | | — | per DEC-1 |
| CF-14, HY-6 | Max concurrent playing videos during the hover handoff | S2b K1 | 3 | | | — | 1 |
| CF-15 | Seconds a hover video was visible while paused | S2 K1 | > 0 if blocked | | | — | 0 |
| CF-16 | Abandoned full-video downloads in S2a: count / MB | S2a Network | 5 / ? | / | / | — | 0 |
| CF-17 | Handoff: dropped frames ±0.5 s around the switch / `BUFFERING_HAVE_NOTHING` seen? | S2b trace + media-internals | stutter | / | / | — | 0 / no |
| CF-17 | Both soundtracks audible during the crossfade (preview and full unmuted overlap) | S2b K1 | yes | | | — | no |
| CF-18 | Video MB transferred: S2a / S2b | S2 Network | ~10 / ~31 | / | / | — | ≥ 50% less |
| CF-19 | Initial JS transferred (gzip) | S1 Network | 334 KB | | | | ≤ 235 KB |
| CF-20 | Universe chunk loaded on the intro? / canvases on the intro | S1 | yes / 1 | / | / | / | no / 0 |
| CF-20 | JS chunks fetched after the chart click | S3 Network | 0 | | | | — |
| CF-21 | Font requests: CSS count, files, KB; render-blocking? | S1 Network / Lighthouse | 1 CSS + many | | | | 0 third-party |
| CF-22 | Logo bytes / total tile-image bytes | S1 Network | 1.0 MB / ? | / | — | / | ≥ 1.5 MB less |
| — | Cold first-visit bytes before any interaction (10 s) | S1 Network | ~14 MB | | | | ≤ 3 MB |
| CF-24 | `/api/songs` TTFB and duration; `x-vercel-cache` | S3 / S6 | upstream-bound | | | | p95 < 150 ms cached |
| CF-29 | Forced reflows per second during the sweep | S4 prod trace | > 0 | | | | — |
| CF-30 | Drawer open: dropped frames / visible extra overshoot (y/n) | S5 trace + R5 | ? / yes | / | / | / | per DEC-3 |
| CF-31 | Forced reflows per second during playback with Song Detail open | S5 prod trace | ~8 | | | | 0 |
| CF-32 | Search merge: wall rebuild visible / long task ms | S4/V11 (note if observed) | yes | | | | — |
| — | Lighthouse Performance score: Desktop / Mobile | S1 | — | / | — | — | — |
| — | LCP / FCP / TBT / CLS (lab) | S1 | — | | | | LCP ≤ 2.5 s |
| — | LCP element | S1 Lighthouse | — | | — | — | — |
| — | Idle intro GPU ms/frame, GPU busy % | S1c | — | / | — | / | — |
| — | Wall frame interval p50 / p95 / p99, missed frames (60 s script) | S4 K1 | unmeasured | | | | p95 ≤ 16.7 ms |
| — | Worst interaction / p98 (INP proxy) | S4, S5 K1 | unmeasured | | | | ≤ 200 ms |
| — | Chart entry T0→T2 / T0→T4 / T0→T5 / T0→T6 / T0→T7 (s) | S3 | unmeasured | | | | — |
| — | Chart switch: click → wall complete (s) | S6 | unmeasured | | | | — |
| — | Tab memory / GPU memory: intro / wall / after switch | S1, S3, S6 Task Manager | — | | — | — | — |

**Notes on Part A** (anything surprising, failed runs, deviations from the script):

-

---

## Part B — Hypotheses HY-1 … HY-15 (verdict required)

Use one block per hypothesis. *Gates* lists the roadmap task(s) the verdict unlocks.

### HY-1 — Each 8 Hz `Home` re-render costs several ms of main-thread time
- **Gates:** — (sets the *expected gain* only; A1–A3 proceed regardless because of CF-1..3)
- **Experiment:** S4 (dev Profiler counts; production "Timer fired" task duration over 0–10 s)
- **Threshold:** none; record the magnitude
- **Files:** `LAP_dev_S4_cpu1x_react.json`, `LAP_prod_S4_*_trace_r*.json.gz`

| Measure | LAP cpu1x | LAP cpu4x | AND |
|---|---|---|---|
| Passive commits per second (dev) | | — | — |
| Prod Timer-fired task: mean / max ms | / | / | / |
| Main-thread ms per second spent on the 8 Hz updates | | | |

- **Verdict:** ☐ CONFIRMED (≥ 2 ms per update on cpu1x) ☐ REJECTED (< 2 ms) ☐ INCONCLUSIVE
- **Expected gain of A1–A3:** ___ ms/s on LAP cpu1x, ___ ms/s on cpu4x
- **Notes:**

### HY-2 — Full atlas uploads stall the GPU or main thread materially
- **Gates:** **B2** (per-slot GPU uploads), and with it G5
- **Experiment:** S3; K1 `kp:atlas-upload` measures; the top 5 uploads examined in the trace
- **Threshold:** p95 enclosing task ≥ 8 ms **or** ≥ 3 dropped frames per upload → CONFIRMED
- **Files:** `*_S3_*_trace_r*.json.gz`, `*_S3_*_kp_r*.json`

| Upload # (largest 5) | Upload call ms | Enclosing task ms | GPU block ms after it | Dropped frames in the next 100 ms |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| **Summary (cpu1x)** | p95: | p95: | mean: | mean: |
| Summary (cpu4x) | p95: | p95: | mean: | mean: |
| Summary (AND) | p95: | p95: | mean: | mean: |

- **Verdict:** ☐ CONFIRMED → do B2 ☐ REJECTED → B1 + flush throttling only ☐ INCONCLUSIVE
- **Notes:**

### HY-3 — `backdrop-filter`s over the live canvas cost significant GPU time
- **Gates:** **B5** (refresh blur) and any Navbar/Search glass proposal. The roadmap's §3.2 row says "H1b, H6"; see the note in EXPERIMENTS.md.
- **Experiment:** EXPERIMENTS.md §HY-3 (K2 `backdrop` A/B), plus the S4 refresh segment
- **Threshold:** ≥ 2 ms GPU per frame saved (LAP) → CONFIRMED

| Condition | A1 GPU ms/frame | B (no backdrop) | A2 | Saved = mean(A) − B |
|---|---|---|---|---|
| Wall, idle | | | | |
| Wall + Search panel open | | | | |
| Refresh (from S4R; no A/B) | GPU ms/frame: ___ · dropped frames: ___ | — | — | — |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-4 — Intro card backdrop and blend layers are re-evaluated per video frame (AC-3)
- **Gates:** **H4** (bake the overlays; needs E5 and design)
- **Experiment:** EXPERIMENTS.md §HY-4 (K2 `backdrop` + `blend` A/B; scroll test; paint flashing; layers)
- **Threshold:** ≥ 2 ms GPU per frame saved **or** visible scroll jank → CONFIRMED

| Measure | A1 | B (effects off) | A2 |
|---|---|---|---|
| Idle intro GPU ms/frame | | | |
| Scroll: dropped frames | | | |
| Paint flashing over cards every frame? (y/n) | | — | — |
| Layer count / memory estimate (Layers panel) | | — | — |
| AND scroll dropped frames (S2-touch) | | — | — |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-5 — Song Detail SVG turbulence/displacement filter is CPU-rasterised and expensive
- **Gates:** **H3** (needs design)
- **Experiment:** S5 (raster per frame during the drawer animation) + EXPERIMENTS.md §HY-5 (K2 `svgfilter` A/B)
- **Threshold:** ≥ 4 ms raster per frame during the drawer animation → CONFIRMED

| Measure | LAP cpu1x | LAP cpu4x | AND |
|---|---|---|---|
| Raster ms/frame during the drawer open (S5) | | | |
| A/B: raster ms/frame with filter / without | / | — | — |
| Idle-open GPU ms/frame with filter / without | / | — | — |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-6 — Three concurrent 1080p decodes drop frames on mid-range devices
- **Gates:** sets the **D5** encode targets (D2 proceeds regardless)
- **Experiment:** S2b (K1 `video.perFile`, `maxConcurrentPlaying`; media-internals decoder; Task Manager GPU Process CPU)
- **Threshold:** dropped > 1% of decoded frames for any file, **or** Frames-track drops during the handoff, **or** a software decoder in use → CONFIRMED

| File | Decoder (HW/SW, name) | Frames decoded | Dropped | Dropped % |
|---|---|---|---|---|
| globe.mp4 | | | | |
| God Mode_preview_3s.mp4 | | | | |
| God Mode_30s.mp4 | | | | |
| Max concurrent playing | | — | — | — |
| GPU Process CPU % during the full video | | — | — | — |
| Frames-track dropped frames in the handoff window | | — | — | — |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **D5 target implication** (e.g. "1080p max, ≤ 4 Mbps, keyframe every 1 s"):
- **Notes:**

### HY-7 — Unmuted hover autoplay is rejected for first-time visitors
- **Gates:** **D3** priority (D3 is low-risk regardless)
- **Experiment:** EXPERIMENTS.md §HY-7 (fresh Guest/InPrivate, no page activation)
- **Threshold:** any rejection or frozen frame observed → CONFIRMED

| Browser | Run | `pageActivated` at install | `NotAllowedError` count | Frozen frame seen? | Sound? | MEI score |
|---|---|---|---|---|---|---|
| Chrome Guest | 1 / 2 / 3 | | | | | |
| Edge InPrivate | 1 / 2 / 3 | | | | | — |
| Safari Private | 1 / 2 / 3 | | | | | — |

- **Verdict:** ☐ CONFIRMED (D3 required, high priority) ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-8 — The audio preload queue can deadlock after a hover sweep
- **Gates:** **C3** scope (stall timeouts)
- **Experiment:** S4-dev (`GlobalAudioPlayer` loading-status Map; `[AUDIO DEBUG]` log) + S4-prod (`.m4a` pending rows)
- **Threshold:** any `'loading'` entry still present beyond 10 s → CONFIRMED

| Measure | +0 s | +10 s | +30 s |
|---|---|---|---|
| `'loading'` entries (dev) | | | |
| URLs "started" but never "ready" (dev console) | — | — | |
| Prod `.m4a` rows pending > 10 s | — | | |
| Did preloading resume during 45–60 s of the script? (y/n) | — | — | |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-9 — iTunes latency and rate limits cause slow first loads and 5xx in production
- **Gates:** **F6** (upstream resilience) and **F7** (static generation) priority
- **Experiment:** EXPERIMENTS.md §HY-9 (Vercel logs and observability; curl script) + the S3/S6 API timings
- **Threshold:** p95 cold > 1.5 s **or** any 403/429 → CONFIRMED

| Measure | Value |
|---|---|
| Vercel `/api/songs` p50 / p75 / p95 duration (window: ___) | / / |
| Invocations / error rate in the window | / |
| Count of 403 / 429 / 5xx / timeouts in the logs | / / / |
| curl: run 1 TTFB per chart (global-top-50, late-night, top-kpop) | / / |
| curl: run 2 TTFB per chart | / / |
| `x-vercel-cache` values seen / distinct `x-vercel-id` instances | / |
| S3/S6 browser `/api/songs` TTFB (median) | |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-10 — Fragment shader at DPR 1.5 is GPU-bound on integrated GPUs
- **Gates:** **B8** (adaptive DPR)
- **Experiment:** EXPERIMENTS.md §HY-10
- **Threshold:** ≥ 25% GPU time difference → CONFIRMED

| Condition | GPU ms/frame @ DPR 1.0 | @ DPR 1.5 | Difference % |
|---|---|---|---|
| Wall at rest | | | |
| Wall, mouse moving | | | |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Native DPR of the reference laptop:**
- **Notes:**

### HY-11 — Synchronous hover renders inside `useFrame` cause long frames *after* A1–A4
- **Gates:** **A5**
- **Experiment:** cannot be decided before Phase 1. Record the baseline now from the S4 prod trace (25–35 s sweep).
- **Threshold (after Phase 1):** any hover-attributable task > 4 ms remaining → CONFIRMED

| Baseline measure | LAP cpu1x | LAP cpu4x |
|---|---|---|
| Longest 5 animation-frame tasks during the sweep (ms) | | |
| Share of those tasks spent in React commit work (estimate) | | |

- **Verdict:** ☐ **DEFERRED** to the end of Phase 1 (re-run S4 after A1–A4)
- **Notes:**

### HY-12 — Jelly simulation costs measurable main-thread time
- **Gates:** **B7**
- **Experiment:** S4-dev trace (Bottom-Up self time of `update` in `jellyField.ts`); cross-check in the prod trace
- **Threshold:** > 0.5 ms per frame → CONFIRMED

| Window | Self ms total | Frames in window | ms per frame (dev) | ms per frame (prod cross-check) |
|---|---|---|---|---|
| Settled (0–10 s) | | | | |
| Sweep (25–35 s) | | | | |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE. Dev durations are inflated: if dev > 0.5 ms but prod < 0.5 ms, mark REJECTED and note it.
- **Notes:**

### HY-13 — `CinematicBackground` full-screen blur costs significant paint/GPU time on song switch
- **Gates:** **H6** (needs design)
- **Experiment:** S5 song switch + EXPERIMENTS.md §HY-13 (K2 `cinematic` A/B)
- **Threshold:** ≥ 4 ms per frame during the 1.2 s transition → CONFIRMED

| Measure | A1 | B (no blur) | A2 |
|---|---|---|---|
| Paint + raster + GPU ms/frame over the transition | | | |
| Dropped frames in the transition | | | |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-14 — Animated `box-shadow` (loader ring, card hover) causes paint-heavy frames
- **Gates:** **H5** (needs design)
- **Experiment:** S3 (loader window T3→T4) and S2a (card-hover transition); paint attribution from the advanced-paint run
- **Threshold:** ≥ 3 ms paint per frame → CONFIRMED

| Window | Paint ms/frame (cpu1x) | cpu4x | AND |
|---|---|---|---|
| Loader ring (S3) | | | |
| Intro card hover (S2a) | | | — |

- **Verdict:** ☐ CONFIRMED ☐ REJECTED ☐ INCONCLUSIVE
- **Notes:**

### HY-15 — One-file playback (no separate preview) reaches first frame as fast as the 3 s preview
- **Gates:** **D6 vs D7** choice
- **Experiment:** EXPERIMENTS.md §HY-15 (K3 under Fast 4G, Disable cache)
- **Threshold:** full-file TTFF within 150 ms of preview TTFF for all three tiles → CONFIRMED (choose D7)

| Tile | Preview median ms | Full median ms | Δ ms | Within 150 ms? |
|---|---|---|---|---|
| God Mode | | | | |
| Beat It | | | | |
| Loser | | | | |
| (Context, unthrottled) | | | | |

- **Verdict:** ☐ CONFIRMED (D7) ☐ REJECTED (D6) ☐ INCONCLUSIVE. Always mark **PROVISIONAL** and re-run after D5.
- **Notes:**

---

## Part C — Gating decisions summary (fill in last)

| Gated task | Hypothesis | Verdict | Decision | Decided by / date |
|---|---|---|---|---|
| B2 per-slot uploads (+ G5) | HY-2 | | ☐ Do ☐ Drop | |
| B5 refresh-blur pause | HY-3 | | ☐ Do ☐ Drop | |
| H4 intro overlay bake | HY-4 | | ☐ Propose to design ☐ Drop | |
| H3 Song Detail glass filter | HY-5 | | ☐ Propose to design ☐ Drop | |
| D5 encode targets | HY-6 | | Targets: | |
| D3 priority | HY-7 | | ☐ High ☐ Normal | |
| C3 stall-timeout scope | HY-8 | | ☐ Include ☐ Not needed | |
| F6 / F7 priority | HY-9 | | ☐ Raise ☐ Keep | |
| B8 adaptive DPR | HY-10 | | ☐ Do ☐ Drop | |
| A5 deferred hover writes | HY-11 | DEFERRED | Revisit after Phase 1 | |
| B7 jelly settle skip | HY-12 | | ☐ Do ☐ Drop | |
| H6 cinematic blur | HY-13 | | ☐ Propose to design ☐ Drop | |
| H5 box-shadow animations | HY-14 | | ☐ Propose to design ☐ Drop | |
| D6 vs D7 | HY-15 | PROVISIONAL | ☐ D6 ☐ D7 (re-check after D5) | |

**Decisions for product/design that the baseline evidence supports** (roadmap §4): attach the recordings for **DEC-1** (R6 + the S6 audio observation) and **DEC-3** (R5).

**Sign-off:** P0.1 is complete when every HY above has a verdict (including DEFERRED/PROVISIONAL), all checklist items are ticked or explained, and the visual references exist for all three sizes.
