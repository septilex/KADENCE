
### W — warm cache, no user activation (fresh page, never clicked)

| Trial | Cache | play() result | src set | req start | 1st byte | loadeddata | canplay | play() call | 1st presented frame | dim 100% | preview layer visible | first visible motion | frozen visible (ms) | P frames | full src set | full 1st frame | full visible | content offset (s) | dual unmuted (ms) | max playing videos | rAF p95 / max (ms) | rAF >50 ms | LoAF n / max | long tasks n / max | leave: src removed / dim gone (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W_warm_noact_chill-hits | warm(disk-cache) | rejected:NotAllowedError | -1 | 7 | 24 | 68 | 68 | 68 | 84 | 292 | 142 | — | 9899 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| W_warm_noact_cue | warm(disk-cache) | rejected:NotAllowedError | -1 | 7 | 18 | 64 | 64 | 65 | 111 | 275 | 175 | — | 11865 | 1 | — | — | — | — | — | 1 | 16.8 / 99.9 | 2 | 2 / 105 | 0 / 0 | 56 / 282 |
| W_warm_noact_dance-hits | warm(disk-cache) | rejected:NotAllowedError | -1 | 6 | 11 | 65 | 65 | 65 | 80 | 290 | 140 | — | 9899 | 1 | — | — | — | — | — | 1 | 16.8 / 33.4 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| W_warm_noact_global-top-50 | warm(disk-cache) | rejected:NotAllowedError | -1 | 6 | 13 | 44 | 44 | 45 | 54 | 274 | 124 | — | 9915 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| W_warm_noact_hip-hop-central | warm(disk-cache) | rejected:NotAllowedError | 0 | 5 | 7 | 51 | 51 | 51 | 64 | 276 | 126 | — | 9915 | 1 | — | — | — | — | — | 1 | 16.8 / 33.2 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| W_warm_noact_late-night | warm(disk-cache) | rejected:NotAllowedError | 0 | 6 | 10 | 44 | 44 | 45 | 56 | 291 | 141 | — | 9882 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 55 / 283 |
| W_warm_noact_mood-booster | warm(disk-cache) | rejected:NotAllowedError | 0 | 6 | 9 | 51 | 51 | 51 | 59 | 294 | 127 | — | 9899 | 1 | — | — | — | — | — | 1 | 16.8 / 33.2 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| W_warm_noact_new-music-friday | warm(disk-cache) | rejected:NotAllowedError | -1 | 5 | 10 | 53 | 53 | 53 | 67 | 275 | 125 | — | 9916 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 55 / 281 |
| W_warm_noact_pop-rising | warm(disk-cache) | rejected:NotAllowedError | 0 | 5 | 8 | 46 | 46 | 46 | 55 | 276 | 110 | — | 9932 | 1 | — | — | — | — | — | 1 | 16.8 / 17.1 | 0 | 0 / 0 | 0 / 0 | 58 / 283 |
| W_warm_noact_top-hindi | warm(disk-cache) | rejected:NotAllowedError | -1 | 11 | 29 | 72 | 72 | 73 | 88 | 292 | 142 | — | 9882 | 1 | — | — | — | — | — | 1 | 16.8 / 33.2 | 0 | 0 / 0 | 0 / 0 | 55 / 283 |
| W_warm_noact_top-kpop | warm(disk-cache) | rejected:NotAllowedError | -1 | 7 | 10 | 50 | 50 | 50 | 64 | 277 | 127 | — | 9899 | 1 | — | — | — | — | — | 1 | 16.8 / 33.5 | 0 | 0 / 0 | 0 / 0 | 57 / 283 |
| W_warm_noact_top-tamil | warm(disk-cache) | rejected:NotAllowedError | -1 | 12 | 29 | 73 | 73 | 73 | 84 | 288 | 138 | — | 9899 | 1 | — | — | — | — | — | 1 | 16.8 / 33.2 | 0 | 0 / 0 | 0 / 0 | 56 / 283 |
| W_warm_noact_top-telugu | warm(disk-cache) | rejected:NotAllowedError | -1 | 6 | 9 | 42 | 42 | 42 | 55 | 276 | 109 | — | 9932 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| W_warm_noact_viral-50 | warm(disk-cache) | rejected:NotAllowedError | -1 | 9 | 15 | 52 | 52 | 52 | 69 | 274 | 124 | — | 9915 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 57 / 281 |
| W_warm_noact_workout | warm(disk-cache) | rejected:NotAllowedError | 0 | 7 | 10 | 53 | 53 | 53 | 64 | 277 | 127 | — | 9915 | 1 | — | — | — | — | — | 1 | 16.8 / 33.3 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |

### B — warm cache, after one activation click

| Trial | Cache | play() result | src set | req start | 1st byte | loadeddata | canplay | play() call | 1st presented frame | dim 100% | preview layer visible | first visible motion | frozen visible (ms) | P frames | full src set | full 1st frame | full visible | content offset (s) | dual unmuted (ms) | max playing videos | rAF p95 / max (ms) | rAF >50 ms | LoAF n / max | long tasks n / max | leave: src removed / dim gone (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B_warm_act_cc | no-request | playing→handoff-to-full (full playing) | 7 | — | — | 70 | 70 | 70 | 125 | 284 | 201 | 215 | 0 | 12 | 72 | 503 | 601 | 2.708 | 200 | 3 | 33.5 / 83.4 | 2 | 2 / 88 | 0 / 0 | 55 / 282 |
| B_warm_act_chill-hits | warm(disk-cache) | playing-visible-motion | 0 | 7 | 11 | 50 | 50 | 50 | 65 | 278 | 128 | 147 | 0 | 214 | 52 | — | — | — | — | 2 | 33.5 / 33.6 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| B_warm_act_cue | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 7 | 15 | 37 | 37 | 37 | 79 | 276 | 143 | 177 | 0 | 10 | 39 | 478 | 476 | 2.667 | 500 | 3 | 33.4 / 66.6 | 1 | 1 / 65 | 0 / 0 | 54 / 282 |
| B_warm_act_cue_r2 | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 6 | 8 | 35 | 35 | 35 | 83 | 278 | 128 | 146 | 0 | 11 | 37 | 402 | 478 | 2.75 | 533 | 3 | 33.5 / 66.5 | 2 | 1 / 67 | 0 / 0 | 54 / 282 |
| B_warm_act_cue_r3 | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 16 | 20 | 52 | 52 | 52 | 73 | 276 | 127 | 149 | 0 | 13 | 55 | 431 | 526 | 2.75 | 583 | 3 | 33.4 / 49.9 | 0 | 1 / 50 | 0 / 0 | 54 / 282 |
| B_warm_act_dance-hits | warm(disk-cache) | playing-visible-motion | 0 | 5 | 8 | 33 | 34 | 34 | 43 | 279 | 112 | 130 | 0 | 212 | 35 | — | — | — | — | 2 | 33.5 / 33.5 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_global-top-50 | warm(disk-cache) | playing-visible-motion | 0 | 5 | 8 | 32 | 32 | 32 | 49 | 260 | 93 | 132 | 0 | 216 | 34 | — | — | — | — | 2 | 33.5 / 33.6 | 0 | 0 / 0 | 0 / 0 | 57 / 282 |
| B_warm_act_global-top-50_r2 | warm(disk-cache) | playing-visible-motion | -1 | 6 | 10 | 47 | 47 | 47 | 57 | 278 | 128 | 186 | 0 | 210 | 48 | — | — | — | — | 2 | 33.5 / 50 | 0 | 1 / 52 | 0 / 0 | 55 / 282 |
| B_warm_act_global-top-50_r3 | warm(disk-cache) | playing-visible-motion | 0 | 5 | 10 | 57 | 57 | 57 | 71 | 275 | 125 | 161 | 0 | 213 | 61 | — | — | — | — | 2 | 33.5 / 50.1 | 1 | 0 / 0 | 0 / 0 | 56 / 282 |
| B_warm_act_hip-hop-central | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 6 | 8 | 48 | 49 | 49 | 59 | 279 | 112 | 147 | 0 | 9 | 50 | 298 | 362 | 2.833 | 433 | 3 | 33.5 / 33.7 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_hip-hop-central_r2 | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 5 | 7 | 43 | 43 | 43 | 64 | 278 | 128 | 131 | 0 | 8 | 48 | 231 | 295 | 2.875 | 233 | 3 | 33.5 / 33.6 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_hip-hop-central_r3 | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 8 | 11 | 49 | 49 | 49 | 65 | 279 | 129 | 164 | 0 | 8 | 52 | 315 | 296 | 2.875 | 217 | 3 | 33.5 / 33.5 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_late-night | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 9 | 13 | 58 | 58 | 58 | 70 | 294 | 127 | 148 | 0 | 5 | 61 | 197 | 177 | 2.959 | 217 | 3 | 33.5 / 33.6 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_late-night_r2 | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 5 | 9 | 51 | 51 | 51 | 64 | 277 | 127 | 147 | 0 | 5 | 54 | 104 | 160 | 3 | 233 | 3 | 33.5 / 33.8 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| B_warm_act_late-night_r3 | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 7 | 13 | 51 | 51 | 51 | 62 | 279 | 112 | 147 | 0 | 5 | 54 | 214 | 178 | 2.959 | 233 | 3 | 33.5 / 33.7 | 0 | 0 / 0 | 0 / 0 | 57 / 282 |
| B_warm_act_mood-booster | warm(disk-cache) | playing-visible-motion | 0 | 6 | 8 | 48 | 48 | 49 | 57 | 278 | 112 | 146 | 0 | 217 | 50 | — | — | — | — | 2 | 33.5 / 33.6 | 0 | 0 / 0 | 0 / 0 | 57 / 282 |
| B_warm_act_new-music-friday | warm(disk-cache) | playing-visible-motion | -1 | 8 | 13 | 56 | 56 | 56 | 70 | 290 | 124 | 158 | 0 | 215 | 58 | — | — | — | — | 2 | 33.4 / 33.5 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| B_warm_act_pop-rising | warm(disk-cache) | playing-visible-motion | -1 | 6 | 9 | 48 | 49 | 49 | 59 | 277 | 110 | 145 | 0 | 214 | 52 | — | — | — | — | 2 | 33.5 / 33.7 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| B_warm_act_top-hindi | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 12 | 19 | 59 | 59 | 59 | 74 | 293 | 143 | 144 | 0 | 11 | 63 | 454 | 443 | 2.75 | 483 | 3 | 33.5 / 33.7 | 0 | 1 / 65 | 0 / 0 | 54 / 282 |
| B_warm_act_top-kpop | warm(disk-cache) | playing-visible-motion | -1 | 9 | 24 | 54 | 54 | 54 | 63 | 291 | 124 | 143 | 0 | 214 | 56 | — | — | — | — | 2 | 33.5 / 33.5 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| B_warm_act_top-tamil | warm(disk-cache) | playing-visible-motion | -1 | 8 | 12 | 39 | 39 | 39 | 50 | 278 | 111 | 129 | 0 | 215 | 42 | — | — | — | — | 2 | 33.4 / 33.7 | 0 | 0 / 0 | 0 / 0 | 57 / 283 |
| B_warm_act_top-telugu | warm(disk-cache) | playing-visible-motion | 0 | 14 | 18 | 58 | 58 | 58 | 70 | 294 | 144 | 146 | 0 | 215 | 61 | — | — | — | — | 2 | 33.5 / 33.7 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| B_warm_act_viral-50 | warm(disk-cache) | playing-visible-motion | -1 | 6 | 8 | 42 | 42 | 42 | 58 | 275 | 108 | 160 | 0 | 207 | 47 | — | — | — | — | 2 | 33.4 / 33.6 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| B_warm_act_workout | warm(disk-cache) | playing-visible-motion | 0 | 6 | 9 | 49 | 49 | 49 | 56 | 277 | 110 | 163 | 0 | 212 | 50 | — | — | — | — | 2 | 33.5 / 33.8 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |

### C — cold cache (cache cleared before each hover), after activation

| Trial | Cache | play() result | src set | req start | 1st byte | loadeddata | canplay | play() call | 1st presented frame | dim 100% | preview layer visible | first visible motion | frozen visible (ms) | P frames | full src set | full 1st frame | full visible | content offset (s) | dual unmuted (ms) | max playing videos | rAF p95 / max (ms) | rAF >50 ms | LoAF n / max | long tasks n / max | leave: src removed / dim gone (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C_cold_act_chill-hits | network | no-play()-call | -1 | 8 | — | — | — | — | — | 278 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 16.9 | 0 | 0 / 0 | 0 / 0 | 53 / 283 |
| C_cold_act_cue | network | no-play()-call | -1 | 12 | — | — | — | — | — | 277 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 18.3 | 0 | 0 / 0 | 0 / 0 | 56 / 282 |
| C_cold_act_dance-hits | network | no-play()-call | 0 | 6 | — | — | — | — | — | 278 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 55 / 283 |
| C_cold_act_global-top-50 | network | no-play()-call | -1 | 6 | — | — | — | — | — | 275 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17.1 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| C_cold_act_hip-hop-central | network | no-play()-call | 0 | 7 | — | — | — | — | — | 279 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 57 / 283 |
| C_cold_act_late-night | network | no-play()-call | -1 | 8 | — | — | — | — | — | 291 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 18 | 0 | 0 / 0 | 0 / 0 | 56 / 283 |
| C_cold_act_mood-booster | network | no-play()-call | -1 | 7 | — | — | — | — | — | 276 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| C_cold_act_new-music-friday | network | no-play()-call | -1 | 9 | — | — | — | — | — | 290 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 54 / 283 |
| C_cold_act_pop-rising | network | no-play()-call | 0 | 7 | — | — | — | — | — | 278 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 18 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| C_cold_act_top-hindi | network | no-play()-call | 0 | 5 | — | — | — | — | — | 279 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17.3 | 0 | 0 / 0 | 0 / 0 | 58 / 282 |
| C_cold_act_top-kpop | network | no-play()-call | 0 | 5 | — | — | — | — | — | 275 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 54 / 283 |
| C_cold_act_top-tamil | network | no-play()-call | -1 | 8 | — | — | — | — | — | 276 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 54 / 282 |
| C_cold_act_top-telugu | network | no-play()-call | -1 | 9 | — | — | — | — | — | 292 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 16.9 | 0 | 0 / 0 | 0 / 0 | 56 / 283 |
| C_cold_act_viral-50 | network | no-play()-call | -1 | 8 | — | — | — | — | — | 276 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 54 / 283 |
| C_cold_act_workout | network | no-play()-call | 0 | 7 | — | — | — | — | — | 279 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 53 / 282 |

### Recorded (screencast) and traced trials — overhead present, use for visuals only

| Trial | Cache | play() result | src set | req start | 1st byte | loadeddata | canplay | play() call | 1st presented frame | dim 100% | preview layer visible | first visible motion | frozen visible (ms) | P frames | full src set | full 1st frame | full visible | content offset (s) | dual unmuted (ms) | max playing videos | rAF p95 / max (ms) | rAF >50 ms | LoAF n / max | long tasks n / max | leave: src removed / dim gone (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REC_cold_act_global-top-50 | network | no-play()-call | 0 | 6 | — | — | — | — | — | 261 | — | — | 0 | 0 | — | — | — | — | — | 1 | 16.8 / 17 | 0 | 0 / 0 | 0 / 0 | 56 / 283 |
| REC_warm_act_cue | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 7 | 9 | 47 | 47 | 47 | 97 | 277 | 160 | 162 | 0 | 13 | 50 | 447 | 544 | 2.708 | 550 | 3 | 33.5 / 66.5 | 1 | 1 / 63 | 0 / 0 | 54 / 282 |
| REC_warm_act_late-night | warm(disk-cache) | playing→handoff-to-full (full playing) | 0 | 5 | 7 | 47 | 47 | 47 | 60 | 276 | 126 | 151 | 0 | 5 | 48 | 195 | 159 | 2.959 | 233 | 3 | 33.5 / 33.9 | 0 | 0 / 0 | 0 / 0 | 55 / 282 |
| TRACE_warm_act_cue | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 16 | 19 | 48 | 48 | 48 | 95 | 274 | 157 | 158 | 0 | 9 | 51 | 392 | 358 | 2.792 | 433 | 3 | 33.5 / 66.7 | 1 | 1 / 68 | 0 / 0 | 56 / 282 |
| TRACE_warm_act_late-night | warm(disk-cache) | playing→handoff-to-full (full playing) | -1 | 9 | 16 | 43 | 43 | 43 | 75 | 277 | 127 | 146 | 0 | 5 | 45 | 180 | 160 | 2.959 | 233 | 3 | 33.5 / 33.8 | 0 | 0 / 0 | 0 / 0 | 55 / 283 |

### Medians by phase (single-card trials)

| Phase | n | play() resolved | play() rejected (NotAllowedError) | first presented frame (ms) | preview layer visible (ms) | first visible motion (ms) | frozen-visible trials | handoff reached | full first frame (ms) | dual unmuted overlap (ms) | max playing videos | rAF >50 ms per trial | LoAF per trial |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W | 15 | 0 | 15 | 64 | 127 | — | 15 | 0 | — | — | 1 | 0 | 0 |
| B | 24 | 24 | 0 | 64 | 125 | 147 | 0 | 11 | 315 | 233 | 2 | 0 | 0 |
| C | 15 | 0 | 0 | — | — | — | 0 | 0 | — | — | 1 | 0 | 0 |

### Rapid switching (7 adjacent cards, 150 ms apart, then rest on card 7)

| Trial | cache | src assignments | preview files that presented a frame | video requests started / canceled | video bytes | play() rejections | last card: first visible motion after its enter (ms) | dim-without-picture before last card motion (ms) | /api prefetches |
|---|---|---|---|---|---|---|---|---|---|
| B_rapid_warm_act_r1 | warm | 14 | 7 (Beat It_preview_3s.mp4, Radhimaa_preview_3s.mp4, Alaakaa Loova_preview_3s.mp4, Loser_preview_3s.mp4, Kiss Kiss Bang Bang_preview_3s.mp4, Yeshanagula_preview_3s.mp4, Sunflower_preview_3s.mp4) | 21 / 14 | 0 | AbortError | 129 | 100 | 0 |
| B_rapid_warm_act_r2 | warm | 14 | 7 (Beat It_preview_3s.mp4, Radhimaa_preview_3s.mp4, Alaakaa Loova_preview_3s.mp4, Loser_preview_3s.mp4, Kiss Kiss Bang Bang_preview_3s.mp4, Yeshanagula_preview_3s.mp4, Sunflower_preview_3s.mp4) | 20 / 13 | 0 | 0 | 110 | 133 | 0 |
| C_rapid_cold_act | cold | 7 | 0 () | 7 / 7 | 0 | 0 | — | 6933 | 0 |
| REC_warm_act_rapid ⚠ CONTAMINATED (real mouse input) | warm | 18 | 8 (Beat It_preview_3s.mp4, Radhimaa_preview_3s.mp4, Alaakaa Loova_preview_3s.mp4, Loser_preview_3s.mp4, Kiss Kiss Bang Bang_preview_3s.mp4, Yeshanagula_preview_3s.mp4, Sunflower_preview_3s.mp4, God Mode_preview_3s.mp4) | 26 / 18 | 0 | AbortError, AbortError | 143 | 133 | 0 |
| W_rapid_warm_noact | warm | 7 | 7 (Beat It_preview_3s.mp4, Radhimaa_preview_3s.mp4, Alaakaa Loova_preview_3s.mp4, Loser_preview_3s.mp4, Kiss Kiss Bang Bang_preview_3s.mp4, Yeshanagula_preview_3s.mp4, Sunflower_preview_3s.mp4) | 11 / 9 | 0 | NotAllowedError, NotAllowedError, NotAllowedError, NotAllowedError, NotAllowedError, NotAllowedError, NotAllowedError | — | 133 | 0 |

### Preview → full handoff details (trials where the full video presented a frame)

| Trial | full src set | full loadedmetadata | seeking / seeked | full play() resolved | full 1st frame (mediaTime) | full visible | preview paused | preview mediaTime at switch | content offset (s) | gap last P → first F frame (ms) | full frame interval p50 / max, >84 ms count (first 1.5 s) | full mediaTime jumps | full `waiting` | rAF max / >50 ms around handoff | dual unmuted (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B_warm_act_cc | 72 | 78 | 79 / 491 | 493 | 503 (3) | 601 | 697 | 0.292 | 2.708 | 35 | 34 / 133, 3 | 0 | 1 | 83.4 / 2 | 200 |
| B_warm_act_cue | 39 | 46 | 46 / 352 | 352 | 478 (3.042) | 476 | 561 | 0.375 | 2.667 | 0 | 34 / 100, 1 | 0 | 2 | 66.6 / 1 | 500 |
| B_warm_act_cue_r2 | 37 | 52 | 52 / 389 | 390 | 402 (3) | 478 | 592 | 0.25 | 2.75 | 37 | 34 / 111, 1 | 0 | 3 | 66.5 / 2 | 533 |
| B_warm_act_cue_r3 | 55 | 67 | 67 / 418 | 418 | 431 (3) | 526 | 631 | 0.25 | 2.75 | 68 | 66 / 99, 2 | 0 | 2 | 49.9 / 0 | 583 |
| B_warm_act_hip-hop-central | 50 | 57 | 61 / 292 | 293 | 298 (3) | 362 | 503 | 0.167 | 2.833 | 29 | 33 / 116, 1 | 0 | 1 | 33.7 / 0 | 433 |
| B_warm_act_hip-hop-central_r2 | 48 | 58 | 58 / 228 | 229 | 231 (3) | 295 | 432 | 0.125 | 2.875 | 17 | 34 / 100, 1 | 0 | 0 | 33.5 / 0 | 233 |
| B_warm_act_hip-hop-central_r3 | 52 | 63 | 63 / 218 | 220 | 315 (3.042) | 296 | 421 | 0.167 | 2.875 | 34 | 34 / 100, 1 | 0 | 0 | 33.5 / 0 | 217 |
| B_warm_act_late-night | 61 | 73 | 73 / 107 | 107 | 197 (3.042) | 177 | 310 | 0.083 | 2.959 | 0 | 33 / 100, 1 | 0 | 1 | 33.5 / 0 | 217 |
| B_warm_act_late-night_r2 | 54 | 66 | 67 / 96 | 96 | 104 (3) | 160 | 299 | 0 | 3 | 40 | 34 / 93, 1 | 0 | 1 | 33.5 / 0 | 233 |
| B_warm_act_late-night_r3 | 54 | 66 | 66 / 107 | 107 | 214 (3.042) | 178 | 307 | 0.083 | 2.959 | 33 | 34 / 68, 0 | 0 | 1 | 33.5 / 0 | 233 |
| B_warm_act_top-hindi | 63 | 72 | 73 / 352 | 352 | 454 (3.042) | 443 | 556 | 0.292 | 2.75 | 11 | 34 / 67, 0 | 0 | 1 | 33.5 / 0 | 483 |
| REC_warm_act_cue | 50 | 63 | 63 / 439 | 440 | 447 (3) | 544 | 644 | 0.292 | 2.708 | 36 | 34 / 100, 2 | 0 | 2 | 66.5 / 1 | 550 |
| REC_warm_act_late-night | 48 | 54 | 54 / 97 | 98 | 195 (3.042) | 159 | 298 | 0.083 | 2.959 | 13 | 34 / 100, 1 | 0 | 1 | 33.5 / 0 | 233 |
| TRACE_warm_act_cue | 51 | 61 | 61 / 280 | 281 | 392 (3.042) | 358 | 495 | 0.25 | 2.792 | 0 | 67 / 100, 5 | 0 | 2 | 66.7 / 1 | 433 |
| TRACE_warm_act_late-night | 45 | 53 | 53 / 87 | 88 | 180 (3.042) | 160 | 294 | 0.083 | 2.959 | 0 | 66 / 100, 4 | 0 | 1 | 33.8 / 0 | 233 |

### Video network per trial

| Trial | file: requests / bytes / from-cache / canceled | /api/songs |
|---|---|---|
| B_rapid_warm_act_r1 | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 0 / 1 / 1<br>Radhimaa_preview_3s.mp4: 2 / 0 / 2 / 1<br>Radhimaa_30s.mp4: 1 / 0 / 0 / 1<br>Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 1<br>Alaakaa Loova_30s.mp4: 1 / 0 / 0 / 1<br>Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Loser_30s.mp4: 1 / 0 / 1 / 1<br>Kiss Kiss Bang Bang_preview_3s.mp4: 2 / 0 / 2 / 1<br>Kiss Kiss Bang Bang_30s.mp4: 1 / 0 / 0 / 1<br>Yeshanagula_preview_3s.mp4: 2 / 0 / 2 / 1<br>Yeshanagula_30s.mp4: 1 / 0 / 1 / 1<br>Sunflower_preview_3s.mp4: 2 / 0 / 2 / 1<br>Sunflower_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_rapid_warm_act_r2 | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 0 / 1 / 1<br>Radhimaa_preview_3s.mp4: 2 / 0 / 2 / 1<br>Radhimaa_30s.mp4: 1 / 0 / 0 / 1<br>Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 1<br>Alaakaa Loova_30s.mp4: 1 / 0 / 0 / 1<br>Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Loser_30s.mp4: 1 / 0 / 1 / 1<br>Kiss Kiss Bang Bang_preview_3s.mp4: 2 / 0 / 2 / 1<br>Kiss Kiss Bang Bang_30s.mp4: 1 / 0 / 0 / 1<br>Yeshanagula_preview_3s.mp4: 1 / 0 / 1 / 0<br>Yeshanagula_30s.mp4: 1 / 0 / 1 / 1<br>Sunflower_preview_3s.mp4: 2 / 0 / 2 / 1<br>Sunflower_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_cc | God Mode_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_chill-hits | Pavazha Malli_preview_3s.mp4: 2 / 0 / 2 / 1<br>Pavazha Malli_30s.mp4: 1 / 1059235 / 0 / 1 | — |
| B_warm_act_cue | God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 5600153 / 1 / 1 | — |
| B_warm_act_cue_r2 | God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 2064966 / 1 / 1 | — |
| B_warm_act_cue_r3 | God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_dance-hits | Yeshanagula_preview_3s.mp4: 2 / 0 / 2 / 1<br>Yeshanagula_30s.mp4: 1 / 1044646 / 0 / 1 | — |
| B_warm_act_global-top-50 | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 679348 / 0 / 1 | — |
| B_warm_act_global-top-50_r2 | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_global-top-50_r3 | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_hip-hop-central | Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Loser_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_hip-hop-central_r2 | Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Loser_30s.mp4: 2 / 0 / 2 / 2 | — |
| B_warm_act_hip-hop-central_r3 | Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Loser_30s.mp4: 2 / 0 / 2 / 2 | — |
| B_warm_act_late-night | One Of The Girls_preview_3s.mp4: 2 / 0 / 2 / 1<br>One Of The Girls_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_late-night_r2 | One Of The Girls_preview_3s.mp4: 2 / 0 / 2 / 1<br>One Of The Girls_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_late-night_r3 | One Of The Girls_preview_3s.mp4: 2 / 0 / 2 / 1<br>One Of The Girls_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_mood-booster | Sunflower_preview_3s.mp4: 2 / 0 / 2 / 1<br>Sunflower_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_new-music-friday | Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 1<br>Alaakaa Loova_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_pop-rising | Kiss Kiss Bang Bang_preview_3s.mp4: 2 / 0 / 2 / 1<br>Kiss Kiss Bang Bang_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_top-hindi | Gehra Hua_preview_3s.mp4: 2 / 0 / 2 / 1<br>Gehra Hua_30s.mp4: 1 / 0 / 1 / 1 | — |
| B_warm_act_top-kpop | Dynamite_preview_3s.mp4: 2 / 0 / 2 / 1<br>Dynamite_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_top-tamil | Monica_preview_3s.mp4: 2 / 0 / 2 / 1<br>Monica_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_top-telugu | Baby Won't You Tell Me_preview_3s.mp4: 2 / 0 / 2 / 1<br>Baby Won't You Tell Me_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_viral-50 | Radhimaa_preview_3s.mp4: 2 / 0 / 2 / 1<br>Radhimaa_30s.mp4: 1 / 0 / 0 / 1 | — |
| B_warm_act_workout | Big Dawgs_preview_3s.mp4: 2 / 0 / 2 / 1<br>Big Dawgs_30s.mp4: 1 / 1322886 / 0 / 1 | — |
| C_cold_act_chill-hits | Pavazha Malli_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_cue | God Mode_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_dance-hits | Yeshanagula_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_global-top-50 | Beat It_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_hip-hop-central | Loser_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_late-night | One Of The Girls_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_mood-booster | Sunflower_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_new-music-friday | Alaakaa Loova_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_pop-rising | Kiss Kiss Bang Bang_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_top-hindi | Gehra Hua_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_top-kpop | Dynamite_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_top-tamil | Monica_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_top-telugu | Baby Won't You Tell Me_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_viral-50 | Radhimaa_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_cold_act_workout | Big Dawgs_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| C_rapid_cold_act | Beat It_preview_3s.mp4: 1 / 0 / 0 / 1<br>Radhimaa_preview_3s.mp4: 1 / 0 / 0 / 1<br>Alaakaa Loova_preview_3s.mp4: 1 / 0 / 0 / 1<br>Loser_preview_3s.mp4: 1 / 0 / 0 / 1<br>Kiss Kiss Bang Bang_preview_3s.mp4: 1 / 0 / 0 / 1<br>Yeshanagula_preview_3s.mp4: 1 / 0 / 0 / 1<br>Sunflower_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| REC_cold_act_global-top-50 | Beat It_preview_3s.mp4: 1 / 0 / 0 / 1 | — |
| REC_warm_act_cue | God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 0 / 1 / 1 | — |
| REC_warm_act_late-night | One Of The Girls_preview_3s.mp4: 2 / 0 / 2 / 1<br>One Of The Girls_30s.mp4: 1 / 0 / 1 / 0 | — |
| REC_warm_act_rapid ⚠ CONTAMINATED (real mouse input) | Beat It_preview_3s.mp4: 2 / 0 / 2 / 1<br>Beat It_30s.mp4: 1 / 0 / 1 / 1<br>Radhimaa_preview_3s.mp4: 1 / 0 / 1 / 1<br>Radhimaa_30s.mp4: 1 / 0 / 0 / 1<br>Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 1<br>Alaakaa Loova_30s.mp4: 1 / 0 / 0 / 1<br>Loser_preview_3s.mp4: 4 / 0 / 4 / 2<br>Loser_30s.mp4: 2 / 0 / 2 / 2<br>Kiss Kiss Bang Bang_preview_3s.mp4: 2 / 0 / 2 / 1<br>Kiss Kiss Bang Bang_30s.mp4: 1 / 0 / 0 / 1<br>Yeshanagula_preview_3s.mp4: 2 / 0 / 2 / 1<br>Yeshanagula_30s.mp4: 1 / 0 / 1 / 1<br>Sunflower_preview_3s.mp4: 2 / 0 / 2 / 1<br>Sunflower_30s.mp4: 1 / 0 / 0 / 1<br>God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 0 / 1 / 1 | — |
| TRACE_warm_act_cue | God Mode_preview_3s.mp4: 2 / 0 / 2 / 1<br>God Mode_30s.mp4: 1 / 0 / 1 / 1 | — |
| TRACE_warm_act_late-night | One Of The Girls_preview_3s.mp4: 2 / 0 / 2 / 1<br>One Of The Girls_30s.mp4: 1 / 0 / 1 / 1 | — |
| W_rapid_warm_noact | Beat It_preview_3s.mp4: 1 / 0 / 1 / 1<br>Radhimaa_preview_3s.mp4: 1 / 0 / 1 / 1<br>Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 2<br>Loser_preview_3s.mp4: 2 / 0 / 2 / 1<br>Kiss Kiss Bang Bang_preview_3s.mp4: 1 / 0 / 1 / 1<br>Yeshanagula_preview_3s.mp4: 3 / 0 / 3 / 2<br>Sunflower_preview_3s.mp4: 1 / 0 / 1 / 1 | — |
| W_warm_noact_chill-hits | Pavazha Malli_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 3419 ms |
| W_warm_noact_cue | God Mode_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 5368 ms |
| W_warm_noact_dance-hits | Yeshanagula_preview_3s.mp4: 2 / 0 / 2 / 1 | 200 MISS 2040 ms |
| W_warm_noact_global-top-50 | Beat It_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 3043 ms |
| W_warm_noact_hip-hop-central | Loser_preview_3s.mp4: 2 / 0 / 2 / 1 | 200 MISS 2282 ms |
| W_warm_noact_late-night | One Of The Girls_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 5676 ms |
| W_warm_noact_mood-booster | Sunflower_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 2121 ms |
| W_warm_noact_new-music-friday | Alaakaa Loova_preview_3s.mp4: 2 / 0 / 2 / 2 | 200 MISS 2716 ms |
| W_warm_noact_pop-rising | Kiss Kiss Bang Bang_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 1632 ms |
| W_warm_noact_top-hindi | Gehra Hua_preview_3s.mp4: 2 / 0 / 2 / 1 | 200 MISS 7082 ms |
| W_warm_noact_top-kpop | Dynamite_preview_3s.mp4: 1 / 0 / 1 / 0 | 200 MISS 4599 ms |
| W_warm_noact_top-tamil | Monica_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 7321 ms |
| W_warm_noact_top-telugu | Baby Won't You Tell Me_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 4235 ms |
| W_warm_noact_viral-50 | Radhimaa_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 2162 ms |
| W_warm_noact_workout | Big Dawgs_preview_3s.mp4: 1 / 0 / 1 / 1 | 200 MISS 2001 ms |

### Decoders seen (Media domain = media-internals)

- D3D11VideoDecoder platform=true 1920x1440: 8 players
- D3D11VideoDecoder platform=true : 17 players
- D3D11VideoDecoder platform=true 1920x1280: 6 players
- ? platform=? : 42 players
- D3D11VideoDecoder platform=true 1920x1080: 60 players
- D3D11VideoDecoder platform=true 1920x788: 12 players
- D3D11VideoDecoder platform=true 1920x1336: 2 players
- D3D11VideoDecoder platform=true 1080x1080: 16 players

### GPU-process CPU per trial (untraced trials only; % of one core over the trial)

| Phase | median | min | max |
|---|---|---|---|
| W | 54.1 | 50.2 | 69 |
| B | 60.8 | 48.3 | 71.6 |
| C | 53.1 | 45.7 | 67.8 |

Foreign (non-scripted) pointer events across all trials: 17