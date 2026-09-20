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
    optimizePackageImports: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  async headers() {
    return [
      {
        source: '/videos/:path*.mp4',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
