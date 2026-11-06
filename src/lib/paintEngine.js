// ─────────────────────────────────────────────────────────────
// Paint engine — shared by the intro and the hero room reveal.
//
// A stroke is painted by *erasing* a cover layer (primer white in the
// intro, the "before" photo in the hero) with ~100 simulated bristles,
// so whatever sits underneath is what the paint leaves behind.
// ─────────────────────────────────────────────────────────────
import { BRUSH_VIEW } from './brushGeometry.js'

export const FORESHORTEN = 0.62 // brush handle points toward the viewer while painting

export const ease = {
  inOutSine: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  // fast, decisive sweep with a soft start and finish
  sweep: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
}

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export function rand(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Cubic Bézier helper → returns point(e) for a stroke. */
export function bezier(p0, p1, p2, p3) {
  return (t) => {
    const u = 1 - t
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]
  }
}

export function makeBristles(seed, count = 110) {
  const r = rand(seed)
  return Array.from({ length: count }, (_, i) => {
    const u = (i + r() * 0.8) / count - 0.5 // −0.5…0.5 across the brush
    const edge = Math.pow(Math.abs(u) * 2, 5)
    return {
      u,
      w: 0.55 + r() * 1.0, // width as a multiple of bristle spacing
      a: edge > 0.55 ? 0.55 + r() * 0.45 : r() < 0.12 ? 0.55 + r() * 0.25 : 1,
      wob: edge * 0.05,
      f: 4 + r() * 10,
      ph: r() * Math.PI * 2,
      dry: r() < 0.3 ? 0.68 + r() * 0.26 : 9,
    }
  })
}

/**
 * Paint one stroke segment from progress e0 to e1.
 * stroke = { point(e) → [x,y], band(e) → width in px, pressure(e) → 0…1, dryStart }
 */
export function paintSegment(ctx, stroke, bristles, e0, e1) {
  if (e1 <= e0) return
  const [ax, ay] = stroke.point(e0)
  const [bx, by] = stroke.point(e1)
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 7))
  const n = steps + 1
  // Flat sample buffers (no per-sample objects).
  const SE = new Float32Array(n)
  const SX = new Float32Array(n)
  const SY = new Float32Array(n)
  const NX = new Float32Array(n)
  const NY = new Float32Array(n)
  const SB = new Float32Array(n)
  let bandMin = Infinity
  let bandMax = 0
  for (let i = 0; i < n; i++) {
    const e = e0 + (e1 - e0) * (i / steps)
    const [x, y] = stroke.point(e)
    const [x2, y2] = stroke.point(Math.min(1, e + 0.002))
    const [x0, y0] = stroke.point(Math.max(0, e - 0.002))
    let tx = x2 - x0
    let ty = y2 - y0
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    const band = stroke.band(e) * (stroke.pressure ? stroke.pressure(e) : 1)
    SE[i] = e
    SX[i] = x
    SY[i] = y
    NX[i] = -ty
    NY[i] = tx
    SB[i] = band
    if (band < bandMin) bandMin = band
    if (band > bandMax) bandMax = band
  }

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'

  const coreOnly = stroke.coreOnlyAbove && SB[0] > stroke.coreOnlyAbove
  // Loaded core: solid coverage that thins as the brush runs dry.
  const dryAt = stroke.dryStart ?? 0.72
  const coreAlpha = e1 < dryAt ? 1 : Math.max(0.35, 1 - (e1 - dryAt) * 2.4)
  const coreW = SB[n - 1] * (coreOnly ? 1 : 0.8)
  ctx.globalAlpha = coreAlpha
  ctx.beginPath()
  ctx.moveTo(SX[0], SY[0])
  for (let i = 1; i < n; i++) ctx.lineTo(SX[i], SY[i])
  ctx.lineWidth = coreW
  ctx.stroke()

  if (coreOnly) {
    ctx.restore()
    return
  }
  // Where the core has already erased everything (alpha 1), a bristle that sits
  // wholly inside it changes no pixels — skip it. The visible result is identical.
  const coreHalf = coreAlpha >= 1 ? coreW / 2 - 1 : -1
  const spacing = SB[0] / bristles.length
  for (const b of bristles) {
    const alpha = b.a * (e1 > b.dry ? Math.max(0, 1 - (e1 - b.dry) * 4.5) : 1)
    if (alpha <= 0.02) continue
    const lw = Math.max(1.2, b.w * spacing * 2.2)
    if (coreHalf > 0 && (Math.abs(b.u) + b.wob) * bandMax + lw / 2 <= coreHalf) continue
    ctx.globalAlpha = alpha
    ctx.lineWidth = lw
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const off = (b.u + Math.sin(SE[i] * b.f * Math.PI + b.ph) * b.wob) * SB[i]
      const px = SX[i] + NX[i] * off
      const py = SY[i] + NY[i] * off
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Flicks a few droplets of paint onto the cover layer. */
export function splatter(ctx, x, y, angle, r, { color = '#B08A36', count = 6, reach = 120, size = 7 } = {}) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const a = angle + (r() - 0.5) * 0.9
    const d = reach * (0.25 + r() * 0.9)
    const s = size * (0.25 + r() * r() * 1.2)
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    ctx.globalAlpha = 0.85 + r() * 0.15
    ctx.beginPath()
    // a droplet stretched along its direction of travel
    ctx.ellipse(px, py, s * (1.2 + r()), s, a, 0, Math.PI * 2)
    ctx.fill()
    if (r() < 0.5) {
      ctx.beginPath()
      ctx.arc(px + Math.cos(a) * s * 2.4, py + Math.sin(a) * s * 2.4, s * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Positions the SVG brush so its bristle tip sits on (x, y).
 * flex: bristle bend in degrees; press: 1 = relaxed, <1 = bristles compressed on the wall.
 */
export function poseBrush(parts, { x, y, angle, scale, fore = FORESHORTEN, flex = 0, press = 1, opacity = 1 }) {
  const { el, brand, bristles } = parts
  if (!el) return
  const flip = Math.cos(angle) < -0.01 ? -1 : 1
  el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad) scale(${scale * fore}, ${scale * flip}) translate(${-BRUSH_VIEW.tipX}px, ${-BRUSH_VIEW.tipY}px)`
  const o = String(opacity)
  if (el.style.opacity !== o) el.style.opacity = o
  if (brand && brand.dataset.flip !== String(flip)) {
    brand.dataset.flip = String(flip)
    brand.setAttribute('transform', flip < 0 ? 'translate(700 0) scale(-1 1)' : '')
  }
  if (bristles) {
    // Only touch the SVG when the bend visibly changes (each write repaints the brush).
    const t = `translate(${BRUSH_VIEW.ferruleX} 90) skewY(${(flex * flip).toFixed(1)}) scale(${press.toFixed(2)} 1) translate(${-BRUSH_VIEW.ferruleX} -90)`
    if (bristles.__t !== t) {
      bristles.__t = t
      bristles.setAttribute('transform', t)
    }
  }
}

export function brushParts(svg) {
  return {
    el: svg,
    brand: svg?.querySelector('[data-brand]'),
    bristles: svg?.querySelector('[data-bristles]'),
  }
}

/** Fine paper/primer texture as a repeatable pattern. */
export function primerPattern(ctx, seed = 3) {
  const c = document.createElement('canvas')
  c.width = c.height = 140
  const g = c.getContext('2d')
  const r = rand(seed)
  const img = g.createImageData(140, 140)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + r() * 135
    img.data[i] = v - 6
    img.data[i + 1] = v - 3
    img.data[i + 2] = v
    img.data[i + 3] = r() * 26
  }
  g.putImageData(img, 0, 0)
  return ctx.createPattern(c, 'repeat')
}

/** Draws an image into a canvas the way CSS object-fit: cover would. */
export function drawCover(ctx, img, w, h, posY = 0.5) {
  const ir = img.naturalWidth / img.naturalHeight
  const cr = w / h
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  let sx = 0
  let sy = 0
  if (ir > cr) {
    sw = sh * cr
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = sw / cr
    sy = (img.naturalHeight - sh) * posY
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
}
