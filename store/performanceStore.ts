'use client'
import { create } from 'zustand'

// ─── Fixed performance constants ─────────────────────────────────────────────
// 1,000 tracks is the permanent target — enough for a full, lush media wall
// while keeping the render loop buttery smooth at 60 fps.
export const TARGET_TRACK_COUNT = 1000

interface PerformanceStore {
  fps: number
  setFps: (fps: number) => void
}

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  fps: 60,
  setFps: (fps) => set({ fps }),
}))
