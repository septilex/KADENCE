# KADENCE — Master Engineering & Performance Audit

| | |
|---|---|
| **Audit date** | 2026-11-10 |
| **Repository** | `https://github.com/septilex/KADENCE.git` |
| **Commit audited** | `e5ab927f9aeae7525188e766be54efe1204841d6` (`main`, 2026-10-16, "perf(media): zero-delay hover playback - remove 800ms artificial dwell timer") |
| **Type** | Read-only inspection and reporting. No application source, configuration, dependency or asset was modified. |
| **Method** | Full source reading of every application file, configuration and script; import-graph tracing; byte-level MP4 structure probing of every video (custom read-only parser, `ffprobe` was not available); image header inspection; `tsc --noEmit --incremental false`; `eslint` (no `--fix`, no cache); `npm audit` (read-only); cross-check against the earlier audit on the `origin/docs/perf-recovery-plan` branch. **No browser, profiler or production build was used.** |

### How to read confidence labels

| Label | Meaning |
|---|---|
| **Confirmed by code** | The behaviour is deterministic and follows directly from the cited source, configuration or measured file structure. |
| **Strongly indicated** | The mechanism is visible in code, but the outcome depends on documented browser or platform behaviour, or on a geometric derivation, that I have not observed at runtime. |
| **Hypothesis** | Plausible from the code, but only runtime measurement can establish it or its size. |

No FPS, CPU time, GPU time, latency or user-perceived delay figure in this document is a measurement. Numbers come from file sizes, file structure, source constants, or arithmetic on those constants, and are labelled as such.

---

## Table of contents

1. Executive summary
2. Repository and version verification
3. Technology stack and dependency overview
4. Complete architecture map
5. Application execution and interaction flows
6. Intro hover-preview deep investigation (Priority A)
7. Music-track hover deep investigation (Priority B)
8. React and state-management findings
9. WebGL and GPU findings
10. Audio-system findings
11. Video and media pipeline findings
12. Bundle and asset findings
13. Backend and API findings
14. UI/UX and accessibility findings
15. Security and reliability findings
16. Consolidated findings register
17. Critical root causes
18. Existing architecture assessment
19. Recommended architecture improvements
20. Prioritised remediation roadmap (P0–P3)
21. Dependencies and safe implementation order
22. Runtime tests and measurements still required
23. Acceptance criteria for future fixes
24. Repository inspection coverage register
25. Final engineering recommendation

---

## 1. Executive summary

KADENCE is a **single-route, fully client-rendered** Next.js 16 / React 19 application (`app/page.tsx` is `'use client'`). Every "screen" — Intro, Loading, the WebGL album wall ("Universe"), Song Detail, Search and Switch Chart — is a state of one React tree owned by one component, `Home`. Three global media systems (hover video, hero globe video, preview audio), one WebGL canvas and one artwork pipeline are mounted for the whole session. That shared topology is why the sluggishness feels app-wide.

### The two priority problems

**A. Intro card hover preview — severity: HIGH.** The delay has **no remaining artificial timer**; it comes from the media pipeline and the compositor:

1. **Every first hover on a card is a cold start** (`HoverMediaBackground.tsx:185-227`). Previews use `preload="none"`, nothing pre-warms them, and there is no poster. The user sees the screen dim, then waits for network, container demux, H.264 decoder start-up, `canplay`, and a 150 ms fade before any picture. Moving to another card first **tears down both players** (`halt()`, `:78-102`), so every card change shows a dim gap. *(Confirmed by code.)*
2. **Hover playback is unmuted** (`:288`, `:303`). Browsers reject unmuted `play()` until the user has clicked or tapped the site, and hovering is not such a gesture. The rejection is swallowed (`:213-215`) *after* the video has already been made visible (`:203`). First-time visitors, whose first action is usually to hover the cards, are therefore likely to see a **frozen first frame**, and the full video never loads. *(Code confirmed; browser outcome strongly indicated.)*
3. **The preview → full-video handoff is not timed to the playhead** (`:120-158`). The full file is seeked to 3.0 s, but **8 of the 15 full videos have their last keyframe before 3.0 s at 0.0 s** (measured). That forces ~72 frames of 1080p–1440p decode in a burst. The switch also fires whenever buffering completes, so the picture and music **jump**, and **both unmuted tracks play over each other for ~200 ms**. *(Confirmed by code and file structure.)*
4. **The full 6.8–30.6 MB file starts downloading the moment the preview starts playing** (`:209-212`). It competes with the preview's own remaining bytes, the `/api/songs` prefetch, 12 artwork prefetches and the 11.8 MB globe video. **The globe keeps decoding under the hover video** with a full-screen CSS filter (`HeroBackgroundVideo.tsx:45-61`). *(Confirmed mechanism; size of impact needs measurement.)*
5. Hover CSS adds per-frame paint work: `will-change` is toggled on at hover start, `box-shadow` (50 px blur) is transitioned, a `filter` is transitioned over a subtree containing `backdrop-filter` and `mix-blend-mode` layers, and the gloss gradient follows `--mx/--my`. Each hover also re-renders the whole React tree because `Home` subscribes to the entire UI store (`page.tsx:117`). *(Mechanism confirmed; cost needs measurement.)*

**B. Music-track hover (WebGL wall) — severity: CRITICAL.** There is no DOM track list; tracks are instanced WebGL tiles. List virtualisation is irrelevant here. The lag is a **combination** of five things:

1. **No immediate visual response on the hovered tile.** The shader uniform `uHoverIdx` is written every frame but **never read** by either shader (`NodeField.tsx:51`, `:167`, `:784`). The first tile-level feedback is the "pop" after a **1.0 s dwell** (`:754-759`) that then eases in over ~0.5 s. *(Confirmed.)*
2. **Hit-testing picks the wrong tile away from screen centre.** Hover is computed on the `z = 0` plane, but the lens lifts tiles under the cursor by 5.3 world units toward a camera at z = 30 (`:111-118`, `gridCalc.ts:31`). Working from the shader constants, the track the code treats as hovered is **≈0.5 tile off at 16 % of the half-width, ≈1 tile at 33 %, ≈1.7 tiles at 65 %, and ≈2 tiles at the edge**. The tooltip, the audio and the pop therefore belong to a neighbouring tile. *(Strongly indicated by the geometric derivation; one runtime check confirms it.)*
3. **Each tile change triggers at least three full React-tree renders**, two of them synchronously inside the WebGL animation frame. The chain is `onHover` from `useFrame` → root `targetAudioUrl` selector → `playUrl` → whole-store subscribers → `setPlayingState`. On top of that, **while any audio plays the entire tree re-renders 8×/s** from the 125 ms progress timer (`page.tsx:117-119`, `:292-304`; `GlobalAudioPlayer.tsx:13-21`, `:124-132`; `SongDetail.tsx:407`). *(Confirmed.)*
4. **Hover audio has no dwell and no bound.** Each new tile allocates a new `Audio()` element and starts a full download outside the concurrency limiter. The previous track is hard-cut, and the pool is never evicted within a chart (`GlobalAudioPlayer.tsx:85`, `:109-120`, `:202-234`). Only 20 of the ≤256 visible tracks are preloaded. *(Confirmed.)*
5. **Hover input is global.** Listeners sit on `window` (`NodeField.tsx:524-527`), so hover keeps running underneath UI and while Song Detail is open. Because the hovered track takes precedence over the selected one (`page.tsx:292-297`), **moving the mouse over the Song Detail panel switches the playing audio to an invisible tile**. The tooltip's "Open in iTunes" link also cannot be reached for the intended song. *(Confirmed.)*

Around these sit frame-time spikes from **64 MiB full-atlas texture re-uploads** issued by two independent artwork loaders (`NodeField.tsx:341-356`, `:543-553`; `atlasManager.ts`). They repeat on every chart switch, refresh and search.

### Biggest architectural weaknesses

1. A **monolithic client root** carrying high-frequency state (progress, hover) through **whole-store Zustand subscriptions**.
2. **No single owner of media and network priority.** Audio, the two video systems, two artwork loaders and the data service each schedule their own work.
3. **Rendering never gated by visibility.** WebGL renders at 60 fps under an invisible canvas and under full-screen blurs; the globe decodes under the hover video; the hover-video engine is active in the Universe.
4. **Compositor-hostile effects over constantly changing pixels**: `backdrop-filter`, blend modes, an SVG turbulence filter and animated `box-shadow` over video and WebGL.
5. **A rate-limited third-party search API used as a live database**, with per-instance in-memory caching and no HTTP caching.
6. **An open server-side proxy** (`/api/proxy`) that the app does not even use.
7. No error boundaries, no WebGL fallback, no accessibility layer (zero ARIA, no keyboard path to tracks, no reduced-motion handling), and no tests.

### Recommendation

**Option B — significant refactoring of selected subsystems.** Inside it, two subsystems need redesign-level work: **media orchestration** (audio + video) and the **chart-data pipeline**. A full rebuild (D) is not justified. The visual design is achievable as built, the WebGL core is efficient at the micro level (one instanced draw call, ref-based frame state, pre-allocated scratch objects), and almost every defect is system-level coupling that can be fixed in small, independently verifiable steps without changing the look.

### Recommended order of remediation (detail in §20–21)

0. Capture a runtime baseline (§22).
1. **P0 — safety and highest leverage, mostly small:** remove `/api/proxy`; selector-only subscriptions; move playback progress out of React; move the hover→audio bridge out of `Home` with a short dwell and UI/detail gating; clear hover media on selection; muted-first hover video; pause WebGL while hidden; single artwork loader.
2. **P1 — the two hover experiences and the media/data paths:** instant tile highlight; lens-aware hit-testing; canvas-scoped input and a touch fix; bounded audio pool; per-slot atlas uploads; posters plus small previews plus deferred full video; playhead-aligned handoff with a single audio source; backend caching; three.js out of the initial bundle.
3. **P2 — quality:** Song Detail and GlassButton fixes, intro compositing, fonts and images, error boundaries and WebGL fallback, an accessibility baseline, the Next.js security upgrade, security headers, static chart data.
4. **P3 — polish:** dead-code and asset removal, media out of Git, tests and CI budgets, observability.

---

## 2. Repository and version verification

| Check | Result |
|---|---|
| Clone completed | Yes. The first two attempts failed (`curl 56 … Connection was reset`, `fatal: early EOF`). The third, over HTTP/1.1, completed. This happened before the audit task began. |
| Valid repository | `git rev-parse --is-inside-work-tree` → `true`; `--is-shallow-repository` → `false`; one pack of 715 objects, **1.16 GiB**. |
| Root / remote | `C:/AntiGravity Projects/KADENCE`; `origin https://github.com/septilex/KADENCE.git` (fetch/push) |
| Branch / HEAD | `main` at `e5ab927`, up to date with `origin/main` |
| Other branches | `origin/docs/perf-recovery-plan` (`df1ebd6`, 2026-11-05): adds `KADENCE_MASTER_PERFORMANCE_AUDIT.md`, `KADENCE_PERFORMANCE_RECOVERY_ROADMAP.md` and `docs/perf-baseline/*` (9 files, docs only). **Not merged into `main`.** |
| Checkout completeness | 156 tracked files present, including all 33 source modules, 5 API routes, 33 videos, 17 audio files, configs and scripts. Nothing missing. |
| Initial `git status` | `nothing to commit, working tree clean`; ignored: `.next/`, `next-env.d.ts`, `node_modules/` |
| Pre-audit actions (outside this audit, at the owner's request) | `npm ci` (lockfile-exact install; changed no tracked file) and `npm run dev` (Next 16.2.6 Turbopack, ready on `http://localhost:3000`, which generated the ignored `.next/` and `next-env.d.ts`). The dev server was **not touched during the audit**. It later stopped when the previous Claude Code session ended; it was not restarted, in line with the audit rules. |
| Final `git status` | See §24. Only the new untracked `docs/` folder holding this report. |

**Earlier KADENCE documents.** A workspace search of `C:\AntiGravity Projects` (excluding `node_modules`, `.next` and `.git`) found no KADENCE audit, roadmap or profiling documents outside the repository. The audit-named files found belong to the unrelated `CardioVanta` project. The only prior KADENCE material is the unmerged docs branch. I read its master audit in full and the roadmap's §1–4 and headings, and cross-checked them against current source; §24 lists exactly what was read. I independently confirmed nearly all of its code-level claims. I add findings it does not contain (TRK-01, TRK-02, TRK-06, TRK-07, TRK-10, INT-06 details, INT-10, AUD-02, GL-04 disposal detail, API caching semantics in Next 16, and others) and correct two points:

- **Next 16 caching semantics.** The earlier audit implies that dropping `cache: 'no-store'` restores a data cache. In Next 16, `fetch` and GET Route Handlers are **not cached by default**, so caching must be opted into explicitly (`node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md:63`, `15-route-handlers.md:51`, `:89-144`). See API-01.
- **R3F disposal on mesh re-key.** R3F v9 calls only `object.dispose()` on the unmounted `InstancedMesh` (`events-*.esm.js:15216-15226`). Geometry and material are **not** disposed, so a re-key leaks geometry GPU buffers but does not trigger a shader recompile. See GL-04.

**Commit history context.** The last month of commits (`3073585`, `3224e1f`, `ff07dad`, `e5ab927`) targeted the *latency of individual hover interactions*: removing dwell timers, race fixes, preserving the crossfade. Removing the dwell (`e5ab927`) cut nominal latency but increased media churn. None of these commits addressed the system-level causes listed here.

---

## 3. Technology stack and dependency overview

### 3.1 Installed versions (from `node_modules/*/package.json`, lockfile v3)

| Package | Version | Used? |
|---|---|---|
| next | 16.2.6 (Turbopack dev) | Yes |
| react / react-dom | 19.2.4 | Yes |
| three | 0.184.0 | Yes (`NodeField`, `atlasManager`, `jellyField`, `CameraController`) |
| @react-three/fiber | 9.6.1 | Yes (`Universe`, `NodeField`, `CameraController`) |
| @react-three/drei | 10.7.7 | **No import anywhere**, yet listed in `optimizePackageImports` |
| framer-motion | 12.40.0 | Yes (11 files) |
| zustand | 5.0.13 | Yes (5 stores; 1 never imported) |
| lenis | 1.3.23 | **No import anywhere** |
| class-variance-authority | 0.7.1 | Yes (`GlassButton`) |
| @types/three | 0.184.1 | Types only, but listed under `dependencies` |
| tailwindcss / @tailwindcss/postcss | 4.3.0 | Yes |
| typescript | 5.9.3 | `tsc --noEmit` **passes** (strict) |
| eslint / eslint-config-next | 9.39.4 / 16.2.6 | **36 errors, 58 warnings** (§8, RCT-06) |
| Runtime used for checks | Node v26.13.0, npm 11.20.0 | — |

### 3.2 External services

- **iTunes Search API** (`itunes.apple.com/search`), server-side only, for chart construction and search (`lib/musicProvider.ts:519-553`).
- **Apple audio CDN** (`audio-ssl.itunes.apple.com`) for 30 s previews, fetched directly by the browser with `crossOrigin='anonymous'`.
- **Artwork CDNs**: `is1-ssl.mzstatic.com` (rewritten to 256 px for the atlas, 600 px elsewhere), `i.scdn.co` (Spotify CDN, signature songs only).
- **Google Fonts** (render-blocking stylesheet in `app/layout.tsx:25-28`).
- **Spotify web pages**: scraped offline by `scripts/build-regional-charts.mjs` (not at runtime).

### 3.3 Dependency risk (`npm audit`, read-only, lockfile as installed)

18 advisories: 1 critical, 8 high, 9 moderate.

- **Critical, direct: `next` 9.3.4-canary.0 – 16.4.0.** "Middleware / Proxy bypass in App Router … Turbopack" and "DoS in App Router using Server Actions". Fixed in `next@16.4.6`. **Exposure today is limited:** the repository has no `middleware`/`proxy` file and no Server Actions. It must still be upgraded before production. See SEC-02.
- **High, transitive:** `postcss` and `sharp` (via next), `brace-expansion`, `browserslist`, `js-yaml`, `nanoid`, `source-map-js`, `zod`. These are mostly build- or lint-time.
- **Moderate:** the `@typescript-eslint/*` chain, `minimatch`, `baseline-browser-mapping`, and `fflate` (reached through the unused `drei`).

---

## 4. Complete architecture map

```
RootLayout (server, app/layout.tsx) ── Google Fonts CSS (7 families, render-blocking)
└── Home ('use client', app/page.tsx)  ← subscribes to WHOLE audioStore, uiStore, performanceStore
    │                                     + songStore selectors incl. targetAudioUrl(hoveredSong)
    ├── GlobalAudioPlayer            (WHOLE audioStore + hoveredSong) — Audio() pool, 125 ms progress timer
    ├── HeroBackgroundVideo          globe.mp4 autoplay/preload=auto, CSS filter, scale 1.85 (intro only)
    ├── HoverMediaBackground         uiStore.hoveredVibe → preview <video> + full <video> (always mounted)
    ├── PreviewVideoLayer            (after intro) tint only; video logic dead
    ├── motion.div [animated opacity + filter: blur()] 
    │   └── Universe (dynamic import, ssr:false, rendered from first paint with songs=[])
    │       └── R3F <Canvas frameloop = songs.length>0 ? 'always' : 'demand'>
    │           ├── NodeField   InstancedMesh (~1,134 tiles @16:9) + GLSL3 shader + JellyField (48×48 CPU sim)
    │           │                 + 2nd artwork loader + window mousemove/click + hover detection in useFrame
    │           └── CameraController
    ├── Vignette motion.div
    ├── CinematicBackground          blurred 600 px artwork behind Song Detail
    ├── UI layer
    │   ├── IntroScreen (until introComplete) ── 14× HomepageVibeCard (memo) + CreatorCueCard
    │   │      + CreatorCollectionCard + MagneticChromeText (window mousemove) + 22 particles + GlowingRingLoader
    │   ├── Navbar (4× GlassButton)          ┐
    │   ├── SearchPanel (1–11× GlassButton)  ├ after introComplete
    │   └── SongDetail (WHOLE audioStore; always mounted after intro; ~14× GlassButton; SVG filter)
    ├── ChangeVibeOverlay (useChartHover → also drives HoverMediaBackground)
    └── HoverTooltip (memo; hoveredSong/selectedSong/introComplete selectors)

Stores (zustand): songStore · audioStore · uiStore · performanceStore (fps never written) · chartPreviewStore (never imported)
Services (module singletons): vibeService (fetch dedupe + 30-min TTL) · atlasManager (4096² canvas + CanvasTexture; imports three)
Static data in client bundle: signatureSongs → devSpecialData (80 tracks, 70 KB source) · introMediaManifest · vibeConfig
Server: /api/songs (iTunes fan-out, per-instance Map cache) · /api/search · /api/songs/top (unused) · /api/chart-preview (unused) · /api/proxy (unused, open)
Dead modules: components/universe/WallGrid.tsx, store/chartPreviewStore.ts, SongDetail.MagneticGlassCard
```

**Coupling worth noting.** `vibeService.ts:2` imports `getOptimizedArtworkUrl` from `atlasManager`, which does `import * as THREE from 'three'` (`atlasManager.ts:1`). `page.tsx:20` also imports `atlasManager` statically. three.js core therefore sits in the **initial** bundle even though the 3D view is dynamically imported (BND-01).

---

## 5. Application execution and interaction flows

**F1 — Cold load.** HTML → client JS (three core included) → render-blocking Google Fonts CSS → hydrate `Home` → render `Universe` immediately (dynamic chunk fetched; WebGL2 context created on the intro, `frameloop='demand'`) → `HeroBackgroundVideo` autoplays `globe.mp4` (11.8 MB, `preload="auto"`) → 2 logo PNGs (783 KB + 230 KB) and 14 tile WebPs (1024², ~1.05 MB) load.

**F2 — Intro card hover.** See §6 for the full lifecycle. In short: `pointerenter` → `setHoveredVibe` → sync render of all of `Home` → `HoverMediaBackground` effect → `halt()` → load the preview → `canplay` → show the preview and call `play()` → on resolve, start the full-video download → seek to 3 s → buffered → crossfade to the full video. In parallel: 150 ms debounce → `/api/songs` prefetch plus 12 artwork prefetches.

**F3 — Vibe select → Universe** (`page.tsx:137-227`). Click → `playUrl(signature track)` immediately (inside the gesture, which is good) → `setVibe` → `fetchVibeSongs` → `setPreloadUrls(all URLs)` (20 preloaded) → `setSongs` (NodeField mounts, frame loop becomes `'always'`, its own loader starts) → `prepareCriticalVibe` (32 parallel images, then one 64 MiB upload) → two rAFs → `setIntroComplete(true)` after 100 ms → `startBackgroundLoading` (224 images, uploads ≤ every 1.2 s). **The hover video is not explicitly stopped**, despite the comment at `page.tsx:130` (INT-10).

**F4 — Wall hover.** See §7. Per frame: raycast to `z=0`, map to the nearest cell, apply hysteresis → on change: `onHover(song)` → store → ≥2 synchronous full-tree renders inside the frame → `playUrl` → new or pooled `Audio` → `play()` → `setPlayingState` → render; the 8 Hz progress renders continue.

**F5 — Select → Song Detail.** The click is handled twice: R3F `onPointerMissed` calls `onSelect(null)`, then the window click handler calls `onSelect(lastHovered)` (`Universe.tsx:51`, `NodeField.tsx:504-521`). The canvas is animated to opacity 0 with `blur(10px) brightness(0)` but **keeps rendering at 60 fps**. Hover keeps running underneath the panel and can switch the audio (TRK-06).

**F6 — Search.** Typing (350 ms debounce, no abort) → `/api/search` → results merged into `songs` → NodeField geometry and mesh are rebuilt, its loader resets and re-downloads 256 artworks with repeated full-atlas uploads. Results beyond index 255 are never shown on the wall (RCT-05).

**F7 — Switch Chart.** The overlay (full-screen `backdrop-blur-3xl`) → card hover drives the *intro* hover-video engine underneath the overlay, unmuted, over the playing iTunes audio (INT-11) → select → `handleChangeVibe` (`page.tsx:231-260`): `setSongs` before `prepareCriticalVibe`, so the two loaders race (GL-03).

**F8 — Refresh.** `?refresh=1` bypasses both caches, triggering 8–19 upstream iTunes calls server-side, and the client reloads the whole atlas.

---

## 6. Intro hover-preview deep investigation (Priority A)

### 6.1 Components, hooks, services and stores on the path

`IntroScreen.tsx` (`HomepageVibeCard` :17-161, `CreatorCueCard` :164-296, `CreatorCollectionCard` :299-462, `MagneticChromeText` :497-549, `IntroScreen` :551-937) → `hooks/useChartHover.ts` → `store/uiStore.ts` (`hoveredVibe`) → subscribers: `app/page.tsx` `Home` (whole store, :117), `IntroScreen` (selector), `components/ui/HoverMediaBackground.tsx` (selector) → `lib/introMediaManifest.ts` → `/public/videos/*_preview_3s.mp4`, `*_30s.mp4`. In parallel: `lib/vibeService.ts` (prefetch) → `/api/songs`; `components/ui/HeroBackgroundVideo.tsx` (globe, continuously).

### 6.2 Step-by-step lifecycle

| # | Step | What the code does (evidence) | What the browser is asked to do | Status |
|---|---|---|---|---|
| 1 | Pointer enters card | `onPointerEnter` on `.kadence-3d-pop` (`IntroScreen.tsx:109`) → `getBoundingClientRect()` (:38) → `handleHoverStart(id)` (`useChartHover.ts:24-43`). CSS `:hover` starts at once: pop transform 0.32 s, card `box-shadow` 0.35 s, `filter: brightness(1.22)` 0.3 s, and **`will-change` is added only on hover** (`IntroScreen.tsx:643-662`). | Possible forced layout (rect read); **promote 2 new compositor layers and rasterise them at hover start**; repaint shadow each frame for 350 ms; animate a filter on a subtree that contains `backdrop-filter` (:140) and 3 blend-mode layers (:140-152). | Confirmed mechanism; cost needs measurement |
| 2 | Hover state changes | `setHoveredVibe(id)` (zustand) → synchronous listeners. Prefetch is debounced by 150 ms: `vibeService.prefetchVibe` → `/api/songs?vibe=` plus 12 × 256 px artwork `Image()`s (`vibeService.ts:87-105`). | One API request (a cold server fans out to 8–19 iTunes calls) plus 12 image requests that compete with the video. | Confirmed |
| 3 | React updates | `useSyncExternalStore` makes it a **sync render of the whole `Home` tree** because `Home` destructures all of `useUIStore()` (`page.tsx:117`). `IntroScreen` is not memoised, so it re-renders fully, including the 140-line `<style>` literal (:592-735). Only the 2 affected `HomepageVibeCard`s re-render (memo), but `CreatorCueCard` always re-renders (inline `onHoverStart` at :865), as do `CreatorCollectionCard` and `MagneticChromeText`. Four wrappers toggle `opacity-0` (:739, :847, :851, :862, :889). `AnimatePresence` **mounts a new 600×600 `blur-[45px]` glow** (:746-762) **inside a layer that is simultaneously fading to opacity 0** (:739), which is wasted raster work. | Style recalc for class toggles; 300 ms opacity transitions; one large blurred paint. | Confirmed (cost needs measurement) |
| 4 | Preview source assigned | Passive effect (`HoverMediaBackground.tsx:230-261`), flushed synchronously for a sync render → `halt()` (:78-102): pause **both** videos, `removeAttribute('src')` + `load()` on both, hide them, deactivate the container. Then `beginPreview` (:185-227): container active (300 ms dim fade-in, :276), `loop=true`, `canplay` listener, `src = preview`, `load()`. | Run the media-element load algorithm twice to tear down (decoder and demuxer destroyed), then once more to start a fresh pipeline. | Confirmed |
| 5 | Browser requests video | `preload="none"` (:289) plus an explicit `load()`. **No prefetch, poster, or warm element exists anywhere for the 14 previews** (repo-wide search: the only `preview_3s` references are the manifest). | Range request(s) for a 0.69–3.54 MB file. First hover per card is a cold network fetch; repeats depend on the HTTP cache (`immutable` in prod, `next.config.ts:16-28`). | Confirmed |
| 6 | Metadata and frames | Files are faststart (`moov` before `mdat`, measured on all 33). H.264 High@4.0–5.0, 1920×1080 up to 1920×1440, 24 fps. **Preview bitrates 1.70–9.31 Mbps** (measured). `play()` is **gated on `canplay`** (HAVE_FUTURE_DATA, :219). | Demux `moov` (~3.5 KB); fetch and decode the first keyframe (1080p/1440p I-frame); initialise the hardware decoder; buffer ahead to `canplay`. With preload effectively metadata-only, how quickly `canplay` arrives is browser-dependent. | Mechanism confirmed; timing needs measurement |
| 7 | Playback begins | On `canplay`: **`setVisible(pVid, true)` first (:203)**, then `play()` (:205) on an **unmuted** element (`muted={false}`, :288). On rejection: `.catch(() => {})` (:213-215). | Without prior user activation (hover is not one), autoplay policy rejects unmuted `play()` → **frozen first frame visible**, and the full video is never prepared (it is chained on resolve, :211). | Code confirmed; rejection strongly indicated for fresh visitors |
| 8 | Preview → full transition | When `play()` resolves: `beginFullVideoPrep` (:105-182). Full `src` is set and `load()` called **immediately** (:167-168) → `loadedmetadata` → `currentTime = 3` (:116) → `progress/canplay/canplaythrough/seeked` → `attemptHandoff` requires buffered ⊇ [3.0, 3.5] (:125-131) → `fVid.play()` → show full → after 200 ms hide and pause the preview (:144-152). | Download 6.8–30.6 MB in parallel with the preview's remaining bytes. Seek to 3.0 s, which **needs decoding from the previous keyframe** (see 6.4). Two decoders active, plus the globe as a third. | Confirmed (code and file structure) |
| 9 | Audio/video crossfade | There is **no audio crossfade**. Both elements are unmuted (:288, :303), so both play at full volume for ~200 ms. The handoff moment is set by **buffering, not by the preview playhead**. The preview (3 s loop) can be anywhere in its loop when the full video starts at 3.0 s, so the picture and music jump. Video crossfade is 150 ms opacity (:293, :309). | Mix two unsynchronised audio streams (audible doubling); show a visual discontinuity. | Confirmed |
| 10 | Leave / rapid change | Leave → 50 ms grace (`useChartHover.ts:52-55`); entering another card cancels it. Each change → `halt()` → `src` removed (the frame vanishes at once; video opacity transitions have nothing left to fade) → cold preview of the new card. **Dim gap = new card's time-to-`canplay` + 150 ms.** | Abort fetches (good for bandwidth); destroy and recreate media pipelines on every change. | Confirmed |
| 11 | Cleanup | Session counter invalidates stale callbacks (:80, :106, :115, :121, :142, :147, :201, :209). Good. Listener cleanup via an untyped `__cleanup` expando on the DOM element (:181, :224, :234-237) works but is fragile. Two elements are reused, so **no element accumulation**. **The globe is never paused** while hover video is visible (`HeroBackgroundVideo.tsx:16-35`), and it carries a full-screen `filter: contrast(1.3) brightness(1.4) saturate(1.2)` at `scale(1.85)` (:55-58). | Keep decoding a 1080×1080 stream plus a filter pass per frame underneath an opaque video. | Confirmed |

### 6.3 Where the delay actually originates (ranked)

| Rank | Origin | Nature | Evidence | Confidence |
|---|---|---|---|---|
| 1 | Cold network fetch plus decoder start for every first hover per card, with no poster or warm-up; full teardown on every card change | Media pipeline | `HoverMediaBackground.tsx:78-102`, `:185-227`, `:289` | Confirmed mechanism; size needs measurement |
| 2 | Unmuted `play()` blocked before the first click, rejection swallowed after revealing the frame | Autoplay policy | `:203-215`, `:288` | Strongly indicated |
| 3 | Handoff seek to 3.0 s with keyframe at 0 s, buffer-timed and not playhead-timed, dual unmuted audio | Media pipeline | `:114-158`; probe (§6.4) | Confirmed |
| 4 | Bandwidth contention: full video (≤30.6 MB) starts during the preview; API and artwork prefetch; globe | Network | `:209-212`; `useChartHover.ts:37-42`; `vibeService.ts:93-101`; `HeroBackgroundVideo.tsx:51` | Confirmed mechanism; size needs measurement |
| 5 | Up to 3 concurrent 1080p+ decodes (globe + preview + full) plus a full-screen CSS filter | GPU / decode | `HeroBackgroundVideo.tsx:45-61`; HMB | Confirmed mechanism; size needs measurement |
| 6 | Hover CSS: `will-change` promotion at hover start, `box-shadow` transitions, filter over backdrop/blend subtree, gradient repaint from `--mx/--my`, 600 px blur glow mount | Compositor / paint | `IntroScreen.tsx:118-119`, `:137-152`, `:636-662`, `:746-762` | Strongly indicated; size needs measurement |
| 7 | 14 `backdrop-filter`s and ~42 blend layers over the video | Compositor | `IntroScreen.tsx:137-152` | Hypothesis (damage tracking may limit it; see INT-07) |
| 8 | Whole-tree React render per hover change; `MagneticChromeText` layout read per `mousemove` | Main thread | `page.tsx:117`; `IntroScreen.tsx:506-531` | Confirmed mechanism; likely small |

**Conclusion for A.** The intro lag is **primarily a media-pipeline and compositing problem, not a React problem**. The deliberate 300 ms container fade and 150 ms video fade also set a floor of ~300 ms before the effect looks complete, even with zero network latency.

### 6.4 Measured media facts relevant to hover (read-only MP4 probe)

| Card (vibe) | Preview file: size / bitrate / res | Full file: size / bitrate | Keyframes in full file (first few, s) | Last keyframe ≤ 3.0 s | Frames to decode for 3.0 s seek (approx.) |
|---|---|---|---|---|---|
| global-top-50 (*Beat It*) | 1.64 MB / 4.23 Mbps / **1920×1440** | 14.06 MB / 3.61 Mbps | 0, 7.17, 13.12 | **0.00** | ~72 |
| viral-50 (*Radhimaa*) | 3.06 MB / 8.01 / 1920×1280 | 24.86 MB / 6.49 | 0, 3.58, 6.21 | **0.00** | ~72 |
| new-music-friday (*Alaakaa Loova*) | 2.42 MB / 6.32 / 1080p | 19.53 MB / 5.07 | 0, 1.46, 3.17 | 1.46 | ~37 |
| hip-hop-central (*Loser*) | 0.69 MB / 1.70 / 1920×788 | 6.76 MB / 1.66 | 0, 10.42, 20.83 | **0.00** | ~72 |
| pop-rising (*Kiss Kiss Bang Bang*) | 2.88 MB / 7.54 / 1080p | 14.31 MB / 3.67 | 0, 3.17, 6.04 | **0.00** | ~72 |
| dance-hits (*Yeshanagula*) | 2.35 MB / 6.12 / 1080p | 26.20 MB / 6.85 | 0, 4.50, 5.83 | **0.00** | ~72 |
| mood-booster (*Sunflower*) | 1.50 MB / 3.87 / 1080p | 13.12 MB / 3.36 | 0, 1.12, 4.08 | 1.12 | ~45 |
| late-night (*One Of The Girls*) | 0.86 MB / 2.16 / 1080p | 8.92 MB / 2.25 | 0, 2.79, 8.38 | 2.79 | ~5 |
| workout (*Big Dawgs*) | 3.54 MB / **9.31** / 1080p | 24.56 MB / 6.40 | 0, 4.96, 5.96 | **0.00** | ~72 |
| chill-hits (*Pavazha Malli*) | 3.40 MB / 8.94 / 1919×1336 | 25.09 MB / 6.56 | 0, 1.62, 3.50 | 1.62 | ~33 |
| dev-special (*God Mode*) | 3.20 MB / 8.38 / 1080p | **30.59 MB / 8.02** | 0, 4.33, 14.75 | **0.00** | ~72 |
| top-telugu (*Baby Won't You Tell Me*) | 1.24 MB / 3.18 / 1080p | 12.18 MB / 3.11 | 0, 1.92, 3.62 | 1.92 | ~26 |
| top-tamil (*Monica*) | 2.90 MB / 7.60 / 1080p | 25.01 MB / 6.53 | 0, 1.04, 2.17 | 2.17 | ~20 |
| top-hindi (*Gehra Hua*) | 1.05 MB / 2.65 / 1080p | 9.68 MB / 2.45 | 0, 4.12, 7.92 | **0.00** | ~72 |
| top-kpop (*Dynamite*) | 1.17 MB / 2.97 / 1080p | 11.57 MB / 2.95 | 0, 1.21, 3.08 | 1.21 | ~43 |
| **Totals** | **31.9 MB** | **266.4 MB** | | 8 of 15 at 0.00 | |

Also: `globe.mp4` is 11.80 MB, 1080×1080, 3.14 Mbps, with an empty audio track. `Gala Gala_30s.mp4` (14.42 MB, no audio) is unreferenced. "Frames to decode" = (3.0 − last keyframe) × 24 fps, arithmetic only.

### 6.5 Specific sub-questions

- **Unnecessary re-renders:** yes. The whole `Home` tree re-renders on every `hoveredVibe` change (INT-08). There is no audio playing on the intro, so the 8 Hz loop does not apply until a vibe is chosen.
- **Video element creation and reuse:** two persistent elements, reused, but their pipelines are destroyed on every change. There is no warm pool and no poster.
- **Preloading:** none for previews; `preload="auto"` for the globe, which is the least important video.
- **`canplay` / `play()` / promise handling:** `play()` is gated on `canplay` instead of calling `play()` immediately and revealing on `playing` or `requestVideoFrameCallback`. The rejection is swallowed after the reveal.
- **Autoplay / muted playback:** unmuted, with no muted fallback and no activation check (`navigator.userActivation`).
- **Decoding and compositing:** up to 3 concurrent decodes, one with a CSS filter; intro cards add blend and backdrop layers above.
- **Seeking and keyframes:** see §6.4.
- **Simultaneous audio:** preview and full overlap for ~200 ms. After a vibe is selected, the iTunes first-track audio starts while hover video audio may still be playing (INT-10, hypothesis).
- **Memory:** no accumulation; elements are reused and `src` removed on halt.
- **Stale async callbacks:** handled correctly by the session counter.
- **Asset sizes:** see §6.4 and MED-01.
- **Mobile/touch:** a tap fires `pointerenter` (preview fetch starts) → `pointerleave` after `pointerup` → halt 50 ms later. Bytes are wasted, there is no hover capability check (`(hover: hover)`), and touch users get no preview alternative (INT-13). On mobile the globe alone costs 11.8 MB on first visit.
- **Hidden videos decoding:** only the globe (under the hover video). Preview and full are released on halt.

---

## 7. Music-track hover deep investigation (Priority B)

### 7.1 What a "track" is

There is **no DOM track list**. Tracks are the ~1,134 instances (16:9 viewport) of one `InstancedMesh` (`NodeField.tsx:795-801`), textured from a 4096² atlas of up to 256 artworks. `WallGrid.tsx` (a DOM grid with per-tile `onMouseEnter`) exists but **is not imported anywhere**. The only DOM lists are the Search results (≤12 rows, CSS-only hover) and none in Song Detail. **Virtualisation is not applicable.**

### 7.2 Complete hover lifecycle

| # | Step | Evidence | Notes |
|---|---|---|---|
| 1 | Pointer moves | `window.addEventListener('mousemove', onMove)` (`NodeField.tsx:525`) stores NDC only (:492-501). | Cheap. **Fires under every UI element and while Song Detail is open** (TRK-06). |
| 2 | Per-frame hit test | `useFrame` (:542): raycast to the **z = 0 plane** (:568-579); effective = raw × 1.028 (parallax inverse, :699-700); sticky radius 0.7 × pitch (:703-723); else nearest cell (:725-738) → `texIndices[cell]` → song. | O(1). **Ignores the lens Z-lift and jelly displacement** (TRK-02). |
| 3 | Visual response | The lens follows a **smoothed** cursor (`followSpeed 9`, τ ≈ 111 ms, :584-597). The shader lifts tiles near the cursor by up to 5.3 wu (:111-118). **`uHoverIdx` is unused by both shaders**, so there is no per-tile highlight. Pop starts after **1.0 s dwell** (:754-759) and eases with rate 6 s⁻¹ (~0.5 s to settle, :772-776). | The hovered tile has no immediate state of its own (TRK-01, TRK-08). |
| 4 | Store write inside the frame | On change: `onHover(song)` → `songStore.hoverSong` (:741-751); cursor style written. | Zustand → `useSyncExternalStore` → **SyncLane render flushed in a microtask before the frame is presented**. |
| 5 | Render #1 | Subscribers: `Home` (`targetAudioUrl` selector, `page.tsx:292-297`), `HoverTooltip` (:37), `GlobalAudioPlayer` (:23). `Home` re-render cascades to **all non-memo children**: `GlobalAudioPlayer`, `HeroBackgroundVideo`, `HoverMediaBackground`, `PreviewVideoLayer`, `Universe` → R3F `Canvas` → `NodeField` + `CameraController`, `CinematicBackground`, `Navbar` (+4 `GlassButton`s, each re-rendering its `<style>`), `SearchPanel`, `SongDetail` (always mounted after intro). | Full tree. |
| 6 | Render #2 | `Home` effect (:299-304) → `playUrl(url)` → `audioStore` set → whole-store subscribers `Home`, `GlobalAudioPlayer`, `SongDetail`. Passive effects of a sync render are flushed synchronously, so this happens **in the same task**. | Full tree again, still inside the frame. |
| 7 | Audio switch | `GlobalAudioPlayer` URL effect (:178-290): **hard `pause()` of the previous track** (:202-206); pooled element, or `new Audio()` + `preload='auto'` + `load()` **outside the concurrency limiter** (:208-234); `volume=0.05`; `play()`; 5 × 20 ms interval ramp to 0.35 (:268-280). | Network fetch for most tracks (only the first 20 URLs are preloaded, :85). |
| 8 | Render #3, #4, then 8 Hz | `setPlayingState(true)` (:265) always creates a new state object, so whole-store subscribers re-render. `loadedmetadata` → `setProgressState` (:244-248). Then a **125 ms interval** `setProgressState` (:124-132). | Full tree 8×/s while anything plays. In the Universe something nearly always plays. |
| 9 | Tooltip | `HoverTooltip` shows `<img src={hoveredSong.albumArt}>` (`page.tsx:58-62`). `albumArt` is the **600×600** variant (`musicProvider.ts:332`), displayed at 48 px; the 256 px URL already cached by the atlas is not reused. The tooltip `motion.div` has no `key`, so the image swaps with a blank gap while loading. `backdrop-blur-md` sits over the live canvas (:52). | One 600 px image request and decode per new track. |
| 10 | Rapid movement | No dwell. Each tile crossed means 2 sync renders in-frame, a new `Audio` download, a tooltip image request, a preload-queue re-evaluation (:80-121) and a cursor style write. | Sweeping 10 tiles in 0.5 s means 10 audio downloads started and ~20 in-frame full-tree renders. |

### 7.3 Exactly which components re-render on one track hover

- **Render #1 (hoveredSong change):** `Home`, `HoverTooltip`, `GlobalAudioPlayer`, plus every non-memo descendant of `Home`: `HeroBackgroundVideo`, `HoverMediaBackground`, `PreviewVideoLayer`, `Universe`, R3F `Canvas` (root re-render → reconciles `NodeField`, `CameraController`, `ambientLight`), vignette `motion.div`, `CinematicBackground`, `Navbar` and its 4 `GlassButton`s, `SearchPanel` and its trigger `GlassButton`, `SongDetail` (and when open its ~14 `GlassButton`s, `LiquidScrubber`, 40 waveform bars), `ChangeVibeOverlay` if open.
- **Render #2 (`playUrl`):** the same full set again (from `Home`'s whole `audioStore` subscription).
- **Render #3 (`setPlayingState`), #4 (`loadedmetadata`), then every 125 ms:** the same full set.
- **Not re-rendered:** the 14 intro cards (unmounted), `HomepageVibeCard` (memo, not mounted).

*(All confirmed by code. Per-render cost needs the React Profiler, R5 in §22.)*

### 7.4 Hit-test misalignment (TRK-02): derivation

Browse camera: `(0, 0, 30)` looking at `z = 0` (`CameraController.tsx:48-51`, `gridCalc.ts:31`). Vertex shader: `displacedWPos.z += smoothstep(R, 0, dist) × 5.3`, R = 10.2 (`NodeField.tsx:33-34`, `:111-118`). A tile at grid x, lifted by z, projects to screen ∝ x / (30 − z). The cursor ray meets `z = 0` at X₀. The code selects the tile at X₀ (after the parallax correction), but the tile drawn under the cursor satisfies x / (30 − 5.3·f(|X₀ − x|)) = X₀ / 30. Solving numerically with the actual constants (stationary cursor, no jelly):

| Cursor offset from centre (world units, at 16:9 half-width = 30.8) | Offset (% of half-width) | Error (world units) | Error (tiles, pitch 1.72) |
|---|---|---|---|
| 2.5 | 8 % | 0.44 | 0.26 |
| 5 | 16 % | 0.87 | 0.50 |
| 10 | 33 % | 1.64 | 0.96 |
| 15 | 49 % | 2.31 | 1.34 |
| 20 | 65 % | 2.86 | 1.66 |
| 30 | 97 % | 3.71 | 2.16 |

The error points **outward**: the code picks a tile farther from centre than the one the user sees. Hysteresis (0.7 pitch) shifts the switch points but not the bias. While the cursor moves, the lens is centred on the *smoothed* cursor, so the error changes from frame to frame, which reads as jitter. *(Strongly indicated; validate with R6.)*

### 7.5 Diagnosis: what causes the lag

| Cause | Share of perceived lag | Type | Confidence |
|---|---|---|---|
| No immediate per-tile hover state; 1 s dwell + ~0.5 s ease to pop; smoothed lens (τ ≈ 111 ms) | Large: the tile "doesn't react" | Interaction design / shader | Confirmed |
| Hit-test misalignment: tooltip, audio and pop belong to a neighbouring tile off-centre | Large: feels "wrong and late" | Geometry | Strongly indicated |
| Audio latency: network fetch per new tile, hard cut, 100 ms ramp | Large for audio | Media / network | Confirmed mechanism; size needs measurement |
| ≥2 full-tree sync renders in the frame per tile change, 8 Hz full-tree renders while playing | Medium–large: frame drops while moving | React / main thread | Confirmed mechanism; size needs measurement |
| Full 64 MiB atlas uploads after entry, switch, refresh or search | Spikes | GPU / main thread | Confirmed count; cost needs measurement |
| Tooltip 600 px image plus `backdrop-blur` over the live canvas; GlassButton blurs | Medium | Network / compositor | Confirmed / hypothesis |

**Conclusion for B.** It is a combination. The two causes the user notices first are **design-level and geometric** (no instant tile feedback; hit-test off-centre). The two that make it stutter are **React rendering in the frame loop** and **audio and network churn**. The GPU work for the wall itself (one draw call, ~4.5 k vertices) is small; GPU cost comes from what is composited over it.

### 7.6 Smallest correct architectural fix

Do not memoise everything. Instead:

1. **Take hover and progress off the React root.** Use selector-only subscriptions; move playback progress to a transient channel read by leaf components; move the hover → audio bridge into a non-rendering subscriber with a 120–180 ms dwell. After this, a tile change re-renders only `HoverTooltip`.
2. **Give the tile an instant state.** Use the already-plumbed `uHoverIdx` for a brightness/scale cue in the shader on the same frame.
3. **Correct the hit test.** For the 3×3 (or 5×5) cells around the naive cell, apply the same displacement as the shader (lens lift, parallax, jelly sample) on the CPU, project the four corners with the camera, and pick the cell whose projected quad contains the pointer.
4. **Scope input to the canvas.** Use pointer events on the canvas element, not `window`; ignore pointers over UI; suspend hover while detail or overlays are open; compute hover synchronously on `pointerdown`/`pointerup` for touch.
5. **Bound and prioritise audio.** Use an LRU pool of 8–12 elements, one scheduler, `preload='metadata'` for neighbours, and fades on both sides.

---

## 8. React and state-management findings

> Finding format: **ID · Title** — Category · Severity · Confidence · Evidence → Current behaviour → Root cause → Impact → Correction → Regression risk → Depends on → Acceptance.

**RCT-01 · Global 8 Hz full-tree re-render loop**
- Category React/state · **Critical** · Confirmed by code
- Evidence: `app/page.tsx:117-119` (`useUIStore()`, `usePerformanceStore()`, `useAudioStore()` destructured without selectors); `components/ui/SongDetail.tsx:407`; `components/GlobalAudioPlayer.tsx:13-21`; progress writes at `:9`, `:124-132`.
- Current: while audio plays, `setProgressState` runs every 125 ms. Every whole-store subscriber re-renders, and `Home` re-renders its entire non-memo subtree, including the R3F canvas root and `SongDetail` (40 bars, scrubber that forces layout).
- Root cause: high-frequency transient values live in render-triggering global state that the root subscribes to wholesale.
- Impact: continuous main-thread load in every post-intro view; it competes with the WebGL frame loop, input and decoding. Likely the largest single contributor to INP and frame drops (magnitude needs measurement, R5).
- Correction: selectors everywhere (`useAudioStore(s => s.playUrl)` or `getState()`); progress in a dedicated transient store or ref read by leaf components via rAF; `SongDetail` subscribes only to `isPlaying`.
- Regression risk: low. Watch for stale closures where actions were destructured.
- Depends on: none.
- Acceptance: React Profiler over 10 s of playback with no input shows **0 commits of `Home`** and ≤1 leaf commit per animation frame (or a transient update with no React commit).

**RCT-02 · Monolithic client root; unstable props; `Universe` not memoised**
- React/state · **High** · Confirmed
- Evidence: `app/page.tsx` (one `'use client'` component for all views); inline `onFps` (:353), `onSearchOpen` (:386), `onChangeVibeClick` (:389), `onOpen/onClose` (:394-395), `onClose` (:410); `Universe.tsx:68` new `targetNodePos` object per render.
- Current: any root update reconciles every view.
- Root cause: no view or module boundaries; state ownership centralised in `Home`.
- Impact: multiplies RCT-01, TRK-03 and INT-08.
- Correction: split into `IntroView`, `UniverseView`, `DetailView` and overlays with view-local subscriptions; `memo(Universe)` with stable props; server components for static intro chrome.
- Regression risk: medium (structural); do it after P0 subscriptions.
- Depends on: RCT-01.
- Acceptance: a hover or progress update commits only its leaf subscribers (Profiler).

**RCT-03 · Dead and latent state**
- React/state · Medium · Confirmed
- Evidence: `performanceStore` fps is never written (`onFps` is never called inside `Universe`), so `usePerformanceStore()` at `page.tsx:118` is a latent whole-store subscription; `uiStore.searchQuery/setSearchQuery/setDetailOpen/viewMode/setViewMode` have 0 references; `songStore.isLoading/updateNodePosition` have 0 references; `store/chartPreviewStore.ts` is never imported.
- Impact: confusion and maintenance cost; future writes would trigger full renders.
- Correction: delete, or replace with selector use.
- Risk: low. Depends on: none. Acceptance: no unused store fields (lint and grep).

**RCT-04 · WebGL canvas and its chunk created on the intro**
- React/bundle · Medium · Confirmed
- Evidence: `page.tsx:26-29` dynamic import, but `:344` renders `<Universe songs={[]}>` from first paint.
- Current: R3F and three renderer chunk downloaded and a WebGL2 context created while the user is on the intro.
- Impact: startup CPU/GPU and memory; competes with the intro video. Also means a WebGL failure crashes the intro (no error boundary, SEC-03).
- Correction: mount after vibe selection; prefetch the chunk on first card hover.
- Risk: low–medium (first-frame warm-up moves later; keep the existing 2-rAF warm-up). Depends on: SEC-03 recommended.
- Acceptance: no WebGL context and no `Universe` chunk before the first card hover or click (Network and Performance panels).

**RCT-05 · Search merge rebuilds the wall; no request cancellation**
- React/state/WebGL · Medium · Confirmed
- Evidence: `page.tsx:305-316` merges into `songs`; `NodeField.tsx:305-309` resets its loaded sets on `[songs]`; `:361-425` new `texIndices` and geometry → `args` change → the `InstancedMesh` is reconstructed; `SearchPanel.tsx:37-50` has no `AbortController`.
- Current: each search re-downloads up to 256 artworks with repeated full-atlas uploads and reconstructs the mesh. Results appended beyond index 255 **never appear on the wall** (`TEXTURE_DEPTH = 256`, `NodeField.tsx:23`, `:344`). Slow, older responses can overwrite newer ones.
- Impact: hitching after every search; the feature's visible effect on the wall is often nil.
- Correction: keep results in the panel; if merging is wanted, append into free atlas slots without resets; abort stale requests.
- Risk: low. Depends on: GL-01/GL-04 for append-only.
- Acceptance: a search causes 0 full-atlas uploads and 0 mesh reconstructions; out-of-order responses are discarded.

**RCT-06 · Lint health**
- Maintainability · Low · Confirmed
- Evidence: 36 errors / 58 warnings. Notable: `react-hooks/immutability` in `NodeField.tsx:459,542,549,555,750`; `GlobalAudioPlayer.tsx:61` use-before-declare (works at runtime because of the closure); `react-hooks/set-state-in-effect` in `SearchPanel.tsx:32`, `SongDetail.tsx:412`; 44 unused vars; 20 `any`; 8 `no-img-element`; 1 `no-page-custom-font`.
- Impact: blocks the React Compiler and hides real issues.
- Correction: fix progressively per touched file. Risk: low. Acceptance: 0 lint errors in CI.

**RCT-07 · `suppressHydrationWarning` on `<html>` and `<body>`**
- Reliability · Low · Confirmed (`app/layout.tsx:21`, `:30`). It hides real mismatches. Remove it unless an extension conflict has been proven. Acceptance: no hydration warnings in dev.

---

## 9. WebGL and GPU findings

**GL-01 · Duplicate artwork pipeline with 64 MiB full-atlas re-uploads**
- WebGL/GPU · **Critical** · Count Confirmed; cost Hypothesis
- Evidence: one shared 4096×4096 `CanvasTexture` (`lib/atlasManager.ts:44-59`). Two writers: `atlasManager` (critical 32 → one upload at :180; background batches of 8, upload ≤ every 1,200 ms at :256-260) and **`NodeField`'s own loader** (`NodeField.tsx:313-356`, up to 6 concurrent, separate `loadedSet`). Its flush runs **on every frame where the count changed while ≤16 are loaded**, then every 500 ms (:543-553).
- Current: the same 256 artworks are requested, decoded and drawn twice. Each `needsUpdate` re-uploads the full 4096²×4 B = **64 MiB** texture. Arithmetic upper bound ≈ 16 + (load window / 0.5 s) + (load window / 1.2 s) uploads per chart entry. It repeats on switch, refresh and search.
- Root cause: no single owner; whole-texture invalidation.
- Impact: frame spikes right after entering the wall, exactly when the user starts hovering.
- Correction (phase 1): delete the `NodeField` loader and flush; `atlasManager` is the sole owner. (Phase 2): per-slot upload (`createImageBitmap` resized to 256² → `texSubImage2D` / `copyTextureToTexture`), 256 KiB per tile.
- Risk: medium (texture state handling; validate visually). Depends on: none (phase 1).
- Acceptance: full-size `texImage2D` calls per chart entry ≤ 1 (phase 2) / ≤ 5 (phase 1); no long task > 50 ms attributable to texture upload (R7).

**GL-02 · Frame loop never gated; animated CSS blur over a live canvas**
- WebGL/GPU · **High** · Confirmed (mechanism), cost Hypothesis
- Evidence: `Universe.tsx:36` (`'always'` whenever songs exist); `page.tsx:336-343` animates `filter: blur(10px) brightness(0)` / `blur(12px)` on the canvas wrapper; the canvas is at opacity 0 under Song Detail but still renders; the Switch Chart overlay applies `backdrop-blur-3xl` over it (`ChangeVibeOverlay.tsx:204`).
- Impact: GPU and CPU (jelly sim, uniforms, raycast) burn continuously while the wall is invisible; full-screen blur passes per frame.
- Correction: `frameloop='never'` (or `'demand'` + `invalidate()`) while detail or overlay is open or the document is hidden; replace the blur on the canvas wrapper with opacity (or a one-off snapshot).
- Risk: low; on resume, dt is clamped (`NodeField.tsx:558`). Depends on: none.
- Acceptance: 0 WebGL frames while Song Detail is open (R7 counter); GPU ms/frame in Song Detail idle near the baseline without the canvas.

**GL-03 · Stale-artwork race and blank slots on chart switch**
- WebGL · Medium · Confirmed race; frequency Hypothesis
- Evidence: `NodeField.loadSlot` `onload` has no generation check (`NodeField.tsx:319-332`); `page.tsx:249` `setSongs` runs **before** `:255` `prepareCriticalVibe`, which clears the whole canvas (`atlasManager.ts:93-95`) while `NodeField` may already have marked slots as loaded.
- Impact: old-chart covers can be drawn into new-chart slots; some slots stay blank until background loading reaches them.
- Correction: single loader (GL-01) with a per-chart generation token; draw only if the token matches.
- Risk: low. Depends on: GL-01. Acceptance: switching charts 10× quickly never shows a cover from a previous chart (R7 visual check).

**GL-04 · Mesh reconstruction on `songs.length` change leaks geometry**
- WebGL · Medium · Confirmed
- Evidence: `NodeField.tsx:361-425` (geometry `useMemo` on `texIndices`, which depends on `songs.length`), `:796-801` (`args`). R3F v9 disposes only the mesh object on unmount (`node_modules/@react-three/fiber/dist/events-b389eeca.esm.js:15216-15226`), and `InstancedMesh.dispose()` does not dispose geometry (`three/src/objects/InstancedMesh.js:407-418`). Old `PlaneGeometry` plus two instanced attributes are never disposed.
- Impact: GPU buffer growth per search or refresh with a length change; a reconstruction hitch each time.
- Correction: stable geometry sized for the max count; update attributes in place (`needsUpdate`); dispose on unmount.
- Risk: low–medium. Depends on: RCT-05. Acceptance: renderer `info.memory.geometries` stays constant across 10 searches.

**GL-05 · Texture minification without mipmaps; shader cost details**
- WebGL quality/perf · Medium · Strongly indicated
- Evidence: atlas `minFilter = LinearFilter`, `generateMipmaps = false` (`atlasManager.ts:54-58`). 256 px slots are drawn at ~50–60 px tiles. Fragment shader: `discard` for rounded corners (:182) defeats early-Z on some GPUs; two `pow()` gamma conversions per fragment (:206, :224). `dpr` up to 1.5 (`Universe.tsx:45`).
- Impact: shimmer and aliasing during motion; GPU cost on integrated and mobile GPUs.
- Correction: smaller slot size or manual mip levels per slot; alpha-to-coverage or an SDF alpha instead of discard; adaptive DPR tier.
- Risk: visual change (needs design sign-off). Acceptance: no visible shimmer in a side-by-side recording; GPU ms/frame not worse.

**GL-06 · No WebGL2 capability check, context-loss handling or fallback**
- Reliability · Medium · Confirmed
- Evidence: GLSL3 shader (`NodeField.tsx:449`) requires WebGL2; no `webglcontextlost/restored` handlers (repository-wide search); no error boundary (SEC-03).
- Impact: on devices without WebGL2, or after a context loss (GPU reset, backgrounding on mobile), the wall goes blank or the whole app crashes.
- Correction: capability check → static artwork-grid fallback; handle context loss (pause, restore, re-upload atlas); error boundary around the canvas.
- Risk: low. Acceptance: the forced context-loss test (`WEBGL_lose_context`) recovers within 1 s or shows the fallback; the app works with WebGL2 disabled.

**GL-07 · Float texture with linear filtering requires an extension**
- Compatibility · Low · Strongly indicated
- Evidence: `jellyField.ts:76-86` (`FloatType` + `LinearFilter`). Linear filtering of float textures needs `OES_texture_float_linear`, which some mobile GPUs lack, leaving the texture incomplete and the jelly effect silently off.
- Correction: `HalfFloatType` or `NearestFilter` fallback. Acceptance: jelly effect works on a device without the extension.

**GL-08 · Per-frame waste**
- Perf · Low · Confirmed
- Evidence: the loader loop scans up to 256 entries every frame forever (`NodeField.tsx:341-356`); unused uniforms are written each frame (`uTime`, `uCameraXY`, `uRawMouse`; `uWaveSpeed`/`uWaveAmp` declared but unused by the shader); the 48×48 jelly sim plus an activity scan run every frame (`jellyField.ts:162-289`).
- Correction: stop the loader when complete (removed with GL-01); skip the jelly step when settled; remove dead uniforms. Acceptance: `JellyField.update` self-time ≈ 0 when idle.

**GL-09 · Selected highlight on the wrong tile; camera targets random coordinates**
- Correctness · Low · Confirmed
- Evidence: `uSelectedIdx` = song index (`NodeField.tsx:786-792`) compared with instance index (`:84`); `CameraController` pans to `selectedSong.x/y` (`Universe.tsx:68`), which are random values from `musicProvider.ts:345-347`, not the tile's grid position.
- Impact: hidden today because the canvas fades out on select; wrong if that behaviour changes.
- Correction: store the selected *instance* index and its grid position. Acceptance: the selected tile is the clicked tile.

---

## 10. Audio-system findings

**AUD-01 · Preload policy and effective concurrency**
- Audio/network · **High** · Confirmed mechanism
- Evidence: all chart preview URLs are dispatched (`page.tsx:180-181`); the first 20 are preloaded with `preload='auto'` (`GlobalAudioPlayer.tsx:55`, `:85`); the limiter counts only the `'loading'` state until `canplaythrough` (:35-51), but browsers can keep downloading after `canplaythrough`; `crossOrigin='anonymous'` (:54, :211).
- Impact: on entry, up to 20 full previews download alongside 32 + 224 + duplicate artworks, delaying the visual fill.
- Correction: preload only the next 2–3 likely tracks fully and `metadata` for the rest; one scheduler for audio and artwork.
- Risk: low. Acceptance: ≤4 concurrent audio requests at entry; artwork for the critical 32 completes earlier than the baseline (R8).

**AUD-02 · Abrupt switching and coarse volume ramps; iOS ignores volume**
- Audio UX · Medium · Confirmed (iOS behaviour documented by Apple)
- Evidence: the previous track is hard-`pause()`d (`GlobalAudioPlayer.tsx:202-206`); ramps use `setInterval` 20 ms × 5 (:187-197, :272-280); on iOS, `HTMLMediaElement.volume` is read-only, so the 0.05 → 0.35 ramp does nothing and playback is at full volume.
- Impact: clicks and pops on fast hover; loud previews on iOS.
- Correction: a Web Audio `GainNode` with `linearRampToValueAtTime` for both fade-out and fade-in (also works on iOS), or a short pause delay after a fade-out.
- Risk: low–medium (AudioContext unlock on the first gesture). Acceptance: no audible click on switch (recording); level matches on iOS.

**AUD-03 · `crossOrigin='anonymous'` on media without Web Audio**
- Reliability · Medium · Hypothesis (depends on CDN CORS headers)
- Evidence: `GlobalAudioPlayer.tsx:54`, `:211`. CORS mode is only needed for sample access. If the CDN omits `Access-Control-Allow-Origin` for some edge or region, playback fails.
- Correction: remove it, or keep it only if AUD-02's Web Audio routing is adopted, and then verify the headers. Acceptance: 0 media CORS errors across 50 previews (R8).

**AUD-04 · Preload queue can stall**
- Reliability · Medium · Strongly indicated
- Evidence: hover-created elements are marked `'loading'` (:216) and count toward the limit of 4; they leave `'loading'` only on `canplaythrough` or `error` (:218-229). Suspended or aborted loads may never emit either.
- Impact: the background preload stops after a sweep.
- Correction: stall timeouts, and per-element state cleared on eviction (pool LRU).
- Acceptance: after a 50-tile sweep, preloading continues within 10 s (R8).

**AUD-05 · Silent failures; no global controls**
- UX/reliability · Low · Confirmed
- Evidence: `play()` rejections are logged only in dev (`audioDebug.ts:5`); no mute or volume control, no Media Session API; Song Detail's shuffle/prev/next/repeat buttons have no `onClick` (`SongDetail.tsx:682`, `:693`, `:725`, `:736`).
- Correction: a global mute; wire or remove dead controls; surface failures. Acceptance: every visible control does something; a failed preview shows a state.

*(The unbounded hover-created pool is recorded as TRK-04.)*

---

## 11. Video and media pipeline findings

**INT-01 · Unmuted hover playback is blocked before the first user gesture; failure swallowed after reveal**
- Media/autoplay · **High** · Code Confirmed; browser outcome Strongly indicated
- Evidence: `HoverMediaBackground.tsx:288`, `:303` (`muted={false}`), `:203` (reveal), `:205` (`play()`), `:211` (full video chained on resolve), `:213-215` (swallow).
- Current: before any click or tap on the site, Chrome, Edge, Firefox and Safari reject unmuted `play()` triggered by hover. The user sees the dim overlay and a frozen first frame; the full video never starts.
- Root cause: playback started from a non-activating event with sound, and no fallback.
- Impact: the signature intro interaction can fail for first-time visitors on their very first action. Developer machines with high media engagement may never see it.
- Correction: always start muted (always allowed); reveal on `playing` / `requestVideoFrameCallback`; unmute only when `navigator.userActivation.hasBeenActive` (or after a one-time "sound on" affordance — a product decision); on rejection, retry muted.
- Risk: low; changes first-visit sound behaviour (needs a product decision).
- Depends on: none.
- Acceptance: in a fresh profile, hovering before any click shows a moving preview within the TTFF target; 0 swallowed `NotAllowedError`s (R2).

**INT-02 · Cold start on every first hover; teardown on every card change; no poster**
- Media · **High** · Confirmed
- Evidence: `HoverMediaBackground.tsx:78-102`, `:185-227`, `:250`, `:289`; no preview prefetch anywhere.
- Current: time to picture = network + demux + decoder initialisation + `canplay` + 150 ms fade. Changing cards removes the source at once, so the user sees a dim gap.
- Correction: (1) an instant poster per vibe (the tile art or the first frame, ≤40 KB) shown in the same frame as hover; (2) small preview renditions (MED-01) prefetched at idle after first paint, respecting `saveData`; (3) keep the outgoing frame visible until the incoming preview's first frame is presented (double-buffer the two elements instead of halting both).
- Risk: low–medium (more bytes at idle; gate on connection). Depends on: MED-01.
- Acceptance: poster visible ≤1 frame after `pointerenter`; preview first frame p75 ≤ 150 ms (warm) / ≤ 400 ms (cold, "Fast 4G"); no dim gap between cards (R1).

**INT-03 · Handoff is buffer-timed, seek-heavy and double-audio**
- Media · **High** · Confirmed (code and probe, §6.4)
- Evidence: `HoverMediaBackground.tsx:114-158`; keyframes per §6.4.
- Correction: either (a) a single-file design (play the full file from 0 with a small first segment, no handoff), or (b) re-encode with a forced keyframe at 3.0 s and switch on the preview playhead (`requestVideoFrameCallback` when `mediaTime ≥ 2.95`), keep exactly one unmuted source, and crossfade gain over 80–120 ms.
- Risk: medium. Depends on: MED-01/MED-02 (encoding).
- Acceptance: no audio overlap (single audible source); the frame after the switch continues the preview's content (frame comparison); dropped frames during the handoff ≤ 2 (`chrome://media-internals`, R3).

**INT-04 · Full video download starts immediately and contends with the preview**
- Network · **High** · Confirmed mechanism
- Evidence: `HoverMediaBackground.tsx:209-212`, `:160-168`; concurrent prefetch at `useChartHover.ts:37-42`, `vibeService.ts:93-101`; globe at `HeroBackgroundVideo.tsx:51`.
- Correction: start the full download only after a sustained hover (≥1.5–2 s) and after the preview is fully buffered; defer data prefetch while video is loading; pause or abort the globe download while hovering.
- Acceptance: bytes transferred for a 1 s hover ≤ preview size + 10 %; the full file is requested only after the dwell (R1 HAR).

**INT-05 · Globe video keeps decoding under the hover video, with a full-screen filter**
- GPU/decode · **High** · Confirmed mechanism
- Evidence: `HeroBackgroundVideo.tsx:16-35` (never paused on hover; the imported `useUIStore` at :6 is unused), `:45-61` (`preload="auto"`, `scale(1.85)`, `filter: contrast(1.3) brightness(1.4) saturate(1.2)`).
- Correction: pause the globe while the hover container is active; bake the colour grade into the file; poster plus deferred load.
- Acceptance: globe `paused === true` whenever hover video is visible; one fewer active decoder (`media-internals`).

**INT-10 · Hover media is never explicitly cleared on selection**
- Media/state · **High if confirmed** · Missing reset Confirmed by code; outcome Hypothesis
- Evidence: comment at `page.tsx:130` ("Immediately stop preview videos") with no corresponding code in `:137-227`; `ChangeVibeOverlay.tsx:244-247` selects and closes without clearing `hoveredVibe`; `HoverMediaBackground` is always mounted, and when active it sits at `z-index: 1` above the canvas (`HoverMediaBackground.tsx:62-68`).
- Current: clearing depends on a `pointerleave` from a card that is becoming `pointer-events: none` (`IntroScreen.tsx:803`) or being unmounted. If the browser does not deliver it (pointer kept still; node removed), the hover video and its **unmuted audio continue during loading and over the wall**, overlapping the first iTunes track that starts on click.
- Correction: on select and on overlay close, call `setHoveredVibe(null)` and halt the media explicitly; gate the engine by view.
- Risk: none. Acceptance: R9. After clicking a card and holding still for 2 s, then moving, no hover video or audio is present.

**INT-11 · Intro hover-video engine runs inside the Universe (Switch Chart)**
- Media/UX · **Medium** · Confirmed
- Evidence: `ChangeVibeOverlay.tsx:200` uses `useChartHover` → `uiStore.hoveredVibe` → `HoverMediaBackground` plays 1080p unmuted video under a 64 px backdrop blur (`:204`) while iTunes audio and WebGL keep running.
- Correction (product decision): limit hover video to the intro, or, if wanted in the overlay, duck wall audio and pause WebGL while it plays.
- Acceptance: in the Switch Chart overlay, at most one audible source at a time.

**MED-01 · Encodes far above need; single rendition; no posters**
- Media assets · **High** · Confirmed (probe)
- Evidence: §6.4; all files are H.264 High, 1080p–1440p; previews 1.70–9.31 Mbps; full 1.66–8.02 Mbps; 298 MB for one pass over all 14 cards (31.9 + 266.4 MB).
- Correction: a reproducible encode pipeline. Suggested starting point (to validate visually under the `bg-black/60` dim): previews at 720p, ~1–1.5 Mbps, ~300–600 KB, one keyframe at 0; full videos at 720p/1080p CRF-targeted 1.5–3 Mbps with a forced keyframe at 3.0 s (or a single-file design); posters (WebP/AVIF); consistent audio loudness. Optional HLS for mobile.
- Risk: visual quality (design sign-off; VMAF or a side-by-side review). Acceptance: total preview bytes ≤ 8 MB; full ≤ 60 MB for all 14; design sign-off.

**MED-02 · Irregular, long GOPs**
- Media · Medium · Confirmed. Keyframes are scene-cut driven (max gaps up to 10.42 s; e.g. *Loser* every ~10.4 s). This hurts any seek, not only the handoff. Fix with closed GOPs of 1–2 s in the pipeline (MED-01).

**MED-03 · `immutable` one-year cache on non-hashed filenames**
- Delivery · Medium · Confirmed (`next.config.ts:16-28`). A re-encode under the same name is served stale to returning users for up to a year. Fix with content-hashed names or drop `immutable`. Acceptance: re-encoded assets are visible to returning users immediately.

**MED-04 · Media committed to Git; unused media deployed**
- Repo/deploy · Medium · Confirmed. The pack is 1.16 GiB, and **cloning failed twice in this session with connection resets before succeeding**. `public/videos` ≈ 324.5 MB. Unused: `public/audio/intro/*` (17 files, ~7.8 MB, no references), `Gala Gala_30s.mp4` (14.4 MB), `Gemini Intro Video Assets/` (15 byte-identical duplicates of public files), `screenshots/` (14.6 MB, README only). Fix: object storage or CDN (or Git LFS at minimum); delete unused files. Acceptance: repo clone < 50 MB; no unreferenced deployable assets.

**MED-05 · Inconsistent encode outputs**
- Low · Confirmed. `globe.mp4` has an empty audio track; *Gala Gala* has no audio; resolutions vary (1920×788 to 1920×1440). Normalise in the pipeline.

**INT-12 · Hover preview song ≠ the song played on entry; stale manifest metadata**
- Product consistency · Low · Confirmed. `introMediaManifest.ts` labels `global-top-50` as "Blinding Lights / The Weeknd" but plays *Beat It*; entry plays the signature track "Blinding Lights" (`signatureSongs.ts:26-38`). The same mismatch exists for most cards. Decide which song represents each chart and align.

---

## 12. Bundle and asset findings

**BND-01 · three.js core in the initial bundle**
- Bundle · **High** · Confirmed (static import chain)
- Evidence: `page.tsx:20` → `atlasManager` (`import * as THREE`, `atlasManager.ts:1`); `vibeService.ts:2` imports `getOptimizedArtworkUrl` from the same module. (The earlier audit measured ~101 KB gzip of three core in the initial chunk from a production build; **not re-measured here**, since builds were out of scope.)
- Correction: move `getOptimizedArtworkUrl` to a three-free util; lazy-import `atlasManager` inside the Universe path.
- Acceptance: the initial route JS contains no `three` module (bundle analyser, R13).

**BND-02 · Render-blocking Google Fonts; unused families**
- Assets · Medium · Confirmed
- Evidence: `layout.tsx:25-28` (Prompt 300–900, Google Sans Flex 100–900, Anton, Syncopate, Space Grotesk, Inter, Syne). Usage by search: Inter (body, `layout.tsx:30`), Syne (4 files), Syncopate (3), Space Grotesk (3), Prompt (1 heading); **Google Sans Flex and Anton are unused**. No `next/font` (lint `no-page-custom-font`).
- Correction: `next/font` (self-hosted, subset, `display: swap`), only the used families and weights. Acceptance: no cross-origin render-blocking CSS; ≤ 6 font files on first load.

**BND-03 · Oversized images; `next/image` configured but unused**
- Assets · Medium · Confirmed
- Evidence: `kadence-horizontal-logo.png` **2172×724, 783 KB**, displayed at 44–52 px tall (`IntroScreen.tsx:780`, `SongDetail.tsx:456`); `kadence-chrome-logo.png` 1110×342, 230 KB; 14 tile WebPs 1024×1024 (59–85 KB) shown at ~160–190 CSS px, with `loading="lazy"` on in-viewport tiles (`IntroScreen.tsx:131`); tooltip and search thumbnails load 600 px art for 36–48 px (`page.tsx:59`, `SearchPanel.tsx:141`); `next.config.ts:4-12` image config is inert (no `next/image` usage).
- Correction: an SVG or ~20 KB WebP logo; 384–512 px tiles; 100 px or 256 px art for thumbnails; eager loading for the first 14 tiles.
- Acceptance: logo ≤ 30 KB; total intro images ≤ 400 KB.

**BND-04 · 70 KB `devSpecialData` in the client bundle**
- Bundle · Low · Confirmed. `signatureSongs.ts:2` imports the full 80-track dataset to read `[0]`; `page.tsx` and `useChartHover` import `signatureSongs`. Inline the single needed track, or lazy-load.

**BND-05 · Unused or misplaced dependencies**
- Low · Confirmed. `@react-three/drei` and `lenis` are unused (`drei` is still in `optimizePackageImports`); `@types/three` belongs in `devDependencies`.

**BND-06 · CSS injected per component instance; duplicated CSS**
- Perf/maintainability · Medium · Confirmed
- Evidence: `GlassButton.tsx:300` renders a ~6 KB `<style>` (incl. 2 `@property`) **per instance** (~25 instances with Song Detail and Search open). The 3D card CSS is duplicated in `IntroScreen.tsx:592-735` and `ChangeVibeOverlay.tsx:262-305`; `GlowingRingLoader` uses styled-jsx.
- Impact: each mount and unmount of a `<style>` invalidates document-wide styles; harder to maintain.
- Correction: move the CSS to `globals.css` or CSS modules once. Acceptance: one copy of each rule in the DOM (Elements panel).

---

## 13. Backend and API findings

**API-01 · A rate-limited search API used as a live database; no effective caching**
- Backend · **High** · Mechanism Confirmed; production behaviour Hypothesis
- Evidence: a cold chart triggers 8 parallel `limit=200` iTunes calls, or 12 + 7 fallback calls for regional charts (`musicProvider.ts:620-677`); `fetch(..., { cache: 'no-store' })` with **no timeout, retry or backoff** (`:519-553`); a per-instance `Map` cache (`app/api/songs/route.ts:6`); no `Cache-Control` on responses (`:34-39`, `:59`). **Next 16 note:** `fetch` and GET Route Handlers are uncached by default (docs cited in §2), so caching needs an explicit mechanism: route config, `use cache` + `cacheLife` in a helper (requires `cacheComponents`), and/or HTTP `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`.
- Impact: slow first loads, upstream rate limits turning into HTTP 500s, cache misses on serverless cold starts and across instances.
- Correction: short term, CDN cache headers plus an explicit Next cache, upstream `AbortSignal.timeout`, and serving stale on error. Long term (API-04), offline chart generation to static JSON.
- Acceptance: a warm chart request is served from the CDN (p95 ≤ 100 ms, R12); no 5xx when the upstream returns 403/429 (stale served).

**API-02 · `refresh=1` is an unauthenticated amplification lever**
- Backend/security · Medium · Confirmed. `route.ts:22`, `:29`, `:42-50`: any client can bypass the cache and trigger 8–19 upstream calls per request; there is no rate limit. Fix: rate limit per IP, or remove server-side refresh (rotate offline). Acceptance: refresh requests are throttled (429 after N/min/IP).

**API-03 · Over-fetch and non-deterministic payloads**
- Backend · Medium · Confirmed. `targetCount` is ignored (`musicProvider.ts:597-600`, never read); every accepted track is returned while only 256 can be displayed; random `x/y/z` (`:345-347`) and random fallback `color` (`:315-316`) make responses uncacheable by content and visuals non-reproducible. Fix: trim to ≤256 and to the fields the client uses; derive values deterministically from the track id. Acceptance: two identical requests return byte-identical JSON.

**API-04 · Regional datasets empty; generation script scrapes Spotify pages**
- Data/product · Medium · Confirmed. `lib/teluguChartData.ts`, `tamilChartData.ts` and `hindiChartData.ts` are empty arrays, so the heaviest live fallback runs (`musicProvider.ts:605-613`). `scripts/build-regional-charts.mjs:101-137` parses Spotify playlist HTML (`Spotify.Entity`), which is brittle and may conflict with the provider's terms (needs legal or product review). Fix: a sanctioned data source and an offline build with a cron.

**API-05 · Production logging in hot paths**
- Low · Confirmed. `[DIAG:route]` logs on every request (`route.ts:25-58`); a per-track rejection log for regional scoring (`musicProvider.ts:185-305`). Gate or remove.

**API-06 · Error leakage and missing limits**
- Low · Confirmed. `String(err)` is returned to clients (`route.ts:62-65`); `/api/search` has no max query length or rate limit (`search/route.ts:6-13`); the client has no abort or timeouts (`vibeService.ts:60`, `SearchPanel.tsx:41`), and errors collapse to `[]` (`vibeService.ts:69-71`). Fix: generic error bodies; validation (max length, charset); per-IP limits; `AbortController`.

**API-07 · Unused endpoints still reachable**
- Low · Confirmed. `/api/songs/top` and `/api/chart-preview` are callable by anyone and hit iTunes; only the never-imported `chartPreviewStore` references `chart-preview`. Remove both.

---

## 14. UI/UX and accessibility findings

**TRK-01 · No immediate tile hover state**
- UX/WebGL · **High** · Confirmed
- Evidence: `NodeField.tsx:51`, `:167` (declared), `:784` (written each frame), no read in either shader; dwell at `:754-759`; easing at `:772-776`.
- Correction: in the vertex or fragment shader, when `abs(aInstanceIdx − uHoverIdx) < 0.1`, raise the highlight (e.g. brightness ×1.15 plus a thin rim) on the same frame; keep the 1 s pop as the "intent" stage if desired.
- Risk: visual (design sign-off). Acceptance: the hovered tile changes appearance in the same frame as the hover change (frame-by-frame recording, R6).

**TRK-02 · Hit-test ignores the lens lift and jelly** — see §7.4. UX/WebGL · **High** · Strongly indicated. Correction in §7.6(3). Risk: low (pure math). Acceptance: across 9 screen positions (centre, edges, corners), the tooltip title equals the tile visually under the pointer in 100 % of samples (R6).

**TRK-06 · Hover keeps running under UI and while Song Detail is open; audio hijack**
- UX/correctness · **High** · Confirmed
- Evidence: window listeners (`NodeField.tsx:524-527`); `targetAudioUrl` prefers hovered over selected (`page.tsx:292-297`); the tooltip is `pointer-events-auto` with a link (`page.tsx:49`, `:79-89`).
- Current: with Song Detail open, moving the pointer anywhere, including over the panel, changes the playing preview to a hidden tile, and the panel's progress and play state then reflect that other track. Moving toward the tooltip's link changes the song shown in it.
- Correction: canvas-scoped pointer events; ignore when `event.target !== canvas`; suspend hover when detail or overlay is open; selected track wins while detail is open.
- Acceptance: with Song Detail open, 60 s of pointer movement never changes `currentUrl` (R10); the tooltip link can be clicked for the song shown.

**TRK-07 · Touch taps act on the previously hovered tile**
- Mobile/correctness · **Medium** · Strongly indicated
- Evidence: a tap's compatibility `mousemove` and `click` are dispatched back-to-back, before the next `useFrame` updates `lastHoverId`; the click handler uses `lastHoverId` (`NodeField.tsx:504-521`).
- Impact: the first tap does nothing (`onPreview(null)`); later taps open the previously tapped tile.
- Correction: compute the hit synchronously in the `pointerup` or `click` handler from the event coordinates.
- Acceptance: on a phone, tapping 10 different tiles opens each tapped tile (R11).

**TRK-08 · Smoothed lens versus raw hit-test**
- UX · Low · Confirmed (`NodeField.tsx:584-597`, `:690-691`). Intentional "honey" feel, but the visual and logical hover diverge while moving. Consider a faster follow speed near the pointer, or matching the hit-test to the same smoothed field after TRK-02.

**TRK-09 · `window` `mouseleave` listener**
- UX · Low · Strongly indicated. `NodeField.tsx:503`, `:526`: browsers generally do not dispatch `mouseleave` on `window`, so hover and audio persist after the pointer leaves the page. Use `document.documentElement` `mouseleave`, `pointerleave` on the canvas, or `mouseout` with `relatedTarget === null`.

**TRK-10 · Clicking the hidden canvas while Song Detail is open selects another song**
- UX · Medium · Confirmed. `Universe.tsx:51` closes, then the window click (`NodeField.tsx:504-516`) re-selects the tile under the pointer; because the wall fills the viewport, "click outside to close" switches songs instead. Fix with TRK-06 gating.

**INT-06 · Intro card hover CSS is paint-heavy at hover start**
- UX perf · Medium · Strongly indicated
- Evidence: `IntroScreen.tsx:643-647`, `:657-662` add `will-change` only on `:hover`, promoting and rasterising layers at the start of the animation; `box-shadow` transitions with 30–50 px blur (`:118-119`, `:655-660`); `filter` transition on a subtree with `backdrop-filter` (:140) and `mix-blend-*` (:140-152); the gloss `radial-gradient` driven by `--mx/--my` repaints on every pointer frame (:147-152, :69-74). The same patterns exist in `CreatorCueCard`/`CreatorCollectionCard` (:665-734, larger shadows) and `ChangeVibeOverlay` (:262-305).
- Correction: promote at rest, or pre-promote on grid `pointerenter`; animate the opacity of a pre-rendered glow instead of `box-shadow`; bake the static gloss and specular into the tile art; move the cursor gloss to a transformed gradient element (transform rather than background change).
- Risk: visual parity (side-by-side sign-off). Acceptance: on hover, paint time per frame ≤ 2 ms and no "Layerize/Rasterize" task > 8 ms at hover start (R4).

**INT-07 · Backdrop and blend layers over playing video** — UX perf · Medium · **Hypothesis**. 14 `backdrop-blur-[1.5px]` plus ~42 blend layers (`IntroScreen.tsx:137-152`). The opaque tile image sits under each blur, so damage tracking may avoid re-evaluation (the earlier roadmap's AC-3). Measure (R4); if costly, bake into the art.

**INT-08 · Whole-tree render per intro hover; wasted glow mount**
- React · Medium · Confirmed. `page.tsx:117`; `IntroScreen.tsx:581`, `:746-762`, `:865`. Fixed by RCT-01 plus `memo`/stable callbacks for `CreatorCueCard`, and one persistent glow whose colour is crossfaded.

**INT-09 · `MagneticChromeText` layout read on every `mousemove`**
- Perf · Medium · Confirmed (`IntroScreen.tsx:506-531`). Use rAF throttling, a rect cached on resize or scroll, and skip when off-screen (`IntersectionObserver`).

**INT-13 · Touch/hover capability not considered**
- Mobile · Low · Strongly indicated. A tap starts a preview fetch that is halted ~50 ms later; there is no `(hover: hover)` gating and no long-press alternative.

**INT-14 · Lazy loading on above-the-fold tiles** — Low · Confirmed (`IntroScreen.tsx:131`). Make all 14 eager, at a smaller size (BND-03).

**UX-01 · No accessibility layer**
- Accessibility · **High** · Confirmed
- Evidence: **0 `aria-*`/`role` attributes** in the app; `outline-none` on 5 interactive elements with no `focus-visible` replacement (`IntroScreen.tsx:116`, `:256`, `:392`; `ChangeVibeOverlay.tsx:119`; `SearchPanel.tsx:100`); the WebGL wall has no keyboard or screen-reader path to tracks (WCAG 2.1.1); dead controls (intro DISCOVER/SEARCH/LIBRARY/profile, `IntroScreen.tsx:785-796`; Song Detail transport, AUD-05); icon buttons rely on `title`; the search input has no label.
- Correction: a visible focus ring; labels; an accessible, keyboard-navigable track list mirroring the wall (it can be visually hidden or offered as a "list view"); wire or remove dead controls.
- Acceptance: an axe scan with 0 serious or critical issues; every track reachable and playable by keyboard; screen-reader announcement of the hovered or focused track.

**UX-02 · No reduced-motion or autoplay controls**
- Accessibility · **High** · Confirmed
- Evidence: no `prefers-reduced-motion` handling anywhere; the globe loops indefinitely with no pause (WCAG 2.2.2); hover-triggered audio and video with sound; parallax, jelly, magnetic and particle motion everywhere.
- Correction: a reduced-motion mode (static poster, no jelly or parallax or particles, crossfades only); a global pause and mute.
- Acceptance: with `prefers-reduced-motion: reduce`, no autoplaying video and no continuous motion (manual check).

**UX-03 · Song Detail drawer: CSS transition fighting the spring**
- UX · Medium · Confirmed. `SongDetail.tsx:489` `transition-all duration-700` plus the overshoot curve at `:492` on an element animated by framer-motion. Each frame framer writes is re-transitioned over 700 ms, giving a rubbery lag. Remove the CSS transition and tune the spring to the approved feel (design sign-off). Acceptance: the drawer follows the spring; open completes within the spring's settle time.

**UX-04 · Responsive gaps**
- UX · Medium · Hypothesis (needs viewport testing). Fixed `left-[400px]` overlays (`SongDetail.tsx:454`, `:466`; `EditorialOverlay.tsx:8`) on screens narrower than ~760 px; the centred search trigger (`SearchPanel.tsx:61`) and right-aligned Navbar buttons likely overlap on narrow widths; `html, body { overflow: hidden }` (`globals.css:7-12`). Test at 360, 768 and 1280 px.

**UX-05 · Loading, empty and error states**
- UX · Medium · Confirmed. API errors collapse to `[]`, so the intro completes into an empty universe with no message (`page.tsx:172-177`, `:220-225`; `vibeService.ts:69-71`); search errors show "No results" (`SearchPanel.tsx:45-47`, `:159-161`); there are no retry affordances. Add explicit error states with retry.

**UX-06 · Component and design-system consistency**
- Maintainability/UX · Low · Confirmed. Three copies of the magnetic-tilt handler (`IntroScreen.tsx:36-93`, `:177-234`, `:316-373`; `ChangeVibeOverlay.tsx:39-96`); colours and shadows inline everywhere; no design tokens; the tooltip's "Open in iTunes" uses a play icon (`page.tsx:86-88`). Extract a `useMagneticTilt` hook and tokens; preserve visuals.

---

## 15. Security and reliability findings

**SEC-01 · Open server-side proxy with content-type pass-through on the app origin**
- Security · **High** (Critical if authentication, cookies or user data are introduced) · Confirmed by code
- Evidence: `app/api/proxy/route.ts:5`, `:15` (`fetch(url)` with an arbitrary user URL: no scheme, host or IP allow-list), `:25-32` (returns the body with the **upstream `content-type`**, `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=31536000, immutable`), `:39-46`. **Not used by the app** (no references).
- Current: anyone can make the server fetch any URL (SSRF toward whatever the hosting network can reach); anyone can serve arbitrary `text/html` or JS **from the KADENCE origin** via a crafted link (content injection and phishing under the app's domain); responses may be cached for a year by intermediaries; bandwidth abuse.
- Correction: **delete the route.** If a proxy is ever needed, allow-list hosts, force image content-types, cap size, and use a short cache.
- Risk: none (unused). Depends on: none.
- Acceptance: `GET /api/proxy?url=…` returns 404 in production.

**SEC-02 · `next@16.2.6` critical advisory and vulnerable transitive dependencies**
- Security · **Medium** in practice (no middleware or proxy file, no Server Actions) · Confirmed (`npm audit`)
- Correction: upgrade to `next ≥ 16.4.6` and refresh the lockfile in a dedicated PR with the regression checklist (§23).
- Acceptance: `npm audit` shows 0 critical and 0 high for runtime dependencies.

**SEC-03 · No error boundaries**
- Reliability · Medium · Confirmed. `app/` contains only `layout.tsx`, `page.tsx` and `api/` (no `error.tsx` or `global-error.tsx`; no `ErrorBoundary` in source). Any render error, such as a WebGL creation failure, blanks the whole single-route app. Add route-level boundaries and a canvas-level boundary with fallback. Acceptance: a forced throw in `NodeField` shows the fallback while the intro and Song Detail remain usable.

**SEC-04 · No security headers**
- Security · Medium · Confirmed. `next.config.ts:16-28` only sets video caching. Add CSP (start in Report-Only; allow-list `itunes`/`mzstatic`/`scdn`/fonts), `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` and `X-Content-Type-Options`. Acceptance: headers present; no CSP violations in normal use.

**SEC-05 · No rate limiting; minimal input validation**
- Security/cost · Medium · Confirmed. Covered by API-02 and API-06. `/api/songs` validates `vibe` against an allow-list (good).

**SEC-06 · Media and network failures are invisible**
- Reliability · Low · Confirmed. Swallowed `play()` errors (`HoverMediaBackground.tsx:154-156`, `:213-215`), errors become `[]`, and there is no telemetry or RUM. Add `web-vitals` and error reporting (vendor is a product decision).

**SEC-07 · Repository hygiene**
- Low · Confirmed. **No secrets are committed**: `kadence_audit.js:5-6` reads Spotify credentials from the environment with placeholders, and `.env*` is git-ignored with none present. Other items: a hard-coded absolute developer-machine path in `scripts/build-dev-special.ts:4`; a UTF-16 diff artefact (`song_detail_diff.txt`); `kadence_audit.js` at the repo root. Move the scripts under `scripts/` with relative inputs and remove the artefacts.

---

## 16. Consolidated findings register

Fix-task IDs refer to §20.

| ID | Category | Sev. | Confidence | Primary location | Summary | Fix |
|---|---|---|---|---|---|---|
| RCT-01 | React/state | **Critical** | Confirmed | `page.tsx:117-119`; `GlobalAudioPlayer.tsx:13-21,124-132`; `SongDetail.tsx:407` | 8 Hz full-tree re-render loop | P0-2, P0-3 |
| TRK-03 | React/hover | **Critical** | Confirmed | `NodeField.tsx:741-751`; `page.tsx:292-304` | ≥3 full-tree renders per tile change, 2 inside the frame | P0-2, P0-4 |
| GL-01 | WebGL/GPU | **Critical** | Count Confirmed / cost Hypothesis | `NodeField.tsx:313-356,543-553`; `atlasManager.ts` | Duplicate loaders; 64 MiB full re-uploads | P0-8, P1-6 |
| SEC-01 | Security | **High** | Confirmed | `api/proxy/route.ts` | Open proxy, SSRF, same-origin content injection | P0-1 |
| TRK-01 | UX/WebGL | **High** | Confirmed | `NodeField.tsx:51,167,754-784` | No instant tile hover state; `uHoverIdx` unused | P1-1 |
| TRK-02 | UX/WebGL | **High** | Strongly indicated | `NodeField.tsx:111-124,568-739` | Hit-test off by 0.5–2 tiles off-centre | P1-2 |
| TRK-04 | Audio | **High** | Confirmed | `GlobalAudioPlayer.tsx:85,109-120,202-234` | No dwell; unbounded, un-evicted pool; hard cut | P0-4, P1-4 |
| TRK-06 | UX/correctness | **High** | Confirmed | `NodeField.tsx:524-527`; `page.tsx:292-297` | Hover under UI and Song Detail hijacks audio | P0-4, P1-3 |
| INT-01 | Media/autoplay | **High** | Confirmed / Strongly indicated | `HoverMediaBackground.tsx:203-215,288,303` | Unmuted hover playback blocked; frozen frame | P0-6 |
| INT-02 | Media | **High** | Confirmed | `HoverMediaBackground.tsx:78-102,185-227` | Cold start, teardown gaps, no poster | P1-8 |
| INT-03 | Media | **High** | Confirmed | `HoverMediaBackground.tsx:114-158`; probe | Buffer-timed, seek-heavy handoff; double audio | P1-9 |
| INT-04 | Network | **High** | Confirmed mechanism | `HoverMediaBackground.tsx:209-212` | Full download contends with preview | P1-8 |
| INT-05 | GPU/decode | **High** | Confirmed mechanism | `HeroBackgroundVideo.tsx:16-61` | Globe decodes and filters under hover video | P1-8 (quick win) |
| INT-10 | Media/state | **High (if confirmed)** | Code Confirmed / outcome Hypothesis | `page.tsx:130,137-227`; `ChangeVibeOverlay.tsx:244-247` | Hover media never cleared on selection | P0-5 |
| GL-02 | WebGL/GPU | **High** | Confirmed mechanism | `Universe.tsx:36`; `page.tsx:336-343` | Ungated frame loop; blur over live canvas | P0-7 |
| AUD-01 | Audio/network | **High** | Confirmed mechanism | `GlobalAudioPlayer.tsx:35-55,85` | 20 full preloads; leaky limiter | P1-4 |
| MED-01 | Media assets | **High** | Confirmed | `public/videos/*` | Over-encoded 1080p–1440p; 298 MB per tour | P1-8 |
| BND-01 | Bundle | **High** | Confirmed | `page.tsx:20`; `vibeService.ts:2` | three core in initial bundle | P1-12 |
| API-01 | Backend | **High** | Confirmed mechanism | `musicProvider.ts:519-677`; `api/songs/route.ts` | Live rate-limited upstream; no effective cache | P1-11, P2-10 |
| RCT-02 | Architecture | **High** | Confirmed | `app/page.tsx` | Monolithic client root; unstable props | P2-11 |
| UX-01 | Accessibility | **High** | Confirmed | app-wide | No ARIA, focus, or keyboard path to tracks | P2-7 |
| UX-02 | Accessibility | **High** | Confirmed | app-wide | No reduced-motion or autoplay controls | P2-7 |
| ARC-01 | Architecture | **High** | Confirmed | §17 RC-2 | No single owner of media and network priority | P1-4, P1-8, P2-11 |
| INT-06 | UX perf | Medium | Strongly indicated | `IntroScreen.tsx:118-152,636-662` | `will-change` at hover start, shadow/filter/gradient repaint | P2-3 |
| INT-07 | UX perf | Medium | Hypothesis | `IntroScreen.tsx:137-152` | Backdrop and blend layers over video | P2-3 (gated) |
| INT-08 | React | Medium | Confirmed | `page.tsx:117`; `IntroScreen.tsx:746-762,865` | Whole-tree render per intro hover | P0-2, P2-3 |
| INT-09 | Perf | Medium | Confirmed | `IntroScreen.tsx:506-531` | Layout read per `mousemove` | P2-3 |
| INT-11 | Media/UX | Medium | Confirmed | `ChangeVibeOverlay.tsx:200,204` | Hover video inside Universe overlay | P0-5 |
| TRK-05 | Network/UX | Medium | Confirmed | `page.tsx:36-95` | Tooltip loads 600 px art; blank swap; backdrop blur | P1-5 |
| TRK-07 | Mobile | Medium | Strongly indicated | `NodeField.tsx:504-521` | Tap acts on previous tile | P1-3 |
| TRK-10 | UX | Medium | Confirmed | `Universe.tsx:51`; `NodeField.tsx:504-516` | Click-outside selects another song | P1-3 |
| GL-03 | WebGL | Medium | Confirmed race | `NodeField.tsx:319-332`; `page.tsx:249-255` | Stale artwork / blank slots on switch | P0-8 |
| GL-04 | WebGL | Medium | Confirmed | `NodeField.tsx:361-425,796-801` | Mesh rebuilt; geometry leaked | P1-7 |
| GL-05 | WebGL | Medium | Strongly indicated | `atlasManager.ts:54-58`; shader | No mipmaps; discard; DPR | P3-5 |
| GL-06 | Reliability | Medium | Confirmed | `NodeField.tsx:449`; repo-wide | No WebGL2 check, context-loss, fallback | P2-6 |
| RCT-03 | State | Medium | Confirmed | stores | Dead and latent state | P3-1 |
| RCT-04 | React/bundle | Medium | Confirmed | `page.tsx:26-29,344` | Canvas and chunk created on intro | P1-12 |
| RCT-05 | React/WebGL | Medium | Confirmed | `page.tsx:305-316`; `SearchPanel.tsx:37-50` | Search rebuilds wall; no abort; invisible results | P1-10 |
| AUD-02 | Audio | Medium | Confirmed | `GlobalAudioPlayer.tsx:187-206,272-280` | Hard cuts; coarse ramps; iOS volume ignored | P1-4 |
| AUD-03 | Reliability | Medium | Hypothesis | `GlobalAudioPlayer.tsx:54,211` | Unneeded CORS mode | P1-4 |
| AUD-04 | Reliability | Medium | Strongly indicated | `GlobalAudioPlayer.tsx:216-229` | Preload queue can stall | P1-4 |
| MED-02 | Media | Medium | Confirmed | probe | Long, irregular GOPs | P1-8 |
| MED-03 | Delivery | Medium | Confirmed | `next.config.ts:16-28` | `immutable` on unhashed names | P3-2 |
| MED-04 | Repo/deploy | Medium | Confirmed | `public/`, repo | 1.16 GiB pack; unused media | P3-1, P3-2 |
| BND-02 | Assets | Medium | Confirmed | `layout.tsx:25-28` | Blocking fonts; 2 unused families | P2-4 |
| BND-03 | Assets | Medium | Confirmed | `public/*.png`, tiles | Oversized images | P2-5 |
| BND-06 | Perf/maint. | Medium | Confirmed | `GlassButton.tsx:300` | Per-instance `<style>` injection | P2-2 |
| API-02 | Backend/sec. | Medium | Confirmed | `api/songs/route.ts:22-50` | Refresh amplification | P1-11 |
| API-03 | Backend | Medium | Confirmed | `musicProvider.ts:315-351,597-600` | Over-fetch; random payloads | P1-11 |
| API-04 | Data | Medium | Confirmed | `lib/*ChartData.ts`; build script | Empty regional data; scraping | P2-10 |
| UX-03 | UX | Medium | Confirmed | `SongDetail.tsx:489-492` | Drawer transition conflict | P2-1 |
| UX-04 | UX | Medium | Hypothesis | `SongDetail.tsx:454,466`; `EditorialOverlay.tsx:8` | Narrow-viewport overlap | P3-6 |
| UX-05 | UX | Medium | Confirmed | `page.tsx:172-177`; `vibeService.ts:69-71` | No error, empty or retry states | P3-7 |
| SEC-02 | Security | Medium | Confirmed | lockfile | Next critical advisory (limited exposure) | P2-8 |
| SEC-03 | Reliability | Medium | Confirmed | `app/` | No error boundaries | P2-6 |
| SEC-04 | Security | Medium | Confirmed | `next.config.ts` | No security headers | P2-9 |
| SEC-05 | Security | Medium | Confirmed | API routes | No rate limits | P2-9 |
| ARC-02 | Architecture | Medium | Confirmed | various | Duplicated subsystems; dead modules | P3-1 |
| ARC-03 | Process | Medium | Confirmed | repo | No tests, CI or budgets; 36 lint errors | P3-3 |
| SD-01 | Perf | Medium | Confirmed mechanism | `SongDetail.tsx:12-63,176-181,260-264,497-504,651-665` | SVG turbulence filter; 8 Hz forced layout; width transitions | P2-1 |
| GL-07 | Compat | Low | Strongly indicated | `jellyField.ts:76-86` | Float linear filtering extension | P3-5 |
| GL-08 | Perf | Low | Confirmed | `NodeField.tsx:341-356`; `jellyField.ts` | Per-frame waste | P0-8, P3-5 |
| GL-09 | Correctness | Low | Confirmed | `NodeField.tsx:84,786-792` | Wrong selected-tile index | P3-5 |
| TRK-08 | UX | Low | Confirmed | `NodeField.tsx:584-597` | Smoothed lens versus raw hit-test | P1-2 |
| TRK-09 | UX | Low | Strongly indicated | `NodeField.tsx:503,526` | `window` `mouseleave` never fires | P1-3 |
| INT-12 | Product | Low | Confirmed | `introMediaManifest.ts`; `signatureSongs.ts` | Hover song ≠ entry song | P3-5 |
| INT-13 | Mobile | Low | Strongly indicated | `IntroScreen.tsx:108-110` | Tap triggers wasted preview fetch | P1-8 |
| INT-14 | Assets | Low | Confirmed | `IntroScreen.tsx:131` | Lazy above-the-fold tiles | P2-5 |
| MED-05 | Media | Low | Confirmed | probe | Inconsistent encodes | P1-8 |
| AUD-05 | UX | Low | Confirmed | `SongDetail.tsx:682-744` | Silent failures; dead controls | P2-1, P2-7 |
| BND-04 | Bundle | Low | Confirmed | `signatureSongs.ts:2` | 70 KB dataset bundled | P1-12 |
| BND-05 | Deps | Low | Confirmed | `package.json` | Unused or misplaced deps | P3-1 |
| API-05 | Backend | Low | Confirmed | `route.ts`; `musicProvider.ts` | Hot-path logging | P1-11 |
| API-06 | Backend/sec. | Low | Confirmed | API routes; `vibeService.ts` | Error leakage; no limits or abort | P1-10, P1-11 |
| API-07 | Backend | Low | Confirmed | `api/songs/top`, `api/chart-preview` | Dead endpoints reachable | P0-1 |
| RCT-06 | Maintainability | Low | Confirmed | eslint | 36 errors | P3-3 |
| RCT-07 | Reliability | Low | Confirmed | `layout.tsx:21,30` | Hydration warnings suppressed | P3-5 |
| UX-06 | Maint./UX | Low | Confirmed | various | Duplicate tilt logic; no tokens | P3-1 |
| SEC-06 | Reliability | Low | Confirmed | various | No telemetry | P3-4 |
| SEC-07 | Hygiene | Low | Confirmed | scripts, root files | Absolute path; artefacts | P3-1 |

*SD-01 detail.* `SongDetail.tsx:12-63` and `:497-504` apply `feTurbulence → feGaussianBlur → feSpecularLighting → feDisplacementMap(scale 200)` together with `backdropFilter: blur(3px)` on a ~360 × viewport-height layer. SVG reference filters are generally rasterised on the CPU (hypothesis on cost, R4). `:176-181` reads `getBoundingClientRect()` on every progress tick (8 Hz forced layout). `:260-264` uses `transition-all` on a `width` that changes every 125 ms. `:547-560` animates `filter: blur()` on the image. `:651-665` recomputes 40 bars' colour and shadow per render. Correction: a static pre-rendered glass texture or a plain backdrop blur; a transform-based progress bar driven by the transient channel; a rect cached on resize.

---

## 17. Critical root causes

| # | Root cause | Findings it produces |
|---|---|---|
| RC-1 | **High-frequency state flows through a monolithic React root via whole-store subscriptions.** Progress at 8 Hz and per-tile hover drive full-tree renders, some of them inside the WebGL frame. | RCT-01, TRK-03, RCT-02, INT-08, SD-01 |
| RC-2 | **No single owner of media and network priority.** Audio pool, hover video, globe, two artwork loaders and the data prefetch schedule independently with separate or no limits and no cancellation policy. | TRK-04, AUD-01, AUD-04, INT-04, INT-05, GL-01, GL-03 |
| RC-3 | **Rendering and media are never gated by visibility or view.** WebGL always on, globe never paused, hover-video engine global, hover input global. | GL-02, INT-05, INT-10, INT-11, TRK-06, TRK-10 |
| RC-4 | **Interaction feedback depends on slow pipelines instead of instant local state.** No tile highlight, no posters, cold decoders, network-bound audio, hit-test not matched to what is drawn. | TRK-01, TRK-02, INT-02, INT-03 |
| RC-5 | **Compositor-hostile effects over constantly changing pixels.** `backdrop-filter`, blend modes, SVG filters, animated `box-shadow`/`filter` over video and WebGL; per-instance CSS injection. | INT-06, INT-07, SD-01, BND-06, GL-02 |
| RC-6 | **Media authored for quality rather than delivery.** Single high-bitrate 1080p–1440p rendition, irregular GOPs, unmuted autoplay, stored in Git. | MED-01–05, INT-01, INT-03 |
| RC-7 | **A third-party search API used as a live database** with per-instance memory caching. | API-01–04 |
| RC-8 | **No safety nets.** No error boundaries, fallbacks, telemetry, tests or accessibility layer. | SEC-03, GL-06, SEC-06, ARC-03, UX-01, UX-02 |

---

## 18. Existing architecture assessment

**Strengths (keep these):**

- Per-frame state lives in refs; scratch objects are pre-allocated.
- One instanced draw call for the whole wall; a single texture atlas; O(1) lookup maps.
- A monotonic session counter guards stale video callbacks.
- rAF-throttled tilt handlers on cards.
- In-flight request deduplication and a TTL cache in `vibeService`.
- Faststart MP4s.
- First-track audio is started inside the click gesture, which is correct for autoplay.
- Strict TypeScript passes.
- The visual identity is distinctive and coherent.

**Weaknesses:**

- **Poor separation.** `Home` is page, router, data orchestrator, audio bridge and layout at once.
- **Overloaded components.** `NodeField` combines loading, input, physics, hit-testing, uniform management and a second texture pipeline. `IntroScreen` is ~940 lines with three copies of the tilt logic and an injected stylesheet. `SongDetail` is ~800 lines.
- **Tight coupling.** The UI store drives media (`hoveredVibe` → video engine in any view); the song store drives audio via a root effect; data services import three.js.
- **Duplicated logic.** Two artwork loaders, three tilt implementations, duplicated CSS, a legacy `WallGrid`, a dead `MagneticGlassCard`.
- **Fragile global state.** Transient values sit in render state, and there are dead fields.
- **Incorrect abstractions.** The proxy route; a preview "layer" whose video code is dead; a `performanceStore` that is never written.

**Options evaluation:**

| Option | Verdict | Reasoning |
|---|---|---|
| A. Targeted optimisation only | **Insufficient** | Quick wins (selectors, gating, muted-first, proxy removal) give large gains. But RC-2 (media and network ownership), RC-4 (feedback design and hit-testing) and RC-7 (data path) need new components, not tweaks. |
| **B. Significant refactoring of selected subsystems** | **Recommended** | Each root cause maps to a bounded subsystem: state topology, wall input and atlas, media orchestration, data pipeline, safety nets. Each can be changed behind the current UI in small PRs with visual parity checks. |
| C. Redesign of major subsystems | Partly, inside B | Media orchestration (one scheduler, poster-first, single-source handoff, re-encode) and the chart-data pipeline (offline or static) warrant redesign-level change. The UI, WebGL renderer and visual design do not. |
| D. Full rebuild | **Not justified** | The repo is ~33 source modules. The expensive, distinctive parts (shader, physics feel, card art direction) are sound. A rebuild would risk losing the tuned look and delay fixes that are mostly small. |

---

## 19. Recommended architecture improvements

```
app/page.tsx (thin shell: view switch only, no high-frequency subscriptions)
├── IntroView         ← hover state local to view; IntroMediaController (poster-first, muted-first, single-source)
├── UniverseView      ← WallEngine (imperative): input (canvas-scoped) → hit-test (lens-aware) → shader state
│                        ArtworkPipeline (sole atlas owner; per-slot uploads; generation tokens)
│                        frameloop gated by ViewVisibility
├── DetailView / SearchView / SwitchChartView (overlay-local state)
└── Leaf subscribers only: Tooltip, ProgressBar, PlayButton (transient channel via subscribe/rAF)

Services (non-React, module singletons):
  MediaScheduler  — one priority queue + budget for audio/video/artwork/data
                    (current > hovered > neighbours > background), cancellation, stall timeouts
  AudioDirector   — subscribes to hover/selection with dwell; LRU element pool (8–12); GainNode fades
  ViewVisibility  — single source of truth: intro | wall | detail | overlay | hidden
Data:
  Static chart JSON (offline-generated, hashed, CDN-cached) → /api/search only remains dynamic (cached, limited)
Safety:
  Route + canvas error boundaries · WebGL2/context-loss fallback · RUM + error reporting · CI budgets · a11y list view
```

Principles:

1. React renders **structure**, not frames or progress.
2. **One owner per scarce resource** (network, decoders, GPU uploads, audio output).
3. **Instant local feedback first**, then progressively richer media.
4. **Gate everything by visibility.**
5. **Preserve the visual design**, verified by side-by-side recordings.

---

## 20. Prioritised remediation roadmap (P0–P3)

> Format per task: **Finding(s)** · **Files** · **Change** · **Benefit** · **Complexity (S ≤ 1 day, M ≤ 3 days, L > 3 days)** · **Regression risk** · **Depends on** · **Verify**.

### P0 — Critical issues (do first; mostly small)

**P0-1 Remove the open proxy and dead upstream routes.**
- Findings: SEC-01, API-07.
- Files: `app/api/proxy/route.ts`, `app/api/songs/top/route.ts`, `app/api/chart-preview/route.ts`, `store/chartPreviewStore.ts`.
- Change: delete them.
- Benefit: closes SSRF and content injection; stops unauthenticated upstream calls.
- Complexity: S. Risk: none (unused).
- Depends on: —.
- Verify: 404s; repo search shows no references; app smoke test.

**P0-2 Selector-only store subscriptions.**
- Findings: RCT-01, TRK-03, INT-08.
- Files: `app/page.tsx:117-119`, `components/ui/SongDetail.tsx:407`, `components/GlobalAudioPlayer.tsx:13-21`.
- Change: select only the fields used; read actions via `getState()`.
- Benefit: removes most full-tree renders.
- Complexity: S. Risk: low (stale-closure review).
- Depends on: —.
- Verify: React Profiler (R5), with `Home` commits during 10 s of idle playback reduced to only those caused by progress until P0-3 lands.

**P0-3 Move progress to a transient channel.**
- Findings: RCT-01, SD-01.
- Files: `store/audioStore.ts`, `GlobalAudioPlayer.tsx:124-132`, `SongDetail.tsx` (`LiquidScrubber`, waveform).
- Change: a separate tiny store or ref updated by rAF; leaf components subscribe; transform-based bar; rect cached on resize.
- Benefit: eliminates the 8 Hz loop and forced layout.
- Complexity: M. Risk: low–medium (scrubber behaviour).
- Depends on: P0-2.
- Verify: 0 `Home` commits during playback; 0 forced layouts per tick (Performance panel).

**P0-4 AudioDirector: hover→audio outside React, with dwell and gating.**
- Findings: TRK-03, TRK-04, TRK-06.
- Files: `app/page.tsx:292-304` (remove); new `lib/audioDirector.ts` (or inside `GlobalAudioPlayer`); `NodeField.tsx` (hover writes only when the wall is interactive).
- Change: `useSongStore.subscribe` → dwell of 120–180 ms (product decision) → `playUrl`; selected track wins while detail is open.
- Benefit: ≤1 leaf commit per tile change; no audio storms; no hijack.
- Complexity: S–M. Risk: low.
- Depends on: P0-2.
- Verify: R5, R10, R8 counters.

**P0-5 Explicitly clear hover media; gate the engine by view.**
- Findings: INT-10, INT-11.
- Files: `IntroScreen.tsx` (`handleVibeSelect`), `ChangeVibeOverlay.tsx:244-247` and close, `hooks/useChartHover.ts` (expose reset), `HoverMediaBackground.tsx` (gate by `introComplete`, or by the decision on the overlay).
- Benefit: no lingering video or audio.
- Complexity: S. Risk: none.
- Depends on: product decision on the overlay.
- Verify: R9.

**P0-6 Muted-first hover playback; reveal on first presented frame.**
- Findings: INT-01.
- Files: `HoverMediaBackground.tsx:200-227`, `:285-313`.
- Change: `muted` by default, unmuted if `navigator.userActivation.hasBeenActive`; reveal on `playing` / `requestVideoFrameCallback`; on rejection, retry muted.
- Benefit: previews work for first-time visitors.
- Complexity: S. Risk: low (sound-policy decision).
- Depends on: —.
- Verify: R2.

**P0-7 Gate the WebGL loop; replace the canvas blur.**
- Findings: GL-02.
- Files: `Universe.tsx:36`, `app/page.tsx:336-343`.
- Change: `frameloop` = `'never'` while detail or overlay is open or the document is hidden; opacity-only wrapper animation.
- Benefit: large GPU savings in Song Detail, Search and Switch Chart.
- Complexity: S. Risk: low.
- Depends on: —.
- Verify: R7 frame counter = 0 while detail is open.

**P0-8 Single artwork loader.**
- Findings: GL-01 (part), GL-03, GL-08.
- Files: `NodeField.tsx:300-356`, `:543-553`; `app/page.tsx:185`, `:249-256` (ordering); `lib/atlasManager.ts` (generation token).
- Benefit: halves image requests and decodes; removes the per-frame flushes; fixes the race.
- Complexity: M. Risk: medium (visual fill order).
- Depends on: —.
- Verify: R7 upload counter; chart-switch visual check.

### P1 — Major performance and architecture issues

**P1-1 Instant tile hover highlight (`uHoverIdx`).**
- Findings: TRK-01. Files: `NodeField.tsx` shaders.
- Complexity: S. Risk: visual (sign-off). Depends on: —.
- Verify: R6 frame recording.

**P1-2 Lens-aware hit-testing.**
- Findings: TRK-02, TRK-08. Files: `NodeField.tsx:686-739` plus a shared displacement helper mirroring the shader.
- Complexity: M. Risk: low. Depends on: —.
- Verify: R6 accuracy grid (100 %).

**P1-3 Canvas-scoped input; touch-correct selection; detail and overlay gating.**
- Findings: TRK-06, TRK-07, TRK-09, TRK-10. Files: `NodeField.tsx:484-534`, `Universe.tsx:51`.
- Complexity: M. Risk: medium (interaction feel). Depends on: P0-4.
- Verify: R10, R11.

**P1-4 Bounded audio system.**
- Findings: TRK-04, AUD-01–04. Files: `GlobalAudioPlayer.tsx`, `audioStore.ts`.
- Change: LRU pool of 8–12 elements; one queue with stall timeouts; `preload='metadata'` for neighbours; `GainNode` fades; no `crossOrigin` unless Web Audio is used (then verify CORS).
- Complexity: M. Risk: medium (iOS unlock). Depends on: P0-4.
- Verify: R8 (element count ≤ 12 after a 60 s sweep; no stalls).

**P1-5 Tooltip artwork and transition.**
- Findings: TRK-05. Files: `app/page.tsx:36-95`.
- Change: 100 px or 256 px URL; keep the previous image until the next one loads (key by id); static background instead of `backdrop-blur`.
- Complexity: S. Risk: visual (sign-off).
- Verify: Network panel shows no 600 px requests on hover.

**P1-6 Per-slot atlas uploads.**
- Findings: GL-01. Files: `lib/atlasManager.ts`, `NodeField.tsx` (texture).
- Change: `createImageBitmap` resize → `texSubImage2D` / `copyTextureToTexture`; append-only slots.
- Complexity: L. Risk: medium. Depends on: P0-8; gated on R7 if phase 1 already meets targets.
- Verify: R7.

**P1-7 Stable instanced geometry.**
- Findings: GL-04, RCT-05. Files: `NodeField.tsx:361-425`, `:796-801`.
- Change: allocate for the max count; update attributes in place; dispose on unmount.
- Complexity: M. Risk: low–medium. Depends on: P0-8.
- Verify: `renderer.info.memory` stable across searches.

**P1-8 Intro media delivery.**
- Findings: INT-02, INT-04, INT-05, INT-13, MED-01, MED-02, MED-05.
- Files: `HoverMediaBackground.tsx`, `HeroBackgroundVideo.tsx`, `lib/introMediaManifest.ts`, `public/videos/*` (new renditions and posters).
- Change: posters shown instantly; small preview renditions prefetched at idle (respect `saveData`); double-buffered elements (no dim gap); full download only after a sustained hover; pause the globe while hover is active; `(hover: hover)` gating.
- Complexity: M (code) + L (encode pipeline). Risk: visual quality (sign-off).
- Depends on: an encode decision.
- Verify: R1, R3.

**P1-9 Single-source, playhead-aligned handoff (or single-file design).**
- Findings: INT-03. Files: `HoverMediaBackground.tsx:105-182`.
- Complexity: M. Risk: medium. Depends on: P1-8 encoding (keyframe at 3.0 s) or a decision for single-file.
- Verify: R3.

**P1-10 Search hygiene.**
- Findings: RCT-05, API-06. Files: `SearchPanel.tsx`, `app/page.tsx:305-316`.
- Change: `AbortController`; results stay in the panel; append-only merge if desired.
- Complexity: S–M. Risk: product (whether search should change the wall).
- Verify: 0 atlas uploads per search.

**P1-11 Backend caching and hygiene.**
- Findings: API-01, API-02, API-03, API-05, API-06.
- Files: `app/api/songs/route.ts`, `app/api/search/route.ts`, `lib/musicProvider.ts`.
- Change: `Cache-Control: public, s-maxage, stale-while-revalidate`; an explicit Next 16 cache (route config or `use cache` + `cacheLife`; consult `node_modules/next/dist/docs` before coding, per `AGENTS.md`); `AbortSignal.timeout`; serve stale on upstream error; rate-limit `refresh`; trim payloads; deterministic values; strip logs.
- Complexity: M. Risk: low–medium.
- Verify: R12.

**P1-12 Initial bundle and lazy wall.**
- Findings: BND-01, RCT-04, BND-04.
- Files: `app/page.tsx:20`, `:26-29`, `:344`; `lib/vibeService.ts:2`; `lib/atlasManager.ts`; `lib/signatureSongs.ts`.
- Change: three-free URL util; mount `Universe` after selection; prefetch the chunk on hover; slim signature data.
- Complexity: M. Risk: low–medium (entry warm-up).
- Verify: bundle analyser (R13); no WebGL context on the intro.

### P2 — Important improvements

**P2-1 Song Detail.**
- Findings: UX-03, SD-01, AUD-05.
- Change: remove the drawer `transition-all`; replace the SVG filter; transient-driven scrubber; wire or remove the transport buttons.
- Complexity: S–M. Risk: visual (sign-off).

**P2-2 GlassButton.**
- Findings: BND-06.
- Change: CSS to `globals.css`; rAF and cached rect; no `backdrop-filter` over the live canvas (gated on R4).
- Complexity: S.

**P2-3 Intro card compositing.**
- Findings: INT-06–09.
- Change: `will-change` at rest or pre-promotion; glow as opacity; baked gloss; a single persistent glow; `MagneticChromeText` throttle; memo for `CreatorCueCard`.
- Complexity: M. Gated on R4. Risk: visual (sign-off).

**P2-4 Fonts via `next/font`; drop unused families and weights.**
- Findings: BND-02. Complexity: S–M.

**P2-5 Right-size images.**
- Findings: BND-03, INT-14.
- Change: logo as SVG or WebP; 384–512 px tiles; eager loading for the first 14.
- Complexity: S.

**P2-6 Error boundaries and WebGL resilience.**
- Findings: SEC-03, GL-06.
- Change: `app/error.tsx`, `app/global-error.tsx`, a canvas boundary, a WebGL2 check with a static fallback, context-loss handlers.
- Complexity: M.

**P2-7 Accessibility baseline.**
- Findings: UX-01, UX-02, AUD-05.
- Change: focus-visible, labels, a keyboard track list, reduced-motion mode, global pause and mute.
- Complexity: M–L. Risk: visual additions (sign-off).

**P2-8 Upgrade `next` (≥ 16.4.6) and refresh the lockfile.**
- Findings: SEC-02.
- Complexity: S–M. Risk: medium (framework upgrade; run §23 checks).

**P2-9 Security headers and API rate limiting.**
- Findings: SEC-04, SEC-05.
- Change: CSP in Report-Only first.
- Complexity: M.

**P2-10 Static chart-data pipeline.**
- Findings: API-01, API-04.
- Change: offline generation (cron), hashed JSON on the CDN, regional datasets from a sanctioned source.
- Complexity: L. Needs decisions on freshness and sourcing.

**P2-11 Split `Home` into view modules.**
- Findings: RCT-02, ARC-01.
- Change: view-local state; `ViewVisibility` service.
- Complexity: L (split into 3–4 PRs). Depends on: P0-2–P0-5.

### P3 — Refinements and polish

**P3-1 Dead code, assets and dependencies.**
- Findings: RCT-03, ARC-02, BND-05, MED-04 (part), UX-06, SEC-07.
- Scope: `WallGrid`, `MagneticGlassCard`, `PreviewVideoLayer` video logic (keep the tint), `performanceStore`, unused `uiStore`/`songStore` fields, `public/audio/intro`, `Gala Gala`, `Gemini Intro Video Assets/`, `drei`, `lenis`, `song_detail_diff.txt`, root `kadence_audit.js` (move to `scripts/`), extract a shared `useMagneticTilt`.
- Complexity: S each (2–3 PRs).

**P3-2 Media out of Git; content-hashed media names; fix the `immutable` policy.**
- Findings: MED-03, MED-04. Complexity: M (hosting decision).

**P3-3 Quality gates.**
- Findings: ARC-03, RCT-06.
- Scope: lint to 0 errors; unit tests (audio pool invariants, atlas slot and generation logic, `vibeService` cache); a Playwright smoke test with a fresh profile (autoplay); CI budgets (bundle size, media sizes). Complexity: L (split).

**P3-4 Observability.**
- Findings: SEC-06. Scope: `web-vitals` RUM, error reporting, media failure events. Complexity: M.

**P3-5 Polish.**
- Findings: GL-05, GL-07, GL-08, GL-09, INT-12, AUD-02 (iOS), RCT-07.
- Scope: mip strategy; float-texture fallback; selected-index fix; manifest/entry-song alignment; hydration flags. Complexity: S each.

**P3-6 Responsive QA at 360, 768 and 1280 px.** Findings: UX-04. Complexity: M.

**P3-7 Error, empty and retry states.** Findings: UX-05. Complexity: S–M.

### Quick wins (≤ 1 day each, low risk, no architectural change)

- P0-1 (proxy and dead routes)
- P0-2 (selectors)
- P0-5 (clear hover media)
- P0-6 (muted-first)
- P0-7 (gate the frame loop and remove the canvas blur)
- P1-1 (`uHoverIdx` highlight)
- P1-5 (tooltip image)
- Pausing the globe during hover (from P1-8)
- Removing `crossOrigin` (from P1-4, if Web Audio is not adopted)
- Stripping hot-path logs (from P1-11)
- The drawer transition fix (from P2-1)
- P2-2 (GlassButton CSS hoist)
- P2-5 (images)
- Parts of P3-1 (dead code and assets)

### Architectural work (needs design and staged rollout)

- P0-3 and P0-4 (transient channel, AudioDirector)
- P1-2 and P1-3 (WallEngine input and hit-test)
- P1-4 (audio system)
- P1-6 and P1-7 (artwork pipeline, geometry)
- P1-8 and P1-9 (media orchestration and encode pipeline)
- P1-11 and P2-10 (data pipeline)
- P1-12 (lazy wall)
- P2-6 and P2-7 (resilience, accessibility)
- P2-11 (view split and `ViewVisibility`)
- A unified MediaScheduler (follows P1-4 and P1-8)

---

## 21. Dependencies and safe implementation order

```
Baseline (R1–R13)  ─┬─► P0-1 (independent)
                    ├─► P0-2 ─► P0-3
                    │       └─► P0-4 ─► P1-3 ─► (P1-2 can land before or after; same file: sequence PRs)
                    │                └─► P1-4 ─► MediaScheduler
                    ├─► P0-5, P0-6, P0-7 (independent, small)
                    ├─► P0-8 ─► P1-6 (gated on R7) ─► P1-7 ─► P1-10 (append-only merge)
                    ├─► P1-1 (independent shader change)
                    ├─► encode decision ─► P1-8 ─► P1-9
                    ├─► P1-11 ─► P2-10
                    └─► P1-12 (after P0-2/P0-4 to avoid page.tsx conflicts)
P2-6 before P1-12 is preferable (a canvas mounted later still needs a boundary).
P2-11 (view split) only after P0-2..P0-5 and P1-3 have stabilised the interfaces.
P2-8 (Next upgrade) in its own PR, after P0 and before P2-9 headers work.
```

**Merge rules.**

1. One task per PR.
2. Every PR carries a before/after trace or counter for its acceptance metric.
3. Visual-parity recordings for anything touching shaders, CSS effects, media or animation.
4. Put risky items behind a feature flag (P1-3, P1-6, P1-8, P1-9).
5. Do not merge P0-3 and P1-4 in the same release (both change audio timing).

**Decisions needed from the product owner** (block only the listed tasks):

- Sound on hover before the first click (P0-6)
- Dwell length for wall audio (P0-4)
- Hover video inside Switch Chart (P0-5)
- Drawer feel (P2-1)
- Encode quality bar and media hosting (P1-8, P3-2)
- Whether search should alter the wall (P1-10)
- Chart freshness and a sanctioned data source (P2-10)
- Telemetry vendor (P3-4)

---

## 22. Runtime tests and measurements still required

Static inspection cannot produce timings. Run timing measurements on a **production build in a separate clone** (`next build && next start`; not run here because the audit forbade builds) or on the deployed site. Run React counts on the dev server. Reference hardware: a mid-range integrated-GPU laptop (plus 4× CPU throttle) and a mid-range Android phone. The `origin/docs/perf-baseline` folder on the docs branch contains a fuller profiling kit; the items below add the cases it does not cover (R6, R9, R10, R11) and target the two hover problems.

| ID | What | How | Record | Decision threshold |
|---|---|---|---|---|
| R1 | Intro hover time to first frame (TTFF), cold and warm, and the dim gap | Paste snippet **S-1** in the console; Network panel ("Disable cache" for cold; "Fast 4G" preset); hover 5 cards for 2 s each, then sweep 7 cards in 1 s | `pointerenter` → `loadstart` → `canplay` → first presented frame (rVFC) per card; gap duration between cards; bytes per hover | Confirms INT-02/INT-04 magnitude; sets P1-8 targets |
| R2 | Autoplay rejection | Fresh Chrome guest, Edge and Firefox profiles (Safari if available); hover before any click with S-1 installed | `play() rejected NotAllowedError` lines; visible frozen frame | Any rejection → P0-6 required |
| R3 | Handoff | Hover *God Mode* and *Beat It* for 6 s; Performance panel with screenshots; `chrome://media-internals` | Dropped frames, decoder type, audio overlap (record system audio) | Basis for P1-9 acceptance |
| R4 | Compositing cost | Rendering tab: Paint flashing, Layer borders, Frame Rendering Stats; toggle effects with temporary DevTools CSS overrides (not repo edits); GPU track ms/frame | Intro hover (INT-06/07), wall idle with GlassButtons and tooltip (P2-2), Song Detail open (SD-01) | ≥ 2 ms GPU/frame or ≥ 3 ms paint/frame → proceed with the gated tasks |
| R5 | React render frequency and cost | React DevTools Profiler, "Highlight updates"; 10 s idle with audio; a 10-tile hover sweep | Commits/s; `Home` commit duration; commits per tile change | Baseline for RCT-01/TRK-03 acceptance |
| R6 | Track-hover accuracy and instant feedback | Hover tiles at 9 screen positions (centre, mid-edges, corners); screenshot each; compare the tooltip title with the tile under the pointer; frame-by-frame screen recording of a hover change | Mismatch rate per position; frames until the tile visibly changes | Confirms TRK-02; TRK-01 acceptance |
| R7 | Atlas uploads and frame loop | Paste snippet **S-2** before choosing a vibe; enter a chart, switch chart, search once; open Song Detail for 10 s | Count and synchronous ms of 4096² uploads; WebGL frames while detail is open | GL-01/GL-02 acceptance; gates P1-6 (≥ 8 ms p95 upload or ≥ 3 dropped frames per upload) |
| R8 | Audio pool and queue | Paste snippet **S-3**; sweep the wall for 60 s; Memory panel heap snapshot (filter `HTMLAudioElement`); Network panel | `new Audio()` count; live elements; stuck loads after 10 s; CORS errors | TRK-04/AUD-04 acceptance |
| R9 | Stuck hover media after selection | (a) Click an intro card and keep the mouse still for 2 s, then move it; (b) in Switch Chart, click a card and keep still for 1 s | Hover video or audio still present over loading or the wall? | Any persistence → INT-10 confirmed (fix is P0-5 regardless) |
| R10 | Audio hijack under Song Detail | Open Song Detail; move the pointer over the panel for 30 s | Does the audio change? Does the panel's progress reset? | Confirms TRK-06 |
| R11 | Touch selection | Real phone (DevTools emulation as a first pass): tap 10 distinct tiles | Which song opens per tap | Confirms TRK-07 |
| R12 | Backend | Server logs (the dev server already prints `[DIAG]`); time cold and warm `/api/songs` per vibe and regional fallbacks; **do not load-test iTunes** | p50/p95, upstream status codes, payload size | p95 cold > 1.5 s or any 403/429 → raise P2-10 |
| R13 | Bundle and Web Vitals | In a separate clone: production build with a bundle analyser; Lighthouse; field INP and LCP after P3-4 | Initial JS by module, LCP, INP, CLS, transfer before interaction | BND-01 and P1-12 acceptance |

**Snippet S-1 (media timeline).** Paste in the console; it only instruments the current tab:

```js
(() => {
  const t0 = performance.now(), log = (...a) => console.log(`[media +${(performance.now()-t0)|0}ms]`, ...a);
  const evs = ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','playing','waiting','stalled','seeked','emptied','error'];
  document.querySelectorAll('video').forEach((v, i) => {
    evs.forEach(e => v.addEventListener(e, () => log(`video#${i}`, e, (v.currentSrc||'').split('/').pop(), 'rs=' + v.readyState)));
    v.addEventListener('loadstart', () => v.requestVideoFrameCallback?.(() => log(`video#${i}`, 'FIRST FRAME PRESENTED')));
  });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { const p = play.call(this); p?.catch?.(e => log('play() rejected', e.name, (this.currentSrc||'').split('/').pop())); return p; };
  document.addEventListener('pointerenter', e => { const b = e.target?.querySelector?.('[id^="vibe-"]'); if (b) log('pointerenter', b.id); }, true);
})();
```

**Snippet S-2 (atlas uploads and WebGL frames):**

```js
(() => {
  let uploads = 0, ms = 0, frames = 0;
  const P = WebGL2RenderingContext.prototype, ti = P.texImage2D;
  P.texImage2D = function (...a) { const src = a[a.length - 1]; const big = (src && src.width >= 4096) || a[3] >= 4096;
    const s = performance.now(); const r = ti.apply(this, a); if (big) { uploads++; ms += performance.now() - s; } return r; };
  const dr = P.drawElementsInstanced; P.drawElementsInstanced = function (...a) { frames++; return dr.apply(this, a); };
  setInterval(() => console.log(`[gl] 4096² uploads=${uploads} syncMs=${ms.toFixed(1)} instancedDraws/s=${frames}`, (frames = 0)), 1000);
})();
```

**Snippet S-3 (audio element creation):**

```js
(() => { let n = 0; const A = window.Audio;
  window.Audio = new Proxy(A, { construct(t, a) { n++; return new t(...a); } });
  setInterval(() => console.log('[audio] new Audio() so far:', n), 5000); })();
```

---

## 23. Acceptance criteria for future fixes

| Area | Metric | Target | Measured by |
|---|---|---|---|
| Intro hover | Visual response after `pointerenter` | Poster or first frame visible ≤ 1 frame (≤ 17 ms at 60 Hz) | R1 recording |
| Intro hover | Preview first frame | p75 ≤ 150 ms warm; ≤ 400 ms cold on "Fast 4G" | R1 |
| Intro hover | First-visit playback | 0 `NotAllowedError`; motion visible in a fresh profile | R2 |
| Intro hover | Card-to-card | No dim gap; the outgoing frame is held until the incoming frame is presented | R1 recording |
| Intro hover | Handoff | One audible source at all times; ≤ 2 dropped frames; no content jump | R3 |
| Intro hover | Bytes | ≤ preview size + 10 % for a 1 s hover; full file only after the dwell | R1 HAR |
| Intro hover | Decoders | Globe paused while hover video is visible | `media-internals` |
| Track hover | Tile feedback | Hovered tile changes appearance in the same frame as the hover change | R6 |
| Track hover | Accuracy | Hovered track = tile under pointer in 100 % of the 9-position grid | R6 |
| Track hover | React | ≤ 1 leaf commit per tile change; 0 `Home` commits | R5 |
| Track hover | Audio | Start ≤ 250 ms p75 after the dwell for neighbour-preloaded tracks; ≤ 12 live audio elements after a 60 s sweep; no audio change while the pointer is over UI or detail | R8, R10 |
| App-wide | Idle playback | 0 `Home` commits in 10 s; 0 forced layouts per progress tick | R5, Performance panel |
| WebGL | Atlas | ≤ 1 full-size upload per chart entry (0 after per-slot uploads); no long task > 50 ms from uploads | R7 |
| WebGL | Hidden canvas | 0 WebGL frames while Song Detail or an overlay is open | R7 |
| WebGL | Resilience | Context loss recovers ≤ 1 s or falls back; WebGL2-off fallback renders | Manual |
| Network | Entry | ≤ 4 concurrent audio requests; critical artwork complete earlier than baseline | R8, HAR |
| Bundle | Initial JS | No `three` in initial chunks; no WebGL context before the first intent | R13 |
| Assets | Images | Logo ≤ 30 KB; intro images ≤ 400 KB total | Network |
| Backend | Caching | Warm chart p95 ≤ 100 ms (CDN); no 5xx on upstream 429 | R12 |
| Security | Proxy | `/api/proxy` → 404; `npm audit`: 0 critical and 0 high for runtime dependencies | curl, `npm audit` |
| Accessibility | Baseline | axe: 0 serious or critical; every track keyboard-reachable; reduced-motion honoured | axe, manual |
| Quality | Gates | 0 lint errors; unit tests for audio pool, atlas generation and cache; Playwright fresh-profile smoke test passing in CI | CI |
| Visual parity | All UI and media tasks | Side-by-side recording approved by the owner | Manual |

---

## 24. Repository inspection coverage register

**Exclusions (not treated as application source):** `node_modules/` (consulted only for installed versions, R3F `dispose` internals in `events-b389eeca.esm.js`, `three/src/objects/InstancedMesh.js`, and the Next 16 docs under `node_modules/next/dist/docs/`); `.next/` (generated by the dev server; not inspected); `.git/` (metadata only via `git` commands); `next-env.d.ts` (generated).

| Area | Files | Coverage |
|---|---|---|
| App shell and routing | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico` | Read fully (favicon: header only) |
| API routes | `app/api/songs/route.ts`, `songs/top/route.ts`, `search/route.ts`, `chart-preview/route.ts`, `proxy/route.ts` | Read fully |
| Components | `GlobalAudioPlayer.tsx`; `ui/`: `ChangeVibeOverlay`, `CinematicBackground`, `EditorialOverlay`, `GlassButton`, `GlowingRingLoader`, `HeroBackgroundVideo`, `HoverMediaBackground`, `IntroScreen`, `Navbar`, `PreviewVideoLayer`, `SearchPanel`, `SongDetail`; `universe/`: `CameraController`, `NodeField`, `Universe`, `WallGrid` | Read fully (all 17) |
| Hooks | `hooks/useChartHover.ts` | Read fully |
| Lib | `atlasManager`, `audioDebug`, `chartSource`, `gridCalc`, `hindiChartData`, `tamilChartData`, `teluguChartData`, `introMediaManifest`, `jellyField`, `musicProvider`, `signatureSongs`, `types`, `vibeConfig`, `vibeService` | Read fully |
| Lib data | `lib/devSpecialData.ts` (70 KB) | Structure and statistics only (80 entries, 79 with previews, all art on mzstatic); entries not read individually |
| Stores | `audioStore`, `chartPreviewStore`, `performanceStore`, `songStore`, `uiStore` | Read fully |
| Config | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `.gitignore` | Read fully |
| Lockfile | `package-lock.json` | Via `npm audit` and installed-version queries; not read line by line |
| Docs | `README.md`, `AGENTS.md`, `CLAUDE.md` | Read fully |
| Scripts | `scripts/build-dev-special.ts`, `test-dev-special.ts`, `test-itunes.ts`; root `kadence_audit.js` | Read fully |
| Scripts | `scripts/build-regional-charts.mjs` (16 KB) | Partially: header, playlist config, all fetch/write/regex sites via search |
| Artefact | `song_detail_diff.txt` (UTF-16 diff) | Partially: first 40 lines |
| Videos | 33 × `public/videos/*.mp4` | Structure probed (box order, codec, profile/level, resolution, fps, bitrate, keyframes); not visually reviewed |
| Audio | 17 × `public/audio/intro/*.m4a` | Sizes and references only (unreferenced); not probed |
| Images | logos, 14 tiles, duplicates in `Gemini Intro Video Assets/`, `public/*.svg` | Dimensions for logos and 3 tiles; duplicate detection by blob hash for all; SVGs not opened |
| Screenshots | 8 × `screenshots/*.png` | Not viewed (documentation only) |
| Prior KADENCE docs (branch `origin/docs/perf-recovery-plan`) | `KADENCE_MASTER_PERFORMANCE_AUDIT.md` | Read fully |
| | `KADENCE_PERFORMANCE_RECOVERY_ROADMAP.md` | §1–4 read; all headings reviewed; §5–10 task bodies **not** read in detail |
| | `docs/perf-baseline/README.md` | Read |
| | `PROFILING_GUIDE`, `SNIPPETS`, `SCENARIOS`, `EXPERIMENTS`, `CAPTURE_CHECKLIST`, `HYPOTHESIS_RESULTS_TEMPLATE` | **Not read** |
| Tooling checks | `tsc --noEmit --incremental false` (pass); `eslint app components hooks lib store` (36 errors, 58 warnings); `npm audit` | Run; no files written (verified) |

**Not covered (limits of this audit):** runtime behaviour of any kind; production build output; deployed configuration (any hosting project settings outside the repository); real network and CDN headers from Apple, Spotify and Google; visual review of media.

**Git status.**

- Before: clean; ignored `.next/`, `next-env.d.ts`, `node_modules/`.
- After writing this report: `?? docs/` (this report only). `git diff --stat` is empty, so no tracked file changed.

---

## 25. Final engineering recommendation

KADENCE's slowness is not caused by React, Next.js, Three.js or its visual ambition being inherently too heavy. It comes from a small number of system-level decisions that multiply each other's cost:

- High-frequency state routed through a single client root.
- Media and network work with no owner or priority.
- Rendering and media never gated by what is visible.
- Interaction feedback that waits on slow pipelines instead of responding locally.
- Expensive compositor effects stacked over pixels that change every frame.

**The intro preview lag is HIGH severity.** It is primarily a media-delivery and compositing problem: cold starts with no poster, unmuted autoplay that fails for new visitors, a buffer-timed seek-heavy handoff with doubled audio, bandwidth and decoder contention.

**The track hover lag is CRITICAL.** It combines no instant tile feedback, a hit-test that selects neighbouring tiles away from the screen centre, full-tree React renders inside the WebGL frame plus an 8 Hz render loop, and unbounded network-bound audio switching.

**Recommendation: Option B.** Do significant refactoring of the state topology, the wall's input and artwork pipeline, and the safety nets. Carry out redesign-level work for media orchestration and the chart-data pipeline. Keep KADENCE's visual identity, interactions and aesthetic intact, and verify every change against side-by-side recordings.

**Start with the baseline (§22).** Then do P0, which is mostly one-day tasks: proxy removal, selector discipline, transient progress, the AudioDirector with dwell and gating, clearing hover media, muted-first playback, a gated frame loop, and a single artwork loader. Then do P1 for the two hover experiences and the media and data paths. P2 and P3 follow for quality, resilience, accessibility and maintainability.

No code has been changed. This report is for review before any implementation is approved.
