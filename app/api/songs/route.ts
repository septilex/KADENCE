import { NextRequest, NextResponse } from 'next/server'
import { fetchChart } from '@/lib/musicProvider'
import type { SongNode, Vibe } from '@/lib/types'

/**
 * GET /api/songs?vibe=<chart>&rotation=<n>
 *
 * `rotation` is 0 for a normal visit and increases by one on each refresh. Each rotation is a
 * different selection (different keyword top-up batch and a different lead section of the wall)
 * and is cached under its own key — server memory and CDN alike — so a refresh really returns
 * new songs while Apple is still asked at most once per chart/rotation per cache window.
 */

const VALID_VIBES: Vibe[] = [
  'global-top-50', 'viral-50', 'new-music-friday', 'hip-hop-central',
  'pop-rising', 'dance-hits', 'mood-booster', 'late-night',
  'workout', 'chill-hits', 'dev-special',
  'top-telugu', 'top-tamil', 'top-hindi', 'top-kpop',
]

/** Rotations wrap after this many refreshes (the keyword batches and wall offsets cycle by then). */
const ROTATIONS = 12
const CACHE_TTL = 20 * 60 * 1000        // complete charts
const PARTIAL_TTL = 2 * 60 * 1000       // a chart built while some Apple chart was unreachable
const STALE_LIMIT = 24 * 60 * 60 * 1000 // serve this old on upstream failure, never older

const cache = new Map<string, { songs: SongNode[]; time: number; ttl: number }>()
const inFlight = new Map<string, Promise<SongNode[]>>()
const headers = { 'Cache-Control': 'public, max-age=60, s-maxage=1200, stale-while-revalidate=1800' }
const partialHeaders = { 'Cache-Control': 'public, max-age=30, s-maxage=120' }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vibeParam = searchParams.get('vibe')
  if (vibeParam && !VALID_VIBES.includes(vibeParam as Vibe)) {
    return NextResponse.json({ error: 'Unknown chart' }, { status: 400 })
  }
  const vibe = (vibeParam || 'global-top-50') as Vibe
  const rotationParam = Number.parseInt(searchParams.get('rotation') ?? '0', 10)
  const rotation = Number.isFinite(rotationParam) && rotationParam > 0 ? rotationParam % ROTATIONS : 0
  const key = `${vibe}:${rotation}`

  const cached = cache.get(key)
  const age = cached ? Date.now() - cached.time : Infinity
  if (cached && age < cached.ttl) {
    return NextResponse.json({ songs: cached.songs, total: cached.songs.length, cached: true, vibe, rotation },
      { headers: cached.ttl === CACHE_TTL ? headers : partialHeaders })
  }
  try {
    let request = inFlight.get(key)
    if (!request) {
      request = fetchChart(vibe, 256, rotation).then(({ songs, complete }) => {
        if (!songs.length) throw new Error('No tracks available')
        cache.set(key, { songs, time: Date.now(), ttl: complete ? CACHE_TTL : PARTIAL_TTL })
        while (cache.size > 64) cache.delete(cache.keys().next().value!)
        return songs
      }).finally(() => inFlight.delete(key))
      inFlight.set(key, request)
    }
    const songs = await request
    const fresh = cache.get(key)
    return NextResponse.json({ songs, total: songs.length, vibe, rotation },
      { headers: fresh?.ttl === CACHE_TTL ? headers : partialHeaders })
  } catch (error) {
    console.error('Songs API error:', error)
    if (cached && age < STALE_LIMIT) {
      return NextResponse.json({ songs: cached.songs, total: cached.songs.length, vibe, rotation, stale: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ error: 'This chart is temporarily unavailable. Please try again.' }, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
  }
}
