// Audio Startup Pipeline Diagnostic Logger
const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()

export function logAudioDebug(stage: string, detail?: any) {
  if (process.env.NODE_ENV === 'production') return
  const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime)
  const detailStr = detail !== undefined ? ` | ${typeof detail === 'object' ? JSON.stringify(detail) : detail}` : ''
  console.log(`%c[AUDIO DEBUG] ${stage} +${elapsed.toLocaleString()}ms${detailStr}`, 'color: #00ffff; font-weight: bold;')
}

if (typeof window !== 'undefined') {
  (window as any).__audioDebugLog = logAudioDebug
  if (process.env.NODE_ENV !== 'production') {
    logAudioDebug('navigation started / module evaluated')
  }
}
