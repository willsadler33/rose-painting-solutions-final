// Small, consistent line icons (1.75px stroke, 24 grid).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }

export const PhoneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.8 1.8 0 0 1-1.9 1.8A16 16 0 0 1 3.2 5.9 1.8 1.8 0 0 1 5 4Z" />
  </svg>
)
export const ClockIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const MenuIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
)
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const QuoteIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 4h10l4 4v12H5z" />
    <path d="M15 4v4h4M8.5 12h7M8.5 15.5h5" />
  </svg>
)
// A hand-brushed tick, used for trust points.
export const BrushTick = ({ className = '' }) => (
  <svg className={className} width="30" height="26" viewBox="0 0 30 26" aria-hidden="true" focusable="false">
    <path d="M3 14.5c2.6 1.2 5 3.6 7 7.4C14 13 19.5 6.6 27 3" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 14c2.2 1 4.4 3.1 6 6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)
