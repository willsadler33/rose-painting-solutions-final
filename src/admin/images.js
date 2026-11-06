// ─────────────────────────────────────────────────────────────
// Photo processing in the owner's browser (no server image service).
//
// Any photo the device can open (JPEG, PNG, WebP, HEIC on iPhone, AVIF…)
// is redrawn and re-encoded, which:
//   • applies the phone's orientation,
//   • removes ALL embedded data — GPS location, camera details, etc.,
//   • produces the sizes the website needs: master (private, for
//     re-editing), lg, md and thumb, as WebP (JPEG where WebP can't be made).
// Edits (crop, rotate, brightness, contrast) are applied from the master,
// so repeated editing never loses quality.
// ─────────────────────────────────────────────────────────────
import { api, uploadBytes } from './api.js'

export const MAX_INPUT_BYTES = 40 * 1024 * 1024
const SIZES = { master: { edge: 3200, q: 0.9, max: 4_200_000 }, lg: { edge: 2000, q: 0.84, max: 2_900_000 }, md: { edge: 1000, q: 0.8, max: 1_150_000 }, thumb: { edge: 480, q: 0.74, max: 280_000 } }

/** Sniff the first bytes so renamed or non-image files are refused early. */
async function looksLikeImage(file) {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const s = (i, n) => String.fromCharCode(...b.slice(i, i + n))
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png'
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp'
  if (s(4, 4) === 'ftyp') return 'heic/avif'
  if (s(0, 3) === 'GIF') return 'gif'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp'
  return ''
}

/** Turn a File, Blob or same-site URL into something we can draw. */
export async function decode(source) {
  let blob = source
  if (typeof source === 'string') {
    const res = await fetch(source, { credentials: 'same-origin' })
    if (!res.ok) throw new Error('That photo couldn’t be loaded. Please try again.')
    blob = await res.blob()
  } else {
    if (source.size > MAX_INPUT_BYTES) throw new Error('That photo is over 40 MB. Please choose a smaller one.')
    const kind = await looksLikeImage(source)
    if (!kind) throw new Error('That file isn’t a photo we can use. Please choose a JPEG, PNG, WebP or iPhone photo.')
  }
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return { image: bmp, w: bmp.width, h: bmp.height }
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { image: img, w: img.naturalWidth, h: img.naturalHeight }
    } catch {
      throw new Error(
        'This photo format can’t be opened on this device. On iPhone, choose the photo from your library (it converts automatically), or set Camera › Formats › Most Compatible.',
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

const canFilter = (() => {
  try {
    const c = document.createElement('canvas').getContext('2d')
    c.filter = 'brightness(1.1)'
    return c.filter === 'brightness(1.1)'
  } catch {
    return false
  }
})()

/** Draw the photo with its edits applied, longest side at most `edge` px. */
export function render(src, edits = {}, edge = 2000) {
  const rot = edits.rotate || 0
  const rw = rot % 180 ? src.h : src.w
  const rh = rot % 180 ? src.w : src.h
  const c = edits.crop || { x: 0, y: 0, w: 1, h: 1 }
  const cw = rw * c.w
  const ch = rh * c.h
  const scale = Math.min(1, edge / Math.max(cw, ch))
  const W = Math.max(1, Math.round(cw * scale))
  const H = Math.max(1, Math.round(ch * scale))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const b = 1 + (edits.brightness || 0) / 100
  const k = 1 + (edits.contrast || 0) / 100
  if (canFilter && (b !== 1 || k !== 1)) ctx.filter = `brightness(${b}) contrast(${k})`
  ctx.scale(scale, scale)
  ctx.translate(-c.x * rw, -c.y * rh)
  // rotate around the rotated image's frame
  if (rot === 90) ctx.transform(0, 1, -1, 0, rw, 0)
  else if (rot === 180) ctx.transform(-1, 0, 0, -1, rw, rh)
  else if (rot === 270) ctx.transform(0, -1, 1, 0, 0, rh)
  ctx.drawImage(src.image, 0, 0, src.w, src.h)
  if (!canFilter && (b !== 1 || k !== 1)) {
    // Safari: apply the same adjustment by hand.
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, ((d[i + j] * b) / 255 - 0.5) * k * 255 + 127.5))
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(img, 0, 0)
  }
  return canvas
}

function toBlob(canvas, type, q) {
  return new Promise((res) => canvas.toBlob(res, type, q))
}
/** WebP where the browser can make it, otherwise JPEG; quality steps down until it fits. */
async function encode(canvas, { q, max }) {
  let quality = q
  for (let i = 0; i < 6; i++) {
    let blob = await toBlob(canvas, 'image/webp', quality)
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality)
    if (blob && blob.size <= max) return blob
    quality -= 0.08
  }
  throw new Error('That photo couldn’t be made small enough to upload. Try cropping it, or use a smaller photo.')
}

/** Average colour (placeholder shown while a photo loads). */
function toneOf(canvas) {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const ctx = c.getContext('2d')
  ctx.drawImage(canvas, 0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Process and upload a photo.
 *   source: File (new photo / replacement) or URL of the private master (re-edit)
 *   id:     existing photo id for a new revision, or undefined for a new photo
 *   withMaster: keep a high-quality private copy (true for new photos/replacements)
 * Returns the fields to store on the photo.
 */
export async function processAndUpload(source, { id, edits = {}, withMaster = true, onProgress } = {}) {
  onProgress?.({ stage: 'Preparing photo', pct: 0.02 })
  const src = await decode(source)
  const parts = []
  if (withMaster) parts.push(['master', await encode(render(src, {}, SIZES.master.edge), SIZES.master)])
  const lgCanvas = render(src, edits, SIZES.lg.edge)
  parts.push(['lg', await encode(lgCanvas, SIZES.lg)])
  const mdCanvas = render(src, edits, SIZES.md.edge)
  parts.push(['md', await encode(mdCanvas, SIZES.md)])
  const thCanvas = render(src, edits, SIZES.thumb.edge)
  parts.push(['thumb', await encode(thCanvas, SIZES.thumb)])
  const tone = toneOf(thCanvas)
  src.image.close?.()

  const start = await api('media', { method: 'POST', body: id ? { id } : {} })
  const total = parts.reduce((s, [, b]) => s + b.size, 0)
  let done = 0
  const sizes = {}
  let ext = 'webp'
  for (const [variant, blob] of parts) {
    const r = await uploadBytes(start.id, start.rev, variant, blob, (f) =>
      onProgress?.({ stage: 'Uploading', pct: 0.05 + (0.95 * (done + f * blob.size)) / total }),
    )
    done += blob.size
    if (variant !== 'master') sizes[variant] = { w: r.w, h: r.h }
    ext = r.ext === 'jpg' ? 'jpg' : 'webp'
  }
  onProgress?.({ stage: 'Done', pct: 1 })
  return {
    id: start.id,
    rev: start.rev,
    ext,
    sizes,
    w: sizes.lg.w,
    h: sizes.lg.h,
    tone,
    ...(withMaster ? { hasMaster: true } : {}),
  }
}

/** A friendly default title from a file name ("IMG_0412.HEIC" → "New photo"). */
export function titleFromFile(name = '') {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
  if (!base || /^(img|dsc|pxl|photo|image)\s*\d+/i.test(base) || /^\d+$/.test(base)) return 'New photo'
  return base.charAt(0).toUpperCase() + base.slice(1, 70)
}
