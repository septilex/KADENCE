'use client'
import { motion, AnimatePresence } from 'framer-motion'

import { Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'

interface NavbarProps {
  songCount: number
  currentVibe: Vibe | null
  onSearchOpen: () => void
  onRefresh: () => void
  isRefreshing: boolean
  onChangeVibeClick: () => void
}

export function Navbar({ songCount, currentVibe, onSearchOpen, onRefresh, isRefreshing, onChangeVibeClick }: NavbarProps) {
  const activeVibe = VIBE_CONFIGS.find(v => v.id === currentVibe)

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4 pointer-events-none"
    >
      {/* Logo & Active Vibe Badge */}
      <div className="pointer-events-auto flex items-center gap-4">
        <div
          className="flex items-baseline text-white opacity-90 select-none uppercase"
          style={{ 
            fontFamily: "'Syncopate', sans-serif", 
            fontSize: '1.5rem',
            letterSpacing: '-0.03em',
            fontWeight: 700,
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          <span>K</span>
          <span className="inline-block bg-white" style={{ width: '0.75em', height: '0.65em', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', margin: '0 0.04em' }} />
          <span>DENCE</span>
        </div>

        {activeVibe && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: activeVibe.accentColor,
                boxShadow: `0 0 8px ${activeVibe.accentColor}`,
              }}
            />
            {activeVibe.badge && (
              <span className="text-white font-bold">{activeVibe.badge}</span>
            )}
            <span className="text-white/60">{activeVibe.label}</span>
          </motion.div>
        )}
      </div>

      {/* Song count */}
      <div className="text-white/25 text-xs tracking-widest uppercase pointer-events-none hidden md:block">
        {songCount > 0 ? `${songCount.toLocaleString()} songs` : ''}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Change Vibe Button */}
        <button
          onClick={onChangeVibeClick}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full
            bg-white/5 border border-white/10 text-white/70 text-xs tracking-wide
            hover:bg-white/12 hover:text-white transition-all duration-300 cursor-pointer"
        >
          Switch Chart
        </button>

        {/* Refresh Tracks Button */}
        <button
          id="navbar-refresh-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full
            bg-white/5 border border-white/10 text-white/70 text-xs tracking-wide
            hover:bg-white/12 hover:text-white transition-all duration-300 cursor-pointer disabled:opacity-50"
        >
          <motion.svg 
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 21v-5h5"/>
          </motion.svg>
          Refresh
        </button>

        {/* Search icon */}
        <button
          id="navbar-search-btn"
          onClick={onSearchOpen}
          className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full
            bg-white/5 border border-white/10 text-white/50
            hover:bg-white/12 hover:text-white/80 transition-all duration-200 cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>
    </motion.nav>
  )
}
