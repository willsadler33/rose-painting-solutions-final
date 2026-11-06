// ─────────────────────────────────────────────────────────────
// One brush, one identity.
// These shapes are shared by the logo mark (flat) and the intro
// brush (rendered), so the brand mark *is* the brush that paints.
// Coordinate space: 520 × 180, bristle tip on the left, handle right.
// ─────────────────────────────────────────────────────────────
export const BRUSH_VIEW = { w: 520, h: 180, face: 160, tipX: 36, tipY: 90, ferruleX: 168 }

export const HANDLE_PATH =
  'M258 42 C300 38 330 52 380 59 C430 65 470 65 498 69 C518 72 520 108 498 111 C470 115 430 115 380 121 C330 128 300 142 258 138 Z'

// Ragged bristle tip for the large rendered brush
export const BRISTLE_PATH =
  'M168 18 C130 14 92 8 42 9 C26 9 15 12 9 20 L4 40 L9 58 L3 78 L8 98 L2 118 L8 138 L4 158 C12 168 26 171 42 171 C92 172 130 166 168 162 Z'

// Clean chisel tip for the flat mark (reads at 16px)
export const BRISTLE_PATH_FLAT =
  'M168 20 C128 15 90 10 46 11 C22 11 6 24 5 44 L5 136 C6 156 22 169 46 169 C90 170 128 165 168 160 Z'

// Flat mark pieces are separated by small gaps of negative space.
export const MARK_HANDLE_PATH =
  'M266 44 C304 41 332 54 380 60 C430 66 470 66 498 70 C518 73 520 107 498 110 C470 114 430 114 380 120 C332 126 304 139 266 136 Z'
export const MARK_FERRULE = { x: 180, y: 16, w: 74, h: 148, rx: 10 }

// The painted swoosh that leaves the brush in the mark (64×64 space)
export const SWOOSH_PATH = 'M7 47.5 C 18 57.5 38 59 58.5 45.5 C 39 54 21 53.5 10.5 44 Z'
// Places the 520×180 brush inside the 64×64 mark: tilted so the handle rises to the right
export const MARK_BRUSH_TRANSFORM = 'translate(34 27.5) rotate(-40) scale(0.112) translate(-262 -90)'
