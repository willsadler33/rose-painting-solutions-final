import { useId, useState } from 'react'
import { faqs } from '../data/content.js'
import { business } from '../data/site.js'
import RevealHeading from './RevealHeading.jsx'

export default function Faq() {
  const [open, setOpen] = useState(-1)
  const uid = useId()
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-primer py-16 md:py-20">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <RevealHeading id="faq-title" className="t-h2 max-w-[11ch] text-ink">
            Questions, answered.
          </RevealHeading>
          <p className="mt-6 measure text-ink-soft">
            Something we haven’t covered? Call{' '}
            <a href={business.phoneHref} className="font-semibold text-cobalt underline underline-offset-4">
              {business.phoneDisplay}
            </a>{' '}
            and we’ll talk it through.
          </p>
        </div>

        <div className="divide-y divide-ink/12 border-y border-ink/12">
          {faqs.map((f, i) => {
            const isOpen = open === i
            const id = `${uid}-${i}`
            return (
              <div key={f.q}>
                <h3>
                  <button
                    type="button"
                    id={`${id}-btn`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-panel`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left font-sans text-[1.1rem] font-semibold text-ink transition-colors hover:text-cobalt md:text-[1.25rem]"
                  >
                    {f.q}
                    <span
                      className={`faq-icon relative grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                        isOpen ? 'bg-cobalt text-white' : 'bg-wash text-cobalt group-hover:bg-sky'
                      }`}
                      aria-hidden="true"
                    >
                      <span className="absolute h-[2px] w-4 rounded bg-current" />
                      <span className="v absolute h-4 w-[2px] rounded bg-current" />
                    </span>
                  </button>
                </h3>
                <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} className="faq-panel" data-open={isOpen} inert={!isOpen}>
                  <div>
                    <p className="max-w-[60ch] pb-7 text-ink-soft">
                      {f.a
                        .replace('{phone}', business.phoneDisplay)
                        .replace('{days}', business.hours.days)
                        .replace('{time}', business.hours.time)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
