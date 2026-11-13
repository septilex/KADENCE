# S2 pilot (instrumentation check, one trial)

- Trial: `pilot_warm_hip-hop-central`. Warm cache (preview from disk cache), **no user activation**, dwell 10 s. Clean Brave profile. 2026-11-11 07:23 UTC.
- **Purpose:** to check the S2 harness end to end before the main run.
- **Result:**
  - Preview `play()` was rejected with `NotAllowedError`.
  - The first frame was presented 122 ms after pointer-enter, and the preview layer was visible from 269 ms.
  - That frozen frame stayed on screen for 9,766 ms. 1 frame presented; `mediaTime` advanced 0 s.
  - The full video was never requested.
- **Instrumentation defect found:** the pilot sampled the first presented frame's brightness (`drawImage` + `getImageData` inside `requestVideoFrameCallback`). That synchronous GPU readback produced a **≈ 56–60 ms long task** at +120 ms, which shows up in this pilot's long-task and long-animation-frame data. **That long task is instrumentation, not the app.** The sampling was removed before the main S2 run.
- Files: `raw/pilot_warm_hip-hop-central.json`, `S2_metrics.json`, `S2_metrics.csv`, `env_phase-pilot.json`.
