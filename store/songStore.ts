'use client'
import { create } from 'zustand'
import { SongNode, Vibe } from '@/lib/types'

interface SongStore {
  songs: SongNode[]
  selectedSong: SongNode | null
  hoveredSong: SongNode | null
  isLoading: boolean
  loadingProgress: number
  introComplete: boolean
  currentVibe: Vibe | null
  isRefreshing: boolean
  isChangingVibe: boolean

  setSongs: (songs: SongNode[]) => void
  selectSong: (song: SongNode | null) => void
  hoverSong: (song: SongNode | null) => void
  setLoading: (loading: boolean, progress?: number) => void
  setIntroComplete: (complete: boolean) => void
  setVibe: (vibe: Vibe) => void
  setRefreshing: (refreshing: boolean) => void
  setChangingVibe: (changing: boolean) => void
  updateNodePosition: (id: string, x: number, y: number) => void
}

export const useSongStore = create<SongStore>((set) => ({
  songs: [],
  selectedSong: null,
  hoveredSong: null,
  isLoading: true,
  loadingProgress: 0,
  introComplete: false,
  currentVibe: null,
  isRefreshing: false,
  isChangingVibe: false,

  setSongs: (songs) => set({ songs }),
  selectSong: (selectedSong) => set({ selectedSong }),
  hoverSong: (hoveredSong) => set({ hoveredSong }),
  setLoading: (isLoading, loadingProgress) =>
    set({ isLoading, ...(loadingProgress !== undefined && { loadingProgress }) }),
  setIntroComplete: (introComplete) => set({ introComplete }),
  setVibe: (currentVibe) => set({ currentVibe }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setChangingVibe: (isChangingVibe) => set({ isChangingVibe }),
  updateNodePosition: (id, x, y) =>
    set((state) => ({
      songs: state.songs.map(s => s.id === id ? { ...s, x, y } : s)
    })),
}))
