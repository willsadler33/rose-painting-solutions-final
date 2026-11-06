import { memo, useEffect, useRef, useState } from 'react'
import { asset } from '../lib/asset.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { BrushMark } from './Logo.jsx'

/**
 * Drag-to-compare: the BEFORE photo sits underneath and the AFTER photo is
 * revealed from the right as the handle moves. Mouse, pen, trackpad, touch
 * and keyboard (arrow keys, Page Up/Down, Home/End via the range input).
 *
 * Performance: the position lives in a ref, not React state. Each pointer
 * event stores the latest position and one requestAnimationFrame writes it
 * as a 0–100 number that CSS turns into transforms (compositor-only — no
 * repaint, no layout). The slider's size is read once when a drag starts,
 * never per move and never on mount.
 *
 * before / after: { src, small?, smallW?, alt, w, h, focus?, focusM? }
 *   focus / focusM set the crop position (desktop / phone). Photos are
 *   cropped with object-fit: cover, never stretched.
 * label: what's being compared (used for the accessible name)
 * demo:  play one gentle sweep to show that it moves
 */
function CompareSlider({
  before,
  after,
  label,
  beforeLabel = 'Before',
  afterLabel = 'After',
  demo = false,
  onDemoEnd,
  sizes = '(min-width: 1024px) 52rem, 92vw',
  className = '',
  children,
}) {
  const ref = useRef(null)
  const rangeRef = useRef(null)
  const tapeB = useRef(null)
  const tapeA = useRef(null)
  const pos = useRef(50)
  const width = useRef(0)
  const left = useRef(0)
  const raf = useRef(0)
  const reduced = useReducedMotion()
  const demoRaf = useRef(0)
  const touched = useRef(false)
  const [hintGone, setHintGone] = useState(false)

  // Write the current position to the DOM (at most once per frame).
  const paint = () => {
    raf.current = 0
    const el = ref.current
    if (!el) return
    const p = pos.current
    const r = Math.round(p)
    el.style.setProperty('--p', p.toFixed(2))
    if (el.dataset.pos !== String(r)) el.dataset.pos = r
    const hb = String(p < 14)
    const ha = String(p > 86)
    if (tapeB.current && tapeB.current.dataset.hidden !== hb) tapeB.current.dataset.hidden = hb
    if (tapeA.current && tapeA.current.dataset.hidden !== ha) tapeA.current.dataset.hidden = ha
  }
  const setPos = (p) => {
    pos.current = Math.min(100, Math.max(0, p))
    if (!raf.current) raf.current = requestAnimationFrame(paint)
  }
  // The hidden range input (keyboard + screen readers) is synced when a drag or the
  // demo ends — rewriting its value on every move would force it to re-lay out.
  const syncRange = () => {
    const range = rangeRef.current
    if (!range) return
    const r = Math.round(pos.current)
    if (document.activeElement !== range) range.value = r
    range.setAttribute('aria-valuetext', `${100 - r}% of the after photo shown`)
  }
  // Promote the moving parts to GPU layers only while something is moving.
  const idle = useRef(0)
  const moving = (on) => {
    const el = ref.current
    if (!el) return
    clearTimeout(idle.current)
    if (on) el.classList.add('is-moving')
    else {
      syncRange()
      idle.current = setTimeout(() => el.classList.remove('is-moving'), 400)
    }
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(idle.current)
    },
    [],
  )

  const fromClientX = (clientX) => setPos(((clientX - left.current) / (width.current || 1)) * 100)

  const stopDemo = () => {
    if (!touched.current) onDemoEnd?.()
    touched.current = true
    setHintGone(true)
    cancelAnimationFrame(demoRaf.current)
  }

  // One gentle sweep the first time the slider is shown, to show that it moves.
  // Uses the same ref path as dragging, so it costs no React renders.
  useEffect(() => {
    if (!demo || reduced || touched.current) return
    const keys = [50, 76, 26, 50]
    const dur = 2400
    let t0 = 0
    const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2
    const tick = (now) => {
      if (!t0) t0 = now
      const p = Math.min(1, (now - t0) / dur)
      const seg = Math.min(keys.length - 2, Math.floor(p * (keys.length - 1)))
      const local = p * (keys.length - 1) - seg
      pos.current = keys[seg] + (keys[seg + 1] - keys[seg]) * ease(local)
      paint()
      if (p < 1 && !touched.current) demoRaf.current = requestAnimationFrame(tick)
      else {
        moving(false)
        if (p >= 1) onDemoEnd?.()
      }
    }
    const id = setTimeout(() => {
      moving(true)
      demoRaf.current = requestAnimationFrame(tick)
    }, 900)
    return () => {
      clearTimeout(id)
      cancelAnimationFrame(demoRaf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, reduced])

  // Mouse/pen/trackpad drag immediately. Touch waits for a clearly horizontal
  // swipe, so scrolling the page past the photos never moves the slider.
  const gesture = useRef(null)
  const dragging = useRef(false)
  const beginDrag = (e) => {
    stopDemo()
    const r = ref.current.getBoundingClientRect() // one read per drag
    left.current = r.left
    width.current = r.width
    dragging.current = true
    moving(true)
    ref.current.classList.add('is-dragging')
    ref.current.setPointerCapture?.(e.pointerId)
    fromClientX(e.clientX)
  }
  const endDrag = () => {
    dragging.current = false
    moving(false)
    ref.current?.classList.remove('is-dragging')
  }
  const onPointerDown = (e) => {
    if (e.button > 0) return
    if (e.pointerType === 'touch') {
      gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      return
    }
    e.preventDefault() // no text selection or image drag while dragging
    beginDrag(e)
  }
  const onPointerMove = (e) => {
    if (dragging.current) return fromClientX(e.clientX)
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = Math.abs(e.clientX - g.x)
    const dy = Math.abs(e.clientY - g.y)
    if (dy > 10 && dy > dx) gesture.current = null // a scroll — let it go
    else if (dx > 6 && dx > dy) {
      gesture.current = null
      beginDrag(e)
    }
  }
  const onPointerUp = (e) => {
    const g = gesture.current
    // A tap (no real movement) moves the handle to that spot.
    if (g && g.id === e.pointerId && Math.abs(e.clientX - g.x) < 6 && Math.abs(e.clientY - g.y) < 6) {
      stopDemo()
      const r = ref.current.getBoundingClientRect()
      left.current = r.left
      width.current = r.width
      fromClientX(e.clientX)
    }
    gesture.current = null
    endDrag()
  }

  const srcset = (p) => (p.small ? `${asset(p.small)} ${p.smallW || 800}w, ${asset(p.src)} ${p.w}w` : undefined)
  // Framing chosen in the dashboard: crop position (desktop / phone) and zoom.
  const focus = (p) => ({ '--f': p.focus || '50% 50%', '--fm': p.focusM || p.focus || '50% 50%', '--z': p.zoom || 1 })

  return (
    <div
      ref={ref}
      className={`compare ${className}`}
      style={{ '--pos': '50%' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={(e) => e.target === ref.current && endDrag()}
      data-pos="50"
    >
      <img
        src={asset(before.small || before.src)}
        srcSet={srcset(before)}
        sizes={sizes}
        alt={before.alt}
        width={before.w}
        height={before.h}
        style={focus(before)}
        loading="lazy"
        decoding="async"
        draggable="false"
        data-side="before"
      />
      {/* The after photo sits in a window that slides right while the photo
          inside slides left by the same amount: a moving reveal edge made of
          two transforms, so the compositor does it without repainting. */}
      <div className="compare-after">
        <img
          src={asset(after.small || after.src)}
          srcSet={srcset(after)}
          sizes={sizes}
          alt={after.alt}
          width={after.w}
          height={after.h}
          style={focus(after)}
          loading="lazy"
          decoding="async"
          draggable="false"
          data-side="after"
        />
      </div>

      <span ref={tapeB} className="tape compare-tape top-4 left-4 md:top-5 md:left-5" data-hidden="false" aria-hidden="true">
        {beforeLabel}
      </span>
      <span
        ref={tapeA}
        className="tape compare-tape top-4 right-4 md:top-5 md:right-5"
        style={{ '--tape-rot': '2.5deg' }}
        data-hidden="false"
        aria-hidden="true"
      >
        {afterLabel}
      </span>

      <span className="compare-line" aria-hidden="true" />
      <span className="compare-grip" aria-hidden="true">
        <svg className="grip-arrow grip-l" width="12" height="20" viewBox="0 0 12 20">
          <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="grip-disc">
          <BrushMark tone="dark" size={34} />
        </span>
        <svg className="grip-arrow grip-r" width="12" height="20" viewBox="0 0 12 20">
          <path d="m2 2 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`grip-hint ${hintGone ? 'is-gone' : ''}`}>Drag to compare</span>
      </span>

      {children}

      <input
        ref={rangeRef}
        type="range"
        min="0"
        max="100"
        step="1"
        defaultValue={50}
        onChange={(e) => {
          stopDemo()
          setPos(Number(e.target.value))
          e.target.setAttribute('aria-valuetext', `${100 - Number(e.target.value)}% of the after photo shown`)
        }}
        onKeyDown={() => moving(true)}
        onKeyUp={() => moving(false)}
        className="compare-range"
        aria-label={`Compare before and after: ${label}. Move left to show more of the after photo.`}
        aria-valuetext="50% of the after photo shown"
      />
    </div>
  )
}

export default memo(CompareSlider)
