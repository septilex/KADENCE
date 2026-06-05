import { NextResponse } from 'next/server'
import { Vibe } from '@/lib/types'
import { fetchChartPreviews } from '@/lib/musicProvider'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vibe = searchParams.get('vibe') as Vibe

  if (!vibe) {
    return NextResponse.json({ error: 'Missing vibe parameter' }, { status: 400 })
  }

  try {
    const songs = await fetchChartPreviews(vibe)
    return NextResponse.json({ songs })
  } catch (error) {
    console.error('API /songs/chart-previews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
