import { useEffect, useRef } from 'react'
import Brush from './Brush.jsx'
import { BRUSH_VIEW } from '../lib/brushGeometry.js'
import {
  FORESHORTEN,
  bezier,
  brushParts,
  clamp,
  ease,
  lerp,
  makeBristles,
  paintSegment,
  poseBrush,
  primerPattern,
  rand,
  splatter,
} from '../lib/paintEngine.js'
import { asset } from '../lib/asset.js'
import { intro as introQuality, motionTier, settleMotionTier } from '../lib/motion.js'

/*
  THE FIRST STROKE — opening sequence (≈2.7s)

  1. Blank canvas   A primed wall with fine texture and soft light. The
                    brush mark and wordmark settle in; the logo's swoosh
                    paints itself in.
  2. Arrival        The logo's brush lifts out of the mark — with weight,
                    a little anticipation and flexing bristles — and
                    swings down to the wall.
  3. Paint          Two pressure-varied cobalt strokes with droplets.
                    Each stroke erases the primer, so the paint *is* the
                    homepage underneath.
  4. Reveal         A final diagonal sweep: the brush rushes toward the
                    camera, the stroke widens past the screen edges and
                    the hero choreography starts beneath it. No fade.

  Plays once per session. Skip with the button or Esc (skipping runs a
  quick final sweep instead of cutting). Reduced motion never sees it.
*/

const SESSION_KEY = 'rps-intro-seen'
const PRIMER = '#fcfbf8'
const COBALT = '#b08a36'

// Timeline (ms)
const T = { logo: 520, lift: 900, s1: 1420, s2: 1940, final: 2640, reveal: 2060 }

export function shouldPlayIntro() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
  } catch {
    /* storage blocked — play it */
  }
  return true
}

export function resetIntro() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

function buildScene(W, H) {
  const landscape = W >= H * 0.85
  const D = Math.hypot(W, H)
  const M = clamp(Math.min(W, H) * (landscape ? 0.2 : 0.32), 96, 180) // logo mark size
  const markX = W / 2 - M / 2
  const markY = H * (landscape ? 0.36 : 0.33) - M / 2

  const band = landscape ? H * 0.56 : W * 0.62
  const kPaint = (band * 0.72) / BRUSH_VIEW.face
  const len = (BRUSH_VIEW.w - BRUSH_VIEW.tipX) * FORESHORTEN * kPaint + 40

  const s1 = landscape
    ? bezier([W * 0.08, H * 0.29], [W * 0.38, H * 0.2], [W * 0.72, H * 0.27], [W + len, H * 0.2])
    : bezier([W * 0.3, H * 0.09], [W * 0.24, H * 0.4], [W * 0.32, H * 0.7], [W * 0.28, H + len])
  const s2 = landscape
    ? bezier([W + len, H * 0.74], [W * 0.62, H * 0.82], [W * 0.3, H * 0.7], [-len, H * 0.77])
    : bezier([W * 0.74, H + len], [W * 0.78, H * 0.6], [W * 0.68, H * 0.3], [W * 0.73, -len])
  const fin = landscape
    ? bezier([-W * 0.35, H * 1.35], [W * 0.2, H * 0.95], [W * 0.68, H * 0.2], [W * 1.5, -H * 0.5])
    : bezier([-W * 0.5, H * 1.15], [W * 0.1, H * 0.85], [W * 0.75, H * 0.25], [W * 1.6, -H * 0.3])

  // Pressure: the brush touches down lightly, presses in, and breathes a little.
  const touchdown = (e) => (e < 0.12 ? 0.3 + 0.7 * ease.outCubic(e / 0.12) : 1 - 0.05 * Math.sin(e * 11))

  return {
    landscape,
    M,
    markX,
    markY,
    kLogo: (0.112 * M) / 64,
    logoTip: [markX + (14.6 * M) / 64, markY + (43.8 * M) / 64],
    kPaint,
    strokes: [
      { point: s1, band: () => band, pressure: touchdown },
      { point: s2, band: () => band, pressure: (e) => 1 - 0.05 * Math.sin(e * 9 + 1) },
      // Once the final stroke is wider than the screen only its solid core matters.
      { point: fin, band: (e) => D * (0.5 + 1.25 * e), pressure: () => 1, dryStart: 2, coreOnlyAbove: Math.max(W, H) },
    ],
  }
}

export default function Intro({ onReveal, onDone }) {
  const canvasRef = useRef(null)
  const brushRef = useRef(null)
  const skipRef = useRef(() => {})
  const skipBtnRef = useRef(null)

  useEffect(() => {
    markSeen()
    skipBtnRef.current?.focus({ preventScroll: true })
    let raf = 0
    let cancelled = false
    let finished = false
    let revealed = false

    const reveal = () => {
      if (revealed) return
      revealed = true
      onReveal?.()
    }
    const done = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
      reveal()
      onDone?.()
    }

    const W = window.innerWidth
    const H = window.innerHeight
    const canvas = canvasRef.current
    let ctx
    let Q = introQuality(motionTier())
    let bristles = []
    let coverCache = null

    // Canvas resolution follows the motion tier: device pixels, capped, and
    // kept within a pixel budget so huge or very dense screens stay smooth.
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, Q.dprCap, Math.sqrt(Q.pixelBudget / (W * H)))
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      coverCache = null
      // Same seeds at every tier, so the strokes keep their character; fewer, wider bristles cost less.
      const k = Q.bristles / 110
      bristles = [makeBristles(11, Q.bristles), makeBristles(97, Q.bristles), makeBristles(211, Math.round(90 * k))]
      document.documentElement.dataset.introQuality = motionTier()
    }
    try {
      ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      sizeCanvas()
    } catch {
      done()
      return
    }

    const sc = buildScene(W, H)
    const parts = brushParts(brushRef.current)
    const lastE = [0, 0, 0]
    const r = rand(5)
    // The Rose Painting Solutions badge, shown on the primer wall before the brush paints over it.
    const logoImg = typeof Image !== 'undefined' ? new Image() : null
    if (logoImg) {
      logoImg.decoding = 'async'
      logoImg.src = asset('images/rose-painting/brand/rose-logo-512.webp')
    }
    let finalStart = T.s2
    let finalDur = T.final - T.s2
    let skipping = false
    let t0 = 0
    let prevAngle = -0.698
    let flex = 0
    let lastDrop = 0
    let touched = false

    // The primed wall (paint, daylight, edge shade, texture) is drawn once into an
    // offscreen canvas; each logo frame just copies it instead of four full-screen fills.
    const buildCover = () => {
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = canvas.height
      const g = c.getContext('2d')
      g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
      g.fillStyle = PRIMER
      g.fillRect(0, 0, W, H)
      // soft daylight from the upper left, a touch of shade at the edges
      const light = g.createRadialGradient(W * 0.22, H * 0.05, 0, W * 0.22, H * 0.05, Math.max(W, H) * 0.9)
      light.addColorStop(0, 'rgba(255,255,255,0.9)')
      light.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = light
      g.fillRect(0, 0, W, H)
      const shade = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8)
      shade.addColorStop(0, 'rgba(21,19,16,0)')
      shade.addColorStop(1, 'rgba(21,19,16,0.07)')
      g.fillStyle = shade
      g.fillRect(0, 0, W, H)
      g.globalAlpha = 0.55
      g.fillStyle = primerPattern(g)
      g.fillRect(0, 0, W, H)
      return c
    }

    const drawCover = (logoT) => {
      if (!coverCache) coverCache = buildCover()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.drawImage(coverCache, 0, 0, W, H)

      // Logo badge fades and settles in
      const a = ease.outCubic(clamp((logoT - 60) / 380, 0, 1))
      if (a > 0 && logoImg && logoImg.complete && logoImg.naturalWidth) {
        const L = Math.min(sc.M * 2.1, W * 0.78, H * 0.6)
        const cx = W / 2
        const cy = sc.markY + sc.M / 2 + sc.M * 0.35 + (1 - a) * 10
        ctx.globalAlpha = a
        ctx.drawImage(logoImg, cx - L / 2, cy - L / 2, L, L)
      } else if (a > 0) {
        const size = sc.M * 0.56
        const y = sc.markY + sc.M + size * 0.86 + (1 - a) * 10
        ctx.globalAlpha = a
        ctx.fillStyle = '#151310'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `400 ${size}px Gloock, Georgia, serif`
        ctx.fillText('Rose', W / 2, y)
      }
      ctx.globalAlpha = 1
    }

    const angleOf = (s, e) => {
      const [x0, y0] = s.point(Math.max(0, e - 0.004))
      const [x1, y1] = s.point(Math.min(1, e + 0.004))
      return Math.atan2(y1 - y0, x1 - x0)
    }

    const pose = (x, y, angle, k, fore, press, opacity = 1, dt = 16) => {
      // bristles lag behind rotation, then settle — reads as weight
      const av = (angle - prevAngle) / Math.max(8, dt)
      flex = lerp(flex, clamp(-av * 900, -16, 16), 0.35)
      prevAngle = angle
      poseBrush(parts, { x, y, angle, scale: k, fore, flex, press, opacity })
    }

    const runStroke = (k, e, dt, { scale = sc.kPaint, foreTo = FORESHORTEN } = {}) => {
      const s = sc.strokes[k]
      if (e > lastE[k]) {
        paintSegment(ctx, s, bristles[k], lastE[k], e)
        lastE[k] = e
      }
      const [x, y] = s.point(e)
      const ang = angleOf(s, e)
      const lift = -0.06 * (Math.cos(ang) < 0 ? -1 : 1)
      const press = 0.86 + 0.04 * Math.sin(e * 20)
      pose(x, y, ang + lift, scale, foreTo, press, 1, dt)

      // occasional droplets thrown off the wet edge
      if (k < 2 && e > 0.05 && e < 0.8 && vt - lastDrop > 70 / Q.drops) {
        lastDrop = vt
        const side = r() < 0.5 ? -1 : 1
        const half = s.band(e) / 2
        const nx = -Math.sin(ang)
        const ny = Math.cos(ang)
        splatter(ctx, x + nx * side * (half + 6), y + ny * side * (half + 6), Math.atan2(ny * side, nx * side), r, {
          count: 1 + Math.floor(r() * 3),
          reach: 40,
          size: 3 + r() * 4,
        })
      }
    }

    // A capped clock: after a stall (tab switch, busy main thread) the brush carries
    // on from where it was instead of jumping ahead, so motion never teleports.
    let last = 0
    let vt = 0
    let debt = 0
    const frame = (now) => {
      if (cancelled) return
      if (!t0) t0 = now
      const raw = last ? now - last : 16
      last = now
      // Long frames are capped; the lost time is repaid gently (up to 1.6× speed)
      // so the brush never teleports and the intro doesn't drag on either.
      const step = Math.min(raw, 50)
      debt += raw - step
      const repay = Math.min(debt, step * 0.6)
      debt -= repay
      const dt = step + repay
      vt += dt
      const t = vt

      try {
        if (!skipping && t < T.logo) {
          drawCover(t)
          const a = ease.outCubic(clamp(t / 420, 0, 1))
          pose(sc.logoTip[0], sc.logoTip[1] - (1 - a) * 12, -0.698, sc.kLogo * (0.94 + 0.06 * a), 1, 1, a, dt)
        } else if (!skipping && t < T.lift) {
          // Lift: anticipation up and back, then swing down to the wall
          if (t - dt < T.logo) drawCover(T.logo)
          const e = ease.inOutCubic((t - T.logo) / (T.lift - T.logo))
          const [tx, ty] = sc.strokes[0].point(0)
          const path = bezier(
            sc.logoTip,
            [sc.logoTip[0] + W * 0.06, sc.logoTip[1] - H * 0.16],
            [tx + W * 0.04, ty - H * 0.18],
            [tx, ty],
          )
          const [x, y] = path(e)
          const a0 = -0.698
          const a1 = angleOf(sc.strokes[0], 0.01) - 0.06
          const over = Math.sin(e * Math.PI) * 0.22 // a little extra swing past the target
          pose(x, y, lerp(a0, a1, e) - over, lerp(sc.kLogo, sc.kPaint, ease.outCubic(e)), lerp(1, FORESHORTEN, e), 1, 1, dt)
          if (e > 0.97 && !touched) {
            touched = true
            splatter(ctx, tx, ty, sc.landscape ? Math.PI * 0.75 : Math.PI * 1.1, r, { count: 7, reach: sc.kPaint * 60, size: 5 })
          }
        } else if (!skipping && t < T.s1) {
          runStroke(0, ease.inOutSine((t - T.lift) / (T.s1 - T.lift)), dt)
        } else if (!skipping && t < T.s2) {
          if (lastE[0] < 1) runStroke(0, 1, dt)
          runStroke(1, ease.inOutSine((t - T.s1) / (T.s2 - T.s1)), dt)
        } else {
          if (!skipping && lastE[1] < 1) runStroke(1, 1, dt)
          const p = clamp((t - finalStart) / finalDur, 0, 1)
          const e = ease.sweep(p)
          const grow = 1 + 2.2 * e * e // the brush rushes toward the camera
          runStroke(2, e, dt, { scale: sc.kPaint * grow, foreTo: lerp(FORESHORTEN, 0.85, e) })
          if (p > 0.4) reveal()
          if (p >= 1) {
            ctx.clearRect(0, 0, W, H)
            performance.mark?.('intro-end')
            return done()
          }
        }
        if (!revealed && t > T.reveal) reveal()
      } catch {
        return done()
      }
      raf = requestAnimationFrame(frame)
    }

    let started = false
    const startLoop = () => {
      if (started || cancelled) return
      started = true
      performance.mark?.('intro-start')
      raf = requestAnimationFrame(frame)
    }

    skipRef.current = () => {
      if (skipping || finished) return
      skipping = true
      // If the loop hasn't started yet (still waiting on fonts), sweep from t = 0 right now.
      finalStart = vt
      finalDur = 420
      // a wider brush so one quick pass clears everything
      const fin = sc.strokes[2]
      const base = fin.band
      fin.band = (e) => base(e) * 1.6
      startLoop()
    }

    // Give the display font a moment so the wordmark renders in Gloock, start
    // decoding the hero photo the brush will reveal, and measure a few frames to
    // settle the motion tier. None of it can hold the intro back beyond 600 ms.
    const heroImg = document.querySelector('.hero3-photo img')
    const ready = Promise.race([
      Promise.all([
        document.fonts?.load
          ? Promise.all([document.fonts.load('400 100px Gloock'), document.fonts.load('600 20px "Hanken Grotesk"')])
          : null,
        settleMotionTier(450),
      ]),
      new Promise((res) => setTimeout(res, 600)),
    ])
    heroImg?.decode?.().catch(() => {})
    drawCover(0)
    ready.finally(() => {
      // The tier may have changed after the frame probe; resize before the first stroke.
      const nextQ = introQuality(motionTier())
      if (nextQ !== Q && nextQ.bristles !== Q.bristles && !started) {
        Q = nextQ
        sizeCanvas()
        drawCover(0)
      }
      startLoop()
    })

    const onKey = (e) => e.key === 'Escape' && skipRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="intro">
      <canvas ref={canvasRef} aria-hidden="true" />
      <Brush
        ref={brushRef}
        id="intro-brush"
        className="intro-brush"
        style={{ transformOrigin: '0 0', width: 520, height: 180, opacity: 0 }}
      />
      <button
        ref={skipBtnRef}
        type="button"
        onClick={() => skipRef.current()}
        className="absolute right-5 bottom-5 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_6px_20px_-8px_rgb(0_0_0/0.5)] transition hover:bg-white md:right-8 md:bottom-8"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        Skip intro
      </button>
    </div>
  )
}
