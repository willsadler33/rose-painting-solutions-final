// ─────────────────────────────────────────────────────────────
// Rose Painting Solutions — content & photo API.
//
// Public:
//   GET  /api/content                    published content for the website
//   GET  /media/:id/:rev/:size.(webp|jpg) photos (live ones are public & cached;
//                                         anything else needs the owner's session)
// Owner (signed in):
//   POST /api/admin/login | /logout | /password,  GET /api/admin/session
//   GET/PUT /api/admin/draft     working copy (saved as a draft)
//   POST /api/admin/publish      make the draft live (previous version kept)
//   POST /api/admin/discard      throw away unpublished changes
//   GET  /api/admin/history      earlier published versions
//   POST /api/admin/restore      bring an earlier version back as the draft
//   GET  /api/admin/preview      the draft, shaped like /api/content
//   POST /api/admin/media        start an upload (new photo or new revision)
//   PUT  /api/admin/media/:id/:rev/:size   upload one size of a photo
//   POST /api/admin/cleanup      remove photo files nothing refers to any more
// ─────────────────────────────────────────────────────────────
import { createAuth, randomId } from './auth.mjs'
import { checkUpload, VARIANTS } from './images.mjs'
import { sanitizeDoc, MAX, isId } from '../src/content/schema.js'
import { buildSeed } from '../src/content/seed.js'
import { toPublic } from '../src/content/public.js'

const HISTORY_KEEP = 20
const JSON_LIMIT = 1_500_000

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}
function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...baseHeaders, ...extra },
  })
}
const err = (status, message, extra) => json(status, { error: message }, extra)
const CONTENT_KEYS = ['business', 'text', 'services', 'reasons', 'categories', 'media', 'gallery', 'projects']
const contentOf = (doc) => JSON.stringify(CONTENT_KEYS.map((k) => doc?.[k] ?? null))

async function readJson(req) {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > JSON_LIMIT) throw Object.assign(new Error('Too much data in one save.'), { status: 413 })
  const buf = new Uint8Array(await req.arrayBuffer())
  if (buf.length > JSON_LIMIT) throw Object.assign(new Error('Too much data in one save.'), { status: 413 })
  try {
    return JSON.parse(new TextDecoder().decode(buf) || '{}')
  } catch {
    throw Object.assign(new Error('The request couldn’t be read.'), { status: 400 })
  }
}

export function createApp({ stores, env = {}, now = () => Date.now(), purgeContentCache = async () => {}, dataEnv = 'local', contentCacheTag = 'rps-content' }) {
  const auth = createAuth({ store: stores.auth, env, now })
  const seed = buildSeed()
  const SEED = sanitizeDoc(seed, seed)
  const iso = () => new Date(now()).toISOString()

  const loadPublished = async () => (await stores.content.getJSON('published')) || null
  const loadDraft = async () => (await stores.content.getJSON('draft')) || (await loadPublished()) || SEED

  // Which uploaded photos may be served to anyone (live on the published site).
  let publicCache = { at: 0, set: new Set() }
  async function publicUploads() {
    if (now() - publicCache.at < 30_000) return publicCache.set
    const pub = (await loadPublished()) || SEED
    const set = new Set()
    const live = toPublic(pub)
    const urls = JSON.stringify([live.gallery, live.projects])
    for (const m of Object.values(pub.media || {})) {
      if (m.kind === 'upload' && urls.includes(`/media/${m.id}/${m.rev}/`)) set.add(`${m.id}/${m.rev}`)
    }
    publicCache = { at: now(), set }
    return set
  }

  /** Every uploaded photo revision a stored document still points at. */
  async function referencedRevisions() {
    const keep = new Set()
    const add = (doc) => {
      for (const m of Object.values(doc?.media || {})) if (m.kind === 'upload') keep.add(`${m.id}/${m.rev}`)
    }
    add(await stores.content.getJSON('draft'))
    add(await loadPublished())
    for (const k of await stores.content.list('history/')) add((await stores.content.getJSON(k))?.doc)
    return keep
  }

  async function verifyUploads(nextDoc, prevDoc) {
    // Checking everything (publish): one listing of all files instead of one per photo.
    const all = prevDoc ? null : new Set(await stores.media.list('m/'))
    for (const m of Object.values(nextDoc.media)) {
      if (m.kind !== 'upload') continue
      const prev = prevDoc?.media?.[m.id]
      if (prev && prev.kind === 'upload' && prev.rev === m.rev) continue
      const keys = all ? ['master', 'lg', 'md', 'thumb'].map((v) => `m/${m.id}/${m.rev}/${v}`).filter((k) => all.has(k)) : await stores.media.list(`m/${m.id}/${m.rev}/`)
      const have = new Set(keys.map((k) => k.split('/').pop()))
      for (const v of ['lg', 'md', 'thumb']) if (!have.has(v)) return `A photo (“${m.title || m.id}”) didn’t finish uploading. Please upload it again.`
      m.hasMaster = have.has('master')
    }
    return ''
  }

  async function pruneHistory() {
    const keys = (await stores.content.list('history/')).sort().reverse()
    for (const k of keys.slice(HISTORY_KEEP)) await stores.content.delete(k)
  }

  async function cleanup() {
    const keep = await referencedRevisions()
    let removed = 0
    for (const k of await stores.media.list('m/')) {
      const [, id, rev] = k.split('/')
      if (!keep.has(`${id}/${rev}`)) {
        await stores.media.delete(k)
        removed++
      }
    }
    publicCache.at = 0
    return removed
  }

  // ── public routes ─────────────────────────────────────────
  async function getContent() {
    const pub = (await loadPublished()) || SEED
    return new Response(JSON.stringify(toPublic(pub)), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Browsers always revalidate. Netlify's CDN keeps it (refreshing in the background)
        // and drops it the moment the owner publishes (cache tag purge), so visitors get
        // fast responses without waiting for the function, and changes still go live at once.
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=604800',
        'Netlify-Cache-Tag': contentCacheTag,
        // The content never depends on the query string. Naming one unused parameter
        // makes every other query string share a single cache entry, so random
        // "?x=123" requests can't bypass the CDN and run the function each time.
        'Netlify-Vary': 'query=v',
        ...baseHeaders,
      },
    })
  }

  async function getMedia(req, parts) {
    const [id, rev, file] = parts
    const m = file && file.match(/^(master|lg|md|thumb)\.(webp|jpg)$/)
    if (!isId(id) || !/^\d{1,7}$/.test(rev) || !m) return err(404, 'Not found')
    const variant = m[1]
    const key = `m/${id}/${rev}/${variant}`
    const isPublic = variant !== 'master' && (await publicUploads()).has(`${id}/${rev}`)
    if (!isPublic && !(await auth.getSession(req))) return err(404, 'Not found')
    const blob = await stores.media.getBytes(key)
    if (!blob) return err(404, 'Not found')
    const etag = `"${id}-${rev}-${variant}"`
    const headers = {
      'Content-Type': blob.metadata.mime === 'image/jpeg' ? 'image/jpeg' : 'image/webp',
      ETag: etag,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
      ...baseHeaders,
      ...(isPublic
        ? {
            'Cache-Control': 'public, max-age=31536000, immutable',
            // Keep served photos at Netlify's edge so repeat views don't run the function.
            'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable',
            'Netlify-Vary': 'query=v',
          }
        : { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }),
    }
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
    return new Response(blob.data, { status: 200, headers })
  }

  // ── owner routes ──────────────────────────────────────────
  async function admin(req, route, ip) {
    const method = req.method
    if (route === 'login' && method === 'POST') {
      if (!auth.sameOrigin(req)) return err(403, 'Not allowed.')
      const body = await readJson(req)
      const r = await auth.login(req, body.password, ip)
      if (r.error) return err(r.status, r.error, r.retryAfter ? { 'Retry-After': String(r.retryAfter) } : {})
      return json(200, { ok: true, csrf: r.session.csrf, mustChangePassword: r.session.mustChange }, { 'Set-Cookie': r.cookie })
    }
    if (!auth.configured) return err(503, 'The dashboard isn’t set up yet. Ask your website developer to finish the setup.')

    const session = await auth.getSession(req)
    if (route === 'session' && method === 'GET') {
      if (!session) return json(200, { authenticated: false })
      return json(200, { authenticated: true, csrf: session.csrf, mustChangePassword: session.mustChange, expiresAt: new Date(session.expiresAt).toISOString() })
    }
    if (!session) return err(401, 'Please sign in again.')
    const changing = method !== 'GET' && method !== 'HEAD'
    if (changing && !auth.checkCsrf(req, session)) return err(403, 'This page is out of date. Please reload and try again.')

    if (route === 'logout' && method === 'POST') {
      return json(200, { ok: true }, { 'Set-Cookie': await auth.logout(req, session) })
    }
    if (route === 'password' && method === 'POST') {
      const body = await readJson(req)
      const r = await auth.changePassword(req, session, body.current, body.next)
      if (r.error) return err(r.status, r.error)
      return json(200, { ok: true, csrf: r.session.csrf }, { 'Set-Cookie': r.cookie })
    }
    if (session.mustChange) return err(403, 'Please choose your own password first.', { 'X-Must-Change-Password': '1' })

    if (route === 'draft' && method === 'GET') {
      const [draft, pub] = await Promise.all([loadDraft(), loadPublished()])
      return json(200, {
        doc: draft,
        publishedRev: pub?.rev ?? null,
        publishedAt: pub?.publishedAt || null,
        // Compare content only (not bookkeeping like revision numbers or the change log).
        hasUnpublished: contentOf(draft) !== contentOf(pub || SEED),
      })
    }
    if (route === 'draft' && method === 'PUT') {
      const body = await readJson(req)
      const current = await loadDraft()
      if (Number(body.baseRev) !== Number(current.rev || 0)) {
        return err(409, 'These changes were made from an older copy (perhaps another tab or device). Reload to get the latest version.')
      }
      const next = sanitizeDoc(body.doc, SEED)
      const problem = await verifyUploads(next, current)
      if (problem) return err(400, problem)
      next.rev = (current.rev || 0) + 1
      next.updatedAt = iso()
      if (JSON.stringify(next).length > MAX.docBytes) return err(413, 'There’s too much content to save. Remove some old photos from the bin first.')
      await stores.content.setJSON('draft', next)
      return json(200, { doc: next })
    }
    if (route === 'publish' && method === 'POST') {
      const body = await readJson(req).catch(() => ({}))
      const draft = await loadDraft()
      const problem = await verifyUploads(draft, null)
      if (problem) return err(400, problem)
      // Keep the version being replaced. On the very first publish that is the
      // original website as handed over, so the owner can always go back to it.
      const prev = await loadPublished()
      await stores.content.setJSON(`history/${iso().replace(/[:.]/g, '-')}-${randomId(4)}`, prev
        ? { at: prev.publishedAt || prev.updatedAt, note: prev.publishNote || '', doc: prev }
        : { at: SEED.updatedAt, note: 'Original website', doc: SEED })
      const at = iso()
      const note = typeof body.note === 'string' ? body.note.slice(0, 120) : ''
      const activity = [{ at, what: 'Published changes to the website' }, ...(draft.activity || [])].slice(0, MAX.activity)
      const published = { ...draft, activity, publishedAt: at, publishNote: note }
      await stores.content.setJSON('published', published)
      await stores.content.setJSON('draft', { ...draft, activity })
      publicCache.at = 0
      try {
        await purgeContentCache()
      } catch (e) {
        console.warn('[api] CDN purge failed; the site updates within 5 minutes instead', e?.message)
      }
      await pruneHistory()
      const removed = await cleanup()
      return json(200, { ok: true, publishedAt: at, removedFiles: removed })
    }
    if (route === 'discard' && method === 'POST') {
      const pub = (await loadPublished()) || SEED
      const draft = await loadDraft()
      const next = { ...pub, rev: (draft.rev || 0) + 1, updatedAt: iso() }
      await stores.content.setJSON('draft', next)
      return json(200, { doc: next })
    }
    if (route === 'history' && method === 'GET') {
      const keys = (await stores.content.list('history/')).sort().reverse()
      const items = []
      for (const k of keys) {
        const h = await stores.content.getJSON(k)
        if (!h) continue
        const d = h.doc || {}
        items.push({
          id: k.slice('history/'.length),
          at: h.at || d.publishedAt || null,
          note: h.note || '',
          photos: Object.values(d.media || {}).filter((m) => !m.deletedAt).length,
          projects: (d.projects || []).filter((p) => !p.deletedAt).length,
        })
      }
      return json(200, { items })
    }
    if (route === 'restore' && method === 'POST') {
      const body = await readJson(req)
      if (typeof body.id !== 'string' || !/^[\w-]{10,80}$/.test(body.id)) return err(400, 'Unknown version.')
      const h = await stores.content.getJSON(`history/${body.id}`)
      if (!h?.doc) return err(404, 'That version is no longer available.')
      const draft = await loadDraft()
      const next = sanitizeDoc(h.doc, SEED)
      next.rev = (draft.rev || 0) + 1
      next.updatedAt = iso()
      next.activity = [{ at: iso(), what: `Restored the version from ${new Date(h.at || Date.now()).toLocaleString('en-US')}` }, ...(draft.activity || [])].slice(0, MAX.activity)
      await stores.content.setJSON('draft', next)
      return json(200, { doc: next })
    }
    if (route === 'preview' && method === 'GET') {
      return json(200, toPublic(await loadDraft()))
    }
    if (route === 'media' && method === 'POST') {
      const body = await readJson(req)
      const draft = await loadDraft()
      if (body.id != null) {
        if (!isId(body.id)) return err(400, 'Unknown photo.')
        const existing = draft.media?.[body.id]
        const keys = await stores.media.list(`m/${body.id}/`)
        const maxRev = Math.max(existing?.rev || 0, ...keys.map((k) => Number(k.split('/')[2]) || 0))
        return json(200, { id: body.id, rev: maxRev + 1 })
      }
      const count = Object.keys(draft.media || {}).length
      if (count >= MAX.media) return err(400, 'The photo library is full. Delete some old photos from the bin first.')
      return json(200, { id: `u${randomId(9).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 16), rev: 1 })
    }
    if (route.startsWith('media/') && method === 'PUT') {
      const [, id, rev, variant] = route.split('/')
      if (!isId(id) || !/^\d{1,7}$/.test(rev || '') || !VARIANTS.includes(variant)) return err(400, 'Unknown photo.')
      const len = Number(req.headers.get('content-length') || 0)
      if (len > 6_000_000) return err(413, 'That photo is too large. Try a smaller photo.')
      // A live photo's files are cached as permanent; never overwrite them (edits make a new revision).
      publicCache.at = 0
      if ((await publicUploads()).has(`${id}/${rev}`)) return err(409, 'That photo is live on your website. Upload a new version instead.')
      const bytes = new Uint8Array(await req.arrayBuffer())
      const check = checkUpload(variant, bytes)
      if (!check.ok) return err(check.status || 400, check.error)
      await stores.media.setBytes(`m/${id}/${rev}/${variant}`, bytes, {
        mime: check.info.mime,
        w: check.info.w,
        h: check.info.h,
        size: bytes.length,
        uploadedAt: iso(),
      })
      return json(200, { ok: true, w: check.info.w, h: check.info.h, ext: check.info.ext, size: bytes.length })
    }
    if (route === 'cleanup' && method === 'POST') {
      return json(200, { removed: await cleanup() })
    }
    return err(404, 'Not found')
  }

  // ── entry point ───────────────────────────────────────────
  return async function handle(req, { ip } = {}) {
    try {
      const url = new URL(req.url)
      const p = url.pathname.replace(/\/+$/, '')
      if (p === '/api/content' && req.method === 'GET') return await getContent()
      if (p === '/api/health') return json(200, { ok: true, dashboard: auth.configured, dataEnv })
      if (p.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) return await getMedia(req, p.slice(7).split('/'))
      if (p.startsWith('/api/admin/')) return await admin(req, p.slice('/api/admin/'.length), ip)
      return err(404, 'Not found')
    } catch (e) {
      if (e?.status) return err(e.status, e.message)
      console.error('[api]', e)
      return err(500, 'Something went wrong. Please try again.')
    }
  }
}
