# P0.1 Profiling Guide — Part 1: Setup, tools and protocol

This guide covers roadmap task **P0.1 (Baseline traces and visual reference capture)**. You run it by hand. Nothing in this guide changes the repository, the `.next` folder or the running dev server.

| Document | Purpose |
|---|---|
| **PROFILING_GUIDE.md** (this file) | One-time setup, how each tool is used, the run protocol, file naming |
| [SCENARIOS.md](SCENARIOS.md) | Step-by-step S1–S6, the stand-alone hypothesis experiments, and visual references |
| [SNIPPETS.md](SNIPPETS.md) | Read-only DevTools snippets K1 (counters), K2 (effect toggles), K3 (time to first frame) |
| [CAPTURE_CHECKLIST.md](CAPTURE_CHECKLIST.md) | Tick-box list of every file to capture |
| [HYPOTHESIS_RESULTS_TEMPLATE.md](HYPOTHESIS_RESULTS_TEMPLATE.md) | Where the numbers and verdicts go |

---

## 1. One-time setup

### 1.1 Hard rules for the whole session

1. **Do not run `next build`, `next start` or `npm install` in `C:\Users\praji\KADENCE`.** The dev server is already running on `http://localhost:3000`. Do not stop, restart or reconfigure it.
2. **Do not edit any file under the repo while recording.** Hot reload would land inside your traces.
3. **Store raw artefacts outside Git**, for example in `C:\kadence-perf\P0.1\`. Traces, HARs, heap snapshots and recordings run to hundreds of MB, and the repo already holds 1.14 GB of loose objects. Commit only the filled-in results template, and link to the folder or tracking issue.
4. **Use sanitized HAR exports.** Never commit a HAR.

### 1.2 Two builds and what each one is for

| Build | URL | Use it for | Do not use it for |
|---|---|---|---|
| **Production** (Vercel) | `<PROD_URL>`. The project is `kadence-musicz`, so probably `https://kadence-musicz.vercel.app`; confirm in the Vercel dashboard | **All timings**: Performance traces, Lighthouse, HAR, GPU, media-internals, memory counts of native objects (`HTMLAudioElement`, `HTMLVideoElement`), K1 counters | React Profiler (unsupported in production React). Function names in production traces are mostly minified. |
| **Dev server** | `http://localhost:3000` | **React Profiler** commit counts and "why did this render"; readable function names (JellyField `update`, `NodeField` frame callbacks); named three.js classes in heap snapshots; the `[AUDIO DEBUG]` console log; inspecting `GlobalAudioPlayer` refs (HY-8) | Any absolute millisecond figure. Development React, unminified code and console logging inflate durations 2–5×. Record only counts and attribution. |

**Before you start, confirm the production deployment's commit.** In Vercel → Project → Deployments → Production → Source, the commit should be `e5ab927` (current `main` HEAD). If it differs, write the deployed commit into the results template, because the baseline must describe the code being optimised.

> **Optional: a profiling-enabled production build.** Only if you want React Profiler data with production timings. Do this in a *separate* clone outside the repo, so this repo's `.next` and `node_modules` are never touched: `git clone C:\Users\praji\KADENCE C:\kadence-perf-build`, then in that folder `npm ci`, `npx next build --profile` and `npx next start -p 3100`. The `--profile` flag is documented in `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`. This is not required for P0.1, and it installs dependencies in that separate folder, so it is your call.

### 1.3 Reference devices

| Code | Device | Notes |
|---|---|---|
| **LAP** | Mid-range laptop with an **integrated GPU**, Chrome stable | Two passes: **cpu1x** (no throttling) and **cpu4x** (DevTools CPU throttle 4×). DevTools CPU throttling slows only the page's renderer threads. It does **not** slow the GPU process or video decoders, so GPU and decode findings come from the cpu1x pass. |
| **AND** | Mid-range Android phone, Chrome stable, USB debugging | No CPU throttle (it is real hardware). The phone has **no hover**, so S2 and the hover parts of S4 do not apply (see SCENARIOS.md). |

### 1.4 Laptop preparation (do once, then record the values in the template's §0)

1. **Power:** plug in the charger; Windows power mode = *Best performance*; turn Battery saver off.
2. **Chrome energy settings:** `chrome://settings/performance` → turn **Energy saver** and **Memory saver** **off**. Energy saver caps frame rate at 30 fps, which would invalidate every frame metric.
3. **GPU:**
   - `chrome://settings/system` → **Use graphics acceleration when available** = on.
   - On a dual-GPU laptop: Windows Settings → System → Display → Graphics → Chrome → **Power saving** (integrated GPU).
4. **Record the environment:**
   - `chrome://gpu` → **Copy Report to Clipboard** → save as `LAP_env_chrome-gpu.txt`. It shows the GPU, driver, and whether "Video Decode" is hardware accelerated.
   - `chrome://version` → save as `LAP_env_chrome-version.txt`.
   - Note the display refresh rate (Windows Settings → Display → Advanced display) and Windows scaling (100% / 125% / 150%). This sets `devicePixelRatio`, which matters for HY-10.
5. **Two Chrome profiles** (Chrome menu → Profiles → Add):
   - **`perf-clean`:** **no extensions at all.** Use it for every production trace, Lighthouse run and HAR. Extensions inject scripts and skew timings.
   - **`perf-react`:** only the **React Developer Tools** extension. Use it for the dev server only.
   - For HY-7, use a fresh **Guest** window each attempt (Chrome menu → Profiles → Open Guest).
6. **Window size:** maximise the browser on a 1920×1080 display. If your display is smaller, use what you have and record `innerWidth × innerHeight` (K1 prints it). Keep the same size for every run.
7. **Close other tabs and heavy apps**: video calls, IDE indexing, other browsers.

### 1.5 Phone preparation

1. Phone: Settings → About → tap *Build number* 7× → Developer options → **USB debugging** on. Also turn on **Stay awake**. Set a fixed brightness and turn battery saver off.
2. Connect over USB. On the laptop open `chrome://inspect/#devices` and accept the prompt on the phone.
3. Open `<PROD_URL>` on the phone, then click **inspect** under it on the laptop. The usual DevTools panels now drive the phone.
4. Save `AND_env.txt` with the phone model, Android version, Chrome version, and the result of `navigator.hardwareConcurrency, devicePixelRatio` typed in the remote Console.

### 1.6 Recommended DevTools settings (every run)

- DevTools docked to the **bottom or undocked**, so the page keeps its normal width. Undocked into a separate window is best for desktop sizes.
- **Network panel:** ☑ **Preserve log**, ☑ **Disable cache** (cold scenarios), throttling **No throttling** unless a step says otherwise.
  - Right-click a column header → **Response Headers → Manage Header Columns…** → add `cache-control`, `content-range`, `x-vercel-cache` and `age`.
  - Settings (gear) → ☑ **Big request rows**.
- **Performance panel** (gear icon → capture settings):
  - ☑ **Screenshots**, ☑ **Memory**.
  - ☐ Disable JavaScript samples (leave samples on).
  - ☐ **Enable advanced paint instrumentation (slow)**: only for the paint-attribution runs that ask for it.
  - ☐ Enable CSS selector stats (slow).
  - CPU throttling: as the pass requires (No throttling / 4× slowdown).
- **Rendering panel** (Ctrl+Shift+P → "Show Rendering"): keep everything **off** during measured traces. Paint flashing and layer borders are separate, visual-only checks.

---

## 2. Tool primer — exactly how each tool is used in this guide

### 2.1 Performance trace

- **Record:** Performance panel → **Record** (Ctrl+E) → perform the steps → **Stop**.
- **Record and reload** (Ctrl+Shift+E) is for page-load scenarios (S1) only.
- **Save:** the **Save trace** (download) icon in the Performance toolbar. If you are offered "include script content / source maps", leave it **off** for production. Save as `.json` or `.json.gz` with the name from §4.
- **Tracks you will read:**

| Track | What it tells you |
|---|---|
| **Frames** | Each frame. **Dropped** frames are red/hatched, **partially presented** frames are yellow. Count dropped frames within a selected window. |
| **Interactions** | Clicks and keypresses with their duration. Hover the bar to see input delay, processing and presentation. |
| **Timings** | `kp:*` marks and measures from snippet K1 (atlas uploads, segment markers). |
| **Main** | The page's main thread. Long tasks (> 50 ms) carry a red corner. "Animation frame fired" tasks contain the R3F render loop. "Timer fired" tasks every 125 ms during playback are the progress updates (CF-3). Purple **Layout** blocks marked with a red triangle are *forced reflows* (CF-29, CF-31). |
| **GPU** | GPU-process work. Used for every "GPU ms per frame" figure (see §2.5). |
| **Raster / Thread pool / Compositor** | Rasterisation of painted content. Used for the SVG filter (HY-5) and the blur hypotheses. |
| **⚛ Scheduler / ⚛ Components** (dev server only) | React 19.2 performance tracks, when present. They show which components rendered and for how long, without the React Profiler. |

- **Reading a window:** drag-select a range on the overview. The **Summary** tab shows Scripting / Rendering / Painting / System / Idle totals. **Bottom-Up** lists self-time by function; group by *Function* or *URL*.

### 2.2 Network HAR

- Clear the log before the scenario (🚫 icon) so the HAR holds only that scenario.
- **Export:** the **Export HAR (sanitized)…** download-arrow icon in the Network toolbar, or right-click any request → *Save all as HAR (sanitized)*.
- Before saving, read the footer of the Network panel: **requests / transferred / resources / Finish / DOMContentLoaded / Load**. Write those into the template.
- **Useful filters** (type them into the filter box):

| Filter | Shows |
|---|---|
| `mzstatic` | Album artwork |
| `.m4a` | iTunes audio previews |
| `/videos/` | Hover and globe videos |
| `/api/` | KADENCE API routes |
| `fonts.` | Google Fonts CSS and font files |
| Type buttons **JS / Media / Img / Font** | Requests of that type |

- **Media requests appear several times** (`206 Partial Content` range requests). "Requests" is the count of rows, "files" is the count of distinct URLs.

### 2.3 React Profiler (dev server, `perf-react` profile)

1. DevTools → **⚛ Profiler** tab → gear icon:
   - **Profiler** section: ☑ **Record why each component rendered while profiling**.
   - **General** section: ☑ *Highlight updates when components render* is useful for a visual check, but turn it **off** while recording.
2. Click **Record (●)** → perform the steps → click again to stop.
3. **Read:**
   - **Total commits:** the counter "N / M" at the top right of the commit bar chart.
   - **Commits where `Home` rendered:** select `Home` in the **Flamegraph**. The right-hand panel lists **"Rendered at"** with every commit time where it rendered; count them.
   - **"Why did this render?"**: shown in the right-hand panel per commit (e.g. *Hook 3 changed*).
   - **Ranked** chart: the most expensive components in a commit.
4. **Save:** the **Save profile** (⬇) icon in the Profiler toolbar → `.json`.
5. Commit **counts** are valid in dev. Durations are inflated: quote them only as "dev ms".

### 2.4 Memory snapshots

1. DevTools → **Memory** → **Heap snapshot** → **Take snapshot**. This forces a garbage collection first, so every live object it reports is really retained.
2. **Read:** in the **Class filter** box type:

| Filter | Read |
|---|---|
| `HTMLAudioElement` | Live audio elements (row count in **Distance / Count**). CF-7. |
| `HTMLVideoElement` | Expected 3 (globe, preview, full) plus any extra |
| `Detached` | Detached DOM nodes. Note the count. |
| Dev server only: `BufferGeometry`, `InstancedMesh`, `InstancedBufferAttribute`, `CanvasTexture` | three.js object counts. In production the class names are minified, so do not use these filters there. CF-11. |

3. **Compare:** select a later snapshot → change **Summary** to **Comparison** → base = the earlier snapshot. The **# New / # Deleted / # Delta** columns show what accumulated.
4. **Save:** right-click the snapshot in the left list → **Save profile** → `.heapsnapshot`.
5. **Also read Chrome's Task Manager** (Shift+Esc). Right-click the header and add **Memory footprint**, **GPU memory** and **CPU**. Note values for the KADENCE tab and the **GPU Process**. The 64 MB atlas texture lives in GPU memory, not in the JS heap.

### 2.5 GPU profiling

There is no single "GPU frame time" readout in Chrome, so this guide uses **one consistent method**, called **GPU-track ms/frame**:

1. In a Performance trace, drag-select a **steady 5-second window** with no navigation in it.
2. Click the **GPU** track. The **Summary** tab shows the total GPU task time for the selection.
3. **GPU ms/frame** = total GPU time ÷ (5 s × refresh rate). **GPU busy %** = total GPU time ÷ 5000 ms.
4. Count **dropped frames** in the same window on the Frames track.

The GPU track measures the GPU process's command execution, which is a good proxy for compositor, blur and WebGL load. It is not shader time measured on the GPU itself. Use the same method before and after every change and the comparison stays valid. A vendor tool such as Intel GPA or PIX would give true GPU time, but it is not needed for the thresholds in the roadmap.

**Supporting tools:**

| Tool | Where | Use |
|---|---|---|
| **Frame rendering stats** | Rendering panel | A live FPS and GPU-memory overlay. Glance at it and note values, but **switch it off while recording**. |
| **Layers panel** | Ctrl+Shift+P → "Show Layers" | Number of compositor layers, their memory estimate and *compositing reasons*. Screenshot it on the intro and the wall (HY-4). |
| **Paint flashing / Layer borders** | Rendering panel | Visual check only: green flashes show repaints every frame. Capture a 5 s screen recording with each enabled, not a trace. |
| **`chrome://gpu`** | — | Captured once in setup. |
| **Optional: Perfetto** | `https://ui.perfetto.dev` → Record new trace → Chrome, with categories `gpu`, `viz`, `cc`, `media` | Deeper GPU and decoder detail. Only if a hypothesis comes out borderline. |

### 2.6 `chrome://media-internals` (and the DevTools **Media** panel)

1. Open `chrome://media-internals` in a **separate tab** before the scenario starts, then switch back to KADENCE.
2. The **Players** tab lists one entry per media player. Hover videos, the globe **and every iTunes `Audio` element** each get one.
3. **Read for each relevant player:**

| Property or event | What it tells you |
|---|---|
| `url`, `video_codec_name`, `audio_codec_name`, width/height, duration | Which file it is and its format |
| **`video_decoder`** (e.g. `D3D11VideoDecoder` / `MojoVideoDecoder` = hardware; `FFmpegVideoDecoder` / `Dav1dVideoDecoder` / `VpxVideoDecoder` = software) and **`is_platform_video_decoder`** | Hardware vs. software decode. Property names vary slightly between Chrome versions; screenshot the table. |
| Events `kPlay`, `kPause`, `kSeek`, `kWebMediaPlayerDestroyed` | Playback lifecycle. A player **without** `kWebMediaPlayerDestroyed` is still alive. |
| `BUFFERING_HAVE_NOTHING` | A stall (CF-17 handoff stutter) |
| Pipeline errors | Load or decode failures |

4. The DevTools **Media** panel (Ctrl+Shift+P → "Show Media") shows the same data inside DevTools, which is handy on the phone.
5. **Save:** neither view has a reliable export. Take **screenshots** of the properties and event log of each key player, and/or select the event log text, copy it and paste it into a `.txt`.
6. **Dropped and decoded frame counts** come from K1 (`video.perFile`), not from media-internals.

### 2.7 Lighthouse

- **Lighthouse** panel → Mode **Navigation**, Categories **Performance** only, Device **Desktop**, then a separate run with **Mobile**. Use the `perf-clean` profile with nothing else open.
- **Save:** ⋮ menu → **Save as HTML**, and also **Save as JSON**.
- Lighthouse uses *simulated* throttling. Its numbers complement the Performance trace; they do not replace it.

---

## 3. The run protocol (repeat for every scenario run)

1. Close all other KADENCE tabs. Open a fresh tab in the right profile (`perf-clean` for production, `perf-react` for dev).
2. Open DevTools, set the throttling for this pass, tick **Disable cache** if the scenario is cold, and clear the Network log.
3. Load the page and **wait 5 s of idle** before acting, unless the scenario is a load recording.
4. Install **K1** if the scenario says so, then run `__kp.reset('<scenario>')` right before the measured action.
5. **Record:** start the Performance recording (and the React Profiler, if listed) and follow the scenario steps. Use a stopwatch or watch the page clock; the timings in the steps matter.
6. Stop recording, then in the Console run `copy(__kp.summary())` and paste it into the `_kp.json` file.
7. Save the trace, then the HAR, then any snapshot, screenshots or profile, using the names from §4.
8. Fill in the scenario's rows in the results template **immediately**, while the trace is still open.
9. **Repeat each timed run 3 times** (laptop cpu1x) and report the **median**. One run is enough for the cpu4x pass, the phone pass, HARs, heap snapshots and React profiles.

---

## 4. File naming

`{DEVICE}_{BUILD}_{SCENARIO}_{PASS}_{ARTEFACT}[_{RUN}].{ext}`

| Part | Values |
|---|---|
| DEVICE | `LAP`, `AND` |
| BUILD | `prod`, `dev` |
| SCENARIO | `S1`…`S6`, or an experiment name such as `HY3`, `HY10`, `HY15`, `VIS` |
| PASS | `cpu1x`, `cpu4x`, `fast4g` (or `na`) |
| ARTEFACT | `trace`, `har`, `kp`, `react`, `heap1`…`heap4`, `lh-desktop`, `lh-mobile`, `media`, `layers`, `taskmgr`, `rec`, `shot` |
| RUN | `r1`, `r2`, `r3` |

Examples: `LAP_prod_S3_cpu1x_trace_r2.json.gz` · `LAP_dev_S4_cpu1x_react.json` · `LAP_prod_S4_cpu1x_heap3.heapsnapshot` · `LAP_prod_S2_cpu1x_media.png`

**Suggested folder layout (outside Git):**

```
C:\kadence-perf\P0.1\
  env\        chrome-gpu, chrome-version, phone info
  S1\ … S6\   one folder per scenario, all devices and passes
  HY\         stand-alone experiments (HY-3, HY-4, HY-7, HY-9, HY-10, HY-15)
  visual\     reference screenshots and recordings (1920x1080, 1366x768, 390x844)
```

Continue with **[SCENARIOS.md](SCENARIOS.md)**.
