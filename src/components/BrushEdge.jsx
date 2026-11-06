/**
 * The wet, slightly ragged edge where one paint colour meets the next.
 * Fills with `currentColor`, so set the colour of the section below.
 */
export default function BrushEdge({ className = '', flip = false }) {
  return (
    <svg
      className={`brush-edge ${className}`}
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scaleY(-1)' } : undefined}
    >
      <path
        fill="currentColor"
        d="M0 34 C 60 30 110 38 170 33 S 280 24 340 30 S 440 41 520 35 S 640 22 720 28 S 830 40 900 34 S 1010 23 1090 29 S 1200 40 1270 33 S 1380 26 1440 31 L1440 60 L0 60 Z"
      />
      <path
        fill="currentColor"
        opacity=".55"
        d="M0 28 C 90 26 150 31 230 27 S 380 20 470 26 S 610 31 700 24 S 860 19 960 25 S 1120 32 1210 26 S 1360 21 1440 25 L1440 60 L0 60 Z"
      />
      <g fill="currentColor" opacity=".35">
        <rect x="120" y="22" width="180" height="2.2" rx="1.1" />
        <rect x="610" y="19" width="140" height="1.8" rx=".9" />
        <rect x="1030" y="21" width="210" height="2" rx="1" />
      </g>
    </svg>
  )
}
