import { useEffect, useRef, useState } from 'react'
import { transformations } from '../data/projects.js'
import { text } from '../data/text.js'
import { asset } from '../lib/asset.js'
import CompareSlider from './CompareSlider.jsx'
import Lightbox from './Lightbox.jsx'

/**
 * The four confirmed before & after projects.
 *  - Project cards on top choose the project.
 *  - Slider (default): drag to reveal the after photo over the before.
 *  - Side by side: both photos whole, at equal height.
 * The photos were taken from slightly different spots; nothing is warped to
 * match, and a note says so.
 */
const ratio = (p) => p.w / p.h
const srcSet = (p) => `${asset(p.small)} ${p.smallW}w, ${asset(p.src)} ${p.w}w`
// Same `sizes` as the slider, so the browser preloads exactly the file it will show.
const SLIDER_SIZES = '(min-width: 1024px) 52rem, 92vw'
const prepared = new Map()
/** Fetch and decode a project's two photos (once). Resolves when both are ready to paint. */
function prepare(t) {
  if (prepared.has(t.id)) return prepared.get(t.id)
  const jobs = [t.before, t.after].map((p) => {
    const im = new Image()
    im.sizes = SLIDER_SIZES
    im.srcset = srcSet(p)
    im.src = asset(p.small)
    return im.decode ? im.decode().catch(() => {}) : Promise.resolve()
  })
  const ready = Promise.all(jobs)
  prepared.set(t.id, ready)
  return ready
}

export default function ProjectShowcase({ active }) {
  const [idx, setIdx] = useState(0) // project on show
  const [sel, setSel] = useState(0) // project chosen (cards respond instantly)
  const want = useRef(0)
  const [view, setView] = useState('slider')
  const [shown, setShown] = useState(false)
  const [demoDone, setDemoDone] = useState(false)
  const [openAt, setOpenAt] = useState(null)
  const opener = useRef(null)
  const refocus = useRef(null)
  const t = transformations[Math.min(idx, transformations.length - 1)]

  // Brush the photos in when the section arrives, the project changes or the view changes.
  useEffect(() => {
    if (!active) return
    setShown(false)
    let b = 0
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setShown(true))))
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [active, idx, view])

  // The card responds at once; the photos swap as soon as both are decoded (or
  // after 350 ms at most), so the brush never reveals a half-decoded image.
  const choose = (i) => {
    if (i === sel) return
    setSel(i)
    want.current = i
    const swap = () => {
      if (want.current !== i) return
      setShown(false)
      setIdx(i)
    }
    Promise.race([prepare(transformations[i]), new Promise((r) => setTimeout(r, 350))]).then(swap)
  }
  const changeView = (v) => {
    if (v === view) return
    setShown(false)
    setView(v)
  }
  const onPickerKey = (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    const btns = [...e.currentTarget.querySelectorAll('button')]
    const from = Math.max(0, btns.indexOf(e.target.closest('button')))
    const n = (from + d + btns.length) % btns.length
    choose(n)
    btns[n]?.focus()
  }

  const split = t ? ratio(t.before) / (ratio(t.before) + ratio(t.after)) : 0.5
  const lightboxPhotos = t
    ? [
        { ...t.before, id: `${t.id}-before`, caption: text.beforeLabel, group: t.title },
        { ...t.after, id: `${t.id}-after`, caption: text.afterLabel, group: t.title },
      ]
    : []
  const closeLightbox = () => {
    refocus.current = opener.current
    setOpenAt(null)
  }
  // Return focus once the viewer has fully closed and the page is interactive again.
  useEffect(() => {
    if (openAt !== null || !refocus.current) return
    document.querySelector(`[data-photo-id="${refocus.current}"]`)?.focus()
    refocus.current = null
  }, [openAt])

  if (!t) return null
  return (
    <div className="exhibit">
      {/* Project cards */}
      <div role="group" aria-label="Choose a project" className="picker" onKeyDown={onPickerKey}>
        {transformations.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="pick"
            aria-pressed={i === sel}
            aria-controls="exhibit-stage"
            onClick={() => choose(i)}
            onPointerEnter={() => prepare(p)}
            onFocus={() => prepare(p)}
          >
            <span className="pick-thumb" aria-hidden="true">
              <img src={asset(p.before.thumb)} alt="" width="320" height="240" loading="lazy" decoding="async" />
              <img src={asset(p.after.thumb)} alt="" width="320" height="240" loading="lazy" decoding="async" className="pick-after" />
            </span>
            <span className="pick-text">
              <span className="pick-title">{p.title}</span>
              <span className="pick-change">{p.change}</span>
              <span className={`pick-stroke paint-mask ${i === sel ? 'is-shown' : ''}`} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>

      {/* The photographs */}
      <div id="exhibit-stage" className="exhibit-stage" data-project={t.id} data-view={view}>
        {view === 'slider' ? (
          <div key={t.id} className={`compare-wrap paint-in ${shown ? 'is-in' : ''}`}>
            <CompareSlider
              before={t.before}
              after={t.after}
              label={t.title}
              beforeLabel={text.beforeLabel}
              afterLabel={text.afterLabel}
              demo={active && shown && !demoDone}
              onDemoEnd={() => setDemoDone(true)}
              className="compare-wide"
            />
          </div>
        ) : (
          <div
            key={t.id}
            className="diptych"
            style={{ '--ab': ratio(t.before), '--aa': ratio(t.after), '--split': split, gridTemplateColumns: `${ratio(t.before)}fr ${ratio(t.after)}fr` }}
          >
            {[
              [text.beforeLabel, t.before, '-2.5deg', 'before'],
              [text.afterLabel, t.after, '2deg', 'after'],
            ].map(([label, p, rot, side], i) => (
              <figure key={side} className="dip" data-side={side}>
                <button
                  type="button"
                  className={`dip-frame paint-in ${shown ? 'is-in' : ''}`}
                  style={{ '--d': `${i * 260}ms`, background: p.tone, aspectRatio: `${p.w} / ${p.h}` }}
                  data-photo-id={lightboxPhotos[i].id}
                  aria-label={`Enlarge the ${side} photo`}
                  onClick={() => {
                    opener.current = lightboxPhotos[i].id
                    setOpenAt(i)
                  }}
                >
                  <img
                    src={asset(p.small)}
                    srcSet={srcSet(p)}
                    sizes={`(min-width: 1024px) ${Math.round(ratio(p) * 30)}rem, ${Math.round(split * 92)}vw`}
                    alt={p.alt}
                    width={p.w}
                    height={p.h}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption className="tape top-3 left-3" style={{ '--tape-rot': rot }}>
                  {label}
                </figcaption>
              </figure>
            ))}
            <svg className={`dip-seam ${shown ? 'is-in' : ''}`} viewBox="0 0 120 64" aria-hidden="true">
              <path
                className="dip-seam-paint"
                d="M9 36c3-10 15-17 34-19 22-2 43-1 61 3 8 2 12 7 10 13-2 6-10 9-22 10-23 2-47 4-68 1-10-1-17-3-15-8Z"
              />
              <g className="dip-seam-paint" opacity=".7">
                <rect x="2" y="27" width="22" height="2.2" rx="1.1" />
                <rect x="0" y="34" width="16" height="1.6" rx=".8" />
                <rect x="4" y="41" width="20" height="2" rx="1" />
                <rect x="104" y="44" width="14" height="1.6" rx=".8" />
              </g>
              <path d="M44 32h30m-9-9 10 9-10 9" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Project label */}
      <div className="exhibit-label">
        <p className="sr-only" aria-live="polite">
          Showing {t.title}
        </p>
        <h3 key={t.id} className="exhibit-title font-display">
          {t.title}
        </h3>
        {t.summary && <p className="mt-3 text-white/85">{t.summary}</p>}
        {(t.service || t.location) && (
          <p className="exhibit-meta mt-3 text-[0.92rem] text-white/70">
            {t.service && <span>{t.service}</span>}
            {t.location && <span>{t.location}</span>}
          </p>
        )}
        <div role="group" aria-label="Comparison view" className="view-switch mt-6">
          <button type="button" aria-pressed={view === 'slider'} onClick={() => changeView('slider')}>
            Slider
          </button>
          <button type="button" aria-pressed={view === 'pair'} onClick={() => changeView('pair')}>
            Side by side
          </button>
        </div>
        {text.angleNote && <p className="mt-5 text-[0.92rem] leading-relaxed text-white/70">{text.angleNote}</p>}
      </div>

      {openAt !== null && (
        <Lightbox photos={lightboxPhotos} index={openAt} onIndex={setOpenAt} onClose={closeLightbox} />
      )}
    </div>
  )
}
