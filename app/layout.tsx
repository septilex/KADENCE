import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KADENCE — Music Discovery Universe',
  description: 'Explore thousands of songs through an immersive 3D floating music universe. Search by mood, vibe, genre, or artist.',
  keywords: ['music discovery', 'itunes', 'interactive', 'visualization', '3D', 'songs'],
  openGraph: {
    title: 'KADENCE — Music Discovery Universe',
    description: 'Explore thousands of songs in an immersive 3D floating music universe.',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#050508',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Syncopate:wght@700&family=Space+Grotesk:wght@400;500;600;700;900&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050508] text-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
