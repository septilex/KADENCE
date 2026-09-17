'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SongNode } from '@/lib/types'
import { GlassButton } from './GlassButton'

interface SearchPanelProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onResults: (songs: SongNode[]) => void
  onSelectResult: (song: SongNode) => void
}

const SUGGESTIONS = [
  'late night drive', 'sad synthwave', 'gym rage',
  'dreamy electronic', 'rainy day songs', 'focus flow',
  'party anthems', 'chill jazz', 'romantic r&b', 'dark ambient',
]

export function SearchPanel({ isOpen, onOpen, onClose, onResults, onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SongNode[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.songs ?? [])
      onResults(data.songs ?? [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [onResults])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  return (
    <>
      {/* Search trigger button */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-40 h-16 flex items-center justify-center pointer-events-none">
        <GlassButton
          id="search-trigger-btn"
          onClick={isOpen ? onClose : onOpen}
          size="sm"
          className="pointer-events-auto"
          contentClassName="flex items-center gap-2.5 px-3 py-1 text-white text-sm font-medium tracking-normal"
          style={{ '--foreground': '#ffffff', '--background': '#ffffff' } as React.CSSProperties}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {!isOpen && <span className="tracking-wide">Search by vibe, mood, or genre…</span>}
          {isOpen && <span className="tracking-wide">Close</span>}
        </GlassButton>
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4"
          >
            <div className="bg-black/70 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                <svg className="text-white/40 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => handleChange(e.target.value)}
                  placeholder="late night drive, gym rage, dreamy…"
                  className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
                  onKeyDown={e => e.key === 'Escape' && onClose()}
                  id="search-input"
                />
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
                )}
              </div>

              {/* Suggestions */}
              {!query && (
                <div className="p-3">
                  <p className="text-white/25 text-xs uppercase tracking-widest mb-2 px-1">Try searching</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map(s => (
                      <GlassButton
                        key={s}
                        onClick={() => { setQuery(s); search(s) }}
                        size="xs"
                        contentClassName="text-white/60 hover:text-white/90 transition-colors lowercase"
                        style={{ '--background': '#ffffff22', '--foreground': '#ffffff' } as React.CSSProperties}
                      >
                        {s}
                      </GlassButton>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && (
                <div className="max-h-64 overflow-y-auto">
                  {results.slice(0, 12).map(song => (
                    <button
                      key={song.id}
                      onClick={() => { onSelectResult(song); onClose() }}
                      className="w-full flex items-center gap-3 px-4 py-2.5
                        hover:bg-white/6 transition-colors duration-150 cursor-pointer text-left"
                    >
                      {song.albumArt && (
                        <img
                          src={song.albumArt}
                          alt={song.album}
                          className="w-9 h-9 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{song.name}</p>
                        <p className="text-white/40 text-xs truncate">{song.artist}</p>
                      </div>
                      <div
                        className="ml-auto w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: song.color }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {query && results.length === 0 && !isSearching && (
                <p className="px-4 py-3 text-white/30 text-sm">No results. Try a different mood.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
