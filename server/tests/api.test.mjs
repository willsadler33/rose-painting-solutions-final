// Backend tests — run with:  npm test
// Uses an in-memory or temporary-folder store and synthetic test images;
// no real photos or live storage are touched.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app.mjs'
import { memoryStores, fileStores } from '../stores.mjs'
import { SESSION, LIMITS } from '../auth.mjs'
import { sniffImage } from '../images.mjs'

const ORIGIN = 'https://rose.example'
const ENV = { SESSION_SECRET: 'x'.repeat(40) + 'test-secret', ADMIN_INITIAL_PASSWORD: 'first-time-pass-123' }

// ── synthetic images (headers are all the server inspects) ──
function jpeg(w, h, pad = 200) {
  const b = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]
  return new Uint8Array([...b, ...new Array(pad).fill(0), 0xff, 0xd9])
}
function webp(w, h, pad = 200) {
  const body = [...'WEBPVP8X'].map((c) => c.charCodeAt(0))
  const size = 10
  const chunk = [size, 0, 0, 0, 0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]
  const all = [...body.slice(0, 4), ...body.slice(4), ...chunk, ...new Array(pad).fill(0)]
  const len = all.length
  return new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([len & 255, (len >> 8) & 255, (len >> 16) & 255, (len >> 24) & 255], all))
}

function setup({ stores = memoryStores(), env = ENV } = {}) {
  let clock = Date.parse('2026-11-01T12:00:00Z')
  const app = createApp({ stores, env, now: () => clock })
  const jar = { cookie: '', csrf: '' }
  const call = async (method, p, body, { headers = {}, ip = '203.0.113.5', raw } = {}) => {
    const h = { Origin: ORIGIN, ...headers }
    if (jar.cookie) h.Cookie = jar.cookie
    if (jar.csrf && method !== 'GET') h['X-CSRF-Token'] ??= jar.csrf
    let payload
    if (raw) {
      payload = raw
      h['Content-Type'] = 'image/webp'
    } else if (body !== undefined) {
      payload = JSON.stringify(body)
      h['Content-Type'] = 'application/json'
    }
    const res = await app(new Request(ORIGIN + p, { method, headers: h, body: payload }), { ip })
    const set = res.headers.get('set-cookie')
    if (set) jar.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    const type = res.headers.get('content-type') || ''
    const data = type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer())
    if (data?.csrf) jar.csrf = data.csrf
    return { status: res.status, data, headers: res.headers }
  }
  const signIn = async () => {
    let r = await call('POST', '/api/admin/login', { password: ENV.ADMIN_INITIAL_PASSWORD })
    assert.equal(r.status, 200)
    r = await call('POST', '/api/admin/password', { next: 'Brushes-and-Rollers-2026' })
    assert.equal(r.status, 200, JSON.stringify(r.data))
  }
  const upload = async (variants = { lg: webp(1600, 1200), md: webp(800, 600), thumb: webp(400, 300) }, id) => {
    const start = await call('POST', '/api/admin/media', id ? { id } : {})
    assert.equal(start.status, 200)
    for (const [v, bytes] of Object.entries(variants)) {
      const r = await call('PUT', `/api/admin/media/${start.data.id}/${start.data.rev}/${v}`, undefined, { raw: bytes })
      assert.equal(r.status, 200, `${v}: ${JSON.stringify(r.data)}`)
    }
    return start.data
  }
  const draft = async () => (await call('GET', '/api/admin/draft')).data
  const save = async (doc) => call('PUT', '/api/admin/draft', { doc, baseRev: doc.rev })
  const tick = (ms) => (clock += ms)
  return { app, call, jar, signIn, upload, draft, save, tick, stores }
}

const addUpload = (doc, u, extra = {}) => {
  doc.media[u.id] = {
    id: u.id, kind: 'upload', rev: u.rev, ext: 'webp', title: 'Test photo', alt: 'A test photo', w: 1600, h: 1200,
    sizes: { lg: { w: 1600, h: 1200 }, md: { w: 800, h: 600 }, thumb: { w: 400, h: 300 } },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...extra,
  }
}

// ── 1–4: sign-in, wrong password, expiry, unauthenticated access ──
test('owner signs in with the initial password and must choose a new one', async () => {
  const t = setup()
  let r = await t.call('POST', '/api/admin/login', { password: ENV.ADMIN_INITIAL_PASSWORD })
  assert.equal(r.status, 200)
  assert.equal(r.data.mustChangePassword, true)
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.match(r.headers.get('set-cookie'), /Secure/)
  assert.match(r.headers.get('set-cookie'), /^__Host-rps_session=/)
  r = await t.call('GET', '/api/admin/draft')
  assert.equal(r.status, 403, 'nothing else works until the password is changed')
  r = await t.call('POST', '/api/admin/password', { next: 'short' })
  assert.equal(r.status, 400)
  r = await t.call('POST', '/api/admin/password', { next: ENV.ADMIN_INITIAL_PASSWORD })
  assert.equal(r.status, 400, 'must differ from the initial password')
  r = await t.call('POST', '/api/admin/password', { next: 'Brushes-and-Rollers-2026' })
  assert.equal(r.status, 200)
  r = await t.call('GET', '/api/admin/draft')
  assert.equal(r.status, 200)
  // The initial password no longer works once the owner has their own.
  t.jar.cookie = ''
  t.jar.csrf = ''
  r = await t.call('POST', '/api/admin/login', { password: ENV.ADMIN_INITIAL_PASSWORD })
  assert.equal(r.status, 401)
  r = await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })
  assert.equal(r.status, 200)
  assert.equal(r.data.mustChangePassword, false)
})

test('wrong passwords are rejected and repeated attempts are locked out', async () => {
  const t = setup()
  await t.signIn()
  t.jar.cookie = ''
  for (let i = 0; i < LIMITS.perIp - 1; i++) assert.equal((await t.call('POST', '/api/admin/login', { password: 'nope-nope-nope' })).status, 401)
  assert.equal((await t.call('POST', '/api/admin/login', { password: 'nope-nope-nope' })).status, 401)
  const locked = await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })
  assert.equal(locked.status, 429, 'even the right password waits during a lock')
  assert.ok(Number(locked.headers.get('retry-after')) > 0)
  // Another connection is unaffected
  assert.equal((await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' }, { ip: '198.51.100.7' })).status, 200)
  t.tick(LIMITS.lockMs + 1000)
  assert.equal((await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })).status, 200)
})

test('sessions expire when idle and after the maximum age', async () => {
  const t = setup()
  await t.signIn()
  assert.equal((await t.call('GET', '/api/admin/session')).data.authenticated, true)
  t.tick(SESSION.idleMs + 1000)
  assert.equal((await t.call('GET', '/api/admin/session')).data.authenticated, false)
  assert.equal((await t.call('GET', '/api/admin/draft')).status, 401)
  // Active use keeps it alive, but never beyond the maximum age
  const u = setup()
  await u.signIn()
  for (let i = 0; i < 20; i++) {
    u.tick(SESSION.idleMs / 2)
    await u.call('GET', '/api/admin/session')
  }
  assert.equal((await u.call('GET', '/api/admin/session')).data.authenticated, false)
})

test('logout ends the session; password change ends all other sessions', async () => {
  const t = setup()
  await t.signIn()
  const other = { ...t.jar }
  let r = await t.call('POST', '/api/admin/logout', {})
  assert.equal(r.status, 200)
  assert.equal((await t.call('GET', '/api/admin/draft')).status, 401)
  // Two devices: changing the password signs the other one out
  const a = setup()
  await a.signIn()
  const deviceB = { cookie: a.jar.cookie, csrf: a.jar.csrf }
  r = await a.call('POST', '/api/admin/password', { current: 'Brushes-and-Rollers-2026', next: 'New-Paint-Colours-77' })
  assert.equal(r.status, 200)
  const saved = { ...a.jar }
  Object.assign(a.jar, deviceB)
  assert.equal((await a.call('GET', '/api/admin/draft')).status, 401)
  Object.assign(a.jar, saved)
  assert.equal((await a.call('GET', '/api/admin/draft')).status, 200)
  assert.ok(other)
})

test('owner-only endpoints refuse anonymous visitors and forged requests', async () => {
  const t = setup()
  for (const [m, p] of [['GET', '/api/admin/draft'], ['PUT', '/api/admin/draft'], ['POST', '/api/admin/publish'], ['POST', '/api/admin/media'], ['GET', '/api/admin/preview'], ['GET', '/api/admin/history']]) {
    const r = await t.call(m, p, m === 'GET' ? undefined : {})
    assert.equal(r.status, 401, `${m} ${p}`)
  }
  assert.equal((await t.call('PUT', '/api/admin/media/abc/1/lg', undefined, { raw: webp(10, 10) })).status, 401)
  await t.signIn()
  // Missing or wrong CSRF token
  assert.equal((await t.call('POST', '/api/admin/publish', {}, { headers: { 'X-CSRF-Token': 'wrong' } })).status, 403)
  // Cross-site origin
  assert.equal((await t.call('POST', '/api/admin/publish', {}, { headers: { Origin: 'https://evil.example' } })).status, 403)
  assert.equal((await t.call('POST', '/api/admin/login', { password: 'x' }, { headers: { Origin: 'https://evil.example' } })).status, 403)
  // Tampered cookie
  const good = t.jar.cookie
  t.jar.cookie = good.slice(0, -3) + 'abc'
  assert.equal((await t.call('GET', '/api/admin/draft')).status, 401)
})

test('without a session secret the dashboard stays switched off, the site still works', async () => {
  const t = setup({ env: {} })
  assert.equal((await t.call('POST', '/api/admin/login', { password: 'anything-at-all' })).status, 503)
  const r = await t.call('GET', '/api/content')
  assert.equal(r.status, 200)
  assert.equal(r.data.projects.length, 4)
})

// ── 5–10: uploads, formats, sizes, replacement, edits ──
test('single and multiple uploads are stored; content is validated by bytes, not names', async () => {
  const t = setup()
  await t.signIn()
  const a = await t.upload()
  const b = await t.upload({ lg: jpeg(1800, 1200), md: jpeg(900, 600), thumb: jpeg(480, 320) })
  const c = await t.upload()
  assert.notEqual(a.id, b.id)
  assert.notEqual(b.id, c.id)
  // Unsupported content (a PNG, a script, a renamed text file) is refused
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(50).fill(0)])
  const script = new TextEncoder().encode('<script>alert(1)</script>')
  for (const bad of [png, script, new TextEncoder().encode('GIF89a......')]) {
    const r = await t.call('PUT', `/api/admin/media/${a.id}/${a.rev}/lg`, undefined, { raw: bad })
    assert.equal(r.status, 415)
  }
  // Oversized files and oversized dimensions are refused
  const r1 = await t.call('PUT', `/api/admin/media/${a.id}/${a.rev}/thumb`, undefined, { raw: webp(400, 300, 400_000) })
  assert.equal(r1.status, 413)
  const r2 = await t.call('PUT', `/api/admin/media/${a.id}/${a.rev}/lg`, undefined, { raw: webp(5000, 3000) })
  assert.equal(r2.status, 413)
  const r3 = await t.call('PUT', `/api/admin/media/${a.id}/${a.rev}/huge`, undefined, { raw: webp(10, 10) })
  assert.equal(r3.status, 400)
  assert.deepEqual(sniffImage(jpeg(321, 123)), { type: 'jpeg', ext: 'jpg', mime: 'image/jpeg', w: 321, h: 123 })
})

test('a photo can’t be saved into the library until all its sizes uploaded', async () => {
  const t = setup()
  await t.signIn()
  const partial = await t.upload({ lg: webp(1600, 1200) })
  const d = await t.draft()
  addUpload(d.doc, partial)
  const r = await t.save(d.doc)
  assert.equal(r.status, 400)
  assert.match(r.data.error, /didn’t finish uploading/)
})

test('replacing a photo creates a new revision; crop, rotation and adjustments are kept as settings', async () => {
  const t = setup()
  await t.signIn()
  const u = await t.upload({ master: webp(3000, 2000), lg: webp(1600, 1200), md: webp(800, 600), thumb: webp(400, 300) })
  let d = await t.draft()
  addUpload(d.doc, u)
  let r = await t.save(d.doc)
  assert.equal(r.status, 200)
  assert.equal(r.data.doc.media[u.id].hasMaster, true, 'the high-quality original is kept for re-editing')
  // Edit: crop + rotate → new revision of the same photo
  const next = await t.upload({ lg: webp(1200, 1600), md: webp(600, 800), thumb: webp(300, 400) }, u.id)
  assert.equal(next.id, u.id)
  assert.equal(next.rev, 2)
  d = r.data
  d.doc = r.data.doc
  Object.assign(d.doc.media[u.id], { rev: 2, w: 1200, h: 1600, edits: { rotate: 90, crop: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 }, brightness: 8, contrast: -40 } })
  r = await t.save(d.doc)
  assert.equal(r.status, 200)
  const e = r.data.doc.media[u.id].edits
  assert.equal(e.rotate, 90)
  assert.deepEqual(e.crop, { x: 0.1, y: 0.05, w: 0.8, h: 0.9 })
  assert.equal(e.brightness, 8)
  assert.equal(e.contrast, -15, 'adjustments are limited so photos of real work stay honest')
  // Reset edits
  r.data.doc.media[u.id].edits = { rotate: 0, crop: null, brightness: 0, contrast: 0 }
  r = await t.save(r.data.doc)
  assert.deepEqual(r.data.doc.media[u.id].edits, { rotate: 0, crop: null, brightness: 0, contrast: 0 })
})

// ── 11–13: titles, descriptions, ordering; text safety ──
test('photo titles and descriptions are editable; markup and unsafe links are neutralised', async () => {
  const t = setup()
  await t.signIn()
  const d = await t.draft()
  const id = 'photo-02'
  d.doc.media[id].title = 'Complete Living Room Repaint — Bright Modern Finish'
  d.doc.media[id].description = 'Two coats of eggshell white.\n\nTrim in satin.'
  d.doc.media['photo-05'].title = '<img src=x onerror=alert(1)>' + 'x'.repeat(200)
  d.doc.business.social = { facebook: 'javascript:alert(1)', instagram: 'https://instagram.com/rosepainting' }
  d.doc.business.email = 'not an email<script>'
  const r = await t.save(d.doc)
  assert.equal(r.status, 200)
  const m = r.data.doc.media
  assert.equal(m[id].title, 'Complete Living Room Repaint — Bright Modern Finish')
  assert.equal(m[id].description, 'Two coats of eggshell white.\n\nTrim in satin.')
  assert.ok(m['photo-05'].title.length <= 80, 'titles are length-limited')
  assert.equal(r.data.doc.business.social.facebook, '', 'only https links are kept')
  assert.equal(r.data.doc.business.social.instagram, 'https://instagram.com/rosepainting')
  assert.equal(r.data.doc.business.email, '')
  // Static photo paths can't be pointed anywhere else
  const d2 = r.data
  d2.doc.media[id].src = 'https://evil.example/x.webp'
  const r2 = await t.save(d2.doc)
  assert.equal(r2.data.doc.media[id], undefined, 'an invalid photo entry is dropped rather than saved')
})

test('the gallery can be reordered', async () => {
  const t = setup()
  await t.signIn()
  const d = await t.draft()
  const before = d.doc.gallery.map((g) => g.media)
  d.doc.gallery.reverse()
  const r = await t.save(d.doc)
  assert.deepEqual(r.data.doc.gallery.map((g) => g.media), [...before].reverse())
})

// ── 14–19: before & after projects, hiding, publishing ──
test('existing before/after pairings are migrated exactly', async () => {
  const t = setup()
  await t.signIn()
  const { doc } = await t.draft()
  const pairs = Object.fromEntries(doc.projects.map((p) => [p.id, [doc.media[p.before.media].src, doc.media[p.after.media].src]]))
  assert.match(pairs['bathroom-vanity'][0], /11-bathroom-vanity-patterned-wall\.webp$/)
  assert.match(pairs['bathroom-vanity'][1], /10-bathroom-vanity-plain-wall\.webp$/)
  assert.match(pairs['room-project-02'][0], /room-project-02-before\.webp$/)
  assert.match(pairs['room-project-02'][1], /room-project-02-after\.webp$/)
  assert.match(pairs['room-project-03'][0], /room-project-03-before\.webp$/)
  assert.match(pairs['room-project-04'][1], /room-project-04-after\.webp$/)
  assert.equal(doc.gallery.length, 5)
})

test('create, edit, swap, hide and publish a before & after project', async () => {
  const t = setup()
  await t.signIn()
  const before = await t.upload()
  const after = await t.upload()
  let d = await t.draft()
  addUpload(d.doc, before, { title: 'Hallway (before)' })
  addUpload(d.doc, after, { title: 'Hallway (after)' })
  d.doc.projects.unshift({
    id: 'hallway', title: 'Hallway refresh', change: 'Scuffed grey to soft white', summary: 'New coat on walls and trim.',
    category: 'interior', status: 'draft',
    before: { media: before.id, focus: '50% 40%', focusM: '50% 50%', zoom: 1.2 },
    after: { media: after.id, focus: '50% 50%', focusM: '50% 50%', zoom: 1 },
  })
  let r = await t.save(d.doc)
  assert.equal(r.status, 200)
  let p = r.data.doc.projects[0]
  assert.equal(p.before.media, before.id, 'BEFORE stays exactly where the owner put it')
  assert.equal(p.after.media, after.id)
  assert.equal(p.before.zoom, 1.2)
  // Drafts are not public, even after publishing
  assert.equal((await t.call('POST', '/api/admin/publish', {})).status, 200)
  let pub = (await t.call('GET', '/api/content')).data
  assert.ok(!pub.projects.some((x) => x.id === 'hallway'), 'a draft project stays off the site')
  // Make it live and publish
  r.data.doc.projects[0].status = 'live'
  r = await t.save(r.data.doc)
  assert.equal((await t.call('POST', '/api/admin/publish', {})).status, 200)
  pub = (await t.call('GET', '/api/content')).data
  const live = pub.projects.find((x) => x.id === 'hallway')
  assert.ok(live)
  assert.equal(live.before.src, `/media/${before.id}/${before.rev}/lg.webp`)
  assert.equal(live.after.src, `/media/${after.id}/${after.rev}/lg.webp`)
  // Deliberate swap
  const doc = r.data.doc
  ;[doc.projects[0].before, doc.projects[0].after] = [doc.projects[0].after, doc.projects[0].before]
  doc.projects[0].title = 'Hallway refresh (edited)'
  r = await t.save(doc)
  p = r.data.doc.projects[0]
  assert.equal(p.before.media, after.id)
  assert.equal(p.title, 'Hallway refresh (edited)')
  // Unpublished edits are invisible until published
  pub = (await t.call('GET', '/api/content')).data
  assert.equal(pub.projects.find((x) => x.id === 'hallway').title, 'Hallway refresh')
  const preview = (await t.call('GET', '/api/admin/preview')).data
  assert.equal(preview.projects.find((x) => x.id === 'hallway').title, 'Hallway refresh (edited)')
  // Hide
  r.data.doc.projects[0].status = 'hidden'
  await t.save(r.data.doc)
  await t.call('POST', '/api/admin/publish', {})
  pub = (await t.call('GET', '/api/content')).data
  assert.ok(!pub.projects.some((x) => x.id === 'hallway'))
})

test('unpublished photos are private; live photos are public and cacheable', async () => {
  const t = setup()
  await t.signIn()
  const u = await t.upload({ master: webp(3000, 2000), lg: webp(1600, 1200), md: webp(800, 600), thumb: webp(400, 300) })
  let d = await t.draft()
  addUpload(d.doc, u)
  d.doc.gallery.push({ media: u.id, status: 'draft' })
  let r = await t.save(d.doc)
  const url = `/media/${u.id}/${u.rev}/lg.webp`
  // Owner can see it; visitors can't
  let m = await t.call('GET', url)
  assert.equal(m.status, 200)
  assert.match(m.headers.get('cache-control'), /no-store/)
  const owner = { ...t.jar }
  t.jar.cookie = ''
  assert.equal((await t.call('GET', url)).status, 404)
  Object.assign(t.jar, owner)
  // Publish it
  r.data.doc.gallery.find((g) => g.media === u.id).status = 'live'
  await t.save(r.data.doc)
  await t.call('POST', '/api/admin/publish', {})
  t.jar.cookie = ''
  m = await t.call('GET', url)
  assert.equal(m.status, 200)
  assert.match(m.headers.get('cache-control'), /public, max-age=31536000, immutable/)
  assert.equal(m.headers.get('content-type'), 'image/webp')
  // The high-quality original is never public
  assert.equal((await t.call('GET', `/media/${u.id}/${u.rev}/master.webp`)).status, 404)
})

// ── 20–21: bin, restore, version history ──
test('photos go to the bin and can be restored; earlier versions can be brought back', async () => {
  const t = setup()
  await t.signIn()
  let d = await t.draft()
  d.doc.media['photo-01'].deletedAt = new Date().toISOString()
  d.doc.gallery = d.doc.gallery.filter((g) => g.media !== 'photo-01')
  let r = await t.save(d.doc)
  assert.ok(r.data.doc.media['photo-01'].deletedAt, 'kept in the bin, not destroyed')
  await t.call('POST', '/api/admin/publish', {})
  assert.equal((await t.call('GET', '/api/content')).data.gallery.length, 4)
  // Restore from the bin
  r.data.doc.media['photo-01'].deletedAt = null
  r.data.doc.gallery.push({ media: 'photo-01', status: 'live' })
  r = await t.save(r.data.doc)
  await t.call('POST', '/api/admin/publish', {})
  assert.equal((await t.call('GET', '/api/content')).data.gallery.length, 5)
  // Version history: bring back the version with 4 photos
  const h = (await t.call('GET', '/api/admin/history')).data.items
  assert.ok(h.length >= 2)
  const v = h.find((x) => x.photos)
  assert.ok(v)
  const restored = await t.call('POST', '/api/admin/restore', { id: h[0].id })
  assert.equal(restored.status, 200)
  // Discard unpublished changes
  const disc = await t.call('POST', '/api/admin/discard', {})
  assert.equal(disc.status, 200)
  assert.equal(disc.data.doc.gallery.length, 5)
})

test('two devices editing at once can’t silently overwrite each other', async () => {
  const t = setup()
  await t.signIn()
  const a = await t.draft()
  const b = await t.draft()
  a.doc.text.heroLine1 = 'From device A'
  assert.equal((await t.save(a.doc)).status, 200)
  b.doc.text.heroLine1 = 'From device B'
  assert.equal((await t.save(b.doc)).status, 409)
})

// ── 22–23: business settings, services ──
test('business settings and services update the public content', async () => {
  const t = setup()
  await t.signIn()
  const d = await t.draft()
  d.doc.business.phoneDisplay = '(330) 555-0142'
  d.doc.business.hours = { openDays: [1, 2, 3, 4, 5, 6], openHour: 8, closeHour: 16.5, timeZone: 'America/New_York' }
  d.doc.business.serviceArea = 'Akron, Canton and surrounding areas'
  d.doc.services[0].title = 'Interior painting'
  d.doc.services[0].summary = 'Walls, ceilings and trim.'
  d.doc.services[5].enabled = false
  d.doc.services.push({ id: 'cabinets', title: 'Cabinet painting', summary: 'Kitchen cabinets sprayed smooth.', includes: ['Degreasing'], tone: '#e6eefc', ink: '#0d1f4d', enabled: true })
  d.doc.text.heroLine1 = 'Fresh walls,'
  await t.save(d.doc)
  await t.call('POST', '/api/admin/publish', {})
  const pub = (await t.call('GET', '/api/content')).data
  assert.equal(pub.business.phoneDisplay, '(330) 555-0142')
  assert.equal(pub.business.phoneHref, 'tel:+13305550142')
  assert.equal(pub.business.hours.days, 'Monday–Saturday')
  assert.equal(pub.business.hours.time, '8:00 AM – 4:30 PM')
  assert.equal(pub.business.hours.closed, 'Sunday')
  assert.equal(pub.services[0].title, 'Interior painting')
  assert.ok(!pub.services.some((s) => s.title === 'Trim, doors & detail'), 'disabled services are hidden')
  assert.ok(pub.services.some((s) => s.id === 'cabinets'))
  assert.equal(pub.text.heroLine1, 'Fresh walls,')
  assert.equal(pub.business.shortName, 'Rose', 'the logo wordmark is protected')
})

// ── 24: durability across redeploys ──
test('uploads and content persist when the app restarts (as after a redeploy)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rps-'))
  try {
    const t = setup({ stores: fileStores(dir) })
    await t.signIn()
    const u = await t.upload()
    const d = await t.draft()
    addUpload(d.doc, u, { title: 'Survives redeploys' })
    d.doc.gallery.push({ media: u.id, status: 'live' })
    await t.save(d.doc)
    await t.call('POST', '/api/admin/publish', {})
    // A brand-new app instance on the same storage = a fresh deploy
    const t2 = setup({ stores: fileStores(dir) })
    const pub = (await t2.call('GET', '/api/content')).data
    const g = pub.gallery.find((x) => x.id === u.id)
    assert.equal(g?.caption, 'Survives redeploys')
    assert.equal((await t2.call('GET', g.src)).status, 200)
    // The owner's password persists too
    assert.equal((await t2.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })).status, 200)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('publishing removes photo files nothing refers to any more', async () => {
  const t = setup()
  await t.signIn()
  const orphan = await t.upload()
  const kept = await t.upload()
  const d = await t.draft()
  addUpload(d.doc, kept)
  await t.save(d.doc)
  const r = await t.call('POST', '/api/admin/publish', {})
  assert.equal(r.status, 200)
  assert.equal(r.data.removedFiles, 3, 'the abandoned upload’s three sizes are cleaned up')
  assert.equal((await t.stores.media.list(`m/${orphan.id}/`)).length, 0)
  assert.equal((await t.stores.media.list(`m/${kept.id}/`)).length, 3)
})

test('public content contains no drafts, bin items or private fields', async () => {
  const t = setup()
  const pub = (await t.call('GET', '/api/content')).data
  assert.equal(pub.projects.length, 4)
  assert.equal(pub.gallery.length, 5)
  const s = JSON.stringify(pub)
  for (const word of ['activity', 'deletedAt', 'password', 'csrf', 'master', 'history']) assert.ok(!s.includes(word), word)
})

test('a live photo’s files can’t be overwritten; the development cookie only works on localhost', async () => {
  const t = setup()
  await t.signIn()
  const u = await t.upload()
  const d = await t.draft()
  addUpload(d.doc, u)
  d.doc.gallery.push({ media: u.id, status: 'live' })
  await t.save(d.doc)
  await t.call('POST', '/api/admin/publish', {})
  const r = await t.call('PUT', `/api/admin/media/${u.id}/${u.rev}/lg`, undefined, { raw: webp(1600, 1200) })
  assert.equal(r.status, 409)
  // A cookie under the plain development name is ignored on the real (https) site.
  const value = t.jar.cookie.split('=').slice(1).join('=')
  t.jar.cookie = `rps_session=${value}`
  assert.equal((await t.call('GET', '/api/admin/draft')).status, 401)
})

// ── Deploy Preview isolation (store naming) ──
test('only the production deploy uses the live stores; everything else gets the test copy', async () => {
  const { resolveDataEnv, storeNames, netlifyStores } = await import('../stores.mjs')
  assert.equal(resolveDataEnv('production', {}), 'production')
  for (const ctx of ['deploy-preview', 'branch-deploy', 'dev', 'preview-server', 'something-new']) {
    assert.equal(resolveDataEnv(ctx, {}), 'preview', ctx)
    assert.equal(resolveDataEnv(ctx, { RPS_DATA_ENV: 'production' }), 'preview', `${ctx} can't be promoted`)
  }
  assert.equal(resolveDataEnv('', {}), 'preview', 'unknown context is treated as a preview')
  assert.equal(resolveDataEnv(undefined, { RPS_DATA_ENV: 'production' }), 'production')
  assert.equal(resolveDataEnv('production', { RPS_DATA_ENV: 'preview' }), 'preview')
  assert.deepEqual(storeNames('production'), { content: 'rps-content', auth: 'rps-auth', media: 'rps-media' })
  assert.deepEqual(storeNames('preview'), { content: 'preview-rps-content', auth: 'preview-rps-auth', media: 'preview-rps-media' })
  for (const n of Object.values(storeNames('preview'))) assert.ok(Buffer.byteLength(n) < 64)
  const opened = []
  netlifyStores((o) => (opened.push(o), {}), { dataEnv: 'preview' })
  assert.deepEqual(opened.map((o) => o.name), ['preview-rps-content', 'preview-rps-auth', 'preview-rps-media'])
  assert.ok(opened.every((o) => o.consistency === 'strong'))
  assert.throws(() => netlifyStores(() => ({})), /dataEnv/, 'no silent default to live data')
})

test('health reports which data the API is using', async () => {
  const app = createApp({ stores: memoryStores(), env: ENV, dataEnv: 'preview' })
  const r = await app(new Request(ORIGIN + '/api/health'))
  assert.deepEqual(await r.json(), { ok: true, dashboard: true, dataEnv: 'preview' })
})

test('expired sessions and old wrong-password records are tidied up on sign-in', async () => {
  const t = setup()
  await t.signIn()
  // A stale session from a lost phone, and an old failed attempt from another connection
  await t.call('POST', '/api/admin/logout', {})
  await t.call('POST', '/api/admin/login', { password: 'wrong-password-1' }, { ip: '198.51.100.7' })
  await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })
  t.jar.cookie = ''
  t.jar.csrf = ''
  assert.equal((await t.stores.auth.list('sessions/')).length, 1)
  assert.ok((await t.stores.auth.list('rl/')).length >= 1)
  t.tick(SESSION.maxMs + 1000)
  await t.call('POST', '/api/admin/login', { password: 'Brushes-and-Rollers-2026' })
  assert.equal((await t.stores.auth.list('sessions/')).length, 1, 'only the new session remains')
  assert.deepEqual((await t.stores.auth.list('rl/')).filter((k) => k !== 'rl/global'), [])
})

test('opening hours read naturally, weeks running Monday to Sunday', async () => {
  const { formatHours } = await import('../../src/content/schema.js')
  const f = (openDays) => formatHours({ openDays, openHour: 9, closeHour: 17 })
  assert.deepEqual([f([1, 2, 3, 4, 5]).days, f([1, 2, 3, 4, 5]).closed], ['Monday–Friday', 'Saturday–Sunday'], 'matches the original website')
  assert.equal(f([1, 2, 3, 4, 5]).timeShort, '9 AM–5 PM')
  assert.equal(f([1, 2, 3, 4, 5, 6]).closed, 'Sunday')
  assert.equal(f([1, 3, 5]).days, 'Monday, Wednesday, Friday')
  assert.equal(f([0, 1, 2, 3, 4, 5, 6]).days, 'Every day')
  assert.equal(f([0, 1, 2, 3, 4, 5, 6]).closed, '')
})
