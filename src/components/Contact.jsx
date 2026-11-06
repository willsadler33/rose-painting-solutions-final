import { useEffect, useState } from 'react'
import { business } from '../data/site.js'
import { text } from '../data/text.js'
import { isOpenNow } from '../lib/hours.js'
import { ClockIcon, PhoneIcon } from './Icons.jsx'
import BrushEdge from './BrushEdge.jsx'
import ContactForm from './ContactForm.jsx'
import RevealHeading from './RevealHeading.jsx'

export default function Contact() {
  const [open, setOpen] = useState(() => isOpenNow())
  useEffect(() => {
    const id = setInterval(() => setOpen(isOpenNow()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <section id="contact" aria-labelledby="contact-title" className="wall relative isolate overflow-hidden text-white">
      <BrushEdge flip className="relative z-10 -mt-px text-primer" />
      <div className="wall-texture" aria-hidden="true" />
      <div className="shell relative z-10 grid gap-12 pt-12 pb-20 md:pb-24 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:pt-16">
        <div>
          <RevealHeading id="contact-title" className="t-h2 max-w-[12ch]">
            {text.contactTitle}
          </RevealHeading>
          <p className="mt-6 measure t-lede text-white/85">
            {text.contactIntro}
          </p>

          <a
            href={business.phoneHref}
            className="group mt-10 inline-flex flex-col rounded-[18px] focus-visible:outline-white"
          >
            <span className="flex items-center gap-2 text-white/90">
              <PhoneIcon /> Call us
            </span>
            <span className="mt-1 font-display text-[clamp(2.4rem,1.6rem+3vw,4rem)] leading-none tracking-[-0.01em]">
              {business.phoneDisplay}
            </span>
            <span
              aria-hidden="true"
              className="mt-3 h-[3px] w-full origin-left scale-x-[0.25] rounded-full bg-white transition-transform duration-700 ease-[var(--ease-brush)] group-hover:scale-x-100"
            />
          </a>

          <div className="mt-10 max-w-md rounded-[18px] bg-white/10 p-6 ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 font-sans font-semibold">
                <ClockIcon /> Opening hours
              </h3>
              {open !== null && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[0.85rem] font-semibold">
                  <span className={`size-2 rounded-full ${open ? 'bg-[#7CF0B0] shadow-[0_0_0_4px_rgb(124_240_176/0.2)]' : 'bg-white/50'}`} aria-hidden="true" />
                  {open ? 'Open now' : 'Closed now'}
                </span>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 whitespace-nowrap text-white/85">
              <dt>{business.hours.days}</dt>
              <dd className="whitespace-nowrap text-right font-semibold text-white">{business.hours.time}</dd>
              {business.hours.closed && (
                <>
                  <dt>{business.hours.closed}</dt>
                  <dd className="text-right">Closed</dd>
                </>
              )}
            </dl>
          </div>

          {(business.email || business.serviceArea || business.instructions) && (
            <div className="mt-6 grid max-w-md gap-4 text-white/85">
              {business.email && (
                <p>
                  <span className="block text-[0.9rem] text-white/70">Email</span>
                  <a href={`mailto:${business.email}`} className="font-semibold text-white underline underline-offset-4">
                    {business.email}
                  </a>
                </p>
              )}
              {business.serviceArea && (
                <p>
                  <span className="block text-[0.9rem] text-white/70">Areas we cover</span>
                  {business.serviceArea}
                </p>
              )}
              {business.instructions && <p className="whitespace-pre-line">{business.instructions}</p>}
            </div>
          )}
        </div>

        <div className="relative rounded-[24px] bg-white p-6 text-ink shadow-[0_50px_100px_-50px_rgb(5_5_4/0.9)] sm:p-9">
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
