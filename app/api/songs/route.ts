import { NextRequest, NextResponse } from 'next/server'
import { fetchSongsByVibe } from '@/lib/musicProvider'
import { Vibe } from '@/lib/types'

// Per-vibe cache — each vibe gets its own set of tracks
const vibeCache = new Map<string, { songs: unknown[]; time: number }>()
const CACHE_TTL = 20 * 60 * 1000 // 20 minutes

const VALID_VIBES: Vibe[] = [
  'global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central',
  'pop-rising', 'dance-hits', 'mood-booster', 'late-night',
  'workout', 'chill-hits', 'dev-special',
  'top-telugu', 'top-tamil', 'top-hindi', 'top-kpop',
]

const inFlight = new Map<Vibe, Promise<import('@/lib/types').SongNode[]>>()
const successHeaders = { 'Cache-Control': 'public, max-age=60, s-maxage=1200, stale-while-revalidate=3600' }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vibeParam = searchParams.get('vibe')
  if (vibeParam && !VALID_VIBES.includes(vibeParam as Vibe)) {
    return NextResponse.json({ error: 'Unknown chart' }, { status: 400 })
  }
  const vibe = (vibeParam || 'global-top-50') as Vibe
  const refresh = searchParams.get('refresh') === '1'
  const cached = vibeCache.get(vibe)
  // Refresh reuses recently fetched data instead of multiplying upstream traffic.
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return NextResponse.json({ songs: cached.songs, total: cached.songs.length, cached: true, vibe }, { headers: refresh ? { 'Cache-Control': 'no-store' } : successHeaders })
  }
  try {
    let request = inFlight.get(vibe)
    if (!request) {
      request = fetchSongsByVibe(vibe, 256).then(songs => {
        if (!songs.length) throw new Error('No tracks available')
        vibeCache.set(vibe, { songs, time: Date.now() })
        return songs
      }).finally(() => inFlight.delete(vibe))
      inFlight.set(vibe, request)
    }
    const songs = await request
    return NextResponse.json({ songs, total: songs.length, vibe }, { headers: refresh ? { 'Cache-Control': 'no-store' } : successHeaders })
  } catch (error) {
    console.error('Songs API error:', error)
    if (cached && Date.now() - cached.time < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ songs: cached.songs, total: cached.songs.length, vibe, stale: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ error: 'This chart is temporarily unavailable. Please try again.' }, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
  }
}
