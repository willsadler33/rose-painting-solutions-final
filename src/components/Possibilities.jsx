import { concepts } from '../data/generated.js'
import { asset } from '../lib/asset.js'
import { useInView } from '../hooks/useInView.js'
import RevealHeading from './RevealHeading.jsx'

/**
 * Imagine the possibilities — a short editorial of AI-generated concept
 * interiors. Clearly labelled: these are inspiration, not our projects.
 */
function Concept({ c, className = '', sizes, index }) {
  const [ref, inView] = useInView({ threshold: 0.2 })
  return (
    <figure ref={ref} className={`concept ${className}`} style={{ '--d': `${index * 110}ms` }}>
      <div className={`paint-in relative overflow-hidden rounded-[18px] ${inView ? 'is-in' : ''}`}>
        <img
          src={asset(c.small)}
          srcSet={`${asset(c.small)} 900w, ${asset(c.src)} ${c.w}w`}
          sizes={sizes}
          alt={c.alt}
          width={c.w}
          height={c.h}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
        <span className="concept-tag">AI concept</span>
      </div>
      <figcaption className="mt-3 text-[0.95rem] text-ink-soft">{c.title}</figcaption>
    </figure>
  )
}

export default function Possibilities() {
  const [a, b, c, d] = concepts
  return (
    <section id="ideas" aria-labelledby="ideas-title" className="relative bg-ice py-20 md:py-24">
      <div className="shell">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <RevealHeading id="ideas-title" className="t-h2 max-w-[12ch] text-ink">
            Imagine the possibilities.
          </RevealHeading>
          <p className="concept-note max-w-sm md:text-right">
            Design inspiration created with AI. These are concept images, not Rose Painting Solutions projects.
          </p>
        </div>

        <div className="concepts mt-12">
          {a && <Concept c={a} index={0} className="concepts-a" sizes="(min-width: 1024px) 56vw, 92vw" />}
          {b && <Concept c={b} index={1} className="concepts-b" sizes="(min-width: 1024px) 36vw, 92vw" />}
          {c && <Concept c={c} index={2} className="concepts-c" sizes="(min-width: 1024px) 18vw, 46vw" />}
          {d && <Concept c={d} index={3} className="concepts-d" sizes="(min-width: 1024px) 18vw, 46vw" />}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-[1.7rem] leading-tight text-ink">Picture your room like this?</p>
          <a href="#contact" className="btn btn-primary">
            Get a quote
          </a>
        </div>
      </div>
    </section>
  )
}
