import { Component, memo, useCallback, useEffect, useState } from 'react'
import Intro, { resetIntro, shouldPlayIntro } from './components/Intro.jsx'
import { useReducedMotion } from './hooks/useReducedMotion.js'
import { lockScroll } from './lib/scrollLock.js'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import ServicesWhy from './components/ServicesWhy.jsx'
import RealWork from './components/RealWork.jsx'
import Possibilities from './components/Possibilities.jsx'
import Faq from './components/Faq.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import MobileCallBar from './components/MobileCallBar.jsx'
import { settleMotionTier } from './lib/motion.js'

// Sections that take no props are memoised, so the intro's reveal (which
// re-renders App mid-sweep) only touches the header and hero.
const Services = memo(ServicesWhy)
const Work = memo(RealWork)
const Ideas = memo(Possibilities)
const FaqSection = memo(Faq)
const ContactSection = memo(Contact)

// If the intro ever throws, drop it and show the site.
class IntroBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail?.()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function App() {
  const [playIntro] = useState(() => shouldPlayIntro())
  const [introOn, setIntroOn] = useState(playIntro)
  const [runId, setRunId] = useState(0) // bumps on replay so the intro and hero start fresh
  const [revealed, setRevealed] = useState(false)
  const reduced = useReducedMotion()

  // Brushed reveals switch their mask off once finished (see .paint-done in CSS):
  // the look is identical, and later repaints inside no longer pay for masking.
  useEffect(() => {
    const onEnd = (e) => {
      const t = e.target
      if (!/mask/.test(e.propertyName) || !t.classList) return
      if (t.classList.contains('is-in') || t.classList.contains('is-shown')) t.classList.add('paint-done')
    }
    document.addEventListener('transitionend', onEnd)
    return () => document.removeEventListener('transitionend', onEnd)
  }, [])

  // Without the intro, settle the motion tier after first paint (the intro does it itself).
  useEffect(() => {
    if (playIntro) return
    const id = (window.requestIdleCallback || setTimeout)(() => settleMotionTier(450), { timeout: 1200 })
    return () => (window.cancelIdleCallback || clearTimeout)(id)
  }, [playIntro])

  // Without the intro, still give the hero its entrance.
  useEffect(() => {
    if (playIntro) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)))
    return () => cancelAnimationFrame(id)
  }, [playIntro])

  // Lock scroll while the intro plays, and never let it hold the page hostage.
  useEffect(() => {
    if (!introOn) return
    const unlock = lockScroll()
    const failsafe = setTimeout(() => {
      setRevealed(true)
      setIntroOn(false)
    }, 6000)
    return () => {
      clearTimeout(failsafe)
      unlock()
      // Hand keyboard focus to the page, not the void the intro leaves behind.
      const a = document.activeElement
      if (!a || a === document.body || !document.contains(a) || a.closest?.('.intro')) {
        document.getElementById('hero-title')?.focus({ preventScroll: true })
      }
    }
  }, [introOn, runId])

  const onReveal = useCallback(() => setRevealed(true), [])
  const onDone = useCallback(() => setIntroOn(false), [])

  const replay = useCallback(() => {
    resetIntro()
    window.scrollTo({ top: 0, behavior: 'instant' })
    setRevealed(false)
    setRunId((n) => n + 1)
    setIntroOn(true)
  }, [])

  return (
    <>
      {introOn && (
        <IntroBoundary key={runId} onFail={() => (setRevealed(true), setIntroOn(false))}>
          <Intro onReveal={onReveal} onDone={onDone} />
        </IntroBoundary>
      )}
      <Header revealed={revealed} inert={introOn} />
      <main id="main" inert={introOn}>
        <Hero key={runId} revealed={revealed} />
        <Services />
        <Work />
        <Ideas />
        <FaqSection />
        <ContactSection />
      </main>
      <Footer onReplayIntro={reduced ? undefined : replay} inert={introOn} />
      <MobileCallBar inert={introOn} />
    </>
  )
}
