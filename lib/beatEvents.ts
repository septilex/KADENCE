type Listener = (strength: number) => void
const listeners = new Set<Listener>()
/** Zero means cancel the current impact and restore rest. */
export function emitBeat(strength: number) { for (const listener of listeners) listener(strength) }
export function subscribeBeats(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener) } }

const surfaces = new Set<object>()
const defaultOwner = {}
let surfaceActive = false
const surfaceListeners = new Set<() => void>()
export const isBeatSurfaceActive = () => surfaceActive
export function setBeatSurfaceActive(value: boolean, owner: object = defaultOwner) {
  if (value) surfaces.add(owner); else surfaces.delete(owner)
  const active = surfaces.size > 0
  if (active === surfaceActive) return
  surfaceActive = active
  for (const listener of surfaceListeners) listener()
}
export function subscribeBeatSurface(listener: () => void) { surfaceListeners.add(listener); return () => { surfaceListeners.delete(listener) } }
