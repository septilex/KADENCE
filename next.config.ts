import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'i.scdn.co' },
      { hostname: 'mosaic.scdn.co' },
      { hostname: 'lineup-images.scdn.co' },
      { hostname: 'seed-mix-image.spotifycdn.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['three', '@react-three/fiber'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ] },
      {
        source: '/videos/:path*.mp4',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
}

export default nextConfig
