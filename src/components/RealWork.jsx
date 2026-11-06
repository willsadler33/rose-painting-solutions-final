import { useState } from 'react'
import { portfolio } from '../data/portfolio.js'
import { transformations } from '../data/projects.js'
import { text } from '../data/text.js'
import { asset } from '../lib/asset.js'
import { useInView } from '../hooks/useInView.js'
import ProjectShowcase from './ProjectShowcase.jsx'
import Lightbox from './Lightbox.jsx'
import RevealHeading from './RevealHeading.jsx'

/**
 * Real work only: the four confirmed before & after projects, then the five
 * finished-room photos as a filmstrip. Nothing AI-generated appears here.
 */
export default function RealWork() {
  const [openId, setOpenId] = useState(null)
  const [stageRef, inView] = useInView({ threshold: 0.2 })
  const [stripRef, stripIn] = useInView({ threshold: 0.2 })

  const close = () => {
    const id = openId
    setOpenId(null)
    requestAnimationFrame(() => document.querySelector(`[data-photo-id="${id}"]`)?.focus())
  }

  return (
    <section id="work" aria-labelledby="work-title" className="relative overflow-hidden bg-midnight py-20 text-white md:py-24">
      <div aria-hidden="true" className="work-glow pointer-events-none absolute -top-[32rem] right-[calc(-12%-20rem)] h-[80rem] w-[80rem]" />

      <div className="shell relative">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <RevealHeading id="work-title" className="t-h2 max-w-[12ch]">
            {text.workTitle}
          </RevealHeading>
          <p className="max-w-sm text-white/80 md:text-right">
            {text.workIntro}
          </p>
        </div>

        {/* Before & after: four confirmed projects */}
        <div id="before-after" ref={stageRef} className="mt-12">
          {transformations.length > 0 && <ProjectShowcase active={inView} />}
        </div>

        {/* Finished rooms */}
        {portfolio.length > 0 && (
        <>
        <div className="mt-16 flex items-end justify-between gap-4 border-t border-white/12 pt-8">
          <h3 className="font-display text-[1.7rem] leading-none">{text.finishedTitle}</h3>
          <p className="text-[0.92rem] text-white/70">Select a photo to view it full screen</p>
        </div>
        <ul ref={stripRef} className="filmstrip mt-6" aria-label={text.finishedTitle}>
          {portfolio.map((p, i) => (
            <li key={p.id} style={{ '--ar': p.w / p.h, '--d': `${i * 90}ms` }}>
              <button
                type="button"
                data-photo-id={p.id}
                onClick={() => setOpenId(p.id)}
                className="group relative block size-full overflow-hidden rounded-[14px]"
                aria-label={`Open photo: ${p.caption}`}
              >
                <span className={`paint-in block size-full ${stripIn ? 'is-in' : ''}`} style={{ background: p.tone }}>
                  <img
                    src={asset(p.small)}
                    srcSet={`${asset(p.small)} ${p.smallW || 800}w, ${asset(p.src)} ${p.w}w`}
                    sizes="(min-width: 1024px) 20vw, 60vw"
                    alt={p.alt}
                    width={p.w}
                    height={p.h}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                  />
                </span>
                <span className="work-caption" aria-hidden="true">
                  <span className="text-[1rem] font-semibold leading-tight">{p.caption}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </div>

      {openId !== null && (
        <Lightbox
          photos={portfolio}
          index={portfolio.findIndex((p) => p.id === openId)}
          onIndex={(i) => setOpenId(portfolio[i].id)}
          onClose={close}
        />
      )}
    </section>
  )
}
