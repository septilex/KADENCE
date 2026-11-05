# KADENCE — Phase 0 / P0.1 performance baseline

This folder prepares roadmap task **P0.1 — Baseline traces and visual reference capture** ([KADENCE_PERFORMANCE_RECOVERY_ROADMAP.md](../../KADENCE_PERFORMANCE_RECOVERY_ROADMAP.md) §7). Every capture is manual. Nothing here changes application code, configuration, dependencies, the `.next` folder or the running dev server.

## Read in this order

| # | File | What it is |
|---|---|---|
| 1 | [PROFILING_GUIDE.md](PROFILING_GUIDE.md) | One-time setup, the two builds and what each is for, how every tool is used (Performance, HAR, React Profiler, memory, GPU, `chrome://media-internals`, Lighthouse), the run protocol, file naming |
| 2 | [SNIPPETS.md](SNIPPETS.md) | Read-only DevTools snippets: **K1** counters (atlas uploads, WebGL frames, audio elements, `play()` rejections, decoders, long frames, artwork duplicates), **K2** effect toggles for A/B runs, **K3** time-to-first-frame test |
| 3 | [SCENARIOS.md](SCENARIOS.md) | **S1–S6** step by step: panels, actions with timings, recording options, metrics, files, interpretation |
| 4 | [EXPERIMENTS.md](EXPERIMENTS.md) | Stand-alone hypothesis experiments (HY-3, 4, 5, 7, 9, 10, 13, 14, 15) and the visual-reference capture (14 views × 3 sizes, 8 recordings) |
| 5 | [CAPTURE_CHECKLIST.md](CAPTURE_CHECKLIST.md) | Every file to capture, as tick boxes |
| 6 | [HYPOTHESIS_RESULTS_TEMPLATE.md](HYPOTHESIS_RESULTS_TEMPLATE.md) | Where results go. Part A quantifies confirmed issues (no verdict); Part B gives each of HY-1…HY-15 a verdict; Part C records gating decisions |

## Key choices made in this guide (and why)

- **Timings come from the production deployment; React counts come from the dev server.** Production React cannot be profiled, and dev timings are inflated. Running `next build --profile` in this repo would overwrite `.next`, so it is offered only as an optional separate clone.
- **P0.2 counters do not exist yet**, so snippet K1 provides the counts the roadmap needs (atlas uploads, WebGL frames, audio elements, decoders) by wrapping browser APIs inside your tab only.
- **One GPU method throughout:** GPU-track ms/frame from the Performance panel. It is not true GPU time, but it is consistent for before/after comparisons.
- **S2 has two parts.** The roadmap's 2 s hovers never reach the 3 s handoff, so S2b adds one sustained hover on the heaviest video (God Mode).
- **The phone has no hover.** S2 and the hover parts of S4 run in touch variants on Android.
- **Wall visuals are not reproducible**, because the server randomises positions and colours (CF-26). Visual references therefore pin `/api/songs` with DevTools Local Overrides, and video/animated views are compared by recording rather than pixel diff.

## Points to settle while running P0.1

1. **HY-3 gate:** the roadmap's §3.2 lists the gated tasks as "H1b, H6". In §7, B5 is gated on HY-3 and H6 on HY-13, and no H1b task exists. The template treats HY-3 as gating B5. Correct the roadmap row if you agree.
2. **HY-1 threshold:** the roadmap gives no numeric threshold (the result only sizes the gain). The template uses **≥ 2 ms per update** as a working definition of "several ms".
3. **Reference phone:** the guide assumes a mid-range Android phone over USB. Safari/iOS is covered only by HY-7, and only if a Mac is available.

## What to commit afterwards

Commit only the filled-in `RESULTS_P0.1.md`, with a link to the artefact folder. Keep traces, HARs, heap snapshots and recordings outside Git; the repo already holds about 1.14 GB of objects.
