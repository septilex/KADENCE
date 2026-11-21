/** Adaptive low-band positive spectral flux. No tempo clock or volume-following output. */
export class BassOnset {
  readonly metrics = { energy: 0, flux: 0, threshold: 0 }
  private previous = new Float32Array(0)
  private energy = 0
  private fluxMean = 0
  private deviation = 0
  private lastTime = -1
  private lastBeat = -Infinity
  private age = 0
  reset() { this.previous.fill(0); this.energy = 0; this.fluxMean = 0; this.deviation = 0; this.lastTime = -1; this.lastBeat = -Infinity; this.age = 0 }
  sample(db: Float32Array, sampleRate: number, fftSize: number, time: number): number {
    const lo = Math.max(1, Math.ceil(35 * fftSize / sampleRate))
    const hi = Math.min(db.length - 1, Math.floor(180 * fftSize / sampleRate))
    if (hi < lo) return 0
    if (this.previous.length !== db.length) { this.previous = new Float32Array(db.length); this.reset() }
    const dt = this.lastTime < 0 ? 0 : Math.max(0, time - this.lastTime)
    if (dt > 250) this.reset()
    this.lastTime = time
    this.age += Math.min(dt, 50)
    let energy = 0, flux = 0
    for (let i = lo; i <= hi; i++) {
      const value = Number.isFinite(db[i]) ? Math.pow(10, db[i] / 20) : 0
      energy += value
      flux += Math.max(0, value - this.previous[i])
      this.previous[i] = value
    }
    energy /= hi - lo + 1; flux /= hi - lo + 1
    const threshold = Math.max(0.00015, this.fluxMean + 2.5 * this.deviation)
    this.metrics.energy = energy; this.metrics.flux = flux; this.metrics.threshold = threshold
    const attack = energy > Math.max(0.001, this.energy * 1.18) && flux > threshold && flux > energy * 0.12
    const strength = attack && this.age > 180 && time - this.lastBeat >= 200
      ? Math.min(1, Math.max(0.15, (flux / Math.max(threshold, energy * 0.3) - 1) / 3)) : 0
    if (strength) this.lastBeat = time
    const alpha = 1 - Math.exp(-Math.min(dt || 16, 50) / 700)
    this.deviation += (Math.abs(flux - this.fluxMean) - this.deviation) * alpha
    this.fluxMean += (flux - this.fluxMean) * alpha
    this.energy += (energy - this.energy) * (energy > this.energy ? 0.65 : 0.12)
    return strength
  }
}
