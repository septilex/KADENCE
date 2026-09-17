'use client'
import { motion, AnimatePresence } from 'framer-motion'

import { Vibe } from '@/lib/types'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { useSongStore } from '@/store/songStore'
import { GlassButton } from './GlassButton'

interface NavbarProps {
  songCount: number
  currentVibe: Vibe | null
  onSearchOpen: () => void
  onRefresh: () => void
  isRefreshing: boolean
  onChangeVibeClick: () => void
  isSongSelected?: boolean
}

export function Navbar({
  songCount,
  currentVibe,
  onSearchOpen,
  onRefresh,
  isRefreshing,
  onChangeVibeClick,
  isSongSelected,
}: NavbarProps) {
  const storeSelectedSong = useSongStore(s => s.selectedSong)
  const isSelected = isSongSelected !== undefined ? isSongSelected : !!storeSelectedSong
  const activeVibe = VIBE_CONFIGS.find(v => v.id === currentVibe)

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed top-0 inset-x-0 z-30 h-16 flex items-center justify-between px-6 pointer-events-none"
    >
      {/* Logo & Active Vibe Badge */}
      <div className="pointer-events-auto flex items-center gap-4">
        <AnimatePresence initial={false}>
          {!isSelected && (
            <motion.div
              key="navbar-kadence-logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center text-white opacity-90 select-none uppercase"
              style={{ 
                fontFamily: "'Syncopate', sans-serif", 
                fontSize: '1.5rem',
                letterSpacing: '-0.03em',
                fontWeight: 700,
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              <img src="/kadence-chrome-logo.png" alt="KADENCE" style={{ height: '2.04em', width: 'auto' }} className="pointer-events-none select-none" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeVibe && !isSelected && (
            <motion.div
              key="universe-category-pill"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <GlassButton
                size="xs"
                contentClassName="flex items-center gap-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif", '--background': activeVibe.bgColor || '#ffffff', '--foreground': '#ffffff' } as React.CSSProperties}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: activeVibe.accentColor,
                    boxShadow: `0 0 8px ${activeVibe.accentColor}`,
                  }}
                />
                {activeVibe.badge && (
                  <span className="text-white font-bold">{activeVibe.badge}</span>
                )}
                <span className="text-white/80">{activeVibe.label}</span>
              </GlassButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Song count */}
      <div className="text-white/25 text-xs tracking-widest uppercase pointer-events-none hidden md:block">
        {songCount > 0 ? `${songCount.toLocaleString()} songs` : ''}
      </div>

      {/* Controls */}
      <div 
        className="pointer-events-auto flex items-center gap-2"
        style={{ '--foreground': '#ffffff', '--background': '#ffffff' } as React.CSSProperties}
      >
        {/* Change Vibe Button */}
        <GlassButton
          onClick={onChangeVibeClick}
          size="sm"
          contentClassName="flex items-center gap-2 text-white text-xs tracking-wide font-medium"
        >
          Switch Chart
        </GlassButton>

        {/* Refresh Tracks Button */}
        <GlassButton
          id="navbar-refresh-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          size="sm"
          className={isRefreshing ? 'opacity-70' : ''}
          contentClassName="flex items-center gap-2 text-white text-xs tracking-wide font-medium"
        >
          <motion.svg 
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 21v-5h5"/>
          </motion.svg>
          Refresh
        </GlassButton>

        {/* Search icon */}
        <GlassButton
          id="navbar-search-btn"
          onClick={onSearchOpen}
          size="icon"
          contentClassName="flex items-center justify-center text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </GlassButton>
      </div>
    </motion.nav>
  )
}
