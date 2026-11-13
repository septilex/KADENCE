# S2: Intro card hover and video preview — results

| | |
|---|---|
| Captured | 2026-11-11, 07:25–08:08 UTC (12:55–13:38 IST) |
| Target | Production `https://kadence-musicz.vercel.app/` (build consistent with `e5ab927`) |
| Browser | A **separate** Brave 157 / Chromium 157.0.8103.39 with a throwaway profile, driven over the Chrome DevTools Protocol. **Your own Brave profile was not touched.** |
| Viewport | 1718×910 CSS px, DPR 1.09, 60 Hz display |
| Trials | 64 hover trials, 0 harness failures (plus 1 pilot and 2 discarded recording attempts) |
| Method and limits | [`S2_method.md`](S2_method.md) |
| All per-trial numbers | [`S2_tables.md`](S2_tables.md), [`S2_metrics.csv`](S2_metrics.csv), [`S2_metrics.json`](S2_metrics.json); raw logs in [`raw/`](raw/) |
| Recordings | [`recordings/*/index.html`](recordings/) (flipbooks with time labels) |
| Traces | [`traces/`](traces/) (open in the DevTools Performance panel) |

All times are **ms after the page's own `pointerover` on the card** ("pointer enter"), unless stated otherwise.

## Validity notes (read first)

1. **Network.** The connection was slow and lossy throughout:
   - curl measured ≈ 250 KB/s at 12:50;
   - ping loss to 1.1.1.1 was 80% at the same time.

   **Cold results reflect this network.** Warm results come from the profile's disk cache and are network-independent.
2. **"Warm" means pre-fetched.** All 15 preview clips were fully pre-fetched into the throwaway profile's cache. Full videos were pre-fetched only for Hip-Hop Central (Loser), Late Night (One Of The Girls) and Top Hindi (Gehra Hua), plus the first 5 MiB of God Mode. The handoff could only be measured for those cards ([`prewarm_log.json`](prewarm_log.json)).
3. **Contamination.** `REC_warm_act_rapid` received **real mouse input** from about +1.5 s (17 pointer events at coordinates the script never sent). It is flagged in the tables and excluded below. Every other trial had **0** foreign pointer events.
4. **Discarded recording attempts.** Two attempts to record the no-activation case were set aside:
   - [`REC_noact_attempt1_not-hydrated.json`](REC_noact_attempt1_not-hydrated.json): the page had not hydrated after 243 s on the slow link, so the card had no handler. The pointer reached the card, but no video request was made.
   - [`REC_attempt2_page-already-activated.json`](REC_attempt2_page-already-activated.json): the page already had user activation from input the script never sent.

   The no-activation behaviour is therefore documented by data, not video.
5. **Not tested here:** Chrome, Edge, Firefox, Safari; touch; the React Profiler (dev build); `Switch Chart` (S6); hover-media clearing on card click (INT-10).

## Summary

| # | Measure | Result |
|---|---|---|
| 1 | Pointer enter → first visible response | The **dim overlay** starts at 40–118 ms and is fully dark at 260–294 ms (300 ms CSS fade). **Warm:** the preview layer is visible at **93–201 ms** (median 125–127). **Activated:** first visible motion at **129–215 ms** (median 147). **Cold:** no picture within 10 s in 15/15 hovers. |
| 2 | Video source assignment and request | Preview `src` is set in the same input task as `pointerover` (−1 to +7 ms). The request starts at 5–16 ms. First byte: **warm 7–29 ms**; **cold: none within 10 s in 15/15** (aborted on leave). |
| 3 | First decoded / presented frame | Warm: `loadeddata` and `canplay` at 32–73 ms (median 49–52); **first presented frame (rVFC) 43–125 ms (median 64)**. Decoder: `D3D11VideoDecoder`, platform (hardware) = true for every player that reported one. |
| 4 | Preview playback success | **No user activation: 0/15 played.** Every unmuted `play()` was rejected with **`NotAllowedError`**, and **one frozen frame stayed visible for the whole hover (9.9–11.9 s)**. **After activation: 24/24 played with visible motion.** **Cold: 0/15 reached `canplay`.** |
| 5 | Preview → full handoff delay | **Full video cached:** full playback starts **96–493 ms** after enter and is visible at 160–601 ms. That is only **0–0.375 s into the 3 s preview**. **Full video not cached** (13 trials): first byte after 0.9–8.9 s, none within 10 s (7), or the seek stalled on a partly cached file (2). **No handoff happened in any of these 10 s hovers**; the preview looped. |
| 6 | Stutter / jump at handoff | **Every handoff jumps forward 2.67–3.0 s in content** (preview at 0.0–0.375 s → full starts at 3.0 s). The preview is confirmed to be the full video's first 3 s ([`content_alignment.json`](content_alignment.json)). There is a visible double exposure during the crossfade (recording). Full-video frame gaps reach up to 67–133 ms in the first 1.5 s; 0–3 `waiting` events. |
| 7 | Simultaneous active videos | Globe never paused. **3 playing at once in every handoff** (globe + preview + full); 2 otherwise (globe + preview); 1 when the preview was blocked or cold. |
| 8 | Audio and autoplay | **15/15 `NotAllowedError`** before activation (7 more in the no-activation sweep). After activation, both soundtracks are unmuted, and **two soundtracks play together for 200–215 ms at every handoff** (15/15). `AbortError` appeared only on interrupted full-video `play()` during sweeps. |
| 9 | Frame intervals during hover | When video plays, **Chromium deliberately drops to 30 Hz** (trace: `FrameIntervalDecider` `MATCHER_TYPE_VIDEO_CONFERENCE`, 33.33 ms, `run_at_half_refresh_rate: true`). Otherwise 60 Hz. Frames > 50 ms: 6 of 8,668 (activated), 2 of 9,485 (no activation), 0 of 9,508 (cold). |
| 10 | Main-thread long tasks during hover | **0 long tasks (≥ 50 ms) in all 64 trials.** 13 long animation frames (50–105 ms) had **0 ms blocking and no script attribution**. They cluster at hover start and around full-video start. |
| 11 | Rapid switching (7 cards, ~165–195 ms apart) | **Warm + activated:** every card loads its preview *and* starts a full-video request (14 `src` assignments, 20–21 requests, 13–14 cancelled). All 7 previews presented frames. The last card was moving 110–129 ms after enter. **Cold:** 7 requests, all cancelled, **0 bytes**, dimmed screen with no picture for 6.9 s. |
| 12 | Leaving a card | `src` removed **53–58 ms** after `pointerout` (50 ms grace + halt). Dim gone at **281–283 ms**. All hover videos paused (59/59). In-flight video downloads are aborted (`net::ERR_ABORTED`) at about 57–62 ms, discarding up to 5.4 MB already received. The globe keeps playing. |

---

## 1. Pointer enter → first visible response

| Phase | Dim starts | Dim full | Preview layer visible (opacity ≥ 0.5) | First visible motion |
|---|---|---|---|---|
| W: warm, no activation (n=15) | 40–109 (med 61) | 274–294 (med 277) | 109–175 (med 127) | **never** (frozen frame) |
| B: warm, activated (n=24) | 41–118 (med 58) | 260–294 (med 278) | 93–201 (med 125) | 129–215 (med 147) |
| C: cold, activated (n=15) | 42–59 (med 45) | 275–292 (med 278) | **never in 10 s** | never in 10 s |

- **The first thing the user sees is the screen dimming.** The dim layer is made active synchronously in `beginPreview` (`HoverMediaBackground.tsx:194`), before any video data exists.
- **Warm:** the picture follows about 70–80 ms after the dim starts.
- **Cold, on this network:** the screen stays dimmed with no picture for the entire hover. See the recording [`REC_cold_act_global-top-50`](recordings/REC_cold_act_global-top-50/index.html): +3,008 ms shows the dimmed globe and no preview.
- The CSS fades (300 ms container, 150 ms video) set a floor of about 280 ms before the effect is complete, as the audit stated.

## 2. Video source assignment and request timing

| | src set | request start | first byte | outcome |
|---|---|---|---|---|
| W (warm) | −1 to 0 | 5–12 (med 6) | 7–29 (med 10), disk cache | 206 from cache |
| B (warm) | −1 to 7 | 5–16 (med 6) | 7–24 (med 10), disk cache | 206 from cache |
| C (cold) | −1 to 0 | 5–12 (med 7) | **none within 10 s (15/15)** | aborted on leave, 0 bytes |

- **No artificial delay remains** (consistent with `e5ab927`). The preview `src` is assigned within the same input task as the pointer event.
- The cold failures are network-bound. For comparison, a separate `curl` at 13:13 got the Loser and Beat It previews with TTFB 1.0–1.3 s and full download in 6.5–13.8 s. In the browser, cold preview requests received **no response headers at all within 10 s**, and S1-cold showed the same for `globe.mp4`. Whether this is the network or something browser-specific (e.g. how media range requests behave on a lossy HTTP/2 connection) **is not determined**.

## 3. First decoded and presented frame (warm)

| | `loadedmetadata` | `loadeddata` / `canplay` | first presented frame (rVFC) |
|---|---|---|---|
| W | 12–36 (med 23) | 42–73 (med 52) | 54–111 (med 64) |
| B | 10–37 (med 24) | 32–70 (med 49) | 43–125 (med 64) |

- Decoding is hardware (`D3D11VideoDecoder`, `kIsPlatformVideoDecoder: true`) for every player that reported a decoder: 1920×788 up to 1920×1440 and the 1080×1080 globe.
- **`play()` being called or resolving does not mean anything is on screen.** In W the first frame *was* presented (rVFC fired once), but playback was rejected. In C, `play()` was never even called.

## 4. Preview playback success

| Phase | `play()` resolved | `NotAllowedError` | Visible motion | Frozen frame visible |
|---|---|---|---|---|
| W: no activation | 0/15 | **15/15** | 0/15 | **15/15, 9,882–11,865 ms** (whole hover) |
| B: after one click | 24/24 | 0 | 24/24 | 0 |
| C: cold | — (never `canplay`) | 0 | 0/15 | 0 (layer never shown) |

- **No activation:** after a rejected `play()`, exactly **1 frame** is presented and `mediaTime` never advances. The preview layer stays at opacity 1 because `setVisible(pVid, true)` runs before `play()` (`HoverMediaBackground.tsx:203-205`), and the rejection is swallowed (`:213-215`).
- **The full video is never requested in this case**, because it is chained to `play()` resolving (`:209-212`).
- This is the first-visit experience in Brave with a fresh profile: hovering, the visitor's natural first action, never grants activation.
- **After activation:** 24/24 played. Where no handoff happened, 207–217 frames were presented per 10 s, with the preview looping 0 → 2.96 s.

## 5. Preview → full handoff

**Full video cached (11 activated trials + 4 recorded/traced):**

| Card | full `play()` call | full `playing` | full 1st frame | full visible | preview paused | preview `mediaTime` at switch | seek 3.0 s (seeking → seeked) |
|---|---|---|---|---|---|---|---|
| Late Night ×3 | 73–83 | 96–107 | 104–214 | 160–178 | 299–310 | 0.000–0.083 s | **29–41 ms** |
| Hip-Hop Central ×3 | 73–228 | 219–293 | 231–315 | 295–362 | 421–503 | 0.125–0.167 s | 155–231 ms |
| Top Hindi ×1 | 83 | 352 | 454 | 443 | 556 | 0.292 s | 279 ms |
| God Mode cue ×3 | 66–89 | 352–418 | 402–478 | 476–526 | 561–631 | 0.250–0.375 s | 306–351 ms |
| God Mode Creator Collection card ×1 | 491 | 493 | 503 | 601 | 697 | 0.292 s | 412 ms |

- **The handoff is triggered by buffering, not by the preview's playhead** (`attemptHandoff`, `HoverMediaBackground.tsx:120-158`). When the full file is in cache, the switch happens **within 96–493 ms of the hover**, after only 0–0.375 s of a 3 s preview.
- **Seek cost follows keyframe placement**, matching the audit's MP4 probe (§6.4):
  - Late Night's last keyframe before 3 s is at 2.79 s → **29–41 ms**.
  - Loser, Gehra Hua and God Mode have it at 0.00 s → **155–412 ms**.
  - Each of those seeks has to decode about 72 frames.
- **Full video not cached** (13 activated single-card trials):
  - **11 network-bound trials:** the full request got its first byte after 934–8,940 ms (4/11) or not at all within 10 s (7/11). `loadedmetadata` arrived after 2.2–9.0 s where it arrived at all.
  - **Global Top 50 r2/r3:** the start of the file was cached from r1 (`loadedmetadata` at 53/76 ms), but the 3.0 s seek **never completed**: 0 further bytes in 10 s.
  - The seek never completed in any of the 13 trials. **0/13 reached a handoff in 10 s**, and 0.66–1.3 MB per hover was downloaded and then aborted on leave. On a fast network the switch would come earlier, at an arbitrary point in the preview loop.

## 6. Stutter and jump at the handoff

- **Content jump:** in all 15 handoffs, the full video starts at 3.000–3.042 s while the preview was at 0.000–0.375 s, a **forward jump of 2.67–3.0 s**.
  - Frame-signature comparison confirms each preview equals the full video's first 3 s: preview at 0.5/1.5/2.5 s best-matches full at 0.5/1.5/2.5 s, with mean luma difference 0.28–0.62. Checked for Beat It, Loser, One Of The Girls, Gehra Hua and God Mode ([`content_alignment.json`](content_alignment.json); Beat It in [`content_alignment_log_attempt1.txt`](content_alignment_log_attempt1.txt)).
  - **Picture and music therefore jump at every handoff.**
- **Visible double exposure:** [`REC_warm_act_late-night`](recordings/REC_warm_act_late-night/index.html), frame `f0046` (+210 ms), shows the full video (visible from about 177 ms) blended over the still-visible preview, with different shots overlaid.
- **Frame pacing after the switch** (rVFC on the full video, first 1.5 s): median interval 33–66 ms; largest gap 67–133 ms (median 100); 0–3 gaps > 84 ms (two 24 fps frames); 0–3 `waiting` events on the full element.
- **Main-thread frames around the handoff:** max 33.5 ms for Late Night, Hip-Hop Central and Top Hindi. God Mode had frames up to 66–83 ms (1–2 frames > 50 ms per trial), all with 0 ms blocking.

## 7. Simultaneously active video elements

Counted each animation frame as videos with `!paused && readyState ≥ 2` and a source.

| Phase | Max playing at once |
|---|---|
| W | 1 (globe; the preview is frozen) |
| B, no handoff | 2 (globe + preview) |
| **B, every handoff** | **3 (globe + preview + full)** |
| C | 1 (globe) |

**The globe was never paused in any sample of any trial**, and keeps its full-screen CSS filter under the hover video (INT-05).

## 8. Audio and autoplay

- **Before activation:** unmuted `play()` (`muted: false`, `volume: 1`, `userActivation.hasBeenActive: false`) was rejected with `NotAllowedError` in **15/15** single hovers and **7/7** sweep cards.
- **After activation:** **two unmuted soundtracks overlap for 200–215 ms at every handoff** (15/15), measured from the full element's `playing` event to the preview's `pause()`. That equals the 200 ms `setTimeout` at `HoverMediaBackground.tsx:146-152`.
  - A sampler that counts every frame where both elements report `paused === false` gives 200–583 ms. That includes time when the full video's `play()` was pending on its seek and not yet producing sound, so **200–215 ms is the accurate figure**.
- **Not measured:** actual loudness or speaker output (no system-audio capture).

## 9. Frame intervals during hover (main-thread `requestAnimationFrame`)

| Phase | Frames | p50 | p95 | max | > 20 ms | > 50 ms |
|---|---|---|---|---|---|---|
| W (frozen preview) | 9,485 | 16.7 | 16.8 | 99.9 | 16 | 2 |
| B (video playing) | 8,668 | 16.7–33.3 (med 33.3) | 33.4–33.5 | 83.4 | 6,969 | 6 |
| C (no video) | 9,508 | 16.7 | 16.8 | 18.3 | 0 | 0 |

**The halving to 30 Hz is a browser policy, not app jank.** In both traces, about 250 ms after the hover video starts, Chromium logs:
- `FrameIntervalDeciderResult` with `MATCHER_TYPE_VIDEO_CONFERENCE`, `interval_us: 33332`, `RESULT_INTERVAL_TYPE_EXACT`;
- then `ExternalBeginFrameSourceWin::SetPreferredInterval {run_at_half_refresh_rate: true}`, with the video sink at 41,666 µs (24 fps);
- it returns to 16.67 ms after leave.

**Side effect:** while a hover video plays, the page's own rAF work and animations (card tilt and gloss, glow) also update at 30 Hz.

## 10. Main-thread long tasks during hover

- **0 `longtask` entries (≥ 50 ms) in all 64 trials**, from 0.3 s before pointer enter to 3 s after leave.
- 13 long animation frames of 50–105 ms. All had **0 ms blocking time and no script attribution**, apart from one 90 ms frame with 7 ms of `onpointerout` in `07lhk_q6pmm3r.js` (framework).
- They occur at hover start (+17 to +39 ms; the pop/shadow/`will-change` and dim start) and around full-video start (+281 to +393 ms). That points to rendering, compositing or decoder work, not JavaScript. Attribution needs the traces (§13).
- **React's whole-tree render per hover (INT-08) never produced a long task in production**, at 1× CPU.

## 11. Rapid switching

7 adjacent cards (Global Top 50 → Mood Booster), entered about 165–195 ms apart, then resting on card 7 for 5–6 s.

| Trial | Cache | `src` sets | Previews that presented a frame | Video requests started / cancelled | `play()` rejections | Last card moving after its enter | Dimmed, no picture (before last card moves) |
|---|---|---|---|---|---|---|---|
| W rapid (no activation) | warm | 7 | 7 (each 1 frozen frame) | 11 / 9 | 7 × `NotAllowedError` | never | 133 ms |
| B rapid r1 | warm | 14 | 7 | 21 / 14 | 1 × `AbortError` (full) | **129 ms** | 100 ms |
| B rapid r2 | warm | 14 | 7 | 20 / 13 | 0 | **110 ms** | 133 ms |
| C rapid (cold) | cold | 7 | 0 | 7 / 7, **0 bytes** | 0 | never | **6,933 ms** |

- **After activation**, each card in a sweep assigns its preview and, 27–88 ms later, the **full** `src` as well, so a 1-second sweep opens 7 full-video downloads (INT-04 churn).
- Each card change goes through `halt()` (`src` removed and `load()` on both elements) and then a fresh preview pipeline. With the cache warm, the visible gap is small (100–133 ms of dim without picture over the whole sweep).
- **Cold:** the sweep produces a darkened screen and nothing else.

## 12. Leaving a card

59 single-card trials:
- **`src` removed 53–58 ms** after `pointerout`: the 50 ms grace timer in `useChartHover` plus `halt()`.
- **Dim gone at 281–283 ms** (300 ms fade).
- Preview and full were paused within 1 s in **59/59** trials; the globe kept playing in all.
- **43 in-flight video requests were aborted at leave** (`net::ERR_ABORTED`, about 57–62 ms after leave): 27 full-video and 16 preview (the cold trials). Full-video bytes already received were discarded: up to **5.4 MB** (God Mode), typically 0.7–1.3 MB.

## Cold vs warm

| | Warm (disk cache) | Cold (this network) |
|---|---|---|
| Preview first byte | 7–29 ms | none within 10 s (15/15) |
| Preview visible | 93–201 ms | never in 10 s |
| Motion (activated) | 129–215 ms | never |
| Handoff | 96–493 ms if the full file is cached; none in 10 s otherwise | none |
| What the user sees | dim → picture in about 0.1 s → (activated) motion | **dimmed screen, no picture**, for the whole hover |

**Repeats** (same card, 3× each, activated warm), first visible motion:
- Hip-Hop Central 147 / 131 / 164 ms
- Late Night 148 / 147 / 147 ms
- Global Top 50 132 / 186 / 161 ms
- God Mode cue 177 / 146 / 149 ms

Per-trial values are in [`S2_tables.md`](S2_tables.md).

## GPU-process CPU (Task-Manager-style, `SystemInfo.getProcessInfo`, untraced)

| | Median % of one core | Range |
|---|---|---|
| Idle intro, 15 s, no hover | **89.6** (renderer 26.1) | — |
| W hovers | 54.1 | 50.2–69.0 |
| B hovers | 60.8 | 48.3–71.6 |
| C hovers | 53.1 | 45.7–67.8 |

Idle is **higher** than any hover phase. A plausible but **unverified** explanation: during hover the intro chrome (cards, logo, cue) fades to opacity 0, which removes the 15 `backdrop-filter` and 57 blend-mode layers from compositing. The renderer figure includes my per-frame sampler.

---

## Comparison with the audit's intro-video findings

| Audit item | Audit claim | S2 evidence | Verdict |
|---|---|---|---|
| **INT-01** unmuted hover `play()` blocked, frozen frame, full never loads | Strongly indicated | 15/15 + 7/7 `NotAllowedError` before activation; frozen first frame visible 9.9–11.9 s; 1 presented frame; no full-video request | **Confirmed** (Brave 157, fresh profile) |
| **INT-02** cold start on every first hover, no poster, teardown gap | Confirmed by code; size unmeasured | Cold: no picture in 10 s (15/15) on this network; warm: picture at 93–201 ms. Teardown confirmed (`src` removed on every change); warm sweep gap only 100–133 ms | **Confirmed.** Impact is dominated by the network; small when cached |
| **INT-03** handoff buffer-timed, seek-heavy, double audio | Confirmed by code + probe | Handoff at 96–493 ms after only 0–0.375 s of preview; **content jump 2.67–3.0 s** (preview verified = first 3 s); seek 29–41 ms with a keyframe near 3 s vs 155–412 ms with a keyframe at 0; **dual unmuted audio 200–215 ms** | **Confirmed and quantified.** Refinement: when the full file is fast or cached, the handoff happens almost immediately, not around 3 s |
| **INT-04** full download starts immediately and contends | Mechanism confirmed | Full `src` set 1–3 ms after preview `play()` resolves; 0.66–5.4 MB per hover then aborted; a 7-card sweep starts 7 full downloads | **Confirmed.** Contention with the preview itself not isolated (previews were cached) |
| **INT-05** globe keeps decoding under hover video | Mechanism confirmed | Globe `paused=false` in every sample; 3 videos playing in every handoff | **Confirmed** |
| INT-06 / INT-07 hover CSS and compositing cost | Strongly indicated / hypothesis | Long animation frames (50–105 ms, 0 ms script) at hover start and full start; GPU process 48–72% of a core during hover. Not attributed per effect | **Partly supported.** Needs the R4 A/B (DevTools CSS overrides) |
| INT-08 whole-tree React render per hover | Confirmed; "likely small" | 0 long tasks in production at 1× CPU | **Cost below 50 ms** (prod, 1×). Commit counts need the dev React Profiler |
| INT-09 `MagneticChromeText` layout per `mousemove` | Confirmed | Not exercised (pointer jumps, no continuous movement) | Not measured |
| INT-10 hover media not cleared on selection | Hypothesis | Not in S2 (no card clicks) | Not measured |
| INT-11 hover engine in Switch Chart | Confirmed | S6 | Not measured |
| INT-13 touch | Strongly indicated | Not tested | Not measured |
| INT-14 lazy above-fold tiles | Confirmed | `loading="lazy"` on tiles 08–14 (S1); no effect on hover measured | — |
| §6.3 rank 1 "cold network fetch dominates" | Hypothesis on size | On this network, cold = no picture at all for 10 s | **Supported** (network-dependent) |

## Technical causes supported by this evidence

1. **Unmuted-only playback plus reveal-before-play** (`HoverMediaBackground.tsx:203-215`, `:288`, `:303`) makes the hover a frozen frame for every visitor who has not clicked yet. *(Measured 15/15.)*
2. **The handoff gate checks only full-video buffering** (`:120-132`), never the preview's playhead, and the full file is requested as soon as preview `play()` resolves (`:209-212`). The result is a 2.7–3.0 s content jump at every handoff, and an immediate one when the full file is cached. *(Measured 15/15.)*
3. **Both elements unmuted, plus a fixed 200 ms crossfade** (`:146-152`) give 200–215 ms of two soundtracks at every handoff. *(Measured 15/15.)*
4. **Seeking to 3.0 s in files whose last keyframe before it is at 0 s** costs 155–412 ms vs 29–41 ms (measured). It is the main variable in how long the handoff takes once data is available.
5. **No poster, `preload="none"`, and a dim-first activation sequence** (`:194`, `:289`): cold hovers show only a darkened screen until data arrives; on this network, for the whole hover.
6. **Full-video prefetch on every hovered card** (`:209-212`) plus `halt()` aborting it: 0.66–5.4 MB discarded per hover; a 1-second sweep opens 7 full downloads.
7. **The globe is never paused** (`HeroBackgroundVideo.tsx`): up to 3 concurrent hardware decodes during handoff.
8. **Not a cause:** main-thread JavaScript (0 long tasks), and the 30 Hz cadence during playback, which is Chromium's own `FrameIntervalDecider`.

## Missing diagnostics

| Item | Why missing / what is needed |
|---|---|
| Cold-hover behaviour on a normal network (e.g. DevTools "Fast 4G") | The network was uncontrolled and lossy; cold previews never arrived. Repeat with a fixed throttling profile on a stable link. |
| Handoff for cards whose full video was not cached | Full files did not arrive within 10 s. Needs a faster network or longer dwell. |
| Audible output | No system-audio capture; the overlap is inferred from element state and events. |
| GPU/compositor cost per effect (R4) | Traces captured ([`traces/`](traces/)) but not analysed per effect; no A/B with effects disabled. |
| Compositor-level dropped frames | rVFC gaps and main-thread rAF only; the GPU track is in the traces. |
| Other browsers (Chrome, Edge, Firefox, Safari) | Only Brave 157 was available and tested. |
| React commit counts per hover | Needs the dev build + React Profiler (not run). |
| Touch / Android | No device. |
| Screen recording of the no-activation frozen frame | Both attempts were invalid (not hydrated; activated by outside input). Data only. |
| Content alignment for the other 10 previews | Checked for 5 of 15 (all matched the first 3 s) before timeouts on the slow link. |

## Evidence index

| File | Content |
|---|---|
| `raw/*.json` | Per trial: actions with wall times, page log (media events, `src` / `play` calls, rVFC frames, per-frame visibility samples, rAF, LoAF, long tasks, pointer events), network, Media domain events, process CPU |
| `S2_metrics.json` / `.csv` | Derived metrics per trial (analyser: `analyze_s2.mjs`, kept in Claude's scratchpad, not in the repo) |
| `S2_tables.md` | All per-trial tables, sweeps, handoff details, decoders, video network per trial |
| `recordings/REC_warm_act_late-night`, `REC_warm_act_cue`, `REC_cold_act_global-top-50`, `REC_warm_act_rapid` (contaminated after +1.5 s) | Screencast flipbooks (`index.html`) |
| `traces/TRACE_warm_act_late-night_trace.json.gz`, `traces/TRACE_warm_act_cue_trace.json.gz` | Chromium traces (frame-interval decisions, GPU, media) |
| `content_alignment.json`, `content_alignment_log*.txt` | Preview ↔ full frame-signature comparison |
| `prewarm_log.json` | What was pre-fetched into the cache for the warm trials |
| `env_phase-*.json`, `run_log.txt` | Run environment, activation click, untraced idle CPU, console log |
| `../S2-pilot/` | Pilot trial and the instrumentation defect that was removed |

**Size:** this folder is about 136 MB (recordings and traces). Following the profiling guide's advice, keep traces and recordings out of Git and commit only the reports.
