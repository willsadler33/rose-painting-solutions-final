// Runs the REAL Netlify Function (netlify/functions/api.mjs) with the REAL
// @netlify/blobs and @netlify/functions packages, against Netlify's own local
// Blobs server (BlobsServer, shipped in @netlify/blobs). Run with:
//   npm install && node --test server/tests/netlify-function.test.mjs
//
// It proves, with synthetic test images only:
//   • production and Deploy Previews use separate stores, so testing a
//     preview can't change or delete the live website's data;
//   • production data (photos, projects, settings, password) survives a
//     redeploy (a brand-new function instance);
//   • anything that isn't clearly production falls back to the test copy.
//
// Skips itself (with a message) when the packages aren't installed.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// RPS_FUNCTION_FILE can point at an esbuild bundle of the function, to test it exactly as Netlify packages it.
const FUNCTION = pathToFileURL(process.env.RPS_FUNCTION_FILE ? path.resolve(process.env.RPS_FUNCTION_FILE) : path.join(here, '../../netlify/functions/api.mjs')).href
const ORIGIN = 'https://rose-test.netlify.app'
const TOKEN = 'local-test-token'
const SITE = 'site-under-test'

let blobs = null
let BlobsServer = null
try {
  blobs = await import('@netlify/blobs')
  ;({ BlobsServer } = await import('@netlify/blobs/server'))
  await import('@netlify/functions')
} catch {
  blobs = null
}
const skip = blobs ? false : '@netlify/blobs / @netlify/functions not installed — run `npm install` first'

// ── synthetic images (headers are all the server inspects) ──
function webp(w, h, pad = 200) {
  const chunk = [10, 0, 0, 0, 0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]
  const all = [...'WEBPVP8X'].map((c) => c.charCodeAt(0)).concat(chunk, new Array(pad).fill(0))
  const len = all.length
  return new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([len & 255, (len >> 8) & 255, (len >> 16) & 255, (len >> 24) & 255], all))
}
const SIZES = () => ({ master: webp(3000, 2000), lg: webp(1600, 1200), md: webp(800, 600), thumb: webp(400, 300) })

// ── environment: a local Blobs server + the purge API recorded instead of called ──
let server
let dir
const purges = []
const realFetch = globalThis.fetch

async function startEnvironment() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rps-netlify-'))
  server = new BlobsServer({ directory: dir, token: TOKEN, port: 0 })
  const { port } = await server.start()
  const url = `http://127.0.0.1:${port}`
  // This is how the Netlify Functions runtime hands Blobs its configuration.
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
    JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, siteID: SITE, token: TOKEN, deployID: 'deploy-1' }),
  ).toString('base64')
  process.env.NETLIFY_PURGE_API_TOKEN = 'purge-test-token'
  process.env.SITE_ID = SITE
  globalThis.fetch = async (input, init) => {
    const u = String(input?.url || input)
    if (u.startsWith('https://api.netlify.com/api/v1/purge')) {
      purges.push(JSON.parse(init.body))
      return new Response(null, { status: 202 })
    }
    return realFetch(input, init)
  }
}

let instance = 0
/** A fresh copy of the function module = a new deploy / cold start. */
async function deployFunction(env) {
  Object.assign(process.env, env)
  instance += 1
  const mod = await import(`${FUNCTION}?instance=${instance}`)
  assert.equal(typeof mod.default, 'function')
  assert.deepEqual(mod.config.path, ['/api/*', '/media/*'])
  return mod.default
}

/** A browser-like client for one deploy context. */
function client(handler, deployContext) {
  const jar = { cookie: '', csrf: '' }
  const context = deployContext === undefined ? { ip: '203.0.113.9' } : { ip: '203.0.113.9', deploy: { context: deployContext, id: 'deploy-1' } }
  const call = async (method, p, body, { raw } = {}) => {
    const h = { Origin: ORIGIN }
    if (jar.cookie) h.Cookie = jar.cookie
    if (jar.csrf && method !== 'GET') h['X-CSRF-Token'] = jar.csrf
    let payload
    if (raw) {
      payload = raw
      h['Content-Type'] = 'image/webp'
    } else if (body !== undefined) {
      payload = JSON.stringify(body)
      h['Content-Type'] = 'application/json'
    }
    const res = await handler(new Request(ORIGIN + p, { method, headers: h, body: payload }), context)
    const set = res.headers.get('set-cookie')
    if (set) jar.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    const type = res.headers.get('content-type') || ''
    const data = type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer())
    if (data?.csrf) jar.csrf = data.csrf
    return { status: res.status, data, headers: res.headers }
  }
  const signInFirstTime = async (initial, chosen) => {
    let r = await call('POST', '/api/admin/login', { password: initial })
    assert.equal(r.status, 200, `first sign-in: ${JSON.stringify(r.data)}`)
    r = await call('POST', '/api/admin/password', { next: chosen })
    assert.equal(r.status, 200, JSON.stringify(r.data))
  }
  const uploadPhoto = async (title) => {
    const start = await call('POST', '/api/admin/media', {})
    assert.equal(start.status, 200)
    for (const [v, bytes] of Object.entries(SIZES())) {
      const r = await call('PUT', `/api/admin/media/${start.data.id}/${start.data.rev}/${v}`, undefined, { raw: bytes })
      assert.equal(r.status, 200, `${v}: ${JSON.stringify(r.data)}`)
    }
    const d = (await call('GET', '/api/admin/draft')).data
    const at = new Date().toISOString()
    d.doc.media[start.data.id] = {
      id: start.data.id, kind: 'upload', rev: start.data.rev, ext: 'webp', title, alt: title, w: 1600, h: 1200,
      sizes: { lg: { w: 1600, h: 1200 }, md: { w: 800, h: 600 }, thumb: { w: 400, h: 300 } }, createdAt: at, updatedAt: at,
    }
    d.doc.gallery.push({ media: start.data.id, status: 'live' })
    const saved = await call('PUT', '/api/admin/draft', { doc: d.doc, baseRev: d.doc.rev })
    assert.equal(saved.status, 200, JSON.stringify(saved.data))
    return start.data
  }
  const publish = async () => {
    const r = await call('POST', '/api/admin/publish', {})
    assert.equal(r.status, 200, JSON.stringify(r.data))
    return r.data
  }
  return { call, jar, signInFirstTime, uploadPhoto, publish }
}

const rawStore = (name) => blobs.getStore({ name, consistency: 'strong' })
async function keysOf(name) {
  const { blobs: list } = await rawStore(name).list()
  return list.map((b) => b.key).sort()
}

const PROD_ENV = { SESSION_SECRET: 'prod-' + 'p'.repeat(40), ADMIN_INITIAL_PASSWORD: 'Prod-Initial-Pass-2026', RPS_DATA_ENV: '' }
const PREVIEW_ENV = { SESSION_SECRET: 'prev-' + 'q'.repeat(40), ADMIN_INITIAL_PASSWORD: 'Preview-Initial-Pass-2026', RPS_DATA_ENV: '' }
const PROD_PASSWORD = 'Owner-Chosen-Password-1'
const PREVIEW_PASSWORD = 'Preview-Chosen-Password-2'

test('Netlify Function: production and Deploy Previews are isolated and production survives redeploys', { skip }, async (t) => {
  await startEnvironment()
  t.after(async () => {
    globalThis.fetch = realFetch
    await server.stop()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  // ── 1. production: first sign-in, upload, publish ──
  let prod = client(await deployFunction(PROD_ENV), 'production')
  let h = await prod.call('GET', '/api/health')
  assert.deepEqual(h.data, { ok: true, dashboard: true, dataEnv: 'production' })
  const before = (await prod.call('GET', '/api/content')).data
  assert.equal(before.gallery.length, 5, 'the five original finished-room photos')
  assert.equal(before.projects.length, 4, 'the four original before & after projects')
  await prod.signInFirstTime(PROD_ENV.ADMIN_INITIAL_PASSWORD, PROD_PASSWORD)
  const prodPhoto = await prod.uploadPhoto('Live kitchen photo')
  let d = (await prod.call('GET', '/api/admin/draft')).data
  d.doc.business.phoneDisplay = '(330) 614-0776'
  d.doc.text.heroLine1 = 'Production headline'
  assert.equal((await prod.call('PUT', '/api/admin/draft', { doc: d.doc, baseRev: d.doc.rev })).status, 200)
  await prod.publish()
  assert.deepEqual(purges.at(-1)?.cache_tags, ['rps-content'], 'production purges the production content tag')
  const prodContent = (await prod.call('GET', '/api/content')).data
  assert.equal(prodContent.text.heroLine1, 'Production headline')
  const live = prodContent.gallery.find((g) => g.id === prodPhoto.id)
  assert.ok(live, 'uploaded photo is live')
  const pubMedia = await client(await deployFunction(PROD_ENV), 'production').call('GET', live.src)
  assert.equal(pubMedia.status, 200, 'visitors can load the live photo')
  assert.match(pubMedia.headers.get('netlify-cdn-cache-control'), /durable/)
  const prodKeys = { content: await keysOf('rps-content'), auth: await keysOf('rps-auth'), media: await keysOf('rps-media') }
  assert.ok(prodKeys.media.some((k) => k.startsWith(`m/${prodPhoto.id}/`)))
  assert.ok(prodKeys.auth.includes('password'))
  const prodPublishedBlob = JSON.stringify(await rawStore('rps-content').get('published', { type: 'json' }))
  const prodPasswordBlob = JSON.stringify(await rawStore('rps-auth').get('password', { type: 'json' }))

  // ── 2. Deploy Preview: separate copy, its own password; delete everything it can ──
  const preview = client(await deployFunction(PREVIEW_ENV), 'deploy-preview')
  h = await preview.call('GET', '/api/health')
  assert.equal(h.data.dataEnv, 'preview')
  const pc = (await preview.call('GET', '/api/content')).data
  assert.equal(pc.text.heroLine1 === 'Production headline', false, 'preview starts from the original website, not live data')
  assert.equal(pc.gallery.length, 5)
  assert.equal((await preview.call('POST', '/api/admin/login', { password: PROD_PASSWORD })).status, 401, 'live password does not work on a preview')
  assert.equal((await preview.call('GET', live.src)).status, 404, 'preview cannot see live photo files')
  await preview.signInFirstTime(PREVIEW_ENV.ADMIN_INITIAL_PASSWORD, PREVIEW_PASSWORD)
  const testPhoto = await preview.uploadPhoto('Preview test photo')
  d = (await preview.call('GET', '/api/admin/draft')).data
  // Try to wreck everything: remove all gallery photos and projects, change details.
  d.doc.gallery = []
  d.doc.projects = []
  d.doc.text.heroLine1 = 'PREVIEW ONLY'
  d.doc.business.phoneDisplay = '(330) 555-0100'
  assert.equal((await preview.call('PUT', '/api/admin/draft', { doc: d.doc, baseRev: d.doc.rev })).status, 200)
  await preview.publish()
  assert.deepEqual(purges.at(-1)?.cache_tags, ['preview-rps-content'], 'a preview only purges its own cache tag')
  assert.equal((await preview.call('POST', '/api/admin/cleanup', {})).status, 200)
  // Forged attempt to overwrite the live photo through the preview API
  const forged = await preview.call('PUT', `/api/admin/media/${prodPhoto.id}/${prodPhoto.rev}/lg`, undefined, { raw: webp(1600, 1200) })
  assert.notEqual(forged.status, 500)
  assert.ok((await keysOf('preview-rps-media')).some((k) => k.startsWith(`m/${testPhoto.id}/`)), 'preview photos go to the preview store')
  // Password change on the preview
  assert.equal((await preview.call('POST', '/api/admin/password', { current: PREVIEW_PASSWORD, next: 'Preview-Changed-Pass-3' })).status, 200)

  // Production stores are byte-for-byte untouched by everything above.
  assert.deepEqual(await keysOf('rps-media'), prodKeys.media, 'no live photo files added or deleted')
  assert.deepEqual(await keysOf('rps-content'), prodKeys.content)
  assert.equal(JSON.stringify(await rawStore('rps-content').get('published', { type: 'json' })), prodPublishedBlob)
  assert.equal(JSON.stringify(await rawStore('rps-auth').get('password', { type: 'json' })), prodPasswordBlob)
  assert.ok(!(await keysOf('rps-media')).some((k) => k.startsWith(`m/${testPhoto.id}/`)))

  // ── 3. branch deploys and unknown contexts also get the test copy ──
  for (const ctx of ['branch-deploy', 'dev', 'preview-server', undefined]) {
    const c = client(await deployFunction(PREVIEW_ENV), ctx)
    assert.equal((await c.call('GET', '/api/health')).data.dataEnv, 'preview', `context ${ctx}`)
  }
  // RPS_DATA_ENV=production can't promote a non-production deploy to live data
  let c = client(await deployFunction({ ...PREVIEW_ENV, RPS_DATA_ENV: 'production' }), 'deploy-preview')
  assert.equal((await c.call('GET', '/api/health')).data.dataEnv, 'preview')
  // RPS_DATA_ENV=preview forces the test copy even on production
  c = client(await deployFunction({ ...PROD_ENV, RPS_DATA_ENV: 'preview' }), 'production')
  assert.equal((await c.call('GET', '/api/health')).data.dataEnv, 'preview')

  // ── 4. production redeploy: everything is still there ──
  prod = client(await deployFunction(PROD_ENV), 'production')
  const after = (await prod.call('GET', '/api/content')).data
  assert.equal(after.text.heroLine1, 'Production headline')
  assert.equal(after.business.phoneDisplay, '(330) 614-0776')
  assert.equal(after.projects.length, 4, 'before & after projects intact')
  assert.ok(after.gallery.some((g) => g.id === prodPhoto.id), 'uploaded photo still live')
  assert.equal(after.gallery.length, 6)
  for (const p of after.projects) {
    assert.ok(p.before?.src && p.after?.src, `project ${p.id} still has both photos`)
  }
  assert.equal((await prod.call('GET', live.src)).status, 200, 'live photo file still served')
  assert.equal((await prod.call('POST', '/api/admin/login', { password: PROD_ENV.ADMIN_INITIAL_PASSWORD })).status, 401, 'initial password stays retired')
  assert.equal((await prod.call('POST', '/api/admin/login', { password: 'Preview-Changed-Pass-3' })).status, 401, 'preview password never works on production')
  const ok = await prod.call('POST', '/api/admin/login', { password: PROD_PASSWORD })
  assert.equal(ok.status, 200, 'owner password survives the redeploy')
  assert.equal(ok.data.mustChangePassword, false)
  const hist = (await prod.call('GET', '/api/admin/history')).data.items
  assert.ok(hist.some((x) => x.note === 'Original website' && x.projects === 4), 'history, including the original website, survives')
})
