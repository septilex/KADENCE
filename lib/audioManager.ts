'use client'

/**
 * Singleton Audio Manager for Kadence.
 * 
 * Safely routes multiple HTMLVideoElements into a single AnalyserNode 
 * WITHOUT duplicate sources, connection toggling overhead, or memory leaks.
 */

class AudioManager {
  ctx: AudioContext | null = null
  analyser: AnalyserNode | null = null
  private sources = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>()

  private init() {
    if (this.ctx) return
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    this.ctx = new AudioContextClass()
    this.analyser = this.ctx.createAnalyser()
    
    // Smooth out the high frequency noise, focus on clear temporal beats
    this.analyser.smoothingTimeConstant = 0.8
    this.analyser.fftSize = 256
    
    this.analyser.connect(this.ctx.destination)
  }

  /**
   * Routes an HTMLVideoElement's audio into the Web Audio graph.
   * Ensures exactly ONE MediaElementAudioSourceNode per element lifetime.
   */
  connectVideo(video: HTMLVideoElement) {
    if (typeof window === 'undefined') return
    if (!this.ctx) this.init()
    if (!this.ctx || !this.analyser) return

    // Never re-create source nodes for the same element
    if (this.sources.has(video)) return

    try {
      const source = this.ctx.createMediaElementSource(video)
      
      // Both dual-slot videos are permanently connected to the analyser.
      // A paused/muted video outputs silence, adding 0 noise to the signal.
      // This completely avoids the risks of dynamic connect/disconnect during rapid hover.
      source.connect(this.analyser)
      
      this.sources.set(video, source)
    } catch (e) {
      console.warn('Kadence Audio: Failed to route video to AudioContext', e)
    }
  }

  getAnalyser() {
    return this.analyser
  }

  /**
   * Resumes the AudioContext after user interaction (browser policy requirement)
   */
  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }
}

export const globalAudioManager = new AudioManager()
