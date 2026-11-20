'use client'
import * as React from 'react'
import { motion } from 'framer-motion'

interface LoaderProps { size?: number; text?: string }

// Fixed circular silhouette with fine, deterministic wave contours inside it.
const WAVES = Array.from({ length: 28 }, (_, line) => {
  const points = Array.from({ length: 241 }, (_, i) => {
    const angle = i / 240 * Math.PI * 2
    const inset = line * 1.35
    const wave = (Math.sin(angle * 3 + line * 0.09) + 1) * (6 + line * 0.42)
    const radius = 174 - inset - wave
    return `${(250 + Math.cos(angle) * radius).toFixed(2)},${(250 + Math.sin(angle) * radius).toFixed(2)}`
  })
  return 'M' + points.join(' L') + ' Z'
})

export const GlowingRingLoader: React.FC<LoaderProps> = ({ size = 340, text }) => {
  const id = React.useId().replace(/:/g, '')
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none"
      role="status" aria-live="polite" aria-label={text || 'Preparing your track'}>
      <div className="loader-orb" style={{ width: `min(${size * 1.55}px, 94vw, 78dvh)`, aspectRatio: '1' }}>
        <svg viewBox="0 0 500 500" className="orb-art" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={id + 'rim'} x1="110" y1="90" x2="370" y2="420" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8db6ff" /><stop offset=".3" stopColor="#ec7dff" />
              <stop offset=".65" stopColor="#bd51ea" /><stop offset=".88" stopColor="#ff9759" />
              <stop offset="1" stopColor="#fff5c9" />
            </linearGradient>
            <radialGradient id={id + 'core'}>
              <stop stopColor="#080611" stopOpacity=".94" />
              <stop offset=".8" stopColor="#130b24" stopOpacity=".9" />
              <stop offset="1" stopColor="#492047" stopOpacity=".45" />
            </radialGradient>
          </defs>
          <ellipse cx="250" cy="250" rx="246" ry="83" transform="rotate(-25 250 250)"
            stroke={`url(#${id}rim)`} strokeWidth=".65" opacity=".28" />
          <circle cx="250" cy="250" r="175" fill={`url(#${id}core)`} />
          <g className="orb-waves">
            {WAVES.map((d, i) => <path key={i} d={d} stroke={`url(#${id}rim)`}
              strokeWidth={i % 7 === 0 ? '.9' : '.55'} opacity={.65 - i * .012} />)}
          </g>
          <circle cx="250" cy="250" r="175" stroke={`url(#${id}rim)`} strokeWidth="5" opacity=".12" />
          <circle cx="250" cy="250" r="175" stroke={`url(#${id}rim)`} strokeWidth="1.7" />
          <g className="orb-ticks">
            {Array.from({ length: 120 }, (_, i) => <line key={i} x1="250" y1="42" x2="250" y2={i % 5 === 0 ? 52 : 49}
              transform={`rotate(${i * 3} 250 250)`} stroke={`url(#${id}rim)`}
              strokeWidth={i > 8 && i < 27 ? '1.7' : '.8'} opacity={i > 8 && i < 27 ? .95 : .28} />)}
          </g>
          <g transform="rotate(-17 250 250)">
            <ellipse cx="250" cy="250" rx="239" ry="64" stroke={`url(#${id}rim)`} strokeWidth=".8" opacity=".65" />
            <circle r="3.2" fill="#ffe0f8">
              <animateMotion dur="9s" repeatCount="indefinite" path="M489,250 A239,64 0 1,1 11,250 A239,64 0 1,1 489,250" />
            </circle>
          </g>
        </svg>
        <div className="orb-copy" aria-hidden="true">
          <div className="orb-equalizer">{[8, 16, 25, 14, 21, 30, 11].map((height, i) =>
            <span key={i} style={{ height, animationDelay: `${i * -.13}s` }} />)}</div>
          <div className="orb-title">{text || 'Preparing your track'}</div>
          <div className="orb-subtitle">Tuning the universe for you…</div>
        </div>
      </div>
      <style jsx>{`
        .loader-orb { position: relative; flex: none; }
        .orb-art { width: 100%; height: 100%; overflow: visible; }
        .orb-copy { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 15px; }
        .orb-title { color: #f7edff; font-family: 'Space Grotesk', sans-serif; font-size: clamp(10px, 1.2vw, 16px); letter-spacing: .24em; text-transform: uppercase; max-width: 72%; }
        .orb-subtitle { color: #a99cb6; font-size: clamp(9px, 1vw, 12px); letter-spacing: .04em; }
        .orb-equalizer { height: 32px; display: flex; align-items: center; gap: 4px; margin-bottom: 5px; }
        .orb-equalizer span { display: block; width: 2px; border-radius: 2px; background: #d595ff; animation: equalize 1.5s ease-in-out infinite alternate; }
        .orb-waves, .orb-ticks { transform-origin: 250px 250px; }
        .orb-waves { animation: orbit 32s linear infinite; }
        .orb-ticks { animation: orbit 70s linear infinite reverse; }
        @keyframes orbit { to { transform: rotate(360deg); } }
        @keyframes equalize { to { transform: scaleY(.35); opacity: .6; } }
        @media (prefers-reduced-motion: reduce) {
          .orb-waves, .orb-ticks, .orb-equalizer span { animation: none; }
        }
      `}</style>
    </motion.div>
  )
}
