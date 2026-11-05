# KADENCE — Master Performance & Production-Readiness Audit

**Audit date:** 2026-11-01
**Commit audited:** `e5ab927` (branch `main`, clean working tree)
**Scope:** Entire repository — `app/`, `components/`, `hooks/`, `lib/`, `store/`, `public/`, configuration, existing production build output in `.next/`
**Method:** Static source analysis, inspection of the existing production build (`.next/`, built 2026-10-16 13:20, which differs from HEAD only by the removal of an 800 ms hover-dwell timer in `HoverMediaBackground.tsx`), `ffprobe` inspection of every media file, `tsc --noEmit --incremental false`, `eslint`. **No browser profiling was performed** (by instruction). No application code, configuration or dependency was modified.

### Confidence legend

| Label | Meaning |
|---|---|
| **Confirmed** | The defect is deterministic and provable from source or build artefacts alone. |
| **Probable** | The mechanism is confirmed in source; the *magnitude* depends on device, GPU, browser or network and should be measured. |
| **Unverified** | Plausible from the code, but needs browser profiling or production telemetry to establish. |

---

## 1. Executive Summary

KADENCE is **not** a multi-page application. It is a **single client-rendered route** (`app/page.tsx`, `'use client'`) that swaps full-screen "views" — Intro, Loading, Universe wall, Song Detail, Search, Switch Chart — by toggling state in Zustand stores. Every view therefore shares one React tree, one set of global media systems and one GPU compositing stack. That is the main reason the slowness feels *site-wide*: it comes from a handful of shared systems that are always mounted, not from any one page.

There are four root causes, in order of impact:

1. **A global re-render loop.** `Home` subscribes to the *entire* audio and UI stores (`app/page.tsx:117-119`). The audio player writes playback progress to that store every 125 ms (`GlobalAudioPlayer.tsx:126-131`). So while any audio plays, which in the Universe is nearly all the time, the whole application tree re-renders about **8 times per second**, including the React-Three-Fiber canvas subtree, Navbar, Search and the 800-line Song Detail panel. On top of that, every tile the cursor crosses fires a *synchronous* store update from inside the WebGL frame loop, which re-renders the whole tree again inside that animation frame.

2. **Uncontrolled media and network concurrency.** Every hovered wall tile starts a full download of a ~1 MB audio file immediately, with no dwell delay and no concurrency limit. The resulting `HTMLAudioElement` is never released while the current chart is active (`GlobalAudioPlayer.tsx:208-234`, `:109-120`). On the homepage, one hover starts a 1080p preview video (0.7–3.5 MB at up to 9.5 Mbps) and then at once a 7–31 MB full video. Exploring all 14 tiles once costs about **298 MB**. The 11.8 MB globe video keeps decoding underneath the whole time.

3. **GPU texture-upload storms.** The album-art atlas is a single 4096×4096 canvas (64 MB RGBA). Two *independent* loaders, `atlasManager` and a second one inside `NodeField.tsx`, download, decode and draw the same 256 artworks. Each of them triggers full 64 MB re-uploads to the GPU. Entering the Universe causes an estimated 25–40 full uploads, and every search, refresh and chart switch causes the whole storm again.

4. **Compositing-heavy visual effects stacked over continuously changing content.** The WebGL canvas renders at 60 fps unconditionally, even when it is invisible (`opacity: 0` under Song Detail) or covered by a full-screen 64 px backdrop blur (Switch Chart). It is also wrapped in an animated CSS `filter: blur()`. On top of it sit many `backdrop-filter` surfaces (every `GlassButton`, the hover tooltip, overlays), and each must be recomputed on every canvas frame. The homepage grid adds 14 backdrop-filters and about 56 blend-mode layers over a playing video. The Song Detail panel uses an SVG turbulence/displacement/specular filter.

Smaller, real problems add to these: render-blocking web fonts (7 families, 91 `@font-face` rules, 2 families never used); three.js core shipped in the initial bundle because of an import chain; ~1 MB of logo PNG preloaded at high priority; an animation conflict that makes the Song Detail drawer feel rubbery; and a backend that calls the iTunes Search API with `cache: 'no-store'` and relies on a per-instance in-memory cache in a serverless deployment.

The codebase also shows real performance-minded work. Per-frame state lives in refs, scratch vectors are pre-allocated, there is one instanced draw call for the wall, a single texture atlas, O(1) lookup maps, a session counter for stale video callbacks, faststart MP4s, rAF-throttled tilt handlers and in-flight request deduplication. **The individual micro-optimisations are mostly sound. The system-level architecture works against them:** global subscriptions, duplicated subsystems, no single owner for media and network priority, and effects that are expensive at the compositor level.

**Bottom line:** KADENCE is a visually ambitious prototype, not a production system. None of the main problems needs a redesign of the UI. Most of the sluggishness can be removed with targeted engineering changes, roughly half of them small (Section 10, Phase 0).

---

## 2. Overall Performance Rating

| Dimension | Rating |
|---|---|
| **Overall performance** | **3 / 10** |
| Initial load (cold, first visit) | 3 / 10 — ~14 MB transferred before first interaction (estimate, §7) |
| Homepage interaction (tile hover) | 3 / 10 |
| Universe idle (audio playing, cursor moving) | 3 / 10 |
| Universe entry / chart switch | 2 / 10 |
| Song Detail open | 3 / 10 |
| Backend / data path | 3 / 10 |

The ratings combine confirmed source defects with how much of the critical path they touch. They are not lab measurements.

---

## 3. Production Readiness Assessment

**Verdict: Not production-ready.** It is suitable as a demo or portfolio piece on high-end desktop hardware and a fast network.

Blocking issues for production-scale users:

| # | Blocker | Why it blocks |
|---|---|---|
| 1 | Unbounded audio element pool and undebounced hover audio (§5 C2) | Memory and bandwidth grow with use; the preload queue can deadlock |
| 2 | Global 8 Hz re-render loop (§5 C1) | Main-thread saturation on mid/low-end devices; INP regressions on every interaction |
| 3 | Media payload (~298 MB to explore the homepage once; 11.8 MB auto-preloaded globe) | Mobile data cost, CDN bandwidth cost, slow-network failure |
| 4 | iTunes Search API as the live data source, with `no-store` and per-instance caching (§9) | Cold-start latency, upstream rate-limit failures turning into HTTP 500s, no resilience |
| 5 | Unmuted autoplay on hover (§5 H3) | First-time visitors likely see a frozen first frame instead of video |
| 6 | Open server-side proxy (`app/api/proxy/route.ts`) | Fetches any URL server-side (SSRF / bandwidth abuse); unused by the app |
| 7 | No telemetry, no error reporting, no performance budget, 36 lint errors, no tests | Regressions cannot be detected or measured |

Build health: `tsc --noEmit` **passes** (strict mode). `eslint` reports **94 problems (36 errors, 58 warnings)**, including `react-hooks/immutability` errors in `NodeField.tsx` and a use-before-declare of `processQueue` in `GlobalAudioPlayer.tsx:61`.

---

## 4. Page-by-Page Audit

KADENCE has one route (`/`). The "pages" below are the user-facing **views** of that route, plus the API routes. Section 4.0 covers the shared layer that is mounted under every view, because it is the largest single source of cost.

### 4.0 Shared shell — mounted under every view

**Files:** `app/layout.tsx`, `app/page.tsx` (`Home`), `components/GlobalAudioPlayer.tsx`, `components/ui/HeroBackgroundVideo.tsx`, `components/ui/HoverMediaBackground.tsx`, `components/universe/Universe.tsx` (dynamic import), `components/ui/CinematicBackground.tsx`, `store/*.ts`

| Concern | Evidence | Severity |
|---|---|---|
| `Home` subscribes to whole stores | `page.tsx:117` `useUIStore()`, `:118` `usePerformanceStore()`, `:119` `useAudioStore()` without selectors. Any change to *any* field, including `progress` (8 Hz) and `hoveredVibe` (every homepage hover), re-renders `Home` and its whole non-memoised subtree. | CRITICAL (Confirmed) |
| Hover state drives a root-level selector | `page.tsx:292-304`: `targetAudioUrl` selector + effect → `playUrl()` on every hovered song. `hoverSong` is called from inside `useFrame` (`NodeField.tsx:749`). Zustand uses `useSyncExternalStore`, so these updates render synchronously, inside the animation frame. | CRITICAL (Confirmed mechanism) |
| Universe and three.js load at startup | `page.tsx:26-29` dynamic-imports `Universe`, but `:344` renders it immediately with `songs=[]`. The 143 KB-gzip R3F/three chunk loads and a WebGL context is created while the user is still on the intro. | HIGH (Confirmed) |
| three.js core in the initial bundle | `page.tsx:20` imports `atlasManager`; `lib/vibeService.ts:2` imports `getOptimizedArtworkUrl` from `atlasManager`; `atlasManager.ts:1` does `import * as THREE from 'three'`. The initial chunk `02hvssugk.d_m.js` (101 KB gzip) contains three r184 core (`CanvasTexture`, `DataTexture`). | HIGH (Confirmed from build) |
| Render-blocking fonts | `layout.tsx:25-28`: one Google Fonts stylesheet with 7 families. The CSS returns 91 `@font-face` rules. `Google Sans Flex` and `Anton` are not referenced anywhere. Not using `next/font`, which ESLint flags (`@next/next/no-page-custom-font`). | HIGH (Confirmed) |
| Global media layers always mounted | `HoverMediaBackground` reacts to `uiStore.hoveredVibe` from *any* view, including the Switch Chart overlay inside the Universe (§4.6). | HIGH (Confirmed) |
| Global CSS | `globals.css` is small (64 KB raw / 10 KB gzip including Tailwind). Not a problem. | — |

### 4.1 Intro — Vibe Selection (Section 1) and Creator Collection (Section 2)

**Main components:** `IntroScreen.tsx` (`HomepageVibeCard` ×14, `CreatorCueCard`, `CreatorCollectionCard`, `AmbientParticles`, `MagneticChromeText`), `HeroBackgroundVideo.tsx`, `HoverMediaBackground.tsx`, `useChartHover.ts`, `vibeService.prefetchVibe`.

**Rendering bottlenecks**
- Every hover sets `uiStore.hoveredVibe`. That re-renders `IntroScreen` (not memoised, subscribed through `useChartHover`) **and** `Home` (whole-store subscription, `page.tsx:117`), which cascades into `Universe` → R3F `Canvas` → `CameraController`. The cards are memoised, so only two cards re-render. The root does not benefit. *(Medium, Confirmed)*
- `MagneticChromeText` (`IntroScreen.tsx:506-531`) attaches a `window` `mousemove` listener that calls `getBoundingClientRect()` on **every** mouse event, without rAF throttling. *(Medium, Confirmed; cost Probable)*

**Animation and compositing cost**
- Each of the 14 cards (`IntroScreen.tsx:137-153`) stacks: a `backdrop-blur-[1.5px]` layer, three `mix-blend-overlay` / `mix-blend-screen` layers, a `blur-[2px]` filtered highlight, and an inset-shadow overlay. In total that is **14 backdrop-filters and ~56 blend/filter layers over a full-screen video that changes 24 times a second**. Backdrop filters and blend groups over a changing backdrop must be recomputed every video frame. This is the main GPU cost of the homepage. *(HIGH, Probable)*
- Hover transitions animate `box-shadow` with very large spreads (`0 0 50px 10px …`, `IntroScreen.tsx:118-119`, `:655-662`) and `filter: brightness()`. `box-shadow` is not compositor-animatable, so every frame of the 350 ms transition repaints. The Creator cards use even larger shadows (`:696-701`, `:732`). *(Medium, Confirmed mechanism)*
- Every new hovered vibe re-keys and remounts a 600×600 `blur-[45px]` glow with an exit animation (`:746-762`). Two large blurred layers are rasterised per hover. *(Medium, Probable)*
- 22 particles with infinite keyframe animation and `will-change: transform, opacity` (`:475-495`, `:597-600`) create 22 permanent compositor layers. *(Low)*

**Asset cost**
- `globe.mp4`: 11.8 MB, 1080×1080, 3.1 Mbps. Loaded with `preload="auto"` and autoplay, scaled `1.85×`, with a CSS `filter: contrast() brightness() saturate()` that adds a full-viewport filter pass per frame (`HeroBackgroundVideo.tsx:45-61`). *(HIGH, Confirmed)*
- The globe **keeps playing and decoding underneath the hover video**. `HeroBackgroundVideo` imports `useUIStore` (`:6`) but never uses it, so nothing pauses it on hover. During a preview→full handoff, three 1080p H.264 streams decode at once (globe, preview, full). *(HIGH, Confirmed)*
- Tile art: 14 × WebP at **1024×1024** (60–85 KB each, ~1.05 MB total), displayed at roughly 160–190 CSS px. About 2.5–3× larger than needed even at DPR 2. *(Medium)*
- `kadence-horizontal-logo.png`: **2172×724, 783 KB**, shown at 44 px tall. `kadence-chrome-logo.png`: 1110×342, 230 KB. React 19 server rendering puts both into `<link rel="preload" as="image">` in `index.html`, so they compete with JS and fonts at high priority. *(Medium, Confirmed from build)*

**Media interaction cost (hover)** — `HoverMediaBackground.tsx`
- On hover: the preview MP4 loads at once (`:220-221`). When it plays, the **full 30 s MP4 starts downloading** (`:211`, `:167-168`). Full files are 6.8–30.6 MB. See §7 for the full table.
- Handoff seeks the full video to exactly 3.0 s (`:116`), but the files have keyframes at 0 s and then 4.3 s (*God Mode*), 7.2 s (*Beat It*) and so on. The decoder has to decode ~72 frames of 1080p from the start before showing the 3 s frame. *(HIGH, Confirmed from ffprobe)*
- Handoff fires when the full file is buffered (`:120-158`), not when the looping preview reaches 3 s. The picture therefore jumps. Both elements are `muted={false}` (`:288`, `:303`), so audio from both plays during the 200 ms crossfade (`:146-152`). *(HIGH, Confirmed)*
- Unmuted `play()` on hover is likely rejected for first-time visitors (§5 H3).

**Network / data**
- A 150 ms hover dwell triggers `vibeService.prefetchVibe` → `/api/songs?vibe=…` plus 12 artwork prefetches (`useChartHover.ts:37-42`, `vibeService.ts:87-105`). That is reasonable on its own, but it competes with the video downloads above.

**Severity for this view: HIGH.** The biggest costs are media decode, bandwidth contention and backdrop-filter/blend compositing over video.

### 4.2 Loading / Universe warm-up

**Main components:** `GlowingRingLoader.tsx`, `page.tsx` `handleVibeSelect` (`:137-227`), `atlasManager.prepareCriticalVibe`, `GlobalAudioPlayer` preload queue, `NodeField` (already mounted, because `setSongs` runs before the artwork is ready, `:185`).

| Concern | Evidence | Severity |
|---|---|---|
| Loader animates box-shadow continuously | `GlowingRingLoader.tsx:104-165`: the main ring's keyframes animate six stacked `box-shadow`s (three inset, up to 48 px blur) over 5.5 s, infinitely. That is a repaint every frame, at the moment the main thread is busiest. | MEDIUM (Confirmed mechanism) |
| Network fan-out during loading | Running at the same time: the first audio track; up to 4 audio preloads (`GlobalAudioPlayer.tsx:35`); **32 parallel** critical artworks (`atlasManager.ts:172-177`); **6 more** from the duplicate `NodeField` loader (`NodeField.tsx:341-356`); the dynamic Universe chunk if it has not finished. | HIGH (Confirmed) |
| Root re-renders 8×/s once audio starts | The progress timer starts with the first `playUrl`, so `Home` → `IntroScreen` (not memoised) → `GlowingRingLoader` re-render at 8 Hz throughout loading. | MEDIUM (Confirmed) |
| Worst-case wait | Each critical image has a 3.5 s safety timeout (`atlasManager.ts:121-129`), so one stalled artwork can hold the loader for 3.5 s. | LOW |

### 4.3 Universe — the album wall (primary experience)

**Main components:** `Universe.tsx` (R3F `Canvas`), `NodeField.tsx` (instanced mesh, custom GLSL3 shader, input, hover, jelly physics), `CameraController.tsx`, `lib/atlasManager.ts`, `lib/jellyField.ts`, `Navbar.tsx`, `SearchPanel.tsx` trigger, `HoverTooltip` (`page.tsx:36-95`), `GlobalAudioPlayer.tsx`.

**Rendering and main thread**
- **8 Hz full-tree renders** while audio plays (C1).
- **A full-tree synchronous render on every tile crossing**, triggered from inside `useFrame` (C1).
- `Universe` and `NodeField` are not memoised. Each root render re-renders the R3F subtree. `CameraController` receives a new `targetNodePos` object each render (`Universe.tsx:68`), so its effect re-runs every render while a song is selected. *(Medium, Confirmed)*
- `NodeField`'s `useFrame` loader loop scans up to 256 entries every frame forever, even after loading finishes (`:341-356`). *(Low)*
- The jelly simulation integrates 48×48 = 2,304 cells per frame and scans for activity (`jellyField.ts:162-289`). Estimated 0.1–0.3 ms of JS per frame. *(Low, Unverified)*

**GPU**
- `frameloop="always"` whenever `songs.length > 0` (`Universe.tsx:36`). Nothing pauses rendering when the canvas is hidden (Song Detail sets it to `opacity: 0`, `page.tsx:339`) or covered (Switch Chart overlay). *(HIGH, Confirmed)*
- The canvas wrapper animates `filter: blur(10–12px) brightness()` (`page.tsx:340`). A CSS filter over a canvas that changes every frame means a full-screen blur every frame during refresh, and during Song Detail as well, even though the canvas is invisible then. *(HIGH, Confirmed mechanism)*
- Persistent `backdrop-filter` surfaces over the 60 fps canvas: 4 Navbar `GlassButton`s plus the search trigger (each `blur(16px)` plus a separately blurred shadow element, `GlassButton.tsx:31`, `:74-75`) and the hover tooltip (`backdrop-blur-md`, `page.tsx:52`). Each is recomputed every frame. *(HIGH, Probable)*
- Fragment shader: full-screen coverage, two `pow()` gamma conversions per fragment, `discard` for rounded corners (which defeats early-Z), at up to DPR 1.5. Fine on discrete GPUs; noticeable on integrated or mobile GPUs. *(Medium, Unverified)*
- **Texture atlas uploads** — see C3. This is the most likely cause of the visible hitching right after entering the Universe. *(CRITICAL, count Confirmed, cost Probable)*

**Audio**
- Sweeping the cursor across the wall calls `playUrl` for every tile crossed, with no dwell (`page.tsx:292-304`). Each URL not already in the pool creates a new `Audio()` with `preload='auto'`, outside the concurrency limiter (`GlobalAudioPlayer.tsx:208-234`). These elements are only evicted when their URL is no longer in `preloadedUrls`. Because `preloadedUrls` contains *every* song of the current chart (`page.tsx:180-181`), they are effectively never evicted within a chart (`:109-120`). See C2. *(CRITICAL, Confirmed)*
- 20 tracks are preloaded in full with `preload='auto'` on entry (`GlobalAudioPlayer.tsx:85`). At a typical ~1 MB per 30 s iTunes preview that is ~20 MB, competing with artwork. *(HIGH, size Unverified)*

**Correctness defect noticed during the audit (not performance):** `uSelectedIdx` is set from the *song index* (`NodeField.tsx:786-792`), but the shader compares it with the *instance index* (`:84`). Because instances map to songs through the shuffled `texIndices`, the selection highlight lands on the wrong tile.

**Severity for this view: CRITICAL.**

### 4.4 Song Detail panel

**Files:** `SongDetail.tsx`, `GlassButton.tsx`, `EditorialOverlay.tsx`, `CinematicBackground.tsx`

| Concern | Evidence | Severity |
|---|---|---|
| Whole audio store subscription | `SongDetail.tsx:407` `useAudioStore()`. The component is always mounted after intro (even when `song` is null), so it re-renders at 8 Hz for the whole session. | HIGH (Confirmed) |
| CSS transition fighting the spring | The drawer (`:483-493`) is animated by framer-motion (spring on `x`, `opacity`) **and** has `transition-all duration-700` with `cubic-bezier(0.175, 0.885, 0.32, 2.2)`. Every per-frame transform framer writes is re-animated by CSS over 700 ms with overshoot. That is the "rubbery, laggy" open/close feel. | HIGH (Confirmed) |
| SVG filter glass | `:12-63` defines `feTurbulence → feComponentTransfer → feGaussianBlur → feSpecularLighting → feComposite → feDisplacementMap(scale 200)`. It is applied with `filter: url(#glass-distortion)` alongside `backdropFilter: blur(3px)` on a ~360 × viewport-height layer (`:497-504`). Chromium generally rasterises SVG reference filters, especially turbulence and lighting, on the CPU. | HIGH (Probable) |
| Forced layout every progress tick | `LiquidScrubber` calls `trackRef.current.getBoundingClientRect()` in an effect keyed on `progress` (`:176-181`). That is a forced synchronous layout 8×/s straight after a React commit. | MEDIUM (Confirmed) |
| Layout-animated progress bar | `transition-all ease-linear` on an element whose `width` changes every 125 ms (`:261-264`) keeps layout running continuously during playback. | MEDIUM (Confirmed) |
| 40 waveform bars repainted per tick | `:651-665`: each bar's `backgroundColor` and `boxShadow` are recomputed from `progress` on every render, with infinite CSS animations and `mix-blend-screen` on the container. | MEDIUM (Confirmed) |
| Blur on full-screen background | `CinematicBackground.tsx:23-32`: 600×600 artwork upscaled to the full viewport with `filter: blur(9px)` inside a 1.2 s scale animation. Switching songs crossfades two such layers (keyed by `song.id`). | MEDIUM (Probable) |
| Image entry animation | `motion.img` animates `filter: blur(12px) → blur(0)` (`:552-557`), a repaint every frame for 650 ms. | LOW |
| ~14 `GlassButton`s | Each one injects its own style block and runs springs (H6). | HIGH (see H6) |
| Canvas still rendering underneath | §4.3: WebGL at 60 fps with a full-screen CSS blur, at `opacity: 0`. | HIGH (Confirmed) |

`MagneticGlassCard` (`SongDetail.tsx:65-139`) is dead code; it is never rendered.

**Severity for this view: HIGH.**

### 4.5 Search

**Files:** `SearchPanel.tsx`, `page.tsx` `handleSearchResults` (`:305-316`), `app/api/search/route.ts`

| Concern | Evidence | Severity |
|---|---|---|
| Each search rebuilds the wall | Results are merged into `songs` (`page.tsx:314`). The new `songs.length` → new `texIndices` → new `geometry` (`NodeField.tsx:361-425`) → new `args` → R3F **reconstructs the InstancedMesh**. The old geometry is never disposed. The `[songs]` effect clears `loadedSet` (`:305-309`), so `NodeField` re-downloads and redraws **all 256 artworks** and repeats the atlas upload storm (C3). | HIGH (Confirmed) |
| No request cancellation | `search()` has no `AbortController` (`SearchPanel.tsx:37-50`). A slow earlier response can overwrite a newer one and still be merged into the wall. | MEDIUM (Confirmed) |
| Overlay over a live canvas | `backdrop-blur-2xl` (40 px) panel plus 10 suggestion `GlassButton`s, each with `backdrop-filter`, over the 60 fps canvas. | MEDIUM (Probable) |
| Upstream | Each query calls iTunes directly with no caching (`musicProvider.ts:744-758`, `cache: 'no-store'`). | MEDIUM |

### 4.6 Switch Chart overlay

**Files:** `ChangeVibeOverlay.tsx`, `useChartHover.ts`, `HoverMediaBackground.tsx`, `page.tsx` `handleChangeVibe` (`:231-260`)

| Concern | Evidence | Severity |
|---|---|---|
| Full-screen 64 px backdrop blur over a 60 fps canvas | `ChangeVibeOverlay.tsx:204` `backdrop-blur-3xl` on `fixed inset-0`. The canvas underneath keeps rendering, so the blur is recomputed every frame across the whole viewport. | HIGH (Probable) |
| Homepage hover-video system fires inside the Universe | The overlay uses `useChartHover` (`:200`), which writes `uiStore.hoveredVibe`. `HoverMediaBackground` is mounted globally and starts the preview and full 1080p MP4s, **unmuted**, under the overlay, while the iTunes preview audio is already playing. The result is overlapping audio, extra decode load, and 7–31 MB downloads during a chart switch. | HIGH (Confirmed) |
| Chart switch triggers wall rebuild and atlas storm | `setSongs` is called before the critical artwork is ready (`page.tsx:249` then `:255`). `atlasManager` clears the canvas while `NodeField` independently starts reloading. | HIGH (Confirmed) |
| Duplicated CSS | The overlay re-injects the `.kadence-3d-*` CSS already injected by `IntroScreen`, using `dangerouslySetInnerHTML` (`:262-305`). | LOW |

### 4.7 API routes (server)

| Route | Used by client? | Findings |
|---|---|---|
| `/api/songs` | Yes | Cold request = **8 parallel iTunes searches × `limit=200`** (`musicProvider.ts:632-661`), all `cache: 'no-store'` (`:522`, `:542`). Cache is a module-level `Map` (`route.ts:6`), which is lost on every serverless cold start and not shared between instances. No `Cache-Control` on the response (`:59`). The `targetCount` argument (`256`) is ignored by `fetchSongsByVibe`; every accepted track is returned, but only 256 can be displayed (`NodeField.tsx:23`). Regional chart files are empty arrays (`lib/*ChartData.ts`), so those charts fall back to 12–19 iTunes queries. Each rejected regional track is `console.log`ged in production (`musicProvider.ts:185-217` etc.). |
| `/api/search` | Yes | Uncached iTunes search, `limit=50`. |
| `/api/songs/top`, `/api/chart-preview` | **No** (`chartPreviewStore` is never imported) | Dead endpoints. |
| `/api/proxy` | **No** | **Open proxy**: fetches any `?url=` server-side and returns it with `Access-Control-Allow-Origin: *` and a one-year immutable cache header (`proxy/route.ts:3-37`). This is a security and bandwidth-cost liability. Remove it. |

---

## 5. Critical and High-Severity Findings

Ranked by expected impact on perceived sluggishness. Each finding lists the location, evidence, mechanism, affected views, fix, expected impact and confidence.

### C1 — Global re-render loop (8 Hz progress plus synchronous hover renders)
- **Where:** `app/page.tsx:117-119` (`Home`), `components/ui/SongDetail.tsx:407`, `components/GlobalAudioPlayer.tsx:13-21`, `:126-131`; hover path `NodeField.tsx:749` → `songStore.hoverSong` → `page.tsx:292-297`.
- **Evidence:** `const { playUrl } = useAudioStore()` subscribes `Home` to `progress`, which `setProgressState` updates every `PROGRESS_INTERVAL_MS = 125` while audio plays. `useUIStore()` likewise subscribes `Home` to `hoveredVibe`. `targetAudioUrl` is a root selector over `hoveredSong`, which changes on every tile crossing. That change is triggered inside `useFrame`.
- **Mechanism:** `Home` is the root of every view. Its non-memoised children (`Universe` → R3F `Canvas` → `NodeField`/`CameraController`, `Navbar`, `SearchPanel`, `SongDetail`, `CinematicBackground`, `IntroScreen` during loading) re-render on each update. Framer-motion components re-diff their props. `SongDetail` re-renders 40 bars and a scrubber that forces layout. Because Zustand updates go through `useSyncExternalStore`, renders started from the rAF callback are flushed synchronously in that frame, which lengthens the very frames that drive the wall animation.
- **Affects:** Loading, Universe, Song Detail, Search, Switch Chart — every view after a vibe is chosen.
- **Fix:** Use selectors everywhere (`useAudioStore(s => s.playUrl)`; read actions with `getState()`). Move `progress`/`duration` into a dedicated store or a ref read by a leaf `<ProgressBar>` through rAF. Never route per-frame or per-hover state through the root component: put the hover → audio bridge in a non-rendering module subscriber (`useSongStore.subscribe`). Wrap `Universe` in `memo` and pass stable props.
- **Expected impact:** Removes ~8 full-tree renders per second and one per tile crossed. Probably the largest single win in main-thread time and INP across the app.
- **Confidence:** Existence **Confirmed**; per-render cost **Probable** (profile with the React DevTools Profiler).

### C2 — Undebounced hover audio with an unbounded, never-evicted `Audio` pool
- **Where:** `page.tsx:292-304`; `GlobalAudioPlayer.tsx:178-290` (URL effect), `:208-234` (element creation), `:109-120` (eviction), `:34-77` (queue).
- **Evidence:** Each hover → `playUrl(url)` → if the URL is not pooled, `new Audio()` + `preload='auto'` + `load()` + `play()`, with no dwell and no concurrency check. Eviction only removes URLs that are `!preloadedUrls.includes(url)`, and `preloadedUrls` holds every song in the chart. Hover-created elements are marked `'loading'` and count toward `CONCURRENCY_LIMIT = 4`. If the browser suspends their loading (common once many media elements exist), `canplaythrough` never fires and the preload queue stalls permanently.
- **Mechanism:** Sweeping across N tiles starts N full-file downloads (about 1 MB each, typical for iTunes previews) and allocates N media players. These compete with artwork, the atlas and the next track. Chromium also limits the number of live media players, so beyond that limit older players get suspended. `play()` / `pause()` churn raises a stream of `AbortError`s.
- **Affects:** Universe (primary), Song Detail, Search.
- **Fix:** Add a hover dwell of 120–200 ms before `playUrl`. Send *all* loads through one priority scheduler with a hard concurrency cap. Use an LRU pool of 8–12 elements that releases audio with `src` removal and `load()`. Preload only metadata or the first seconds for neighbours (`preload='metadata'`). Better still, use one or two reused `<audio>` elements and rely on the HTTP cache. Remove `crossOrigin='anonymous'` unless Web Audio analysis is added.
- **Expected impact:** Bounded memory, much less bandwidth contention, faster artwork fill, no queue deadlock. Hover audio feels *more* immediate because the intended track is not queued behind dozens of abandoned ones.
- **Confidence:** Growth and leak **Confirmed**; deadlock **Probable**.

### C3 — 64 MB texture-atlas upload storms and a duplicate artwork pipeline
- **Where:** `lib/atlasManager.ts:44-59` (4096×4096 canvas `CanvasTexture`), `:180`, `:256-258`, `:266-268`; `components/universe/NodeField.tsx:300-356` (second loader), `:543-553` (flush policy), `:305-309` (reset on `songs` change).
- **Evidence:** `atlasManager` loads 32 critical and 224 background artworks and sets `texture.needsUpdate = true` once at the end of the critical load, then at most every 1.2 s. `NodeField` keeps its *own* `loadedSet`, re-requests and re-decodes the same 256 images (`MAX_LOADS = 6`), redraws them into the same canvas, and sets `needsUpdate` **on every frame in which the count changed while `size <= 16`** (`isInitialBatch`), then every 500 ms. Each `needsUpdate` on a `CanvasTexture` re-uploads the **whole** 4096² RGBA surface (64 MB).
- **Estimate:** About 16 (initial batch) + ~8–12 (500 ms cadence) + ~5–8 (atlasManager) ≈ **25–40 full uploads, i.e. ~1.6–2.6 GB of texture upload traffic**, concentrated in the first ~5–10 s after entering the Universe. The same thing happens on every search, refresh and chart switch. Memory: 64 MB canvas backing store plus 64 MB GPU texture.
- **Mechanism:** Full-texture `texImage2D` uploads stall the GPU process and often the main thread, depending on whether the canvas is GPU-accelerated and how `flipY` is handled by the browser. The result is the visible hitching right after the transition, when the user first moves the mouse.
- **Affects:** Universe entry, chart switch, refresh, search.
- **Fix:** Delete the `NodeField` loader and make `atlasManager` the only owner. Upload **per slot**: decode with `createImageBitmap` (off the main thread, resized to 256²) and copy each tile into the atlas with `renderer.copyTextureToTexture(src, atlas, null, dstPosition)` or a raw `texSubImage2D`. That uploads 256 KB per tile instead of 64 MB. Do not reset slots when songs are only appended. Consider a `DataArrayTexture` (256 layers × 256²).
- **Expected impact:** Upload volume falls from GBs to ~16 MB per chart; removes the main source of post-transition jank; halves image requests and decodes.
- **Confidence:** Upload count and duplication **Confirmed**; stall duration **Probable** (verify with Chrome Performance + GPU track).

### C4 — Unconditional 60 fps WebGL under expensive full-screen compositing
- **Where:** `Universe.tsx:36` (`frameloop`), `page.tsx:336-343` (animated `filter` on the canvas wrapper), `GlassButton.tsx:31`, `:74-75`, `page.tsx:52` (tooltip), `ChangeVibeOverlay.tsx:204` (`backdrop-blur-3xl`), `SearchPanel.tsx:88` (`backdrop-blur-2xl`).
- **Evidence:** No code path stops or throttles the render loop while `selectedSong` is set (the canvas is at opacity 0), while the Switch Chart overlay covers it, or while the document is hidden behind other layers. Every `backdrop-filter` above the canvas samples content that changes every frame.
- **Mechanism:** The GPU pays for the WebGL frame **plus** a full-screen CSS blur (refresh / Song Detail) **plus** one blur pass per backdrop-filter surface, every frame. On integrated GPUs this becomes the frame-time ceiling. It also starves video decode and composition when the hover-video system is active (§4.6).
- **Affects:** Universe, Song Detail, Search, Switch Chart.
- **Fix:** Use `frameloop="demand"` with `invalidate()` from input and animation sources, or switch to `"never"` while Song Detail or overlays are open. Replace the animated blur on the canvas with an opacity fade, or a one-off blurred snapshot (`gl.domElement.toDataURL` → static image) if the blur look is required. Give glass controls a static pre-blurred background, or limit `backdrop-filter` to surfaces that are not over the live canvas. Cap DPR at 1 on low-end GPUs (adaptive tier).
- **Expected impact:** Large GPU-time reduction in every post-intro view; better battery life; lower fan noise on laptops.
- **Confidence:** Structure **Confirmed**; GPU cost **Probable**.

### H1 — Homepage media weight and decode contention
- **Where:** `HeroBackgroundVideo.tsx:45-61`; `HoverMediaBackground.tsx:105-227`; `lib/introMediaManifest.ts`; `public/videos/`.
- **Evidence:** See the table in §7. The globe (11.8 MB, `preload="auto"`, CSS color filter, `scale(1.85)`) is never paused during hover. A hover starts a 1080p preview at 1.8–9.5 Mbps, then immediately the full 6.8–30.6 MB file. Exploring all 14 tiles once ≈ **31.9 MB of previews + 266.4 MB of full videos ≈ 298 MB**.
- **Fix:** Pause the globe while a hover video is visible. Re-encode at 720p (or 1080p at 2–3 Mbps with CRF and `-preset slow`), add 540p/720p variants, or use HLS through a media CDN. Defer the full-video download until the preview has played ~1.5 s and the user is still hovering. Add `poster` frames. Do not autoload the globe on slow connections (`navigator.connection.saveData` / `effectiveType`).
- **Expected impact:** 3–5× less video bandwidth per hover; one fewer concurrent decode; much better behaviour on mobile and slow links.
- **Confidence:** **Confirmed** (sizes and bitrates measured with ffprobe).

### H2 — Preview→full handoff is seek-heavy and not frame-aligned
- **Where:** `HoverMediaBackground.tsx:114-158`.
- **Evidence:** `currentTime = 3` on files whose keyframes are at 0 s, 4.33 s, 14.75 s (*God Mode*) and 0 s, 7.17 s (*Beat It*), measured with ffprobe. Handoff triggers on `progress`/`canplay`/`seeked` once the buffer covers 3.0–3.5 s, regardless of where the looping preview is. Both videos are unmuted during the 200 ms crossfade.
- **Fix:** Remove the handoff entirely: make the preview the first segment of the same file, or encode the full video with `-force_key_frames 3` (or a dedicated "from 3 s" tail file starting with a keyframe). Trigger the switch on the preview's `timeupdate` near its end (or `requestVideoFrameCallback`), and keep only one audio source active.
- **Expected impact:** Removes the decode spike and the visual/audio discontinuity at handoff.
- **Confidence:** **Confirmed**.

### H3 — Unmuted autoplay on hover is likely blocked for first-time visitors
- **Where:** `HoverMediaBackground.tsx:203-216`, `:288`, `:303`.
- **Evidence:** `play()` is called from a `canplay` handler after a *hover*. Under browser autoplay policies, hover is not a user activation, so unmuted playback is rejected until the user has clicked or tapped on the site (unless the site already has a high Media Engagement Index). The code makes the preview visible (`setVisible(pVid, true)`, `:203`) *before* `play()` resolves and swallows the rejection (`:213-215`). The user sees a frozen first frame, and the full video never loads, because that step is chained on `play()` resolving.
- **Why the developer may not see it:** On `localhost` or a frequently visited deployment the developer's browser builds up a high engagement score and autoplay with sound is allowed. New users do not have that.
- **Fix:** Start muted (always permitted) and unmute after the first user gesture. Or show a one-tap "enable sound" affordance. Only reveal the video once `play()` has resolved.
- **Confidence:** **Probable** (policy confirmed; verify with a fresh browser profile).

### H4 — Homepage grid compositing over video
- **Where:** `IntroScreen.tsx:113-157` (per-card layer stack), `:622-662` (3D, shadow and filter transitions), `:746-772` (blurred glows), `:475-495` (particles).
- **Evidence and mechanism:** See §4.1. 14 backdrop-filters and ~56 blend/filter layers over a 24 fps video; box-shadow transitions repaint every frame; each hover remounts a 600 px blur(45px) layer.
- **Fix:** Bake the glass and specular overlay into the tile WebP (it is static art). Drop the per-card `backdrop-blur-[1.5px]` (barely visible at 1.5 px). Replace blend-mode overlays with pre-multiplied gradients. Animate a pre-rendered glow image's `opacity`/`transform` instead of `box-shadow`. Keep one persistent glow element and cross-fade its colour.
- **Expected impact:** Large drop in compositor work on the homepage, especially while scrolling and while video plays.
- **Confidence:** **Probable**.

### H5 — Song Detail panel: SVG filter, transition conflict, layout thrash
- See §4.4. The `transition-all duration-700` on a framer-animated element (`SongDetail.tsx:489-493`) is **Confirmed** and very cheap to fix. The SVG filter (`:12-63`, `:497-504`) is **Probable** and should be replaced with a static pre-rendered texture or a plain `backdrop-filter`.

### H6 — `GlassButton`: per-instance style injection, stacked filters, unthrottled layout reads
- **Where:** `GlassButton.tsx:300` (`<style>{glassButtonStyles}</style>` in every instance), `:9-215` (≈6 KB of CSS including two `@property` registrations), `:31` (`filter: blur`), `:74-75` (`backdrop-filter: blur(16px)`), `:54-69`, `:151-166` (`mask-composite`), `:281-291` (`getBoundingClientRect` on every `mousemove`), `:278-279` (two springs per instance).
- **Evidence:** About 19 instances when Song Detail and Search are open. Each mount or unmount inserts or removes a `<style>` element, which invalidates styles for the whole document. React 19 only hoists and dedupes `<style>` elements that have `href` and `precedence`; these have neither.
- **Fix:** Move the CSS into `globals.css` (once). Throttle `mousemove` with rAF and cache the rect on `pointerenter`. Drop `backdrop-filter` on buttons over the live canvas. Lazily create springs only while hovered.
- **Expected impact:** Faster mount/unmount of Song Detail and Search, fewer style recalculations, lower per-frame GPU cost in the Universe.
- **Confidence:** Injection and layout reads **Confirmed**; GPU share **Probable**.

### H7 — Initial-load critical path
- **Where:** `app/layout.tsx:23-28`; `app/page.tsx:20-21`, `:26-29`, `:344`; `lib/vibeService.ts:2`; `public/kadence-*-logo.png`; `public/images/vibes/*`; `HeroBackgroundVideo.tsx:51`.
- **Evidence from the production build:**

| Asset | Size |
|---|---|
| Initial JS (8 module scripts) | **334 KB gzip / ~1.2 MB raw** |
| ↳ three r184 core, pulled in by `atlasManager` | 101 KB gzip |
| ↳ framer-motion + app code (includes the 80-track `devSpecialData`) | 88 KB gzip |
| Universe chunk (R3F + three renderer), fetched immediately | 143 KB gzip |
| CSS | 10 KB gzip |
| Fonts | 7 families, 91 `@font-face` rules, render-blocking |
| Preloaded logos | 1.01 MB PNG |
| Tile images | ~1.05 MB |
| `globe.mp4` (auto-preload) | 11.8 MB |

  **Total ≈ 14 MB before the first interaction** (font bytes not measured).
- **Fix:** Use `next/font` with only the used families and weights (`Inter`, `Syne`, `Syncopate`, `Space Grotesk`, `Prompt` — subset, `display: swap`; drop `Google Sans Flex` and `Anton`). Move `getOptimizedArtworkUrl` into a three-free util and lazy-import `atlasManager`. Mount `Universe` only after a vibe is chosen (prefetch the chunk on tile hover). Serve the logo as SVG or a ~20 KB WebP at 2× display size. Resize tile art to 384². Give the globe `preload="metadata"` and a poster, and start it after `load`.
- **Expected impact:** Initial JS down ~30–40% (three core and Universe off the critical path); faster first paint (no render-blocking font CSS); ~13 MB less transferred on a cold visit.
- **Confidence:** **Confirmed** (build artefacts).

### H8 — Backend data path cannot handle production traffic
- See §4.7 and §9. `cache: 'no-store'`, 8 × 200-result iTunes calls per cold chart, per-instance in-memory cache in a serverless deployment (`.vercel/project.json` present), no CDN caching, no rate-limit handling or backoff, empty regional datasets that force 12–19 upstream calls each.
- **Confidence:** Mechanism **Confirmed**; latency and rate-limit behaviour **Unverified** (needs production logs).

### H9 — Search merges trigger full wall reconstruction
- See §4.5. **Confirmed**.

---

## 6. Root Causes of Overall Sluggishness

The findings reduce to seven architectural root causes. Fixing a symptom without fixing its root cause will regress.

| # | Root cause | Symptoms it produces |
|---|---|---|
| R1 | **One giant client component as the application root** (`Home`). It holds high-frequency state through whole-store subscriptions, and every view is its child. | C1, H9, re-render cost in every view |
| R2 | **No single owner of media or network priority.** Video (`HeroBackgroundVideo`, `HoverMediaBackground`), audio (`GlobalAudioPlayer`), artwork (`atlasManager` *and* `NodeField`) and data (`vibeService`) each start requests on their own, with separate or no concurrency limits. | C2, C3, H1, loading-phase contention, Switch Chart audio overlap |
| R3 | **Duplicated subsystems.** Two artwork loaders, two flush policies, CSS injected per instance, two copies of the 3D card CSS. | C3, H6 |
| R4 | **Rendering is never gated on visibility or need.** WebGL is always on; hover-video logic runs in any view; the globe never pauses. | C4, H1, §4.6 |
| R5 | **Compositor-unfriendly effects over continuously changing pixels.** `backdrop-filter`, `mix-blend-mode`, SVG filters, animated `box-shadow` and CSS `filter` sit above video or WebGL. | C4, H4, H5, H6, M1 |
| R6 | **Media authored for quality, not delivery.** 1080p–1440p at up to 9.5 Mbps, a single rendition, keyframes not aligned to the handoff, unmuted tracks, no posters, no adaptive variants. | H1, H2, H3 |
| R7 | **A live third-party search API used as the database.** No durable cache, no CDN policy, no payload shaping. | H8, slow first chart load, failure under load |

---

## 7. Media and Asset Performance Analysis

### 7.1 Video inventory (measured with ffprobe)

All files are H.264 High profile, yuv420p, 24 fps, AAC audio (except *Gala Gala*), **faststart = yes** (`moov` before `mdat`, which is good).

| Vibe tile | Preview (3 s) | Full (30 s) | Resolution | Full bitrate |
|---|---|---|---|---|
| global-top-50 (*Beat It*) | 1.6 MB | 14.1 MB | 1920×1440 (level 5.0) | 3.7 Mbps |
| viral-50 (*Radhimaa*) | 3.1 MB | 24.9 MB | 1920×1280 | 6.6 Mbps |
| new-music-friday (*Alaakaa Loova*) | 2.4 MB | 19.5 MB | 1920×1080 | 5.2 Mbps |
| hip-hop-central (*Loser*) | 0.7 MB | 6.8 MB | 1920×788 | 1.8 Mbps |
| pop-rising (*Kiss Kiss Bang Bang*) | 2.9 MB | 14.3 MB | 1920×1080 | 3.8 Mbps |
| dance-hits (*Yeshanagula*) | 2.3 MB | 26.2 MB | 1920×1080 | 7.0 Mbps |
| mood-booster (*Sunflower*) | 1.5 MB | 13.1 MB | 1920×1080 | 3.5 Mbps |
| late-night (*One Of The Girls*) | 0.9 MB | 8.9 MB | 1920×1080 | 2.4 Mbps |
| workout (*Big Dawgs*) | 3.5 MB (9.5 Mbps) | 24.6 MB | 1920×1080 | 6.5 Mbps |
| chill-hits (*Pavazha Malli*) | 3.4 MB (9.1 Mbps) | 25.1 MB | ~1920×1336 | 6.7 Mbps |
| dev-special (*God Mode*) | 3.2 MB | **30.6 MB** | 1920×1080 | **8.1 Mbps** |
| top-telugu (*Baby Won't You Tell Me*) | 1.2 MB | 12.2 MB | 1920×1080 | 3.2 Mbps |
| top-tamil (*Monica*) | 2.9 MB | 25.0 MB | 1920×1080 | 6.7 Mbps |
| top-hindi (*Gehra Hua*) | 1.0 MB | 9.7 MB | 1920×1080 | 2.6 Mbps |
| top-kpop (*Dynamite*) | 1.2 MB | 11.6 MB | 1920×1080 | 3.1 Mbps |
| **Totals** | **31.9 MB** | **266.4 MB** | | |
| `globe.mp4` (background) | — | 11.8 MB | 1080×1080 | 3.1 Mbps |
| `Gala Gala_30s.mp4` | — | 14.4 MB | **unused** (not in manifest) | |

**Observations**
- These bitrates are far above what a dimmed (`bg-black/60`), full-bleed, 3–30 s background loop needs. 720p at 1.5–2.5 Mbps would look the same behind the dim layer.
- Keyframe spacing is irregular (scene-cut driven) and does not include 3.0 s, which hurts the handoff (H2).
- `next.config.ts:16-28` gives `/videos/*.mp4` `Cache-Control: immutable, max-age=1y`. The filenames are **not content-hashed**, so a re-encode under the same name is served stale to returning users for up to a year. Hash the filenames or drop `immutable`.
- `HoverMediaBackground.halt()` (`:78-102`) clears `src` on every tile change. Returning to a tile depends on the browser's partial-content HTTP cache. This is acceptable, but it means the media element is not reused.

### 7.2 Audio
- iTunes previews are streamed from `audio-ssl.itunes.apple.com` with `crossOrigin='anonymous'` (`GlobalAudioPlayer.tsx:54`, `:211`). CORS mode is not needed for `<audio>` playback and makes playback depend on the CDN's CORS headers. *(Low, Unverified risk)*
- **`public/audio/intro/` (17 files, 7.5 MB) is not referenced anywhere** but is deployed.
- Preloading 20 full previews on entry is too aggressive (C2). `preload='metadata'` for neighbours plus full preload for 2–3 likely tracks would cover the same user experience.

### 7.3 Images
| Asset | Actual | Displayed | Verdict |
|---|---|---|---|
| `kadence-horizontal-logo.png` | 2172×724, 783 KB, preloaded | 44–52 px tall | ~40× oversized; use SVG or ~20 KB WebP |
| `kadence-chrome-logo.png` | 1110×342, 230 KB, preloaded | ~340 px tall at 1080p | Roughly right size; convert to WebP/AVIF (~60–80 KB) |
| `images/vibes/*.webp` ×14 | 1024×1024, 61–85 KB | ~160–190 CSS px | Resize to 384–400 px (~15–25 KB each) |
| Wall artwork (mzstatic) | 256×256 via URL rewrite (`atlasManager.ts:13-19`) | ~57 px tiles | Fine, but downloaded **twice** (C3) |
| `CinematicBackground` | 600×600 upscaled to the viewport under `blur(9px)` | full screen | Fine visually; the blur is the cost |
| Song Detail hero | 600×600 | ~320 px | Fine |

`next.config.ts` configures `images.remotePatterns` for Spotify hosts and AVIF/WebP formats, but **`next/image` is never used** (8 `no-img-element` lint warnings). The configuration does nothing.

### 7.4 Fonts
- One render-blocking cross-origin stylesheet (`layout.tsx:25-28`) with 7 families. The CSS served by Google contains **91 `@font-face` rules**.
- Used: `Inter` (3 files), `Syne` (4), `Syncopate` (3), `Space Grotesk` (3), `Prompt` (1 file, as a fallback stack in Song Detail).
- **Unused: `Google Sans Flex` (variable 100–900), `Anton`.**
- `Prompt` is requested in 7 weights for one heading.

### 7.5 Repository and deploy weight
- `public/videos` is 310 MB and committed to Git: 1.14 GB of loose objects locally. Every clone and deploy carries it. Use a media CDN or object storage, or Git LFS at minimum.
- Dead weight: `public/audio/intro` (7.5 MB), `Gala Gala_30s.mp4` (14.4 MB), `Gemini Intro Video Assets/` (duplicate of the tile art), `song_detail_diff.txt`, `kadence_audit.js`.

---

## 8. React and Rendering Architecture Analysis

### 8.1 Component and state topology

```
RootLayout (server)
└── Home  ('use client', subscribes to ALL of audioStore + uiStore + performanceStore)
    ├── GlobalAudioPlayer        (ALL of audioStore + hoveredSong)  → 8 Hz renders
    ├── HeroBackgroundVideo
    ├── HoverMediaBackground     (uiStore.hoveredVibe — active in every view)
    ├── PreviewVideoLayer        (no-op; effectively dead)
    ├── motion.div [filter blur] ── Universe (not memo) ── R3F Canvas (frameloop always)
    │                                   ├── NodeField (not memo; second artwork loader)
    │                                   └── CameraController
    ├── CinematicBackground
    ├── IntroScreen (not memo) ── 14× HomepageVibeCard (memo), MagneticChromeText (window mousemove)
    ├── Navbar (4× GlassButton)
    ├── SearchPanel (1–11× GlassButton)
    ├── SongDetail (ALL of audioStore; always mounted; ~14× GlassButton; SVG filter)
    ├── ChangeVibeOverlay (useChartHover → triggers HoverMediaBackground)
    └── HoverTooltip (memo, selectors — the one correctly isolated subscriber)
```

### 8.2 Store design
- **Zustand is a good choice. The way it is used defeats its main benefit.** Three components use whole-store destructuring (`page.tsx:117-119`, `SongDetail.tsx:407`, `GlobalAudioPlayer.tsx:13-21`).
- **High-frequency values live in global, render-triggering state:** `progress` (8 Hz), `hoveredSong` (per tile crossing), `hoveredVibe` (per card). These should be transient: refs, `subscribe()` listeners or a dedicated store read only by leaf components.
- **Dead state:** `performanceStore` (`onFps` is passed but `Universe` never calls it), `uiStore.searchQuery/isDetailOpen/viewMode`, `songStore.isLoading` and `updateNodePosition`, and the whole of `chartPreviewStore`.
- `songStore.songs` is replaced wholesale on search merges. Every replacement costs O(n) in `NodeField` and resets the loaders (H9).

### 8.3 React-Three-Fiber usage
**Good:** a single `InstancedMesh` (one draw call for ~1,134 instances at 16:9), a custom shader with uniforms written only when changed, pre-allocated scratch objects, ref-based per-frame state, O(1) maps, `antialias: false`, `dpr` capped at 1.5.

**Problems:**
- Frame loop always on (C4).
- Geometry rebuilt and mesh reconstructed whenever `songs.length` changes. The old geometry is not disposed, and the material is never disposed on unmount.
- Per-frame JS in one `useFrame` mixes loading, input, physics, hover detection and uniform updates. That is fine at this scale, but it should be split into explicit ordered systems.
- React state is written from inside `useFrame` (`onHover` → store), which bridges the render loop to React synchronously (C1). R3F guidance is to keep React out of the frame loop.
- ESLint `react-hooks/immutability` errors in `NodeField` (`:459`, `:542`, `:549`, `:555`, `:750`) mark patterns that the React Compiler would reject. They are not bugs today, but they block future compiler-based optimisation.

### 8.4 Animation stack
- framer-motion is used in 11 files, including for one-shot fades that plain CSS could handle. Every `motion.*` component re-diffs its `animate` props on each of the 8 Hz renders.
- CSS transitions and framer animations target the same element (SongDetail drawer), which is a confirmed conflict.
- Many animations target paint-bound properties: `box-shadow` (intro cards, loader ring), `filter: blur` (canvas wrapper, Song Detail image), `width` (progress bar).
- The codebase has 93 inline `style={{…}}` literals. Those inside the 8 Hz components (`Home`, `SongDetail`, `GlassButton`, `Navbar`) are recreated and diffed on every render.

### 8.5 Hydration and SSR
- The route is prerendered to static HTML (`.next/server/app/index.html`, 58 KB), then the whole page hydrates as one client component. With 1.2 MB of raw JS to parse and execute, Time-to-Interactive on mid-range mobile is likely to be several seconds *(Unverified)*. The intro UI could be mostly server components, with only the interactive cards as client islands.
- `suppressHydrationWarning` on both `<html>` and `<body>` hides real mismatches. Remove it unless an extension conflict has been proven.

---

## 9. Network and Backend Analysis

### 9.1 Request map for one typical session

| Phase | Requests (approximate) |
|---|---|
| First paint | HTML, 8 JS chunks (334 KB gz), CSS, Google Fonts CSS + ~15 woff2 files (estimate), 2 logo PNG preloads (1 MB), 14 tile WebPs (1 MB) |
| After hydration | Universe chunk (143 KB gz), `globe.mp4` (11.8 MB, progressive) |
| Each homepage hover (>150 ms) | `/api/songs?vibe=…` (cold: 8 upstream iTunes calls), 12 artwork prefetches, preview MP4 (0.7–3.5 MB), full MP4 (6.8–30.6 MB) |
| Vibe click → loading | First audio preview (~1 MB), 32 + 6 artwork requests, 4 concurrent audio preloads |
| Universe idle | 20 audio preloads (~20 MB), 224 + 256 artwork requests (duplicate pipeline) |
| Per tile crossed | A new full audio download if not pooled |
| Per search | `/api/search` (1 upstream call), then a full re-download of 256 artworks (H9) |

### 9.2 `/api/songs` design issues
1. **`fetch(..., { cache: 'no-store' })`** (`musicProvider.ts:522`, `:542`) opts out of the Next.js Data Cache, the one cache layer that would persist across serverless instances. Switching to `next: { revalidate: 1200 }` gives durable, shared caching with no extra infrastructure.
2. **The only cache is a module-level `Map`** (`app/api/songs/route.ts:6`). On Vercel it is per instance and lost on cold start, so production cache-hit rates will be much lower than in local dev.
3. **No HTTP caching on responses.** Adding `Cache-Control: public, s-maxage=1200, stale-while-revalidate=86400` would let the CDN answer almost all chart requests.
4. **Upstream fan-out:** 8 × `limit=200` (about 1,600 raw tracks, likely several MB of JSON per cold chart, *Unverified*), plus 7 fallback queries for regional charts whose curated datasets are empty. Apple's Search API is rate-limited (on the order of ~20 calls per minute per source IP per Apple's guidance, *Unverified for current limits*). One cold chart uses 8–19 of those calls, and serverless egress IPs are shared. Under concurrent users this will produce upstream failures, which the route turns into HTTP 500 (`route.ts:53-55`).
5. **Over-fetch to the client:** all accepted tracks are returned, but at most 256 are displayed (`TEXTURE_DEPTH`). Fields such as `x/y/z/vx/vy/scale` are generated with `Math.random()` (`musicProvider.ts:345-351`) and are unused by the wall. `color` is also random when no genre matches (`:315-316`), so responses are non-deterministic and cannot be cached by content.
6. **Production logging in the hot path:** `console.log` per rejected regional track and `[DIAG:route]` logs on every request. This adds CPU and log-ingestion cost.
7. **`targetCount` is ignored** (`fetchSongsByVibe(vibe, 256, offset)`; the parameter is never read).

**Recommended architecture:** Build chart datasets **offline** (cron or build step: Vercel Cron, GitHub Action or ISR). Store them as static JSON on the CDN with content-hashed URLs, trimmed to exactly what the wall needs (≤256 tracks; id, name, artist, album, art, preview, url, genre). The client then loads charts as static files. `/api/search` stays dynamic, but with `revalidate`, per-IP rate limiting and an `AbortSignal` timeout.

### 9.3 Client data layer
`vibeService` is well designed for its scope (in-flight dedupe, 30-minute TTL, prefetch on hover). Its gaps: no persistence across reloads (no `sessionStorage` or HTTP cache, because the API sends no cache headers), no abort, and errors collapse to `[]` with no retry.

---

## 10. Complete Prioritised Remediation Roadmap

Effort estimates assume one engineer who knows the codebase. Phase 0 items carry little risk and do not change the visual design.

### Phase 0 — Quick wins (≈ 1–3 days)

| # | Action | Fixes | Files |
|---|---|---|---|
| 0.1 | Replace whole-store subscriptions with selectors; read actions through `getState()` | C1 | `page.tsx:117-119`, `SongDetail.tsx:407`, `GlobalAudioPlayer.tsx:13-21` |
| 0.2 | Move playback progress out of React state for everything except a leaf progress component (or update it through refs/rAF) | C1, §4.4 | `audioStore.ts`, `GlobalAudioPlayer.tsx`, `SongDetail.tsx` |
| 0.3 | Move the hover → audio bridge out of `Home` into a store `subscribe()` with a 120–200 ms dwell | C1, C2 | `page.tsx:292-304` |
| 0.4 | LRU-cap the audio pool (8–12), route every load through the queue, `preload='metadata'` for non-imminent tracks, drop `crossOrigin` | C2 | `GlobalAudioPlayer.tsx` |
| 0.5 | Delete the duplicate artwork loader and its flush logic in `NodeField` | C3 (≈50% of it) | `NodeField.tsx:300-356`, `:543-553` |
| 0.6 | Pause the WebGL loop while Song Detail or Switch Chart is open; replace the animated `filter: blur` on the canvas wrapper with opacity | C4 | `Universe.tsx:36`, `page.tsx:336-343` |
| 0.7 | Remove `transition-all duration-700` from the Song Detail drawer | H5 | `SongDetail.tsx:489-493` |
| 0.8 | Move `GlassButton` CSS into `globals.css`; rAF-throttle its `mousemove` | H6 | `GlassButton.tsx` |
| 0.9 | Pause the globe while a hover video is visible; `preload="metadata"` plus a poster | H1 | `HeroBackgroundVideo.tsx` |
| 0.10 | Start hover videos muted and reveal them only after `play()` resolves; unmute after the first gesture | H3 | `HoverMediaBackground.tsx` |
| 0.11 | Stop `HoverMediaBackground` from reacting outside the intro (gate on `!introComplete`, or give `ChangeVibeOverlay` its own hover state) | §4.6 | `HoverMediaBackground.tsx`, `ChangeVibeOverlay.tsx` |
| 0.12 | Fonts through `next/font`; drop the unused families and weights | H7 | `layout.tsx` |
| 0.13 | Replace the logo PNGs (SVG/WebP), resize tile art to 384² | H7 | `public/` |
| 0.14 | Delete `/api/proxy` and the other dead code and assets (WallGrid, chartPreviewStore, `/api/chart-preview`, `/api/songs/top`, performanceStore, PreviewVideoLayer, MagneticGlassCard, `public/audio/intro`, Gala Gala video, unused deps `lenis`, `@react-three/drei`) | Security, maintainability | various |
| 0.15 | `fetch` with `next: { revalidate }` and add `Cache-Control: s-maxage, stale-while-revalidate` to `/api/songs` and `/api/search`; strip production `console.log`s | H8 | `musicProvider.ts`, `app/api/*` |

### Phase 1 — Structural fixes (≈ 1–2 weeks)

| # | Action | Fixes |
|---|---|---|
| 1.1 | Per-slot atlas uploads: `createImageBitmap` (resize on decode) plus `copyTextureToTexture`/`texSubImage2D`; no full re-upload; append-only slots on search merge | C3, H9 |
| 1.2 | `frameloop="demand"` with explicit `invalidate()` from input, jelly activity and camera motion; adaptive DPR/quality tier from measured frame time | C4 |
| 1.3 | Take three.js out of the initial bundle (three-free URL util, lazy `atlasManager`); mount `Universe` only after vibe selection and prefetch the chunk on hover | H7 |
| 1.4 | Re-encode all hover media: 720p (plus 1080p only if needed), CRF-targeted 1.5–2.5 Mbps, a forced keyframe at 3.0 s or a single-file design with no handoff, separate or muted audio tracks, posters, content-hashed filenames | H1, H2 |
| 1.5 | Rework the handoff to be position-triggered (`requestVideoFrameCallback`/`timeupdate`) with one audio source | H2 |
| 1.6 | Replace the Song Detail SVG filter with a static texture or simple backdrop blur; make the scrubber ref-driven (no `getBoundingClientRect` per tick, transform-based progress) | H5 |
| 1.7 | Intro cards: bake the glass and specular layers into the art, remove per-card backdrop-filter and blend layers, use opacity-animated glow images instead of `box-shadow` transitions | H4 |
| 1.8 | Search: `AbortController`, debounce, show results in the panel without rebuilding the wall (or append-only) | H9 |
| 1.9 | Offline chart generation to static, trimmed, hashed JSON; populate the regional datasets; deterministic payloads | H8 |

### Phase 2 — Production engineering (≈ 2–4 weeks, ongoing)

| # | Action |
|---|---|
| 2.1 | Break `Home` into feature modules (IntroView, UniverseView, DetailView, SearchView) with view-local state. Use server components for static intro chrome |
| 2.2 | A single **MediaScheduler** service that owns every audio, video and artwork request, with priorities (current > hovered > neighbours > background), a global concurrency budget and cancellation |
| 2.3 | Move hover videos to a media CDN with adaptive streaming (HLS/DASH, AV1/HEVC/H.264 ladders), or cut hover video on mobile and `saveData` connections |
| 2.4 | Performance budgets enforced in CI: bundle size (e.g. `@next/bundle-analyzer` + size-limit), Lighthouse CI, media size checks |
| 2.5 | Real-user monitoring: `web-vitals` (LCP, INP, CLS), long-task and frame-time sampling, error reporting (e.g. Sentry) |
| 2.6 | Fix all 36 lint errors; enable the React Compiler once the `react-hooks/immutability` violations are resolved |
| 2.7 | Tests: unit tests for `GlobalAudioPlayer` pool and queue invariants, `vibeService` caching and `atlasManager` slot logic; a Playwright smoke test with a fresh profile to catch autoplay regressions |
| 2.8 | Move media out of Git (object storage or LFS); remove the 1.14 GB of loose objects from the deploy path |

---

## 11. Expected Benefits of Each Recommended Fix

Magnitudes are engineering estimates derived from the mechanisms above. Validate each with a before/after Chrome Performance trace on a mid-range laptop (integrated GPU) and a mid-range Android phone.

| Fix | Primary metric | Expected effect | Confidence |
|---|---|---|---|
| 0.1–0.3 Selector discipline, progress and hover off the root | Main-thread time, INP | Removes ~8 full-tree renders/s plus one per tile crossed. Likely the single largest responsiveness gain across all post-intro views | High |
| 0.4 Audio pool cap and dwell | Bandwidth, memory, artwork fill time | Memory bounded instead of growing with hovers; network freed for artwork; no preload-queue deadlock | High |
| 0.5 + 1.1 Single artwork pipeline, per-slot uploads | Frame drops after entry, chart switch, search | Texture upload volume from ~1.6–2.6 GB to ~16 MB per chart; half the image requests and decodes; removes the post-transition hitching | High (count), Medium (ms saved) |
| 0.6 + 1.2 Gated/demand frame loop, no canvas blur | GPU time, battery | GPU work drops to near zero while Song Detail or overlays are open; idle wall stops burning frames | High |
| 0.7 Drawer transition conflict | Perceived animation quality | Drawer follows the spring directly; the 700 ms rubber-band lag disappears | High |
| 0.8 GlassButton CSS hoisting and throttling | Style recalc, layout | Opening Song Detail or Search no longer forces ~15–19 document-wide style recalcs; fewer forced layouts | High |
| 0.9 + 1.4 + 1.5 Media pipeline | Bandwidth, decode, handoff smoothness | 3–5× less video data per hover; one fewer concurrent decode; seamless handoff | High |
| 0.10 Muted-first autoplay | Reliability | Hover video works for first-time visitors | Medium-High |
| 0.11 Hover-video gating | Switch Chart responsiveness | No unexpected 1080p decode or overlapping audio inside the Universe | High |
| 0.12–0.13 + 1.3 Fonts, images, bundle | FCP, LCP, TTI | ~30–40% less JS on the critical path; no render-blocking cross-origin CSS; ~1.5 MB fewer image bytes; ~13 MB less on a cold visit if the globe stops preloading | High |
| 1.6 Song Detail filter and scrubber | Paint/raster time while the panel is open | Removes CPU filter rasterisation and 8 Hz forced layout | Medium |
| 1.7 Intro card compositing | Homepage frame time, scroll smoothness | Large reduction in compositor passes over video | Medium |
| 0.15 + 1.9 Backend caching and static charts | TTFB, reliability, cost | Chart loads become CDN hits (tens of ms) instead of 8–19 upstream calls; no rate-limit 500s | High |
| 2.x Architecture, observability, tests | Regression prevention | Makes performance measurable and keeps the gains | High |

---

## 12. Final Engineering Verdict

### Production-quality scorecard

| Area | Score | Rationale |
|---|---|---|
| **Frontend architecture** | **3 / 10** | One client component owns all views and high-frequency state. Duplicated subsystems (two artwork loaders, per-instance CSS). Media systems react to global state in views where they should be inactive. Dead code throughout. Good local patterns (refs, instancing, session counters) cannot make up for this topology. |
| **Rendering performance** | **3 / 10** | Unconditional 60 fps WebGL, full-screen CSS blur over a live canvas, many backdrop-filters and blend layers over video or WebGL, SVG CPU filters, paint-bound animations. The shader and instancing themselves are efficient. |
| **Runtime responsiveness** | **3 / 10** | 8 Hz full-tree re-renders while audio plays; synchronous full-tree renders on every tile crossing; forced layouts in mousemove and progress paths; texture-upload stalls on entry and on every data change. |
| **Media delivery and playback** | **3 / 10** | Faststart files and the stale-callback guard are good. But bitrates and resolutions are far beyond need, there is a single rendition, keyframes are misaligned with the handoff, playback is unmuted autoplay on hover, the globe never pauses, audio elements are never evicted, and ~298 MB is needed to explore the homepage once. |
| **State management** | **4 / 10** | Zustand is appropriate and some components use selectors well (`HoverTooltip`). Whole-store subscriptions at the root, per-frame/per-hover values in render state, and several dead stores and fields undo that. |
| **Asset optimisation** | **3 / 10** | 783 KB logo shown at 44 px, 1024² tiles shown at ~170 px, 7 render-blocking font families (2 unused), 22 MB of unused media deployed, `next/image` configured but unused. Artwork URL resizing to 256² is a good touch. |
| **Network efficiency** | **3 / 10** | No global request scheduler, duplicate artwork downloads, aggressive full-file audio preloading, no API caching headers, `no-store` upstream fetches, over-fetched payloads. Client-side in-flight dedupe and hover prefetch are good. |
| **Scalability** | **2 / 10** | Live dependency on a rate-limited third-party search API, cache lost on serverless cold starts, CDN bandwidth per user dominated by hundreds of MB of video, open proxy endpoint. This will not hold up under real traffic. |
| **Maintainability** | **4 / 10** | TypeScript strict passes and the code is readable and heavily commented. But there are 36 ESLint errors, 20 `any`, 44 unused variables, comments that contradict the code ("first 64 critical tiles" vs `CRITICAL_TILES = 32`; "48×48" vs the class doc "64×64"), dead files, and 1.14 GB of media in Git. |
| **Reliability** | **4 / 10** | Errors are swallowed to keep the UI moving (good for demos, bad for diagnosis). Autoplay-policy failure on hover, CORS-mode audio dependency, upstream failures surfacing as HTTP 500s, immutable caching on unhashed media names, no telemetry, no tests. |
| **Overall production readiness** | **3 / 10** | A visually compelling, well-intentioned prototype whose performance problems are systemic but tractable. |

### Verdict

KADENCE's sluggishness has nothing to do with React, Next.js, Three.js or the visual design being inherently too heavy. It comes from **a few specific architectural decisions that multiply each other's cost**. High-frequency state flows through the root of a single-component application. Several independent media systems compete for the same network, decoder and GPU with no coordination. A 64 MB texture is re-uploaded wholesale dozens of times. And expensive compositor effects sit permanently over pixels that change every frame.

The previous optimisation commits in the history (zero-delay hover, race-condition fixes, reduced image concurrency) were aimed at *latency of individual interactions*. They did not touch these system-level throughput problems, and in places made them worse. For example, removing the hover dwell increased media churn.

The recommended order is:
1. **Phase 0.1–0.6** (selectors, progress/hover out of the root, audio pool, single artwork loader, gated frame loop). This should change the *feel* of the whole app within a few days.
2. **Phase 0.7–0.15**, the remaining quick wins, to fix initial load and visible animation defects.
3. **Phase 1**, to make the media and data paths production-grade.
4. **Phase 2**, to keep it that way through observability, budgets and tests.

Before any of this, record a baseline: one Chrome Performance trace each for (a) homepage hover across five tiles, (b) entering a chart, (c) one minute of wall interaction with audio, and (d) opening and closing Song Detail, on a mid-range integrated-GPU laptop with 4× CPU throttling. Every finding marked *Probable* or *Unverified* above can be settled with those four traces.

---

### Appendix A — Items requiring browser profiling to quantify

| Item | What to measure |
|---|---|
| Per-render cost of the 8 Hz `Home` re-render (C1) | React Profiler commit durations; main-thread time per second |
| Atlas upload stall duration (C3) | Performance panel GPU track; `texImage2D` duration; whether the 2D canvas is GPU-accelerated |
| Backdrop-filter, blend-mode and SVG filter cost (C4, H4, H5, H6) | Rendering → Paint flashing / Layer borders; GPU raster time; frame time with each effect toggled |
| Concurrent video decode impact (H1) | `chrome://media-internals`; dropped frames with globe + preview + full |
| Autoplay rejection (H3) | Fresh browser profile, hover before any click |
| Audio pool growth and preload deadlock (C2) | Memory panel; count of `HTMLAudioElement`s after a 10 s wall sweep; Network panel |
| iTunes latency and rate limits (H8) | Production function logs; p50/p95 duration of cold `/api/songs` |
| Fragment shader cost at DPR 1.5 (M6) | GPU frame time on integrated GPUs with DPR 1 vs 1.5 |

### Appendix B — Medium and Low findings not detailed above

| ID | Severity | Finding | Location |
|---|---|---|---|
| M1 | Medium | Loader ring animates six `box-shadow`s per frame during the busiest main-thread phase | `GlowingRingLoader.tsx:104-165` |
| M2 | Medium | Full-screen `blur(9px)` cinematic background inside a scale animation; double layers when switching songs | `CinematicBackground.tsx:14-53` |
| M3 | Medium | `MagneticChromeText` reads `getBoundingClientRect` on every window `mousemove` | `IntroScreen.tsx:506-531` |
| M4 | Medium | Production `console.log` in API hot paths | `musicProvider.ts:185-305`, `api/songs/route.ts:25-58` |
| M5 | Medium | Non-deterministic payloads (`Math.random` positions/colours), unused fields, empty regional datasets causing extra upstream calls | `musicProvider.ts:315-351`, `lib/*ChartData.ts` |
| M6 | Medium | Full-screen fragment shader with two `pow()` gamma conversions and `discard` at DPR up to 1.5 | `NodeField.tsx:154-227`, `Universe.tsx:45` |
| M7 | Medium | Dead code and assets shipped or deployed (see Phase 0.14) | various |
| M8 | Medium | `immutable` one-year caching on unhashed video filenames; no cache policy for images or API | `next.config.ts:16-28` |
| L1 | Low | Jelly simulation 2,304 cells per frame plus a full activity scan | `jellyField.ts:162-289` |
| L2 | Low | Per-frame 256-entry loader scan that never stops | `NodeField.tsx:341-356` |
| L3 | Low (correctness) | Selected-tile highlight uses the song index against the instance index | `NodeField.tsx:84`, `:786-792` |
| L4 | Low | `crossOrigin='anonymous'` on `<audio>` adds an unnecessary CORS dependency | `GlobalAudioPlayer.tsx:54`, `:211` |
| L5 | Low | `react-hooks/immutability` lint errors; `processQueue` used before it is declared | `NodeField.tsx`, `GlobalAudioPlayer.tsx:61` |
| L6 | Low | Geometry and material not disposed on rebuild or unmount | `NodeField.tsx:420-454` |
| L7 | Low | `suppressHydrationWarning` on `<html>` and `<body>` hides real hydration mismatches | `app/layout.tsx:21`, `:30` |

---
*Audit performed read-only. The only file added to the repository is this report.*
