// ─────────────────────────────────────────────────────────────
// Loads the owner's published content before the site first renders,
// and fills the site's data modules with it. Components keep reading
// business / text / services / portfolio / transformations as before.
//
// • /api/content is preloaded from index.html, so it downloads in
//   parallel with the JavaScript and usually costs no extra time.
// • If it is slow (>2.5 s) or unavailable, the built-in content is used,
//   so the site always renders.
// • ?preview shows unpublished changes — only to a signed-in owner
//   (the server checks the session cookie).
// ─────────────────────────────────────────────────────────────
import { business } from '../data/site.js'
import { text } from '../data/text.js'
import { services } from '../data/services.js'
import { reasons } from '../data/content.js'
import { portfolio } from '../data/portfolio.js'
import { transformations } from '../data/projects.js'
import { buildSeed } from './seed.js'
import { sanitizeDoc } from './schema.js'
import { toPublic } from './public.js'

const replaceArray = (arr, next) => arr.splice(0, arr.length, ...next)

export function applyContent(pub) {
  if (!pub || typeof pub !== 'object') return
  if (pub.business) {
    const { hours, ...rest } = pub.business
    Object.assign(business, rest)
    if (hours) business.hours = { ...business.hours, ...hours }
  }
  if (pub.text) Object.assign(text, pub.text)
  if (Array.isArray(pub.services)) replaceArray(services, pub.services)
  if (Array.isArray(pub.reasons)) replaceArray(reasons, pub.reasons)
  if (Array.isArray(pub.gallery)) replaceArray(portfolio, pub.gallery)
  if (Array.isArray(pub.projects)) replaceArray(transformations, pub.projects)
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

export async function loadContent() {
  let preview = false
  try {
    preview = new URLSearchParams(location.search).has('preview')
  } catch {
    /* ignore */
  }
  const base = import.meta.env.BASE_URL || './'
  const url = `${base}api/${preview ? 'admin/preview' : 'content'}`
  try {
    const res = await withTimeout(fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }), 2500)
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.includes('application/json')) throw new Error(`content ${res.status}`)
    applyContent(await res.json())
    return { preview, source: 'live' }
  } catch {
    // Built-in content, shaped exactly like the server's (only needed when the fetch fails).
    const seed = buildSeed()
    applyContent(toPublic(sanitizeDoc(seed, seed)))
    return { preview: false, source: 'built-in', previewFailed: preview }
  }
}
