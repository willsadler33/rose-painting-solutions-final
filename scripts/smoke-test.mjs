// Read-only checks against a deployed site (a Deploy Preview or production).
// It never signs in and never changes anything, so it's safe to run on the
// live website.
//
//   node scripts/smoke-test.mjs https://deploy-preview-5--your-site.netlify.app preview
//   node scripts/smoke-test.mjs https://www.your-domain.com production
//
// The second argument is the data you expect the API to be using.
const [base, expectEnv = 'preview'] = process.argv.slice(2)
if (!base || !/^(https:\/\/|http:\/\/localhost[:/])/.test(base)) {
  console.error('Usage: node scripts/smoke-test.mjs https://<site> [preview|production]')
  process.exit(2)
}
const origin = base.replace(/\/+$/, '')
let failed = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}
const get = (p, init) => fetch(origin + p, { redirect: 'manual', ...init })

// 1. API is deployed and using the expected data
const health = await get('/api/health')
const h = health.ok ? await health.json() : {}
check(health.ok, '/api/health responds', `HTTP ${health.status}`)
check(h.dashboard === true, 'dashboard is configured (SESSION_SECRET set)', JSON.stringify(h))
check(h.dataEnv === expectEnv, `API uses the ${expectEnv} data`, `dataEnv=${h.dataEnv}`)

// 2. Public content
const content = await get('/api/content')
const c = content.ok ? await content.json() : {}
check(content.ok, '/api/content responds', `HTTP ${content.status}`)
check(Array.isArray(c.gallery) && c.gallery.length > 0, 'gallery has photos', `${c.gallery?.length} photos`)
check(Array.isArray(c.projects) && c.projects.length > 0, 'before & after projects present', `${c.projects?.length} projects`)
check(!JSON.stringify(c).includes('"master"'), 'no private originals in public content')
check(/durable/.test(content.headers.get('netlify-cdn-cache-control') || '') || content.headers.has('cache-status'), 'content is CDN-cacheable')

// 3. Every photo the site shows actually loads
const srcs = new Set()
for (const g of c.gallery || []) srcs.add(g.src)
for (const p of c.projects || []) {
  srcs.add(p.before?.src)
  srcs.add(p.after?.src)
}
srcs.delete(undefined)
for (const src of srcs) {
  const url = src.startsWith('http') ? src : origin + (src.startsWith('/') ? src : `/${src.replace(/^\.\//, '')}`)
  const r = await fetch(url, { method: 'HEAD' })
  check(r.ok && /^image\//.test(r.headers.get('content-type') || ''), `photo loads: ${src}`, `HTTP ${r.status}`)
}

// 4. Pages and protection
const home = await get('/')
check(home.ok, 'home page loads', `HTTP ${home.status}`)
check(/default-src 'self'/.test(home.headers.get('content-security-policy') || ''), 'security headers on the home page')
const admin = await get('/admin/')
const adminHtml = admin.ok ? await admin.text() : ''
check(admin.ok && adminHtml.includes('id="root"'), '/admin/ loads the dashboard', `HTTP ${admin.status}`)
check(/noindex/.test(admin.headers.get('x-robots-tag') || '') || adminHtml.includes('noindex'), '/admin/ is hidden from search engines')
const adminNoSlash = await get('/admin')
check([200, 301, 302, 308].includes(adminNoSlash.status), '/admin (no slash) works', `HTTP ${adminNoSlash.status}`)
const draft = await get('/api/admin/draft')
check(draft.status === 401, 'owner data needs a sign-in', `HTTP ${draft.status}`)
const robots = await (await get('/robots.txt')).text()
check(/Disallow: \/admin/.test(robots), 'robots.txt hides /admin')

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.')
process.exit(failed ? 1 : 0)
