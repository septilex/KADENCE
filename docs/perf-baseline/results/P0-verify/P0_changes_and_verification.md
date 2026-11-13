# P0 fixes: changes and verification

| | |
|---|---|
| Branch | `perf/p0-fixes` (from `main` @ `e5ab927`). |
| Decisions applied | Scope: the audit's P0 batch. Intro hover sound: **muted until the visitor's first click/tap/key**. Hover-audio dwell: **150 ms**. |
| Not included | The Switch Chart overlay hover video was kept (no decision taken); it is now only cleared on select/close. |
| Checks | `tsc --noEmit`: **0 errors**. ESLint on the changed files: **10 → 9 errors, 22 → 21 warnings** (no new findings; the remaining ones are pre-existing items in the audit's RCT-06). |

## What changed

| Audit item | File(s) | Change |
|---|---|---|
| **P0-1** SEC-01, API-07 | `app/api/proxy/route.ts`, `app/api/songs/top/route.ts`, `app/api/chart-preview/route.ts`, `store/chartPreviewStore.ts` | **Deleted.** The open proxy and two unused upstream routes; their only client was the never-imported store. |
| **P0-2** RCT-01, TRK-03, INT-08 | `app/page.tsx`, `components/GlobalAudioPlayer.tsx`, `components/ui/SongDetail.tsx` | Whole-store subscriptions (`useUIStore()`, `usePerformanceStore()`, `useAudioStore()`) replaced with **selector-only** subscriptions. |
| **P0-3** RCT-01, SD-01, CF-31 | `store/playbackProgressStore.ts` (new), `store/audioStore.ts`, `components/ui/SongDetail.tsx` | Playback progress moved out of `audioStore` into its own store. Only a new leaf, `PlaybackProgressSection` (waveform + scrubber), subscribes to it. The scrubber's per-tick `getBoundingClientRect()` is replaced by a `ResizeObserver`-cached width. `setPlayingState` no longer notifies when the value is unchanged. |
| **P0-4** RCT-01, TRK-01, TRK-06 | `lib/audioDirector.ts` (new), `components/GlobalAudioPlayer.tsx`, `app/page.tsx` | The hover/selection → `playUrl()` bridge moved out of `Home` into a store subscription outside React (started once by `GlobalAudioPlayer`). Hover-driven switches wait a **150 ms dwell**; selection changes act immediately; while Song Detail is open the selected song wins. `Home` no longer subscribes to the hovered song. |
| **P0-5** INT-10, INT-11 | `app/page.tsx`, `components/ui/HoverMediaBackground.tsx` | `hoveredVibe` is cleared explicitly on chart selection, on Switch Chart selection and on overlay close. The hover-video engine is **gated**: it runs only on the intro and in the Switch Chart overlay. |
| **P0-6** INT-01 | `components/ui/HoverMediaBackground.tsx` | Previews and the full video start **muted unless the page has user activation**. On `NotAllowedError`, playback is retried muted. Layers are revealed only on the **first presented frame** (`requestVideoFrameCallback`, with a `playing` fallback). The first pointerdown/keydown unmutes the playing hover video. |
| **P0-7** GL-02, CF-12 | `components/universe/Universe.tsx`, `app/page.tsx` | Canvas `frameloop='never'` while Song Detail or the Switch Chart overlay covers the wall. The Song Detail fade of the wall is **opacity-only** (the animated `blur(10px) brightness(0)` was removed). The Refresh blur is unchanged (HY-3 is unresolved). |
| Dev warning (duplicate React key) | `components/ui/SongDetail.tsx` | Static `<style>` / `<GlassFilter>` moved outside `AnimatePresence`; the drawer group gets a constant key. Restores the drawer's exit animation (see Known open items, 1). |
| **P0-8** GL-01, GL-03, GL-08, RCT-05 | `lib/atlasManager.ts`, `components/universe/NodeField.tsx` | `atlasManager` is the **only** artwork loader: one de-duplicated loader per slot (keyed by URL), a **generation token** (late images from a previous chart are discarded), background loading waits for the critical set, GPU uploads coalesced (one after the critical set, then at most every 1.2 s). NodeField's own loader, its per-frame 256-slot scan and its per-frame texture flush are removed; NodeField calls `atlasManager.ensureSongs(songs)` on song-list changes, which also covers songs appended by search. |

## Verification (local dev server, separate throwaway Brave profile, same scripts as S2–S5)

### Intro hover with no prior click (INT-01): [`intro-hover/`](intro-hover/)

| | Before (S2, production) | After (dev) |
|---|---|---|
| Preview `play()` | `NotAllowedError` (15/15) | **resolved, muted**, +83 ms |
| Presented frames during a 10 s hover | 1 (frozen) | **13 preview + 231 full-video frames** |
| Frozen frame on screen | ≈ 9.9 s | **0 of 723 samples** |
| Full video | never requested | handed off at +444 ms (muted) |

### Song Detail and the progress loop: [`S5-dev-ab/`](S5-dev-ab/)

Same dev server, same script. A = original code, B = with the changes. Corrected commit census.

| Measure | A (before) | B (after) |
|---|---|---|
| Wall with a track playing: react-dom commits/s | 8 | **0** |
| Song Detail open: commits/s | 8.3 | 8 |
| ↳ composites re-rendered per commit (median) | 89 | **4** |
| ↳ `Home` / `SongDetail` renders per second | 8.3 / 8.3 | **0 / 0** |
| ↳ `getBoundingClientRect` calls/s | 8.4 | **0.4** |
| ↳ WebGL draw-frames/s (5 s idle) | 120.5 | **0** |
| Total React commits over the 27 s script | 863 | **343** |
| Drawer opening: long tasks; frame p95 / max | 5 (61–80 ms); 83 / 160 ms | **0**; 49 / 83 ms |
| Scrub: worst interaction; frame p95 | 88 ms; 90 ms | **48 ms; 14 ms** |
| Audio `play()` of different tracks while the panel is open (TRK-06, side effect) | 7 distinct | **1** |
| GPU-process CPU, Song Detail open idle | 179% | 172% |

**Not fixed by P0:** GPU cost with Song Detail open is almost unchanged, even with WebGL stopped. It comes from Song Detail's own compositing (SVG turbulence filter + backdrop blur, SD-01), which is P2-1.

### Artwork pipeline: [`atlas-dev-ab/`](atlas-dev-ab/)

| Measure | A (before) | B (after) |
|---|---|---|
| Chart entry: full 4096² atlas uploads (dev, warm) | 8 | **4** |
| Chart entry: artwork `Image.src` sets / unique URLs | 512 / 243 | **256 / 243** |
| Search: artwork re-downloaded into the atlas | **256** (whole wall reloaded) | **0** |
| Search: full atlas uploads | 3 | **0** |
| Wall screenshot | populated | **populated** ([`shots/B_after_p0_wall.jpg`](atlas-dev-ab/shots/B_after_p0_wall.jpg)) |

Search results beyond index 255 are not shown on the wall in either version (pre-existing RCT-05 limit: this chart already has ≥ 256 songs).

### React commits on the wall: [`S4-dev/`](S4-dev/)

- With Song Detail open and a track playing, `Home` rendered **0** times (before: in every commit).
- This run's passive window had no track playing (the wall took 25.6 s to settle), so it does not test the idle-wall case; `S5-dev-ab` covers that.
- The S4-dev numbers predate the census fix, so their composite counts are upper bounds.

### Hover audio with the 150 ms dwell (P0-4): [`S4-dev/`](S4-dev/) run `S4_dev_after_p0_4`, [`S5-dev-ab/`](S5-dev-ab/) run `G_after_p0_4`

| Measure | Before P0-4 (`S4_dev_after_p0`) | After P0-4 |
|---|---|---|
| `Home` renders per tile change: slow hover / fast sweep | 22 / 224 | **0 / 0** |
| Audio `play()` calls during the fast sweep | 224 | **0** |
| `new Audio()` during the fast sweep | 73 | **45** (preload queue still re-prioritises on hover; P1-4) |
| Slow hover (10 tiles dwelled on): `play()` calls | — | **10**, tile → `play()` 139–341 ms (p50 226 ms) |

- **Song Detail keeps the selected track** (`G_after_p0_4`): one track played from the open at 2.5 s to the close at 24.5 s; pause, play, scrub and click-to-seek all acted on it; no other track started while the panel was open. WebGL draw-frames with the panel open: 0.
- **Not a regression:** in `S4_dev_after_p0_4`, Song Detail closed ≈ 3.3 s after opening. The pointer log shows a press-and-click on the canvas at (976, 473) at 42.7–42.9 s; the script never dispatched an event at that position, so this was a real mouse click during the run (the canvas's `onPointerMissed` deselects). The scripted S5 run above stayed open for its full 22 s.
- "Next Track" in the S5 script does not change the playing track in any run (A, B, D, G); unchanged by P0 and not investigated.

## Known open items

1. ~~Dev-only React warning "Encountered two children with the same key"~~ **Fixed.**
   - **Cause** (captured with the React owner stack: `Home → SongDetail → AnimatePresence → PresenceChild`, key `""`): `SongDetail`'s `<AnimatePresence>` had three un-keyed direct children (`<style>`, `<GlassFilter />`, and the `{song && <>…</>}` fragment). framer-motion keys presence children by `key || ""`, so they collided on every `SongDetail` render.
   - **Fix** (`components/ui/SongDetail.tsx`): the static `<style>` and SVG filter definitions moved outside `AnimatePresence`; the drawer group is wrapped in `<Fragment key="song-detail">`, a constant key, so switching songs while open behaves as before.
   - **Verified** (dev): duplicate-key errors during chart entry **37 → 0**; the Next.js dev "Issue" badge is gone.
   - **Visible behaviour change:** A/B on identical conditions ([`S5-keyfix-ab/`](S5-keyfix-ab/), both runs on battery). Before the fix, **Close made the drawer vanish instantly** (gone 6 ms after the click): the collision prevented `AnimatePresence` from running its exit animation. With the fix, the drawer's existing `exit={{ x: -400, opacity: 0 }}` animation plays (≈ 0.86 s). Opening is unchanged: 12 vs 13 frames in 1.3 s, and first long task 250 vs 243 ms.
   - **Measurement note:** the laptop switched to battery ("Silent" power scheme, 60 Hz) during this work, so runs C–F are slower overall than A/B (AC power, 144 Hz) and must not be compared across that boundary.
   - **Environment:** `git.exe` started being blocked by Windows Application Control (exit `0xC0E90002`) mid-session, so this A/B toggled only the one edit by hand (backup + restore, verified) instead of using git.
2. ~~P0-4 (AudioDirector + dwell)~~ **Done** with a 150 ms dwell (see above).
3. Switch Chart overlay hover video: still plays (now cleared on select/close). Limiting it to the intro is a product decision.
4. Not yet measured on production. All verification ran on `next dev`.
