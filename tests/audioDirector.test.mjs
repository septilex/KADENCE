import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startAudioDirector, HOVER_DWELL_MS } from '../lib/audioDirector.ts'
import { useSongStore } from '../store/songStore.ts'
import { useAudioStore } from '../store/audioStore.ts'

test('selection promotes a pending hover immediately and resumes the same paused source', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const previousWindow = globalThis.window
  globalThis.window = {}
  useSongStore.setState({ selectedSong: null, hoveredSong: null, isRefreshing: false, isChangingVibe: false })
  useAudioStore.setState({ currentUrl: null, isPlaying: false })
  const stop = startAudioDirector()
  try {
    const song = { id: 'one', previewUrl: 'https://test/one' }
    useSongStore.getState().hoverSong(song)
    assert.equal(useAudioStore.getState().currentUrl, null)
    useSongStore.getState().selectSong(song)
    assert.equal(useAudioStore.getState().currentUrl, song.previewUrl)
    assert.equal(useAudioStore.getState().beatEligible, true)
    useAudioStore.getState().pause()
    t.mock.timers.tick(HOVER_DWELL_MS + 1)
    assert.equal(useAudioStore.getState().isPlaying, false, 'obsolete hover must not resume audio')
    useSongStore.getState().selectSong({ ...song })
    assert.equal(useAudioStore.getState().isPlaying, true)
  } finally { stop(); globalThis.window = previousWindow; t.mock.timers.reset() }
})

test('rapid hover is debounced and a track without a preview stops old audio', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const previousWindow = globalThis.window
  globalThis.window = {}
  useSongStore.setState({ selectedSong: null, hoveredSong: null, isRefreshing: false, isChangingVibe: false })
  useAudioStore.setState({ currentUrl: null, isPlaying: false })
  const stop = startAudioDirector()
  try {
    useSongStore.getState().hoverSong({ id: 'one', previewUrl: 'one' })
    t.mock.timers.tick(100)
    useSongStore.getState().hoverSong({ id: 'two', previewUrl: 'two' })
    t.mock.timers.tick(100)
    assert.equal(useAudioStore.getState().currentUrl, null)
    t.mock.timers.tick(HOVER_DWELL_MS)
    assert.equal(useAudioStore.getState().currentUrl, 'two')
    assert.equal(useAudioStore.getState().beatEligible, false)
    useSongStore.getState().selectSong({ id: 'silent', previewUrl: null })
    assert.equal(useAudioStore.getState().currentUrl, null)
  } finally { stop(); globalThis.window = previousWindow; t.mock.timers.reset() }
})
