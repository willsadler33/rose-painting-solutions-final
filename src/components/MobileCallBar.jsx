import { useEffect, useState } from 'react'
import { business } from '../data/site.js'
import { PhoneIcon } from './Icons.jsx'

/** Thumb-reach call bar on phones, shown once the hero has scrolled away. */
export default function MobileCallBar({ inert = false }) {
  const [show, setShow] = useState(false)
  // Two IntersectionObservers instead of a scroll listener: no work while scrolling.
  //  • shown once the top 70% of the first screen has scrolled away
  //  • hidden again when the contact section reaches the lower 40% of the screen
  useEffect(() => {
    const hero = document.getElementById('top')
    const contact = document.getElementById('contact')
    if (!hero || !contact || typeof IntersectionObserver === 'undefined') return
    let pastHero = false
    let nearContact = false
    const update = () => setShow(pastHero && !nearContact)
    const io1 = new IntersectionObserver(
      ([e]) => {
        pastHero = !e.isIntersecting && e.boundingClientRect.top < 0
        update()
      },
      { rootMargin: '0px 0px -30% 0px' },
    )
    const io2 = new IntersectionObserver(
      ([e]) => {
        nearContact = e.isIntersecting || e.boundingClientRect.top < 0
        update()
      },
      { rootMargin: '0px 0px -40% 0px' },
    )
    // A sentinel 70% of a screen down the page: once it scrolls out of the top, the hero is "past".
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:70svh;pointer-events:none'
    hero.appendChild(sentinel)
    io1.observe(sentinel)
    io2.observe(contact)
    return () => {
      io1.disconnect()
      io2.disconnect()
      sentinel.remove()
    }
  }, [])

  return (
    <div
      className={`fixed inset-x-3 bottom-3 z-40 grid grid-cols-[1.25fr_1fr] gap-2 rounded-full bg-white/[0.97] p-1.5 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)] ring-1 ring-ink/10 transition duration-500 md:hidden ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[130%] opacity-0'
      }`}
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-hidden={!show}
      inert={inert || !show}
    >
      <a href={business.phoneHref} className="btn btn-primary min-h-12 py-2" tabIndex={show ? 0 : -1}>
        <PhoneIcon /> Call now
      </a>
      <a href="#contact" className="btn btn-ink-ghost min-h-12 py-2" tabIndex={show ? 0 : -1}>
        Free quote
      </a>
    </div>
  )
}
