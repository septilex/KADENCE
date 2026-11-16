'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SongNode, Vibe } from '@/lib/types'

/** The subset of a song the library keeps (small enough to persist hundreds of them). */
export interface LibrarySong {
  id: string
  name: string
  artist: string
  album: string
  albumArt: string
  previewUrl: string | null
  spotifyUrl: string
  genres: string[]
  color: string
}

export interface PlayRecord {
  song: LibrarySong
  count: number
  lastPlayed: number
}

export type HubPanel = 'discover' | 'search' | 'library' | 'profile'

interface LibraryState {
  /** Listening history, keyed by song id. Everything here stays in this browser. */
  plays: Record<string, PlayRecord>
  liked: Record<string, { song: LibrarySong; likedAt: number }>
  vibeVisits: Partial<Record<Vibe, number>>
  displayName: string
  /** Which hub panel is open (not persisted). */
  activePanel: HubPanel | null

  recordPlay: (song: SongNode | LibrarySong) => void
  toggleLike: (song: SongNode | LibrarySong) => void
  recordVibe: (vibe: Vibe) => void
  setDisplayName: (name: string) => void
  openPanel: (panel: HubPanel | null) => void
  clearHistory: () => void
}

const MAX_TRACKED_SONGS = 400

export function toLibrarySong(song: SongNode | LibrarySong): LibrarySong {
  return {
    id: song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    albumArt: song.albumArt,
    previewUrl: song.previewUrl,
    spotifyUrl: song.spotifyUrl,
    genres: song.genres ?? [],
    color: song.color,
  }
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      plays: {},
      liked: {},
      vibeVisits: {},
      displayName: '',
      activePanel: null,

      recordPlay: (song) => set((state) => {
        const previous = state.plays[song.id]
        const plays = {
          ...state.plays,
          [song.id]: { song: toLibrarySong(song), count: (previous?.count ?? 0) + 1, lastPlayed: Date.now() },
        }
        // Bound storage: drop the least recently played songs beyond the cap.
        const ids = Object.keys(plays)
        if (ids.length > MAX_TRACKED_SONGS) {
          ids.sort((a, b) => plays[a].lastPlayed - plays[b].lastPlayed)
          for (const id of ids.slice(0, ids.length - MAX_TRACKED_SONGS)) delete plays[id]
        }
        return { plays }
      }),

      toggleLike: (song) => set((state) => {
        const liked = { ...state.liked }
        if (liked[song.id]) delete liked[song.id]
        else liked[song.id] = { song: toLibrarySong(song), likedAt: Date.now() }
        return { liked }
      }),

      recordVibe: (vibe) => set((state) => ({
        vibeVisits: { ...state.vibeVisits, [vibe]: (state.vibeVisits[vibe] ?? 0) + 1 },
      })),

      setDisplayName: (displayName) => set({ displayName: displayName.slice(0, 24) }),
      openPanel: (activePanel) => set({ activePanel }),
      clearHistory: () => set({ plays: {}, vibeVisits: {} }),
    }),
    {
      name: 'kadence-library-v1',
      partialize: (state) => ({
        plays: state.plays,
        liked: state.liked,
        vibeVisits: state.vibeVisits,
        displayName: state.displayName,
      }),
    },
  ),
)
