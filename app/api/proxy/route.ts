import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  const FALLBACK_URL = 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36'

  try {
    let res = await fetch(url)
    
    // If the original URL (e.g. fake hash) fails, gracefully fallback
    if (!res.ok) {
      res = await fetch(FALLBACK_URL)
      if (!res.ok) throw new Error(`Fallback returned ${res.status}`)
    }
    
    const buffer = await res.arrayBuffer()
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse('Failed to fetch image', { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
