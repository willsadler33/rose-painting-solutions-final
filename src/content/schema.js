// ─────────────────────────────────────────────────────────────
// The content document: everything the owner can edit.
// Shared by the public site, the dashboard and the server.
//
// The server runs sanitizeDoc() on every save, so nothing that reaches
// storage can carry markup, scripts, unexpected URLs or oversized text.
// React escapes all text when rendering; links are https-only; image
// addresses are never free text (uploads are referenced by id).
// ─────────────────────────────────────────────────────────────
import { TEXT_LIMITS } from '../data/text.js'

export const DOC_VERSION = 1
export const STATUSES = ['live', 'draft', 'hidden']
export const MAX = {
  media: 600,
  projects: 120,
  gallery: 200,
  services: 16,
  reasons: 6,
  categories: 24,
  includes: 6,
  activity: 60,
  docBytes: 900_000,
}

export const DEFAULT_CATEGORIES = [
  { id: 'interior', name: 'Interior painting' },
  { id: 'walls-ceilings', name: 'Walls & ceilings' },
  { id: 'bathrooms', name: 'Bathrooms' },
  { id: 'trim-doors', name: 'Trim & doors' },
  { id: 'repairs', name: 'Repairs & restoration' },
  { id: 'finished', name: 'Completed projects' },
  { id: 'before-after', name: 'Before & after' },
]

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── small, strict cleaners ───────────────────────────────────
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g
// Chip colours from the old blue palette, mapped to the black-and-gold brand so
// services saved before the rebrand still match the new look.
const LEGACY_TONES = {
  '#e6eefc': ['#151310', '#ffffff'],
  '#bfd3f7': ['#ecdcb2', '#151310'],
  '#86a8f0': ['#d9b866', '#151310'],
  '#3b62d9': ['#3a342b', '#ffffff'],
  '#2348d6': ['#b08a36', '#151310'],
  '#0d1f4d': ['#f5efe2', '#151310'],
}
// Any other blue chip colour is swapped for the brand colour of similar lightness.
const BRAND_BY_LIGHTNESS = [
  [0.25, ['#151310', '#ffffff']],
  [0.45, ['#3a342b', '#ffffff']],
  [0.62, ['#b08a36', '#151310']],
  [0.78, ['#d9b866', '#151310']],
  [0.9, ['#ecdcb2', '#151310']],
  [2, ['#f5efe2', '#151310']],
]
function isBlue(c) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max - min > 0.06 && b === max && b > r + 0.04
}
function lightness(c) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function brandChip(tone, ink) {
  if (LEGACY_TONES[tone]) return LEGACY_TONES[tone]
  if (isBlue(tone)) return BRAND_BY_LIGHTNESS.find(([max]) => lightness(tone) <= max)[1]
  return [tone, isBlue(ink) ? '#151310' : ink]
}


export function cleanText(v, max, { multiline = false } = {}) {
  if (typeof v !== 'string') return ''
  let s = v.replace(CTRL, '').replace(/\r\n?/g, '\n')
  if (!multiline) s = s.replace(/\s*\n\s*/g, ' ')
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return s.length > max ? s.slice(0, max).trim() : s
}
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
export const isId = (v) => typeof v === 'string' && ID_RE.test(v)
export function slug(s, fallback = 'item') {
  const v = String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return v || fallback
}
const pct = (v, d = 50) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d
}
/** "50% 30%" → normalised focus string */
export function cleanFocus(v, d = '50% 50%') {
  const m = typeof v === 'string' && v.match(/^\s*(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%\s*$/)
  return m ? `${pct(m[1])}% ${pct(m[2])}%` : d
}
const num = (v, min, max, d) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d)
const bool = (v, d = false) => (typeof v === 'boolean' ? v : d)
const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)
export function cleanUrl(v) {
  if (typeof v !== 'string' || !v.trim()) return ''
  try {
    const u = new URL(v.trim())
    if (u.protocol !== 'https:' || u.username || u.password) return ''
    return u.href.slice(0, 300)
  } catch {
    return ''
  }
}
export function cleanEmail(v) {
  const s = cleanText(v, 120)
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(s) ? s : ''
}
/** Display phone → tel: link (US numbers get +1). Returns '' if it isn't a phone number. */
export function telHref(display) {
  const digits = String(display || '').replace(/[^\d+]/g, '')
  const d = digits.replace(/^\+/, '')
  if (d.length < 7 || d.length > 15) return ''
  if (digits.startsWith('+')) return `tel:+${d}`
  if (d.length === 10) return `tel:+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`
  return `tel:${d}`
}

// ── hours ────────────────────────────────────────────────────
function to12(h) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  const ap = hh >= 12 && hh < 24 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return { long: `${h12}:${String(mm).padStart(2, '0')} ${ap}`, short: mm ? `${h12}:${String(mm).padStart(2, '0')} ${ap}` : `${h12} ${ap}` }
}
function dayRanges(days, names) {
  // Weeks run Monday → Sunday, so a closed weekend reads "Saturday–Sunday".
  const pos = (d) => (d + 6) % 7
  const set = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => pos(a) - pos(b))
  const out = []
  for (let i = 0; i < set.length; i++) {
    let j = i
    while (j + 1 < set.length && pos(set[j + 1]) === pos(set[j]) + 1) j++
    out.push(j > i ? `${names[set[i]]}–${names[set[j]]}` : names[set[i]])
    i = j
  }
  return out.join(', ')
}
/** Human strings for opening hours, e.g. { days: 'Monday–Friday', daysShort: 'Mon–Fri', time: '9:00 AM – 5:00 PM', timeShort: '9 AM–5 PM', closed: 'Saturday–Sunday' } */
export function formatHours(h) {
  const open = h.openDays || []
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.includes(d))
  const a = to12(h.openHour)
  const b = to12(h.closeHour)
  return {
    days: open.length === 7 ? 'Every day' : dayRanges(open, DAY_NAMES) || 'By appointment',
    daysShort: open.length === 7 ? 'Every day' : dayRanges(open, DAY_SHORT) || 'By appt.',
    time: `${a.long} – ${b.long}`,
    timeShort: `${a.short}–${b.short}`,
    closed: dayRanges(closedDays, DAY_NAMES),
  }
}

// ── sanitizers per part ──────────────────────────────────────
function cleanBusiness(b = {}, d = {}) {
  const hours = b.hours || {}
  const dh = d.hours || {}
  const openDays = Array.isArray(hours.openDays)
    ? [...new Set(hours.openDays.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))]
    : dh.openDays || [1, 2, 3, 4, 5]
  let openHour = num(hours.openHour, 0, 23.5, dh.openHour ?? 9)
  let closeHour = num(hours.closeHour, 0.5, 24, dh.closeHour ?? 17)
  openHour = Math.round(openHour * 2) / 2
  closeHour = Math.round(closeHour * 2) / 2
  if (closeHour <= openHour) closeHour = Math.min(24, openHour + 1)
  const phoneDisplay = cleanText(b.phoneDisplay, 30) || d.phoneDisplay || ''
  const social = {}
  for (const k of ['facebook', 'instagram', 'google', 'nextdoor', 'yelp', 'website']) social[k] = cleanUrl(b.social?.[k])
  return {
    name: cleanText(b.name, 80) || d.name || 'Rose Painting Solutions',
    shortName: d.shortName || 'Rose', // part of the logo — not editable
    phoneDisplay,
    phoneHref: telHref(phoneDisplay) || d.phoneHref || '',
    email: cleanEmail(b.email),
    serviceArea: cleanText(b.serviceArea, 160),
    description: cleanText(b.description, 400, { multiline: true }),
    instructions: cleanText(b.instructions, 300, { multiline: true }),
    hours: {
      openDays: openDays.sort((x, y) => x - y),
      openHour,
      closeHour,
      timeZone: typeof hours.timeZone === 'string' && /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(hours.timeZone) ? hours.timeZone : dh.timeZone || 'America/New_York',
    },
    social,
  }
}

function cleanMedia(m) {
  if (!m || !isId(m.id)) return null
  const kind = m.kind === 'static' ? 'static' : 'upload'
  const out = {
    id: m.id,
    kind,
    title: cleanText(m.title, 80),
    description: cleanText(m.description, 300, { multiline: true }),
    alt: cleanText(m.alt, 250),
    project: cleanText(m.project, 60),
    category: isId(m.category) ? m.category : '',
    tone: hex(m.tone, '#8a8a80'),
    focus: cleanFocus(m.focus),
    w: Math.round(num(m.w, 1, 8000, 1200)),
    h: Math.round(num(m.h, 1, 8000, 900)),
    createdAt: iso(m.createdAt) || new Date(0).toISOString(),
    updatedAt: iso(m.updatedAt) || new Date(0).toISOString(),
    deletedAt: iso(m.deletedAt),
  }
  if (kind === 'static') {
    // Only the photos that ship with the site, by exact path pattern.
    const ok = (p) => typeof p === 'string' && /^images\/rose-painting\/real-work\/[a-z0-9-]+\.webp$/.test(p)
    if (!ok(m.src)) return null
    out.src = m.src
    out.small = ok(m.small) ? m.small : m.src
    out.thumb = ok(m.thumb) ? m.thumb : out.small
    out.smallW = Math.round(num(m.smallW, 1, 4000, 800))
  } else {
    out.rev = Math.round(num(m.rev, 1, 1e6, 1))
    out.ext = m.ext === 'jpg' ? 'jpg' : 'webp'
    out.sizes = {}
    for (const v of ['lg', 'md', 'thumb']) {
      const s = m.sizes?.[v]
      if (s) out.sizes[v] = { w: Math.round(num(s.w, 1, 8000, 1)), h: Math.round(num(s.h, 1, 8000, 1)) }
    }
    out.hasMaster = bool(m.hasMaster, false)
    const e = m.edits || {}
    const c = e.crop
    out.edits = {
      rotate: [0, 90, 180, 270].includes(e.rotate) ? e.rotate : 0,
      crop:
        c && [c.x, c.y, c.w, c.h].every((n) => Number.isFinite(Number(n)))
          ? { x: num(c.x, 0, 1, 0), y: num(c.y, 0, 1, 0), w: num(c.w, 0.05, 1, 1), h: num(c.h, 0.05, 1, 1) }
          : null,
      brightness: num(e.brightness, -15, 15, 0),
      contrast: num(e.contrast, -15, 15, 0),
    }
  }
  return out
}

const cleanSlot = (s = {}, media) => ({
  media: isId(s.media) && media[s.media] ? s.media : '',
  focus: cleanFocus(s.focus),
  focusM: cleanFocus(s.focusM, cleanFocus(s.focus)),
  zoom: Math.round(num(s.zoom, 1, 2.5, 1) * 100) / 100,
})

function cleanProject(p, media) {
  if (!p || !isId(p.id)) return null
  return {
    id: p.id,
    title: cleanText(p.title, 60) || 'Untitled project',
    change: cleanText(p.change, 48),
    summary: cleanText(p.summary, 260, { multiline: false }),
    category: isId(p.category) ? p.category : '',
    location: cleanText(p.location, 60),
    service: cleanText(p.service, 60),
    status: STATUSES.includes(p.status) ? p.status : 'draft',
    before: cleanSlot(p.before, media),
    after: cleanSlot(p.after, media),
    updatedAt: iso(p.updatedAt) || new Date(0).toISOString(),
    deletedAt: iso(p.deletedAt),
  }
}

function cleanService(s, i) {
  if (!s) return null
  return {
    id: isId(s.id) ? s.id : `service-${i + 1}`,
    title: cleanText(s.title, 48) || 'Service',
    summary: cleanText(s.summary, 160),
    includes: (Array.isArray(s.includes) ? s.includes : []).map((x) => cleanText(x, 40)).filter(Boolean).slice(0, MAX.includes),
    ...(([tone, ink]) => ({ tone, ink }))(brandChip(hex(s.tone, '#151310'), hex(s.ink, '#ffffff'))),
    enabled: bool(s.enabled, true),
  }
}

/**
 * Validate and clean a whole content document. Unknown fields are dropped.
 * `defaults` (the seed) fills anything missing so the site always renders.
 */
export function sanitizeDoc(input, defaults) {
  const d = defaults || {}
  const src = input && typeof input === 'object' ? input : {}
  const text = {}
  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    const v = cleanText(src.text?.[k], max, { multiline: false })
    text[k] = v || d.text?.[k] || ''
  }
  const categories = (Array.isArray(src.categories) ? src.categories : d.categories || DEFAULT_CATEGORIES)
    .map((c) => (c && isId(c.id) ? { id: c.id, name: cleanText(c.name, 40) || c.id } : null))
    .filter(Boolean)
    .filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
    .slice(0, MAX.categories)

  const media = {}
  const srcMedia = src.media && typeof src.media === 'object' ? Object.values(src.media) : []
  for (const m of srcMedia.slice(0, MAX.media)) {
    const c = cleanMedia(m)
    if (c) media[c.id] = c
  }

  const gallery = (Array.isArray(src.gallery) ? src.gallery : [])
    .filter((g) => g && isId(g.media) && media[g.media])
    .map((g) => ({ media: g.media, status: STATUSES.includes(g.status) ? g.status : 'draft' }))
    .filter((g, i, a) => a.findIndex((x) => x.media === g.media) === i)
    .slice(0, MAX.gallery)

  const projects = (Array.isArray(src.projects) ? src.projects : [])
    .map((p) => cleanProject(p, media))
    .filter(Boolean)
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
    .slice(0, MAX.projects)

  const services = (Array.isArray(src.services) ? src.services : d.services || [])
    .map(cleanService)
    .filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
    .slice(0, MAX.services)

  const reasons = (Array.isArray(src.reasons) ? src.reasons : d.reasons || [])
    .map((r) => ({ title: cleanText(r?.title, 40), text: cleanText(r?.text, 120) }))
    .filter((r) => r.title)
    .slice(0, MAX.reasons)

  const activity = (Array.isArray(src.activity) ? src.activity : [])
    .map((a) => ({ at: iso(a?.at) || new Date().toISOString(), what: cleanText(a?.what, 140) }))
    .filter((a) => a.what)
    .slice(0, MAX.activity)

  return {
    version: DOC_VERSION,
    rev: Math.round(num(src.rev, 0, 1e9, 0)),
    business: cleanBusiness(src.business, d.business),
    text,
    services,
    reasons,
    categories,
    media,
    gallery,
    projects,
    activity,
    updatedAt: iso(src.updatedAt) || new Date().toISOString(),
  }
}

/** Every upload (media id + revision) a document points at. */
export function referencedUploads(doc) {
  const out = new Map()
  for (const m of Object.values(doc?.media || {})) if (m.kind === 'upload') out.set(m.id, m.rev)
  return out
}
