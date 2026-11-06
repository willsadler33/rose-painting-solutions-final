import { forwardRef, useMemo } from 'react'
import { BRISTLE_PATH, BRUSH_VIEW, HANDLE_PATH } from '../lib/brushGeometry.js'

// Deterministic pseudo-random so the bristles render the same every time.
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * A 4-inch flat paintbrush drawn side-on, bristles to the left.
 * viewBox 520×180 — the bristle face spans y 10→170 (160 units).
 * Shares its geometry with the logo mark (see lib/brushGeometry.js).
 * The contact point used by the paint engine is (36, 90).
 */
export { BRUSH_VIEW }

const Brush = forwardRef(function Brush({ className = '', style, id = 'b' }, ref) {
  const strands = useMemo(() => {
    const rnd = seeded(7)
    return Array.from({ length: 46 }, (_, i) => {
      const y = 16 + (i / 45) * 148
      const end = 8 + rnd() * 34
      const bend = (rnd() - 0.5) * 6
      return { d: `M168 ${y.toFixed(1)} Q ${(90 + rnd() * 20).toFixed(1)} ${(y + bend).toFixed(1)} ${end.toFixed(1)} ${(y + bend * 1.6).toFixed(1)}`, o: 0.08 + rnd() * 0.16 }
    })
  }, [])

  return (
    <svg
      ref={ref}
      className={className}
      style={style}
      viewBox="0 0 520 180"
      width="520"
      height="180"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-bristle`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#a8822e" />
          <stop offset="0.28" stopColor="#c9a24a" />
          <stop offset="0.36" stopColor="#ddc07a" />
          <stop offset="0.5" stopColor="#efe7d6" />
          <stop offset="1" stopColor="#fbf8f1" />
        </linearGradient>
        <linearGradient id={`${id}-bristle-shade`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#151310" stopOpacity="0.08" />
          <stop offset="1" stopColor="#151310" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`${id}-ferrule`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d9c79c" />
          <stop offset="0.14" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#f1e4c1" />
          <stop offset="0.55" stopColor="#b89552" />
          <stop offset="0.72" stopColor="#e6d3a0" />
          <stop offset="1" stopColor="#8a6a26" />
        </linearGradient>
        <linearGradient id={`${id}-handle`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4a4540" />
          <stop offset="0.22" stopColor="#26231f" />
          <stop offset="0.6" stopColor="#151310" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Handle */}
      <path
        d={HANDLE_PATH}
        fill={`url(#${id}-handle)`}
      />
      <path
        d="M266 50 C305 48 335 60 382 66 C430 72 468 72 492 75"
        stroke={`url(#${id}-gloss)`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <circle cx="497" cy="90" r="5.5" fill="#fcfbf8" opacity="0.92" />
      <text
        data-brand=""
        x="350"
        y="90"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fillOpacity="0.85"
        fontFamily="Gloock, Georgia, serif"
        fontSize="26"
        letterSpacing="0.5"
      >
        Rose
      </text>

      {/* Ferrule */}
      <rect x="164" y="13" width="100" height="154" rx="7" fill={`url(#${id}-ferrule)`} />
      <g opacity="0.55">
        <rect x="232" y="13" width="3" height="154" fill="#6e6758" />
        <rect x="235" y="13" width="2" height="154" fill="#fff" />
        <rect x="242" y="13" width="3" height="154" fill="#6e6758" />
        <rect x="245" y="13" width="2" height="154" fill="#fff" />
      </g>
      <circle cx="200" cy="32" r="3.2" fill="#a89f8c" />
      <circle cx="200" cy="148" r="3.2" fill="#a89f8c" />

      {/* Bristles — wrapped so the intro can flex them with motion */}
      <g data-bristles="">
      {/* Bristles */}
      <path
        d={BRISTLE_PATH}
        fill={`url(#${id}-bristle)`}
      />
      <g fill="none" stroke="#151310" strokeWidth="0.9" strokeLinecap="round">
        {strands.map((s, i) => (
          <path key={i} d={s.d} strokeOpacity={s.o} />
        ))}
      </g>
      <path
        d={BRISTLE_PATH}
        fill={`url(#${id}-bristle-shade)`}
      />
      {/* Wet paint glint along the loaded tip */}
      <path d="M14 26 C40 20 70 18 96 20" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  )
})

export default Brush
