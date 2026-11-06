// ─────────────────────────────────────────────────────────────
// Upload validation by actual file content (never by name or by the
// Content-Type the browser claims). Photos are optimised in the owner's
// browser before upload, so the server only ever stores JPEG or WebP.
// ─────────────────────────────────────────────────────────────

/** Per-variant limits: bytes and longest edge in pixels. */
export const VARIANT_LIMITS = {
  // Netlify Functions accept at most 6 MB per request, and binary bodies may be
  // base64-encoded on the way in (+33%), so keep every upload under ~4.5 MB.
  master: { bytes: 4_400_000, edge: 4096 },
  lg: { bytes: 3_000_000, edge: 2400 },
  md: { bytes: 1_200_000, edge: 1400 },
  thumb: { bytes: 300_000, edge: 800 },
}
export const VARIANTS = Object.keys(VARIANT_LIMITS)

const u16be = (b, i) => (b[i] << 8) | b[i + 1]
const u16le = (b, i) => b[i] | (b[i + 1] << 8)
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n))

function jpegSize(b) {
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return null
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2
      continue
    }
    const len = u16be(b, i + 2)
    if (len < 2) return null
    // Start-of-frame markers (C0–CF except DHT C4, JPG C8, DAC CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { w: u16be(b, i + 7), h: u16be(b, i + 5) }
    }
    i += 2 + len
  }
  return null
}

function webpSize(b) {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ') {
    if (!(b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)) return null
    return { w: u16le(b, 26) & 0x3fff, h: u16le(b, 28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { w: u24le(b, 24) + 1, h: u24le(b, 27) + 1 }
  return null
}

/** → { type: 'jpeg'|'webp', ext, mime, w, h } or null when it isn't a JPEG/WebP image. */
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const j = jpegSize(b)
  if (j && j.w > 0 && j.h > 0) return { type: 'jpeg', ext: 'jpg', mime: 'image/jpeg', ...j }
  const w = webpSize(b)
  if (w && w.w > 0 && w.h > 0) return { type: 'webp', ext: 'webp', mime: 'image/webp', ...w }
  return null
}

/** Validate one uploaded variant. Returns { ok, info } or { ok: false, error }. */
export function checkUpload(variant, bytes) {
  const lim = VARIANT_LIMITS[variant]
  if (!lim) return { ok: false, error: 'Unknown photo size.' }
  if (!bytes || bytes.length === 0) return { ok: false, error: 'The photo was empty.' }
  if (bytes.length > lim.bytes) return { ok: false, error: 'That photo is too large. Try a smaller photo.', status: 413 }
  const info = sniffImage(bytes)
  if (!info) return { ok: false, error: 'That file isn’t a supported photo (JPEG or WebP).', status: 415 }
  if (Math.max(info.w, info.h) > lim.edge) return { ok: false, error: 'That photo’s dimensions are too large.', status: 413 }
  return { ok: true, info }
}
