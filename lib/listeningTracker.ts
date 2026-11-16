import { useAudioStore } from '@/store/audioStore'
import { useSongStore } from '@/store/songStore'
import { useLibraryStore, toLibrarySong, type LibrarySong } from '@/store/libraryStore'
import type { SongNode } from '@/lib/types'

/** A preview counts as "played" once it has been audible for this long without a break. */
export const PLAY_THRESHOLD_MS = 8000

// Songs started from the hub panels (search, library, profile) are not on the wall, so the
// tracker cannot find them in the song store. They are remembered here by preview URL.
const requested = new Map<string, LibrarySong>()

/** Play a song from anywhere in the UI and make sure the tracker can attribute the play. */
export function playSong(song: SongNode | LibrarySong) {
  if (!song.previewUrl) return
  requested.set(song.previewUrl, toLibrarySong(song))
  const audio = useAudioStore.getState()
  if (audio.currentUrl === song.previewUrl) audio.togglePlay()
  else audio.playUrl(song.previewUrl)
}

function findSong(url: string): SongNode | LibrarySong | null {
  const { selectedSong, hoveredSong, songs } = useSongStore.getState()
  if (selectedSong?.previewUrl === url) return selectedSong
  if (hoveredSong?.previewUrl === url) return hoveredSong
  return songs.find((s) => s.previewUrl === url) ?? requested.get(url) ?? null
}

let started = false

/**
 * Builds the listening history behind the profile: counts a play after PLAY_THRESHOLD_MS of
 * continuous playback, and counts every chart the listener opens. Runs outside React.
 */
export function startListeningTracker(): () => void {
  if (started || typeof window === 'undefined') return () => {}
  started = true

  let timer: ReturnType<typeof setTimeout> | null = null
  let countedUrl: string | null = null
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }

  const evaluate = () => {
    const { currentUrl, isPlaying } = useAudioStore.getState()
    clear()
    if (!currentUrl || !isPlaying || currentUrl === countedUrl) return
    timer = setTimeout(() => {
      timer = null
      const now = useAudioStore.getState()
      if (now.currentUrl !== currentUrl || !now.isPlaying) return
      const song = findSong(currentUrl)
      if (!song) return
      countedUrl = currentUrl
      useLibraryStore.getState().recordPlay(song)
    }, PLAY_THRESHOLD_MS)
  }

  const unsubscribeAudio = useAudioStore.subscribe((state, prev) => {
    if (state.currentUrl !== prev.currentUrl) countedUrl = null
    if (state.currentUrl !== prev.currentUrl || state.isPlaying !== prev.isPlaying) evaluate()
  })
  const unsubscribeSongs = useSongStore.subscribe((state, prev) => {
    if (state.currentVibe && state.currentVibe !== prev.currentVibe) useLibraryStore.getState().recordVibe(state.currentVibe)
  })
  evaluate()

  return () => { clear(); unsubscribeAudio(); unsubscribeSongs(); started = false }
}
