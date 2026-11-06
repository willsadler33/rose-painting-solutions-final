import { business } from '../data/site.js'
import { asset } from '../lib/asset.js'
import {
  BRISTLE_PATH_FLAT,
  MARK_BRUSH_TRANSFORM,
  MARK_FERRULE,
  MARK_HANDLE_PATH,
  SWOOSH_PATH,
} from '../lib/brushGeometry.js'

const TONES = {
  // On white / primer backgrounds
  light: { handle: '#151310', ferrule: '#A89F8C', ridge: '#151310', bristle: '#ECDCB2', tip: '#B08A36', swoosh: '#B08A36', text: '#151310', sub: '#96722A' },
  // On cobalt or navy backgrounds
  dark: { handle: '#FFFFFF', ferrule: '#ECDCB2', ridge: '#151310', bristle: '#FFFFFF', tip: '#E2C47A', swoosh: '#E2C47A', text: '#FFFFFF', sub: '#D4AF5A' },
  // Navy tile (favicon, app icon, small square uses)
  tile: { handle: '#FFFFFF', ferrule: '#ECDCB2', ridge: '#151310', bristle: '#FFFFFF', tip: '#C9A24A', swoosh: '#C9A24A', bg: '#151310' },
}

/** The paintbrush mark on its own. `tone`: light | dark | tile */
export function BrushMark({ tone = 'light', size = 40, className = '', title }) {
  const t = TONES[tone]
  const clip = `mk-${tone}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {t.bg && <rect width="64" height="64" rx="15" fill={t.bg} />}
      <defs>
        <clipPath id={clip}>
          <path d={BRISTLE_PATH_FLAT} />
        </clipPath>
      </defs>
      <path d={SWOOSH_PATH} fill={t.swoosh} />
      <g transform={MARK_BRUSH_TRANSFORM}>
        <path d={MARK_HANDLE_PATH} fill={t.handle} />
        <circle cx="494" cy="90" r="9" fill={t.bg || (tone === 'light' ? '#FCFBF8' : '#B08A36')} opacity={tone === 'dark' ? 0 : 1} />
        <rect x={MARK_FERRULE.x} y={MARK_FERRULE.y} width={MARK_FERRULE.w} height={MARK_FERRULE.h} rx={MARK_FERRULE.rx} fill={t.ferrule} />
        <rect x="226" y={MARK_FERRULE.y} width="10" height={MARK_FERRULE.h} fill={t.ridge} opacity=".35" />
        <path d={BRISTLE_PATH_FLAT} fill={t.bristle} />
        <rect x="0" y="0" width="74" height="180" fill={t.tip} clipPath={`url(#${clip})`} />
      </g>
    </svg>
  )
}

/** The round Rose Painting Solutions badge. */
export function LogoBadge({ size = 56, className = '' }) {
  return (
    <img
      src={asset('images/rose-painting/brand/rose-logo-192.webp')}
      srcSet={`${asset('images/rose-painting/brand/rose-logo-96.webp')} 96w, ${asset('images/rose-painting/brand/rose-logo-192.webp')} 192w, ${asset('images/rose-painting/brand/rose-logo-512.webp')} 512w`}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      decoding="async"
      className={`shrink-0 rounded-full shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)] ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Logo lockups.
 *  layout: 'inline' (navigation) | 'stacked' (footer, intro)
 *  tone:   'light' (on white) | 'dark' (on black)
 */
export default function Logo({ tone = 'light', layout = 'inline', size, className = '' }) {
  const t = TONES[tone]
  if (layout === 'stacked') {
    return (
      <span className={`inline-flex flex-col items-start ${className}`} aria-label={business.name || 'Rose Painting Solutions'}>
        <LogoBadge size={size || 120} />
        <span className="mt-3 font-display text-[2.4rem] leading-none tracking-[-0.015em]" style={{ color: t.text }}>
          {business.shortName}
        </span>
        <span className="mt-2 text-[0.8rem] font-semibold tracking-[0.12em]" style={{ color: t.sub }}>
          Painting Solutions
        </span>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoBadge size={size || 54} className="-my-1.5" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.6rem] tracking-[-0.01em]" style={{ color: t.text }}>
          {business.shortName}
        </span>
        <span className="mt-1 whitespace-nowrap text-[0.72rem] font-semibold tracking-[0.08em]" style={{ color: t.sub }}>
          Painting Solutions
        </span>
      </span>
    </span>
  )
}
