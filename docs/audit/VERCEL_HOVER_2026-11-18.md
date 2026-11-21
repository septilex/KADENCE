# Live Vercel hover test — 18 November 2026

Target: https://kadence-musicz.vercel.app

Isolated headless Brave profile; normal autoplay policy, 1440x900, actual pointer input. 15 chart cards and the Explore Dev button, before and after a real click. 3.2-second observation per hover. One run, not population performance data. Repeat pass combines warmed cache and activation; it cannot isolate their separate latency effects. Audible means media element playing unmuted, not a recording of speaker output.

Production still requests /videos/*_preview_3s.mp4, not /videos/hover-v1/*. The local smaller clips and sound control are not live. Cold first-frame delays reached 2273 ms. All first-visit trials played muted; all activated trials had an unmuted playing element. No persistent frozen preview was reproduced within these observation windows. Long-session stalls and mobile Safari remain untested.

| Phase | Control | First frame ms | Unmuted playing |
|---|---|---:|---|
| first-visit | vibe-global-top-50 | 878 | False |
| first-visit | vibe-viral-50 | 872 | False |
| first-visit | vibe-new-music-friday | 799 | False |
| first-visit | vibe-hip-hop-central | 1216 | False |
| first-visit | vibe-pop-rising | 121 | False |
| first-visit | vibe-dance-hits | 1042 | False |
| first-visit | vibe-mood-booster | 600 | False |
| first-visit | vibe-late-night | 1151 | False |
| first-visit | vibe-workout | 1825 | False |
| first-visit | vibe-chill-hits | 153 | False |
| first-visit | vibe-top-telugu | 1265 | False |
| first-visit | vibe-top-tamil | 1093 | False |
| first-visit | vibe-top-hindi | 2273 | False |
| first-visit | vibe-top-kpop | 1465 | False |
| first-visit | vibe-dev-special | 114 | False |
| activated | vibe-global-top-50 | 121 | True |
| activated | vibe-viral-50 | 110 | True |
| activated | vibe-new-music-friday | 114 | True |
| activated | vibe-hip-hop-central | 61 | True |
| activated | vibe-pop-rising | 90 | True |
| activated | vibe-dance-hits | 82 | True |
| activated | vibe-mood-booster | 140 | True |
| activated | vibe-late-night | 130 | True |
| activated | vibe-workout | 77 | True |
| activated | vibe-chill-hits | 88 | True |
| activated | vibe-top-telugu | 95 | True |
| activated | vibe-top-tamil | 79 | True |
| activated | vibe-top-hindi | 111 | True |
| activated | vibe-top-kpop | 82 | True |
| activated | vibe-dev-special | 84 | True |
| first-visit | explore-dev-universe-btn | 285 | False |
| activated | explore-dev-universe-btn | 337 | True |

Raw evidence: results/2026-11-18-vercel/hover.json and creator-cue.json. Network and console errors are preserved in these files; the tested preview playback succeeded despite unrelated failures. No deployment performed.
