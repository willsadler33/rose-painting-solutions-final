import { useState } from 'react'
import { services } from '../data/services.js'
import { reasons } from '../data/content.js'
import { text } from '../data/text.js'
import { BrushTick } from './Icons.jsx'
import RevealHeading from './RevealHeading.jsx'

/**
 * Services + why choose us, in one compact section.
 * The services are a fan of paint swatches: one is open at a time, and
 * hovering, focusing or tapping a swatch opens it.
 */
export default function ServicesWhy() {
  const [open, setOpen] = useState(0)

  return (
    <section id="services" aria-labelledby="services-title" className="relative bg-primer py-20 md:py-24">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <RevealHeading id="services-title" className="t-h2 max-w-[13ch] text-ink">
            {text.servicesTitle}
          </RevealHeading>
          <p className="mt-5 measure text-ink-soft">{text.servicesIntro}</p>

          <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2" aria-label="Why choose us">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-3">
                <BrushTick className="mt-0.5 shrink-0 text-cobalt" />
                <div>
                  <h3 className="font-display text-[1.3rem] leading-tight text-ink">{r.title}</h3>
                  <p className="mt-1 text-[0.95rem] text-ink-soft">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {services.length > 0 && (
        <ul className="swatch-fan" aria-label="Our services">
          {services.map((s, i) => {
            const isOpen = open === i
            return (
              <li
                key={s.title}
                className={`swatch ${isOpen ? 'is-open' : ''}`}
                style={{ '--tone': s.tone, '--ink': s.ink }}
                onMouseEnter={() => setOpen(i)}
              >
                <button
                  type="button"
                  className="swatch-btn"
                  aria-expanded={isOpen}
                  aria-controls={`swatch-${i}`}
                  onClick={() => setOpen(i)}
                  onFocus={() => setOpen(i)}
                >
                  <span className="swatch-name">{s.title}</span>
                </button>
                <div id={`swatch-${i}`} className="swatch-body" inert={!isOpen}>
                  <h3 className="font-display text-[1.6rem] leading-tight">{s.title}</h3>
                  <p className="mt-3 leading-relaxed opacity-90">{s.summary}</p>
                  <ul className="mt-4 grid gap-1 text-[0.92rem] font-medium">
                    {s.includes.map((x) => (
                      <li key={x} className="swatch-item">
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )
          })}
        </ul>
        )}
      </div>
    </section>
  )
}
