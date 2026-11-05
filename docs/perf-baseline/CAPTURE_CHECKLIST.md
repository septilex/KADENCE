# P0.1 capture checklist

Tick each item as you save it. File names follow [PROFILING_GUIDE.md §4](PROFILING_GUIDE.md). "×3" means runs r1–r3 (report the median); every other item is a single run. Store everything outside Git (e.g. `C:\kadence-perf\P0.1\`).

**Rough time:** laptop ≈ 4–5 h, phone ≈ 1 h, visual references ≈ 1.5 h.

## 0. Before you start
- [ ] Production deployment commit confirmed (expected `e5ab927`); written into template §0
- [ ] `<PROD_URL>` confirmed
- [ ] Energy saver and Memory saver off; laptop plugged in; Best-performance power mode; integrated GPU selected for Chrome
- [ ] `perf-clean` profile (no extensions) and `perf-react` profile (React DevTools only) created
- [ ] Snippets K1, K2, K3 saved in DevTools → Sources → Snippets (in **both** profiles)
- [ ] `LAP_env_chrome-gpu.txt`, `LAP_env_chrome-version.txt` saved; refresh rate, Windows scaling and DPR noted
- [ ] `AND_env.txt` saved; phone connected via `chrome://inspect`
- [ ] Dev server on `http://localhost:3000` responds (do **not** restart it, and run no `next build` in the repo)

## S1 — Cold load and idle intro
| Item | LAP cpu1x | LAP cpu4x | AND |
|---|---|---|---|
| Lighthouse Desktop HTML + JSON | [ ] | — | — |
| Lighthouse Mobile HTML + JSON | [ ] | — | — |
| Load trace (`S1_trace`) | [ ] ×3 | [ ] | [ ] |
| Network footer values noted | [ ] | [ ] | [ ] |
| HAR (`S1_har`) | [ ] | — | [ ] |
| Idle 15 s trace (`S1_idle-trace`) | [ ] | [ ] | [ ] |
| Canvas count on the intro noted | [ ] | — | [ ] |
| Task Manager screenshot | [ ] | — | — |
| media-internals: globe player screenshot | [ ] | — | — |
| Layers panel screenshot | [ ] | — | — |

## S2 — Intro hover (laptop only; phone runs S2-touch)
| Item | LAP cpu1x | LAP cpu4x | AND |
|---|---|---|---|
| K1 installed with `pageActivated: false` noted | [ ] | [ ] | — |
| S2a trace (five tiles × 2 s) | [ ] ×3 | [ ] | — |
| S2a K1 JSON | [ ] ×3 | [ ] | — |
| S2a HAR | [ ] | — | — |
| S2b trace (Dev's Universe, 10 s) | [ ] ×3 | [ ] | — |
| S2b K1 JSON | [ ] ×3 | [ ] | — |
| media-internals screenshots: globe, God Mode preview, God Mode full, one abandoned `_30s` | [ ] | — | — |
| Task Manager, GPU Process CPU during full video | [ ] | — | — |
| S2-touch scroll trace | — | — | [ ] |
| Optional: dev React profile (`LAP_dev_S2_cpu1x_react.json`) | [ ] | — | — |

## S3 — Chart entry (Late Night; Workout for cpu4x and the phone)
| Item | LAP cpu1x | LAP cpu4x | AND |
|---|---|---|---|
| Trace (Screenshots + Memory) | [ ] ×3 | [ ] | [ ] |
| K1 JSON | [ ] ×3 | [ ] | [ ] |
| HAR | [ ] | — | [ ] |
| T0–T7 timeline extracted | [ ] ×3 | [ ] | [ ] |
| `.m4a` count and bytes at +30 s; `mzstatic` count and bytes | [ ] | [ ] | [ ] |
| HY-2 per-upload table (top 5 uploads) | [ ] | [ ] | — |
| Task Manager GPU memory | [ ] | — | — |
| Clock time of each run noted (for HY-9) | [ ] | [ ] | [ ] |

## S4 — 60 s Universe interaction
| Item | LAP prod cpu1x | LAP prod cpu4x | LAP dev | AND |
|---|---|---|---|---|
| Trace (60 s script) | [ ] ×3 | [ ] | [ ] (attribution) | [ ] (tap variant) |
| K1 JSON | [ ] ×3 | [ ] | — | [ ] |
| HAR | [ ] | — | — | — |
| heap1 (idle intro) | [ ] | — | — | — |
| heap2 (settled wall) | [ ] | — | — | — |
| heap3 (after script + 10 s) | [ ] | — | — | — |
| heap4 (after switch to Workout) | [ ] | — | — | — |
| `.m4a` totals and pending rows noted | [ ] | — | — | — |
| media-internals: live `.m4a` players count + screenshot | [ ] | — | — | — |
| Refresh segment trace + K1 (`S4R`) | [ ] | — | — | — |
| **React Profiler** (`LAP_dev_S4_cpu1x_react.json`) | — | — | [ ] | — |
| HY-8 screenshots at +0 / +10 / +30 s | — | — | [ ] | — |
| Dev console log saved | — | — | [ ] | — |
| Dev heap snapshot (three.js classes) | — | — | [ ] | — |

## S5 — Song Detail
| Item | LAP prod cpu1x | LAP prod cpu4x | LAP dev | AND |
|---|---|---|---|---|
| Trace (27 s script) | [ ] ×3 | [ ] | — | [ ] |
| K1 JSON | [ ] ×3 | [ ] | — | [ ] |
| WebGL frames/s while open (5 s) noted | [ ] | — | — | [ ] |
| Paint-attribution trace (advanced paint on) | [ ] | — | — | — |
| Paint-flashing screen recording | [ ] | — | — | — |
| **React Profiler** (`LAP_dev_S5_cpu1x_react.json`) | — | — | [ ] | — |

## S6 — Switch Chart
| Item | LAP prod cpu1x | LAP prod cpu4x | LAP dev | AND |
|---|---|---|---|---|
| Trace | [ ] ×3 | [ ] | — | [ ] (tap) |
| K1 JSON | [ ] ×3 | [ ] | — | [ ] |
| HAR | [ ] | — | — | — |
| WebGL frames/s with overlay open noted | [ ] | — | — | — |
| Audio overlap observation (per hovered chart) | [ ] | — | — | — |
| media-internals screenshots (overlay hover videos) | [ ] | — | — | — |
| Esc-close check | [ ] | — | — | — |
| Optional React Profiler | — | — | [ ] | — |

## Stand-alone experiments ([EXPERIMENTS.md](EXPERIMENTS.md))
- [ ] HY-3: wall A1/B/A2 traces + Search-open A1/B/A2 traces
- [ ] HY-4: intro A1/B/A2 traces, scroll on/off traces, layer-borders and paint-flashing recordings, Layers screenshot
- [ ] HY-5: drawer A1/B/A2 traces
- [ ] HY-13: song-switch A1/B/A2 traces
- [ ] HY-7: Chrome Guest ×3, Edge InPrivate ×3, Safari Private ×3 (if a Mac is available): K1 JSON each, observations, `chrome://media-engagement` value, one recording
- [ ] HY-9: Vercel Logs screenshot, Observability screenshot, error-string counts, `HY9_curl.txt`
- [ ] HY-10: DPR 1 rest/move, DPR 1.5 rest/move traces
- [ ] HY-15: K3 result under Fast 4G (+ unthrottled for context)

## Visual references
- [ ] Local Overrides set for `late-night` and `workout` (folder outside the repo)
- [ ] V01–V14 at 1920×1080 @1
- [ ] V01–V14 at 1366×768 @1
- [ ] V01–V14 at 390×844 @3
- [ ] R1–R8 recordings at 60 fps (R2 and R6 with audio)
- [ ] Local Overrides switched off afterwards

## Wrap-up
- [ ] Every row in [HYPOTHESIS_RESULTS_TEMPLATE.md](HYPOTHESIS_RESULTS_TEMPLATE.md) filled in; each HY has a verdict
- [ ] The filled template is copied to `docs/perf-baseline/RESULTS_P0.1.md` (the only file to commit), with a link to the artefact folder
- [ ] Browser state restored: throttling off, Device Toolbar off, Overrides off, Energy saver back to your preference
