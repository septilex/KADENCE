# Homepage hover playback — 18 November 2026

Confirmed: fifteen 3-second preview files totalled 31,904,768 bytes. Each hover began with a cold media load; full videos (up to 30.6 MB) began downloading immediately after playback. Browser policy also blocks audible autoplay without interaction.

Changes: new versioned 640px H.264/AAC fast-start clips, total 3,805,073 bytes (88.1% reduction); sequential browser-cache warming with Save-Data opt-out; full-video preparation deferred 1.5 seconds and cancelled on leave; explicit Enable preview sound control. Existing original videos remain intact.

Validation: TypeScript and 12 regression tests pass. These tests cover audio lifecycle, atlas, picking and provider logic; they do not establish hover startup latency. Production build result is in hover-build.log. No deployed Vercel latency measurement or deployment was performed in this change. Verify cold and warm hovers on the deployed URL, with normal autoplay policy, including a fresh visitor before/after clicking Enable preview sound. Offline or slow connections cannot guarantee instantaneous playback.

References: https://developer.chrome.com/blog/autoplay and https://vercel.com/docs/caching/cdn-cache
