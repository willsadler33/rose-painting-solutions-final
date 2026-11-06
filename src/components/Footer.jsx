import { business, nav } from '../data/site.js'
import Logo from './Logo.jsx'
import { text } from '../data/text.js'

const SOCIAL = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['google', 'Google'],
  ['nextdoor', 'Nextdoor'],
  ['yelp', 'Yelp'],
  ['website', 'Website'],
]

export default function Footer({ onReplayIntro, inert = false }) {
  const year = new Date().getFullYear()
  return (
    <footer id="site-footer" inert={inert} className="bg-midnight pt-12 pb-28 text-white md:pb-10">
      <div className="shell">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Logo tone="dark" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="inline-block py-1.5 text-white/80 transition hover:text-white">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="md:text-right">
            <a href={business.phoneHref} className="block font-display text-[1.7rem] leading-none hover:text-sky">
              {business.phoneDisplay}
            </a>
            <p className="mt-1.5 text-[0.92rem] text-white/70">
              {business.hours.days}, {business.hours.time}
            </p>
            {business.email && (
              <a href={`mailto:${business.email}`} className="mt-1.5 block text-[0.92rem] text-white/80 hover:text-white">
                {business.email}
              </a>
            )}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[0.88rem] text-white/60 sm:flex-row sm:justify-between">
          <p>
            © {year} {business.name}. {text.footerDescription}
          </p>
          {SOCIAL.some(([k]) => business.social?.[k]) && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Social media">
              {SOCIAL.filter(([k]) => business.social?.[k]).map(([k, label]) => (
                <li key={k}>
                  <a href={business.social[k]} target="_blank" rel="noopener noreferrer" className="inline-block py-2 hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-6">
            {onReplayIntro && (
              <button type="button" onClick={onReplayIntro} className="inline-block py-2 hover:text-white">
                Replay intro
              </button>
            )}
            <a href="#top" className="inline-block py-2 hover:text-white">
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
