'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SongNode, Vibe } from '@/lib/types'
import dynamic from 'next/dynamic'
import { VIBE_CONFIGS } from '@/lib/vibeConfig'
import { getOptimizedArtworkUrl } from '@/lib/artwork'
import { useAudioStore } from '@/store/audioStore'
import { useLibraryStore, type HubPanel, type LibrarySong } from '@/store/libraryStore'
import { playSong } from '@/lib/listeningTracker'
import { buildAutoPlaylists, buildTasteProfile, type AutoPlaylist } from '@/lib/tasteProfile'

// Loaded and mounted only when Discover is opened.
const DiscoverConstellation = dynamic(() => import('./DiscoverConstellation'), { ssr: false })

const DISPLAY = { fontFamily: "'Syne', sans-serif" }
const BODY = { fontFamily: "'Space Grotesk', sans-serif" }
const EASE = [0.16, 1, 0.3, 1] as const
const GLASS = 'border border-white/10 bg-[#090910]/85 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]'

type AnySong = SongNode | LibrarySong

// ── Shared pieces ────────────────────────────────────────────────────────────

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/40" style={BODY}>{children}</p>
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center" style={BODY}>
      <p className="text-sm font-semibold text-white/70">{title}</p>
      <p className="mt-1 text-xs text-white/35">{hint}</p>
    </div>
  )
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

/** One playable song: artwork, title, artist, optional badge, like, and a link out. */
function SongRow({ song, rank, badge }: { song: AnySong; rank?: number; badge?: string }) {
  const active = useAudioStore((s) => s.currentUrl === song.previewUrl && !!song.previewUrl)
  const playing = useAudioStore((s) => s.isPlaying) && active
  const liked = useLibraryStore((s) => !!s.liked[song.id])
  const toggleLike = useLibraryStore((s) => s.toggleLike)

  return (
    <div className={`group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${active ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}>
      {rank !== undefined && <span className="w-5 text-center font-mono text-[11px] text-white/35">{String(rank).padStart(2, '0')}</span>}
      <button
        type="button"
        onClick={() => playSong(song)}
        disabled={!song.previewUrl}
        aria-label={`${playing ? 'Pause' : 'Play'} ${song.name}`}
        className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getOptimizedArtworkUrl(song.albumArt, 100)} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/55 text-white transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {playing
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>}
        </span>
      </button>
      <button type="button" onClick={() => playSong(song)} disabled={!song.previewUrl} className="min-w-0 flex-1 text-left" style={BODY}>
        <p className={`truncate text-[13px] font-semibold ${active ? 'text-white' : 'text-white/90'}`}>{song.name}</p>
        <p className="truncate text-[11px] text-white/45">{song.artist}</p>
      </button>
      {badge && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/55">{badge}</span>}
      <button
        type="button"
        onClick={() => toggleLike(song)}
        aria-label={liked ? `Remove ${song.name} from liked songs` : `Like ${song.name}`}
        aria-pressed={liked}
        className={`rounded-full p-1.5 transition-colors ${liked ? 'text-pink-400' : 'text-white/30 hover:text-white'}`}
      >
        <Heart filled={liked} />
      </button>
      {song.spotifyUrl && (
        <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${song.name} on its music service`} className="rounded-full p-1.5 text-white/30 transition-colors hover:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </a>
      )}
    </div>
  )
}

function PanelHeader({ kicker, title, onClose }: { kicker: string; title: string; onClose: () => void }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <Kicker>{kicker}</Kicker>
        <h2 className="mt-1.5 text-2xl font-extrabold uppercase tracking-[0.08em] text-white" style={DISPLAY}>{title}</h2>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-white/15 p-2 text-white/60 transition-colors hover:border-white/40 hover:text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

// ── Search ───────────────────────────────────────────────────────────────────

const SEARCH_IDEAS = ['late night drive', 'gym rage', 'rainy day songs', 'dreamy electronic', 'party anthems', 'romantic r&b', 'focus flow', 'sad synthwave']

function SearchPalette() {
  // Discover can hand over what the listener typed there.
  const [query, setQuery] = useState(() => useLibraryStore.getState().searchSeed)
  const [results, setResults] = useState<SongNode[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const recent = useLibraryStore((s) => s.plays)
  const recentSongs = useMemo(() => Object.values(recent).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 4), [recent])

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(t) }, [])

  const run = useCallback(async (q: string) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setStatus('loading')
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      if (!res.ok) throw new Error('search failed')
      const data = await res.json()
      if (controller.signal.aborted) return
      const seen = new Set<string>()
      const unique = ((data.songs ?? []) as SongNode[]).filter((song) => {
        const key = `${song.name}|${song.artist}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setResults(unique)
      setStatus('done')
    } catch {
      if (controller.signal.aborted) return
      setResults([])
      setStatus('error')
    }
  }, [])

  // Debounced search-as-you-type; an empty box cancels whatever is in flight.
  useEffect(() => {
    const q = query.trim()
    if (!q) { requestRef.current?.abort(); return }
    const timer = setTimeout(() => { void run(q) }, 350)
    return () => clearTimeout(timer)
  }, [query, run])
  useEffect(() => () => requestRef.current?.abort(), [])

  const typed = query.trim().length > 0

  return (
    <motion.div
      role="dialog" aria-label="Search"
      initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`fixed left-1/2 top-24 z-[120] flex max-h-[calc(100dvh-7.5rem)] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-3xl ${GLASS}`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value.slice(0, 120))}
          placeholder="Song, artist, mood or moment…" aria-label="Search songs"
          className="flex-1 bg-transparent text-lg text-white placeholder:text-white/30 focus:outline-none" style={BODY}
        />
        <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/40">ESC</kbd>
      </div>

      <div className="overflow-y-auto p-4">
        {!typed && (
          <>
            <Kicker>Try a mood</Kicker>
            <div className="mb-5 mt-2.5 flex flex-wrap gap-2">
              {SEARCH_IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setQuery(idea)} className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white" style={BODY}>
                  {idea}
                </button>
              ))}
            </div>
            {recentSongs.length > 0 && (
              <>
                <Kicker>You played recently</Kicker>
                <div className="mt-2 space-y-0.5">{recentSongs.map((r) => <SongRow key={r.song.id} song={r.song} />)}</div>
              </>
            )}
          </>
        )}
        {typed && status === 'loading' && <p className="px-2 py-6 text-center text-sm text-white/45" style={BODY}>Scanning the universe…</p>}
        {typed && status === 'error' && <Empty title="Search is unavailable right now" hint="Give it a moment and try again." />}
        {typed && status === 'done' && results.length === 0 && <Empty title={`Nothing found for “${query.trim()}”`} hint="Try an artist name or a different mood." />}
        {typed && status === 'done' && results.length > 0 && (
          <>
            <Kicker>{results.length} results · tap to preview</Kicker>
            <div className="mt-2 space-y-0.5">{results.slice(0, 30).map((song) => <SongRow key={song.id} song={song} />)}</div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Library ──────────────────────────────────────────────────────────────────

type LibraryTab = 'liked' | 'recent' | 'repeat'

function LibraryDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<LibraryTab>('liked')
  const plays = useLibraryStore((s) => s.plays)
  const liked = useLibraryStore((s) => s.liked)

  const lists = useMemo(() => {
    const records = Object.values(plays)
    return {
      liked: Object.values(liked).sort((a, b) => b.likedAt - a.likedAt).map((l) => ({ song: l.song, badge: undefined as string | undefined })),
      recent: [...records].sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 50).map((r) => ({ song: r.song, badge: undefined as string | undefined })),
      repeat: [...records].filter((r) => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 50).map((r) => ({ song: r.song, badge: `×${r.count}` as string | undefined })),
    }
  }, [plays, liked])

  const tabs: { id: LibraryTab; label: string }[] = [
    { id: 'liked', label: 'Liked' }, { id: 'recent', label: 'Recent' }, { id: 'repeat', label: 'On repeat' },
  ]
  const empty: Record<LibraryTab, [string, string]> = {
    liked: ['No liked songs yet', 'Tap the heart on any song to keep it here.'],
    recent: ['Nothing played yet', 'Open a chart and listen — your history builds itself.'],
    repeat: ['Nothing on repeat yet', 'Songs you play more than once land here.'],
  }
  const rows = lists[tab]

  return (
    <motion.aside
      role="dialog" aria-label="Library"
      initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.32, ease: EASE }}
      // Opens under the nav bar, which sits on the left of the homepage header.
      className={`fixed bottom-4 left-4 top-24 z-[120] flex w-[min(440px,calc(100vw-2rem))] flex-col rounded-3xl p-6 ${GLASS}`}
    >
      <PanelHeader kicker="Saved on this device" title="Library" onClose={onClose} />
      <div className="mb-4 flex gap-1.5 rounded-full border border-white/10 bg-white/5 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`} style={BODY}
          >
            {t.label} <span className="opacity-50">{lists[t.id].length}</span>
          </button>
        ))}
      </div>
      <div className="-mx-2 flex-1 space-y-0.5 overflow-y-auto px-2">
        {rows.length === 0
          ? <Empty title={empty[tab][0]} hint={empty[tab][1]} />
          : rows.map((row, i) => <SongRow key={row.song.id} song={row.song} rank={i + 1} badge={row.badge} />)}
      </div>
    </motion.aside>
  )
}

// ── Profile ──────────────────────────────────────────────────────────────────

const GENRE_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80']

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="text-xl font-extrabold text-white" style={DISPLAY}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40" style={BODY}>{label}</p>
    </div>
  )
}

function PlaylistCard({ playlist, open, onToggle }: { playlist: AutoPlaylist; open: boolean; onToggle: () => void }) {
  const covers = playlist.songs.slice(0, 4)
  return (
    <button
      type="button" onClick={onToggle} aria-expanded={open}
      className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${open ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}
    >
      <span className="grid h-12 w-12 flex-shrink-0 grid-cols-2 overflow-hidden rounded-lg bg-white/5">
        {covers.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.id} src={getOptimizedArtworkUrl(s.albumArt, 100)} alt="" loading="lazy" className={`h-full w-full object-cover ${covers.length === 1 ? 'col-span-2 row-span-2' : ''}`} />
        ))}
      </span>
      <span className="min-w-0" style={BODY}>
        <span className="block truncate text-[13px] font-bold text-white">{playlist.title}</span>
        <span className="block truncate text-[11px] text-white/45">{playlist.songs.length} songs · {playlist.subtitle}</span>
      </span>
    </button>
  )
}

function ProfileCard({ onClose, onVibeSelect }: { onClose: () => void; onVibeSelect: (v: Vibe) => void }) {
  const plays = useLibraryStore((s) => s.plays)
  const liked = useLibraryStore((s) => s.liked)
  const vibeVisits = useLibraryStore((s) => s.vibeVisits)
  const displayName = useLibraryStore((s) => s.displayName)
  const setDisplayName = useLibraryStore((s) => s.setDisplayName)
  const clearHistory = useLibraryStore((s) => s.clearHistory)
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const taste = useMemo(() => buildTasteProfile(plays, vibeVisits), [plays, vibeVisits])
  const playlists = useMemo(() => buildAutoPlaylists(plays, liked), [plays, liked])
  const favourite = VIBE_CONFIGS.find((v) => v.id === taste.favouriteVibe) ?? null
  const accent = favourite?.bgColor ?? '#22d3ee'
  const initials = (displayName.trim() || 'You').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const hasHistory = taste.totalPlays > 0
  const expanded = playlists.find((p) => p.id === openPlaylist) ?? null

  return (
    <motion.div
      role="dialog" aria-label="Your profile"
      initial={{ opacity: 0, y: 24, scale: 0.96, rotateX: 8 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="fixed left-1/2 top-1/2 z-[120] max-h-[calc(100dvh-2rem)] w-[min(940px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] p-px"
      style={{ background: `linear-gradient(140deg, ${accent}, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 60%, #a78bfa)`, transformPerspective: 1200 }}
    >
      <div className="relative overflow-hidden rounded-[27px] bg-[#07070d]/95 p-6 backdrop-blur-2xl md:p-8">
        {/* Holographic wash + scan grid */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: accent }} />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-violet-500 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 flex-shrink-0">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: `conic-gradient(from 0deg, ${accent}, #a78bfa, #f472b6, ${accent})` }}
                  animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-[#07070d] text-2xl font-extrabold text-white" style={DISPLAY}>{initials}</div>
              </div>
              <div>
                <Kicker>Listener ID · stored on this device</Kicker>
                <input
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Name yourself" aria-label="Display name" maxLength={24}
                  className="mt-1 w-full max-w-[320px] bg-transparent text-3xl font-extrabold uppercase tracking-[0.04em] text-white placeholder:text-white/25 focus:outline-none" style={DISPLAY}
                />
                <p className="mt-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ ...BODY, borderColor: `${accent}66`, color: accent, background: `${accent}14` }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                  {taste.archetype}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-white/15 p-2 text-white/60 transition-colors hover:border-white/40 hover:text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Stat value={taste.totalPlays} label="Plays" />
            <Stat value={taste.uniqueArtists} label="Artists" />
            <Stat value={Object.keys(liked).length} label="Liked" />
            <Stat value={`${taste.minutes}m`} label="Listened" />
          </div>

          {!hasHistory && (
            <div className="mt-6">
              <Empty title="Your taste profile is empty — for now" hint="Play a few previews for 8 seconds or more. KADENCE builds this card from what you actually listen to." />
            </div>
          )}

          {hasHistory && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section>
                <Kicker>Music taste</Kicker>
                {taste.topGenres.length === 0
                  ? <p className="mt-3 text-xs text-white/40" style={BODY}>No genre data on the songs played so far.</p>
                  : (
                    <div className="mt-3 space-y-2.5">
                      {taste.topGenres.map((genre, i) => (
                        <div key={genre.name} style={BODY}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="font-semibold text-white/85">{genre.name}</span>
                            <span className="font-mono text-white/45">{Math.round(genre.share * 100)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              className="h-full rounded-full" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length], boxShadow: `0 0 10px ${GENRE_COLORS[i % GENRE_COLORS.length]}` }}
                              initial={{ width: 0 }} animate={{ width: `${Math.max(4, genre.share * 100)}%` }} transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: EASE }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                <div className="mt-6"><Kicker>Most repeated artists</Kicker></div>
                <div className="mt-3 space-y-2">
                  {taste.topArtists.map((artist, i) => (
                    <div key={artist.name} className="flex items-center gap-3" style={BODY}>
                      <span className="w-5 text-center font-mono text-[11px] text-white/35">{String(i + 1).padStart(2, '0')}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getOptimizedArtworkUrl(artist.art, 100)} alt="" loading="lazy" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">{artist.name}</span>
                      <span className="font-mono text-[11px] text-white/45">{artist.plays} {artist.plays === 1 ? 'play' : 'plays'}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <Kicker>Most repeated songs</Kicker>
                <div className="-mx-2 mt-2 space-y-0.5">
                  {taste.topSongs.map((record, i) => <SongRow key={record.song.id} song={record.song} rank={i + 1} badge={`×${record.count}`} />)}
                </div>
                {favourite && (
                  <button
                    type="button" onClick={() => { onClose(); onVibeSelect(favourite.id) }}
                    className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-white/30" style={BODY}
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Home universe</span>
                      <span className="block text-sm font-bold text-white">{favourite.label}</span>
                    </span>
                    <span className="text-xs font-semibold" style={{ color: accent }}>Enter →</span>
                  </button>
                )}
              </section>
            </div>
          )}

          <section className="mt-6">
            <Kicker>Your playlists · built from your listening</Kicker>
            {playlists.length === 0
              ? <p className="mt-3 text-xs text-white/40" style={BODY}>Like a song or play a few previews and playlists appear here.</p>
              : (
                <>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {playlists.map((p) => <PlaylistCard key={p.id} playlist={p} open={openPlaylist === p.id} onToggle={() => setOpenPlaylist(openPlaylist === p.id ? null : p.id)} />)}
                  </div>
                  {expanded && (
                    <div className="-mx-2 mt-3 max-h-64 space-y-0.5 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2">
                      {expanded.songs.map((song, i) => <SongRow key={song.id} song={song} rank={i + 1} />)}
                    </div>
                  )}
                </>
              )}
          </section>

          {hasHistory && (
            <div className="mt-6 flex items-center justify-end gap-3 text-[11px]" style={BODY}>
              {confirmClear
                ? (
                  <>
                    <span className="text-white/50">Erase listening history? Liked songs are kept.</span>
                    <button type="button" onClick={() => { clearHistory(); setConfirmClear(false) }} className="rounded-full border border-red-400/50 px-3 py-1 font-semibold text-red-300 hover:bg-red-500/10">Erase</button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="rounded-full border border-white/15 px-3 py-1 text-white/60 hover:text-white">Cancel</button>
                  </>
                )
                : <button type="button" onClick={() => setConfirmClear(true)} className="text-white/35 underline-offset-4 hover:text-white/70 hover:underline">Reset listening history</button>}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Host ─────────────────────────────────────────────────────────────────────

/** Renders whichever hub panel is open, over a click-away backdrop. Escape closes it. */
export function HubPanels({ onVibeSelect }: { onVibeSelect: (vibe: Vibe, origin?: { x: number; y: number }) => void }) {
  const panel = useLibraryStore((s) => s.activePanel)
  const openPanel = useLibraryStore((s) => s.openPanel)
  const close = useCallback(() => openPanel(null), [openPanel])

  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, close])

  const render = (active: HubPanel) => {
    if (active === 'discover') return <DiscoverConstellation key="discover" onVibeSelect={onVibeSelect} onClose={close} />
    if (active === 'search') return <SearchPalette key="search" />
    if (active === 'library') return <LibraryDrawer key="library" onClose={close} />
    return <ProfileCard key="profile" onClose={close} onVibeSelect={onVibeSelect} />
  }

  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          key="hub-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
          onClick={close} aria-hidden="true"
        />
      )}
      {panel && render(panel)}
    </AnimatePresence>
  )
}
