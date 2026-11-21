'use client'
import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { HubPanel } from '@/store/libraryStore'

// Same face as the chart tile titles (Syne), at a lighter weight: Syne gets wider as it gets
// bolder, so SemiBold with slightly tightened tracking keeps the labels compact.
const FONT = { fontFamily: "'Syne', sans-serif", fontWeight: 600, letterSpacing: '-0.01em' }

const ICONS: Record<'discover' | 'search' | 'library', ReactNode> = {
  discover: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  library: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
    </svg>
  ),
}
const LABELS = { discover: 'Discover', search: 'Search', library: 'Library' } as const

// Glowing white light, shown only under the pointer (or keyboard focus).
const SHINE = {
  background: 'linear-gradient(180deg, #ffffff 0%, #f6f7f9 60%, #e9ecf0 100%)',
  border: '1px solid rgba(255, 255, 255, 0.85)',
  boxShadow:
    '0 0 14px rgba(255, 255, 255, 0.85), 0 0 32px rgba(255, 255, 255, 0.45), 0 0 60px rgba(255, 255, 255, 0.18), inset 0 1px 0 #ffffff, inset 0 -2px 4px rgba(150, 156, 166, 0.25)',
}

/**
 * Pill navigation. Items rest in their default colour; the glowing white capsule appears only
 * under the pointer (or keyboard focus) and glides between items as it moves — a framer-motion
 * shared layout, so only transforms animate. The open panel is marked with full-white text.
 */
export function NavSlider({ active, onToggle }: { active: HubPanel | null; onToggle: (panel: HubPanel) => void }) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState<HubPanel | null>(null)
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 }

  const item = (id: 'discover' | 'search' | 'library') => {
    const lit = hovered === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => onToggle(id)}
        onPointerEnter={() => setHovered(id)}
        onFocus={() => setHovered(id)}
        aria-expanded={active === id}
        className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-[14px] outline-none transition-colors duration-200 select-none focus-visible:ring-2 focus-visible:ring-white/70 ${lit ? 'text-[#111318]' : active === id ? 'text-white' : 'text-white/75'}`}
        style={FONT}
      >
        {lit && (
          <motion.span
            layoutId="kadence-nav-shine"
            transition={spring}
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={SHINE}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          {ICONS[id]}
          {LABELS[id]}
        </span>
      </button>
    )
  }

  const profileLit = hovered === 'profile'
  return (
    <nav
      aria-label="Main"
      onPointerLeave={() => setHovered(null)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovered(null) }}
      className="flex items-center gap-1.5 rounded-full p-1.5"
      style={{
        background: 'linear-gradient(180deg, rgba(26, 26, 40, 0.92) 0%, rgba(10, 10, 18, 0.92) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow:
          '0 12px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -2px 8px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {item('discover')}
      {item('search')}
      <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      {item('library')}
      <button
        type="button"
        onClick={() => onToggle('profile')}
        onPointerEnter={() => setHovered('profile')}
        onFocus={() => setHovered('profile')}
        aria-label="Your profile"
        aria-expanded={active === 'profile'}
        className={`relative ml-1 flex h-10 w-10 items-center justify-center rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/70 ${profileLit ? 'text-[#111318]' : active === 'profile' ? 'text-white' : 'text-white/75'}`}
        style={profileLit ? SHINE : {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -2px 5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
    </nav>
  )
}
