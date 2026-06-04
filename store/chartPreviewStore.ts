import { create } from 'zustand'
import { SongNode, Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'

interface ChartPreviewStoreState {
  previews: Record<string, SongNode[]>
  isPreloading: boolean
  preloadAll: () => Promise<void>
}

export const useChartPreviewStore = create<ChartPreviewStoreState>((set, get) => ({
  previews: {},
  isPreloading: false,

  preloadAll: async () => {
    if (get().isPreloading || Object.keys(get().previews).length > 0) return
    set({ isPreloading: true })

    // Fetch in parallel chunks to avoid hammering the network instantly
    const vibes = VIBE_CONFIGS.map(v => v.id)
    const newPreviews: Record<string, SongNode[]> = {}

    const fetchVibe = async (vibeId: Vibe) => {
      try {
        const res = await fetch(`/api/songs/chart-previews?vibe=${vibeId}`)
        const data = await res.json()
        if (data.songs) {
          newPreviews[vibeId] = data.songs
        }
      } catch (e) {
        console.error(`Failed to preload ${vibeId}`, e)
      }
    }

    // Process 3 at a time
    for (let i = 0; i < vibes.length; i += 3) {
      const chunk = vibes.slice(i, i + 3)
      await Promise.allSettled(chunk.map(fetchVibe))
    }

    set({ previews: newPreviews, isPreloading: false })
  }
}))
