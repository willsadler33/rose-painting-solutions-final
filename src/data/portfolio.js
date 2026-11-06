// ─────────────────────────────────────────────────────────────
// "Our Work" — photos of finished Rose Painting Solutions projects
// (confirmed by the owner: photos 01–05 are finished results).
//
// Captions describe what is visible in each photo.
// To add a photo: put the file (and an ~800px-wide copy) in
// public/images/rose-painting/real-work/, then add an entry below.
// `w`/`h` are the image's pixel size (keeps the layout from jumping);
// `tone` is a placeholder colour shown while the photo loads.
// ─────────────────────────────────────────────────────────────
const dir = 'images/rose-painting/real-work/'
const photo = (n, name, w, h, tone, group, caption, alt) => ({
  id: n,
  src: `${dir}${n}-${name}.webp`,
  small: `${dir}${n}-${name}-800.webp`,
  w,
  h,
  tone,
  group,
  caption,
  alt,
})

// Listed in the order they hang on the page.
export const portfolio = [
  photo('02', 'light-room-tall-windows', 1170, 1552, '#888878', 'Finished room', 'Bright room with tall windows',
    'Finished room: empty room with white walls, grey carpet and a white ceiling fan, with sunlight coming through a tall double window'),
  photo('05', 'neutral-room-wide-window', 1170, 871, '#786848', 'Finished room', 'Room with a wide window',
    'Finished room: room with light walls, dark carpet, a ceiling fan with a light and a wide three-part window'),
  photo('01', 'light-room-sliding-door', 1170, 1556, '#787868', 'Finished room', 'Room with a sliding glass door',
    'Finished room: empty room with light walls, grey carpet, a dark ceiling fan and a sliding glass door at the far end'),
  photo('03', 'light-room-patio-door', 1170, 1556, '#787868', 'Finished room', 'Room with a double window',
    'Finished room: empty room with white walls, grey carpet, a ceiling fan and a double window letting in sunlight'),
  photo('04', 'light-bathroom-tub', 1170, 1556, '#887868', 'Finished bathroom', 'Bathroom with a corner tub',
    'Finished bathroom seen through an open door: light walls, a vanity with mirror, tiled floor and a corner bathtub'),
]
