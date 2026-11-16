import { NextRequest, NextResponse } from 'next/server'
import { searchSongsByMood } from '@/lib/musicProvider'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').trim()

  if (!query || query.length > 120) {
    return NextResponse.json({ songs: [], error: 'Enter a search between 1 and 120 characters.' }, { status: 400 })
  }

  try {
    const songs = await searchSongsByMood(query)
    return NextResponse.json({ songs }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } })
  } catch (err) {
    console.error('Search API error:', err)
    return NextResponse.json({ songs: [], error: 'Search is temporarily unavailable. Please try again.' }, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
  }
}
