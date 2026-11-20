'use client'

import { memo, type CSSProperties } from 'react'

// The reference's artwork is separate from the live chart labels and controls.
// Only transform/opacity animate; the detailed image is decoded once.
export const ConstellationAtmosphere = memo(function ConstellationAtmosphere({ accent = '#8875ff' }: { accent?: string }) {
  return (
    <div className="kdc-atmosphere" aria-hidden="true" style={{ '--sky-accent': accent } as CSSProperties}>
      <div className="kdc-space-parallax">
        <img src="/images/discover/space-reference-v2.png" alt="" draggable={false}
          className="kdc-space-plate" decoding="async" />
        <div className="kdc-space-light kdc-space-light-violet" />
        <div className="kdc-space-light kdc-space-light-amber" />
      </div>
      <div className="kdc-space-reaction" />
      <svg className="kdc-space-sparks" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 28 }, (_, i) => <circle key={i}
          cx={(i * 487 + 31) % 1600} cy={(i * 197 + 71) % 900}
          r={i % 5 === 0 ? 1 : .6} fill={i % 3 ? '#aaa9ff' : '#f2d7ff'}
          style={{ animationDelay: `${-(i % 9)}s`, animationDuration: `${4 + i % 5}s` }} />)}
      </svg>
      <style>{`
        .kdc-atmosphere { position: absolute; inset: 0; overflow: hidden; pointer-events: none; contain: strict; }
        .kdc-space-parallax { position: absolute; inset: -12px; transform: translate3d(calc(var(--px) * 6px), calc(var(--py) * 6px), 0); transition: transform 1.2s ease-out; }
        .kdc-space-plate { position: absolute; width: 100%; height: 100%; object-fit: cover; object-position: center; }
        .kdc-space-light { position: absolute; inset: 0; mix-blend-mode: screen; opacity: .3; }
        .kdc-space-light-violet { background: radial-gradient(ellipse at 10% 24%, #7b39c940, transparent 24%), radial-gradient(ellipse at 79% 98%, #568dfc30, transparent 22%); }
        .kdc-space-light-amber { background: radial-gradient(ellipse at 94% 23%, #f48b3928, transparent 17%); }
        .kdc-space-reaction { position: absolute; inset: -10%; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--sky-accent) 8%, transparent), transparent 60%); transform: translate(calc(var(--px) * 5vw), calc(var(--py) * 4vh)); transition: background 1s ease, transform 1.2s ease-out; }
        .kdc-space-sparks { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .5; }
        @media (prefers-reduced-motion: no-preference) {
          .kdc-space-plate { animation: kdc-space-drift 36s ease-in-out infinite alternate; }
          .kdc-space-light-violet { animation: kdc-space-breathe 13s ease-in-out infinite alternate; }
          .kdc-space-light-amber { animation: kdc-space-breathe 19s -8s ease-in-out infinite alternate; }
          .kdc-space-sparks circle { animation: kdc-space-twinkle 6s ease-in-out infinite alternate; }
        }
        @keyframes kdc-space-drift { from { transform: scale(1); } to { transform: scale(1.018) translate(3px, -2px); } }
        @keyframes kdc-space-breathe { from { opacity: .15; } to { opacity: .65; } }
        @keyframes kdc-space-twinkle { from { opacity: .15; } to { opacity: .85; } }
        @media (prefers-reduced-motion: reduce) { .kdc-space-parallax, .kdc-space-reaction { transform: none; transition: none; } }
      `}</style>
    </div>
  )
})
