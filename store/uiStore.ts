'use client'
import { create } from 'zustand'

interface UIStore {
  isSearchOpen: boolean
  searchQuery: string
  isDetailOpen: boolean
  viewMode: 'explore' | 'search' | 'detail'
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  setDetailOpen: (open: boolean) => void
  setViewMode: (mode: 'explore' | 'search' | 'detail') => void
}

export const useUIStore = create<UIStore>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  isDetailOpen: false,
  viewMode: 'explore',
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailOpen: (isDetailOpen) => set({ isDetailOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
}))
