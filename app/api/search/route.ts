import { NextRequest, NextResponse } from 'next/server'
import { searchSongsByMood } from '@/lib/musicProvider'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''

  if (!query.trim()) {
    return NextResponse.json({ songs: [], error: 'No query provided' }, { status: 400 })
  }

  try {
    const songs = await searchSongsByMood(query)
    return NextResponse.json({ songs })
  } catch (err) {
    console.error('Search API error:', err)
    return NextResponse.json({ songs: [], error: 'Search failed' }, { status: 500 })
  }
}
