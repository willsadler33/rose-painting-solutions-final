import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { asset } from '../lib/asset.js'
import { lockScroll } from '../lib/scrollLock.js'

/**
 * Full-screen photo viewer.
 * Keyboard: ←/→ to move, Esc to close, Tab stays inside.
 * Touch: swipe left/right. The page behind is inert while open.
 */
export default function Lightbox({ photos, index, onIndex, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(null)
  const touch = useRef(null)
  const [dir, setDir] = useState(0)
  const photo = photos[index]

  const go = (d) => {
    setDir(d)
    onIndex((index + d + photos.length) % photos.length)
  }

  useEffect(() => {
    const unlock = lockScroll()
    // Everything behind the viewer is unreachable while it's open.
    // Remember each element's own inert state so React-controlled values survive.
    const behind = [...document.getElementById('root').children].map((el) => [el, el.inert])
    behind.forEach(([el]) => (el.inert = true))
    closeRef.current?.focus()
    return () => {
      unlock()
      behind.forEach(([el, was]) => (el.inert = was))
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return // leave browser shortcuts alone
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Tab') {
        const f = [...ref.current.querySelectorAll('button')]
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Preload neighbours so moving through the set feels instant.
  useEffect(() => {
    ;[1, -1].forEach((d) => {
      const p = photos[(index + d + photos.length) % photos.length]
      const im = new Image()
      im.sizes = '100vw'
      if (p.small) im.srcset = `${asset(p.small)} ${p.smallW || 800}w, ${asset(p.src)} ${p.w}w`
      im.src = asset(p.small || p.src)
      im.decode?.().catch(() => {})
    })
  }, [index, photos])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}: ${photo.caption}`}
      className="lightbox"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      <p className="sr-only" aria-live="polite">
        Photo {index + 1} of {photos.length}: {photo.caption}
      </p>
      <div className="lightbox-top">
        <p className="tabular-nums text-white/80" aria-hidden="true">
          {index + 1} / {photos.length}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className="lightbox-btn" aria-label="Close photo viewer">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <figure className="lightbox-figure" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img
          key={photo.id}
          src={asset(photo.small || photo.src)}
          srcSet={photo.small ? `${asset(photo.small)} ${photo.smallW || 800}w, ${asset(photo.src)} ${photo.w}w` : undefined}
          sizes="(min-width: 1152px) 72rem, 100vw"
          decoding="async"
          alt={photo.alt}
          width={photo.w}
          height={photo.h}
          className="lightbox-img"
          style={{ '--from': `${dir * 40}px`, background: photo.tone }}
        />
        <figcaption className="mt-4 text-center">
          <span className="font-display text-[1.4rem] text-white">{photo.caption}</span>
          <span className="ml-3 text-white/70">{photo.group}</span>
          {photo.description && <span className="mx-auto mt-2 block max-w-xl text-[0.95rem] text-white/75">{photo.description}</span>}
        </figcaption>
      </figure>

      <button type="button" onClick={() => go(-1)} className="lightbox-btn lightbox-prev" aria-label="Previous photo">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" onClick={() => go(1)} className="lightbox-btn lightbox-next" aria-label="Next photo">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>,
    document.body,
  )
}
