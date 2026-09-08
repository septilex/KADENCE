'use client'
import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoaderProps {
  size?: number
  text?: string
}

const MUSIC_WORDS = [
  'Generating',
  'Tuning',
  'Mixing',
  'Rapping',
  'Composing',
  'Producing',
  'Creating',
  'Vibing',
  'Mastering',
  'Synthesizing',
] as const

export const GlowingRingLoader: React.FC<LoaderProps> = ({
  size = 340,
  text,
}) => {
  const [currentWord, setCurrentWord] = React.useState<string>(() => {
    return text || MUSIC_WORDS[Math.floor(Math.random() * MUSIC_WORDS.length)]
  })

  // Randomly cycle through music-related words every 1.5s
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => {
        const pool = MUSIC_WORDS.filter((w) => w !== prev)
        return pool[Math.floor(Math.random() * pool.length)]
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  const letters = currentWord.split('')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent pointer-events-none select-none"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size, maxWidth: '90vw', maxHeight: '90vw' }}
      >
        {/* Soft Music Beat Pulse Glow — expands subtly outward synchronized with the rhythm */}
        <div className="absolute inset-[-12px] rounded-full blur-[32px] animate-beatPulse bg-gradient-to-tr from-purple-600/35 via-pink-500/35 to-cyan-400/35 pointer-events-none" />

        {/* Subtle Outer Futuristic Orbit Ring */}
        <div className="absolute inset-[-20px] rounded-full border border-white/[0.09] border-dashed animate-slowOrbit pointer-events-none" />

        {/* Subtle Inner Concentric Accent Ring */}
        <div className="absolute inset-[22px] rounded-full border border-white/[0.07] pointer-events-none" />

        {/* Four Subtle Glowing Micro-Accents at Cardinal Points */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4] pointer-events-none" />
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899] pointer-events-none" />
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_10px_#a855f7] pointer-events-none" />
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_10px_#f97316] pointer-events-none" />

        {/* Animated Words in the Center with Syne Font */}
        <div className="relative z-10 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex items-center justify-center"
            >
              {letters.map((letter, index) => (
                <span
                  key={`${currentWord}-${index}`}
                  className="inline-block text-white text-xl sm:text-2xl font-bold uppercase tracking-[0.22em] opacity-60 animate-loaderLetter drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
                  style={{
                    fontFamily: "'Syne', 'Syncopate', sans-serif",
                    animationDelay: `${index * 0.08}s`,
                  }}
                >
                  {letter}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dynamic Multicolor Glowing Rotating Main Ring */}
        <div className="absolute inset-0 rounded-full animate-loaderCircle pointer-events-none" />
      </div>

      <style jsx>{`
        @keyframes loaderCircle {
          0% {
            transform: rotate(0deg);
            box-shadow:
              0 8px 18px 0 #ec4899 inset,
              0 18px 28px 0 #8b5cf6 inset,
              0 40px 48px 0 #3b82f6 inset,
              0 0 8px 2px rgba(236, 72, 153, 0.5),
              0 0 20px 4px rgba(139, 92, 246, 0.4),
              0 0 36px 8px rgba(59, 130, 246, 0.3);
          }
          20% {
            transform: rotate(72deg);
            box-shadow:
              0 8px 18px 0 #a855f7 inset,
              0 18px 28px 0 #3b82f6 inset,
              0 40px 48px 0 #06b6d4 inset,
              0 0 8px 2px rgba(168, 85, 247, 0.5),
              0 0 20px 4px rgba(59, 130, 246, 0.4),
              0 0 36px 8px rgba(6, 182, 212, 0.3);
          }
          40% {
            transform: rotate(144deg);
            box-shadow:
              0 8px 18px 0 #06b6d4 inset,
              0 18px 28px 0 #10b981 inset,
              0 40px 48px 0 #8b5cf6 inset,
              0 0 8px 2px rgba(6, 182, 212, 0.5),
              0 0 20px 4px rgba(16, 185, 129, 0.4),
              0 0 36px 8px rgba(139, 92, 246, 0.3);
          }
          60% {
            transform: rotate(216deg);
            box-shadow:
              0 8px 18px 0 #f97316 inset,
              0 18px 28px 0 #f43f5e inset,
              0 40px 48px 0 #a855f7 inset,
              0 0 8px 2px rgba(249, 115, 22, 0.5),
              0 0 20px 4px rgba(244, 63, 94, 0.4),
              0 0 36px 8px rgba(168, 85, 247, 0.3);
          }
          80% {
            transform: rotate(288deg);
            box-shadow:
              0 8px 18px 0 #f43f5e inset,
              0 18px 28px 0 #ec4899 inset,
              0 40px 48px 0 #f97316 inset,
              0 0 8px 2px rgba(244, 63, 94, 0.5),
              0 0 20px 4px rgba(236, 72, 153, 0.4),
              0 0 36px 8px rgba(249, 115, 22, 0.3);
          }
          100% {
            transform: rotate(360deg);
            box-shadow:
              0 8px 18px 0 #ec4899 inset,
              0 18px 28px 0 #8b5cf6 inset,
              0 40px 48px 0 #3b82f6 inset,
              0 0 8px 2px rgba(236, 72, 153, 0.5),
              0 0 20px 4px rgba(139, 92, 246, 0.4),
              0 0 36px 8px rgba(59, 130, 246, 0.3);
          }
        }

        @keyframes beatPulse {
          0%, 100% {
            transform: scale(0.97);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.65;
          }
        }

        @keyframes slowOrbit {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes loaderLetter {
          0%,
          100% {
            opacity: 0.45;
            transform: translateY(0);
          }
          20% {
            opacity: 1;
            transform: scale(1.14) translateY(-2px);
          }
          40% {
            opacity: 0.75;
            transform: translateY(0);
          }
        }

        .animate-loaderCircle {
          animation: loaderCircle 5.5s linear infinite;
        }

        .animate-beatPulse {
          animation: beatPulse 2.6s ease-in-out infinite;
        }

        .animate-slowOrbit {
          animation: slowOrbit 30s linear infinite;
        }

        .animate-loaderLetter {
          animation: loaderLetter 2.6s infinite ease-in-out;
        }
      `}</style>
    </motion.div>
  )
}
