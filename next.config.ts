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
}

export default nextConfig
