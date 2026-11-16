'use client'
import { useState } from 'react'
import type { SongNode } from '@/lib/types'
import { getOptimizedArtworkUrl } from '@/lib/artwork'

export function TrackList({ songs, onSelect }: { songs: SongNode[]; onSelect: (song: SongNode) => void }) {
  const [query, setQuery] = useState('')
  const shown = songs.filter(song => `${song.name} ${song.artist}`.toLowerCase().includes(query.toLowerCase()))
  return <section aria-label="Music tracks" className="absolute inset-0 overflow-y-auto bg-[#090912] px-4 pb-24 pt-24">
    <div className="mx-auto max-w-5xl">
      <label className="mb-6 block text-sm text-white/80">Filter this chart
        <input value={query} onChange={event => setQuery(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white" />
      </label>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(song => <li key={song.id}>
          <button onClick={() => onSelect(song)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
            {/* Remote CDN artwork is already sized; avoid an extra image proxy hop. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getOptimizedArtworkUrl(song.albumArt, 100)} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
            <span className="min-w-0"><span className="block truncate font-medium text-white">{song.name}</span><span className="block truncate text-sm text-white/60">{song.artist}</span>{!song.previewUrl && <span className="text-xs text-white/40">Preview unavailable</span>}</span>
          </button>
        </li>)}
      </ul>
      {!shown.length && <p role="status" className="text-white/70">No tracks match this filter.</p>}
    </div>
  </section>
}
