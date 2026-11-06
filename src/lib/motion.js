// ─────────────────────────────────────────────────────────────
// Motion quality — picks how much rendering work the animations do.
//
//   high      full cinematic detail
//   balanced  same choreography, fewer bristles, lighter canvas resolution
//   lite      same story with minimal per-frame work (CSS-composited reveals)
//
// Decided ONCE, before anything animates, and never changed mid-animation.
// Signals (all optional, all local — nothing is stored beyond this tab or sent anywhere):
//   • navigator.deviceMemory (Chromium only; absent on iPhone/Safari → no penalty)
//   • Data Saver
//   • a short frame-timing probe (measured, so a fast phone stays on high)
// Override for testing: ?motion=high|balanced|lite
// Reduced motion is handled separately (prefers-reduced-motion).
// ─────────────────────────────────────────────────────────────
const LEVELS = ['lite', 'balanced', 'high']
const KEY = 'rps-motion'

let tier = null

function staticTier() {
  try {
    const q = new URLSearchParams(location.search).get('motion')
    if (LEVELS.includes(q)) return { tier: q, forced: true }
  } catch {
    /* ignore */
  }
  try {
    const saved = sessionStorage.getItem(KEY)
    if (LEVELS.includes(saved)) return { tier: saved, forced: true }
  } catch {
    /* storage blocked */
  }
  let level = 2
  const mem = navigator.deviceMemory // undefined on Safari/Firefox — treated as capable
  if (typeof mem === 'number') {
    if (mem <= 2) level = 0
    else if (mem <= 4) level = 1
  }
  if (navigator.connection?.saveData) level = Math.min(level, 1)
  return { tier: LEVELS[level], forced: false }
}

function apply(t, persist) {
  tier = t
  document.documentElement.dataset.motion = t
  if (!persist) return
  try {
    sessionStorage.setItem(KEY, t) // keeps the measured tier stable for the rest of the visit
  } catch {
    /* ignore */
  }
}

/** Current tier (synchronous). Falls back to static signals if the probe hasn't run. */
export function motionTier() {
  if (tier) return tier
  if (typeof window === 'undefined') return 'high'
  apply(staticTier().tier)
  return tier
}

/**
 * Measure ~14 animation frames and settle the tier. Never raises it above the
 * static signals, only lowers it when frames are genuinely slow. Resolves
 * within `budget` ms so it never delays anything.
 */
export function settleMotionTier(budget = 450) {
  if (typeof window === 'undefined') return Promise.resolve('high')
  const s = staticTier()
  if (s.forced) {
    apply(s.tier)
    return Promise.resolve(tier)
  }
  return new Promise((resolve) => {
    const gaps = []
    let last = 0
    let raf = 0
    const finish = () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      let level = LEVELS.indexOf(s.tier)
      if (gaps.length >= 6) {
        const sorted = gaps.sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        if (median > 45) level = Math.min(level, 0)
        else if (median > 26) level = Math.min(level, 1)
      }
      apply(LEVELS[level], true)
      resolve(tier)
    }
    const step = (now) => {
      if (last) gaps.push(now - last)
      last = now
      if (gaps.length >= 14) return finish()
      raf = requestAnimationFrame(step)
    }
    const timer = setTimeout(finish, budget)
    raf = requestAnimationFrame(step)
  })
}

/** Per-tier settings for the paint engine and canvas. */
export function intro(t = motionTier()) {
  return {
    high: { bristles: 110, dprCap: 2, pixelBudget: 4.6e6, drops: 1 },
    balanced: { bristles: 64, dprCap: 1.5, pixelBudget: 2.6e6, drops: 0.7 },
    lite: { bristles: 36, dprCap: 1, pixelBudget: 1.4e6, drops: 0.45 },
  }[t]
}
