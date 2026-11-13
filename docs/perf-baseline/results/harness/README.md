# Measurement harness (S1-cold, S2)

Read-only measurement scripts used for the S1-cold and S2 runs, copied here so the runs can be reproduced. They are **not** application code and are not imported by the app.

- Node 26 built-ins only (WebSocket, fetch, zlib); nothing installed.
- They launch a **separate** Brave instance with a throwaway `--user-data-dir` and a local DevTools debugging port (9333). `PROFILE` in `cdp.mjs` points to that throwaway folder; adjust it before reuse.

| Script | Purpose |
|---|---|
| `cdp.mjs` | Minimal Chrome DevTools Protocol client, Brave launcher, 60 s per-call timeout |
| `s1cold.mjs` / `analyze_s1cold.mjs` | Cold-cache homepage load + 15 s idle, traces, network log, process CPU |
| `s2early.js` | In-page instrumentation injected before page scripts (media API wrappers, rVFC presented frames, per-frame visibility, LoAF / long tasks, pointer log) |
| `s2.mjs` | S2 trial driver (phases `pilot`, `main`, `wrec`) |
| `analyze_s2.mjs` / `aggregate_s2.mjs` | Per-trial metrics and markdown tables |
| `prewarm.mjs` | Pre-fetch intro media into the throwaway profile's cache (warm trials) |
| `content_check.mjs` | Preview ↔ full frame-signature alignment |
| `s3extra.js` | S3 extra in-page instrumentation (atlas uploads, draws, artwork image loads, Audio() events, loader/intro DOM state) |
| `s3.mjs` / `analyze_s3.mjs` | S3 chart-entry driver (env `BLOCK_GLOBE=1` = globe-blocked experiment) and analyser |
| `filmstrip.mjs` | Extract trace screenshots into a flipbook (the S3 trace had none) |
| `s4extra.js` | S4 in-page instrumentation (React DevTools-style commit hook, tooltip changes, audio pool/status Map sampler) |
| `s4.mjs` / `analyze_s4.mjs` | S4 60 s interaction driver and analyser |
| `tracescan.mjs` | Streaming `TimerFire` extraction from large gzip traces |
