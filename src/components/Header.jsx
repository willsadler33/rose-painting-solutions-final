import { useEffect, useRef, useState } from 'react'
import Logo from './Logo.jsx'
import { business, nav } from '../data/site.js'
import { CloseIcon, MenuIcon, PhoneIcon } from './Icons.jsx'
import { lockScroll } from '../lib/scrollLock.js'

export default function Header({ revealed = true, inert = false }) {
  const [solid, setSolid] = useState(false)
  const barRef = useRef(null)
  const [open, setOpen] = useState(false)

  // Once per frame at most; the page height is measured on resize, not on every scroll event.
  useEffect(() => {
    let raf = 0
    let max = 1
    let wasSolid = null
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight
    }
    const apply = () => {
      raf = 0
      const y = window.scrollY
      const s = y > 40
      if (s !== wasSolid) {
        wasSolid = s
        setSolid(s)
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    measure()
    apply()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (measure(), onScroll())) : null
    ro?.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    const unlock = lockScroll()
    // Only the menu is reachable while it's open
    const behind = ['main', 'site-footer'].map((id) => document.getElementById(id)).filter(Boolean)
    behind.forEach((el) => (el.inert = true))
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
      behind.forEach((el) => (el.inert = false))
    }
  }, [open])

  const light = !solid && !open

  return (
    <>
    <header
      inert={inert}
      className={`hdr fixed inset-x-0 top-0 z-50 ${revealed ? 'is-in' : ''} ${light ? 'on-dark' : ''} transition-[background,box-shadow,backdrop-filter] duration-500 ${
        light ? 'bg-transparent' : 'hdr-solid shadow-[0_1px_0_rgb(0_0_0/0.08),0_10px_30px_-20px_rgb(0_0_0/0.35)]'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <div className="shell flex h-[4.75rem] items-center justify-between gap-6">
        <a href="#top" aria-label={`${business.name} — back to top`} className="hdr-item rounded-lg" style={{ '--i': 0 }}>
          <Logo tone={light ? 'dark' : 'light'} />
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item, i) => (
              <li key={item.href} className="hdr-item" style={{ '--i': i + 1 }}>
                <a
                  href={item.href}
                  className={`group relative rounded-full px-4 py-2 text-[0.97rem] font-medium transition-colors ${
                    light ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-4 bottom-1 h-[2px] origin-left scale-x-0 rounded-full transition-transform duration-500 ease-[var(--ease-brush)] group-hover:scale-x-100 ${
                      light ? 'bg-white' : 'bg-cobalt'
                    }`}
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hdr-item flex items-center gap-2" style={{ '--i': nav.length + 1 }}>
          <a
            href={business.phoneHref}
            className={`btn hidden min-h-11 py-2 text-[0.95rem] sm:inline-flex ${light ? 'btn-light' : 'btn-primary'}`}
          >
            <PhoneIcon />
            {business.phoneDisplay}
          </a>
          <a
            href={business.phoneHref}
            aria-label={`Call ${business.phoneDisplay}`}
            className={`grid size-11 place-items-center rounded-full sm:hidden ${light ? 'bg-white text-ink' : 'bg-cobalt text-white'}`}
          >
            <PhoneIcon />
          </a>
          <button
            type="button"
            className={`grid size-11 place-items-center rounded-full lg:hidden ${light ? 'text-white ring-1 ring-white/45' : 'text-ink ring-1 ring-ink/20'}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <span
        ref={barRef}
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-[3px] origin-left rounded-r-full bg-cobalt transition-opacity duration-500 ${light ? 'opacity-0' : 'opacity-100'}`}
        style={{ transform: 'scaleX(0)' }}
      />
    </header>
    {/* Lives outside <header>: its backdrop-filter would trap a fixed panel */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 top-[4.75rem] bottom-0 z-[49] overflow-y-auto bg-white lg:hidden"
      >
        <nav aria-label="Mobile" className="shell pt-6 pb-10">
          <ul className="divide-y divide-ink/10">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={() => setOpen(false)} className="block py-4 font-display text-3xl text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3">
            <a href={business.phoneHref} className="btn btn-primary w-full">
              <PhoneIcon /> Call {business.phoneDisplay}
            </a>
            <a href="#contact" onClick={() => setOpen(false)} className="btn btn-ink-ghost w-full">
              Get a free quote
            </a>
            <p className="mt-2 text-center text-ink-soft t-small">
              {business.hours.days}, {business.hours.time}
            </p>
          </div>
        </nav>
      </div>
    </>
  )
}
