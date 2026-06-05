import { NextResponse } from 'next/server'
import { Vibe } from '@/lib/types'
import { fetchTopSongByVibe } from '@/lib/musicProvider'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vibe = searchParams.get('vibe') as Vibe

  if (!vibe) {
    return NextResponse.json({ error: 'Missing vibe parameter' }, { status: 400 })
  }

  try {
    const topSong = await fetchTopSongByVibe(vibe)
    return NextResponse.json({ song: topSong })
  } catch (error) {
    console.error('API /songs/top error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
