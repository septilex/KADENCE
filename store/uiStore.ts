'use client'
import { create } from 'zustand'

interface UIStore {
  isSearchOpen: boolean
  searchQuery: string
  isDetailOpen: boolean
  viewMode: 'explore' | 'search' | 'detail'
  activeCategoryVideo: string | null
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  setDetailOpen: (open: boolean) => void
  setViewMode: (mode: 'explore' | 'search' | 'detail') => void
  setActiveCategoryVideo: (url: string | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  isDetailOpen: false,
  viewMode: 'explore',
  activeCategoryVideo: null,
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailOpen: (isDetailOpen) => set({ isDetailOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveCategoryVideo: (activeCategoryVideo) => set({ activeCategoryVideo }),
}))

