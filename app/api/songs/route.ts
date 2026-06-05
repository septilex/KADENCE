import { NextRequest, NextResponse } from 'next/server'
import { fetchSongsByVibe } from '@/lib/spotify'
import { generateDemoSongs } from '@/lib/demoData'
import { Vibe } from '@/lib/types'

// Per-vibe cache — each vibe gets its own set of curated tracks
const vibeCache = new Map<string, { songs: unknown[]; time: number }>()
const CACHE_TTL = 20 * 60 * 1000 // 20 minutes

const VALID_VIBES: Vibe[] = [
  'global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central',
  'pop-rising', 'dance-hits', 'mood-booster', 'late-night',
  'workout', 'chill-hits',
]

// Keep track of refresh counts per vibe to shift/rotate seed indices on refresh requests
const refreshCounts = new Map<string, number>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vibeParam = searchParams.get('vibe') as Vibe | null
  const refresh = searchParams.get('refresh') === '1'
  const vibe: Vibe = (vibeParam && VALID_VIBES.includes(vibeParam)) ? vibeParam : 'global-top-50'

  // Check if Spotify is configured
  const hasSpotify = !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_ID !== 'your_spotify_client_id_here' &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_CLIENT_SECRET !== 'your_spotify_client_secret_here'
  )

  console.log('[DIAG:route] vibe:', vibe, '| hasSpotify:', hasSpotify, '| refresh:', refresh)

  if (!hasSpotify) {
    console.warn('[DIAG:route] Spotify not configured — returning demo songs')
    const demo = generateDemoSongs(1000, vibe)
    return NextResponse.json({ songs: demo, total: demo.length, demo: true, vibe })
  }

  try {
    const cached = vibeCache.get(vibe)
    const isFresh = cached && (Date.now() - cached.time < CACHE_TTL) && !refresh
    console.log('[DIAG:route] Cache check — has cached entry:', !!cached, '| isFresh:', isFresh, '| cached songs count:', cached?.songs?.length ?? 'n/a')

    if (isFresh && cached) {
      console.log('[DIAG:route] Returning CACHED result:', cached.songs.length, 'songs')
      return NextResponse.json({
        songs: cached.songs,
        total: cached.songs.length,
        cached: true,
        vibe,
      })
    }

    // Increment refresh rotation index
    let offset = 0
    if (refresh) {
      const currentVal = refreshCounts.get(vibe) || 0
      offset = currentVal + 1
      refreshCounts.set(vibe, offset)
    }

    const songs = await fetchSongsByVibe(vibe, 1000, offset)
    console.log('[DIAG:route] fetchSongsByVibe returned:', songs.length, 'songs')

    if (songs.length === 0) {
      throw new Error('Spotify API returned 0 songs, possibly due to rate limits')
    }

    vibeCache.set(vibe, { songs, time: Date.now() })
    console.log('[DIAG:route] Responding with', songs.length, 'songs for vibe:', vibe)
    return NextResponse.json({ songs, total: songs.length, vibe })
  } catch (err) {
    console.error('Songs API error, falling back to demo:', err)
    const demo = generateDemoSongs(1000, vibe)
    return NextResponse.json({ songs: demo, total: demo.length, demo: true, vibe })
  }
}
