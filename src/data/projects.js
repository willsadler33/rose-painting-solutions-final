// ─────────────────────────────────────────────────────────────
// Confirmed before & after projects (real photos only).
//
// Only add a project here when the owner has confirmed that both photos
// show the same space and which one came first. Finished-room photos
// belong in portfolio.js; AI images belong in generated.js and never here.
//
// Paths are relative to /public. Each photo has:
//   src    full size (1170px wide)
//   small  ~760–800px wide, used on phones and in the side-by-side view
//   thumb  320×240 crop, used only in the project picker
// ─────────────────────────────────────────────────────────────
const dir = 'images/rose-painting/real-work/'

// focus / focusM: where the slider frame centres its crop (desktop 16:9, phone 4:5),
// chosen so the painted walls stay in view. Photos are cropped, never stretched.
const photo = (name, w, h, smallW, alt, tone, focus = '50% 50%', focusM = '50% 50%') => ({
  src: `${dir}${name}.webp`,
  small: `${dir}${name}-${smallW}.webp`,
  thumb: `${dir}${name}-thumb.webp`,
  w,
  h,
  smallW,
  alt,
  tone,
  focus,
  focusM,
})

export const transformations = [
  {
    id: 'bathroom-vanity',
    title: 'Bathroom vanity',
    change: 'Patterned wall to plain white',
    summary: 'A busy patterned wall covering around the double vanity, now smooth, plain white walls.',
    // Confirmed by the owner: photo 11 (IMG_0326) is BEFORE, photo 10 (IMG_0325) is AFTER.
    before: photo(
      '11-bathroom-vanity-patterned-wall',
      1170,
      1552,
      800,
      'Before: bathroom double vanity with a patterned wall covering behind and around the mirror',
      '#c9bfae',
      '50% 22%',
      '50% 40%',
    ),
    after: photo(
      '10-bathroom-vanity-plain-wall',
      1170,
      1556,
      800,
      'After: the same bathroom double vanity with smooth plain white walls and a large mirror, with paint and tools still on the counter',
      '#d9d6cf',
      '50% 45%',
      '50% 45%',
    ),
  },
  {
    id: 'room-project-02',
    title: 'Room with a high window',
    change: 'Pale blue to bright white',
    summary: 'Pale blue walls around a small high window, now a crisp, even white.',
    // Confirmed by the owner: IMG_0330 is BEFORE, IMG_0333 is AFTER.
    before: photo(
      'room-project-02-before',
      1170,
      1570,
      760,
      'Before: room with pale blue walls, a small high window with a dark valance, a wall shelf and a stained beige carpet',
      '#a9b2bd',
      '50% 6%',
      '50% 30%',
    ),
    after: photo(
      'room-project-02-after',
      1170,
      878,
      760,
      'After: the same room with bright white walls, a ceiling fan, the small high window and a dark carpet, seen from a different corner',
      '#9a9894',
      '50% 38%',
      '62% 50%',
    ),
  },
  {
    id: 'room-project-03',
    title: 'Room with a wide window',
    change: 'Pale blue to bright white',
    summary: 'Pale blue walls around a wide window, now bright white from floor to ceiling.',
    // Confirmed by the owner: IMG_0331 is BEFORE, IMG_0332 is AFTER.
    before: photo(
      'room-project-03-before',
      1170,
      1560,
      760,
      'Before: room with pale blue walls, a wide window with vertical blinds and a dark valance, and a stained beige carpet',
      '#a9a69c',
      '50% 6%',
      '50% 30%',
    ),
    after: photo(
      'room-project-03-after',
      1170,
      878,
      760,
      'After: the same room with white walls, a ceiling fan, a wide three-part window and a dark carpet, seen from a different corner',
      '#8f8a78',
      '50% 38%',
      '44% 50%',
    ),
  },
  {
    id: 'room-project-04',
    title: 'Room with built-in shelves',
    change: 'Deep blue to bright white',
    summary: 'Deep blue walls and a blue support post in a large room with built-in shelves, now bright white throughout.',
    // Confirmed by the owner: IMG_0336 is BEFORE, IMG_0337 is AFTER.
    before: photo(
      'room-project-04-before',
      1170,
      1560,
      760,
      'Before: large room with deep blue walls, a blue support post, a wall heater, built-in shelves and a worn, stained carpet',
      '#7b7f8a',
      '50% 8%',
      '50% 40%',
    ),
    after: photo(
      'room-project-04-after',
      1170,
      1560,
      760,
      'After: the same large room with bright white walls and posts, recessed ceiling lights, the wall heater, built-in shelves and a grey carpet, seen from a different angle',
      '#b8b5ad',
      '50% 45%',
      '50% 50%',
    ),
  },
]

// The honesty note shown under the projects now lives in data/text.js (angleNote).
