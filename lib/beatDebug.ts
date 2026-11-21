/** Mutable, development-only telemetry; never drives rendering or beat decisions. */
export const beatDebug = { source: '', media: '', playing: false, context: 'not created', status: 'waiting for visible homepage media', readable: false, bass: 0, flux: 0, threshold: 0, beats: 0, animations: 0, surface: '', transform: '', error: '' }
export function debugEnabled() { return process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location?.search).get('beatDebug') === '1' }
export function updateBeatDebug(values: Partial<typeof beatDebug>) { if (debugEnabled()) Object.assign(beatDebug, values) }
export function installBeatDebug() {
  if (!debugEnabled()) return () => {}
  const panel = document.createElement('pre')
  panel.setAttribute('data-beat-debug', '')
  panel.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:2147483647;max-width:min(620px,95vw);max-height:45vh;overflow:auto;background:#05080fed;color:#9fffc4;padding:12px;font:12px/1.5 monospace;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ffffff40'
  document.body.appendChild(panel)
  const draw = () => { const target = document.querySelector<HTMLElement>('[data-beat-surface="active"]'); beatDebug.transform = target ? getComputedStyle(target).transform : 'no active wrapper'; panel.textContent = 'KADENCE beat diagnostics (development only)\n' + JSON.stringify(beatDebug, null, 2) }
  draw(); const timer = setInterval(draw, 250)
  return () => { clearInterval(timer); panel.remove() }
}
