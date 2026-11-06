// ─────────────────────────────────────────────────────────────
// Owner sign-in: one owner account, password only.
//
// • Passwords: scrypt (Node's built-in crypto) with a random salt.
// • First sign-in uses ADMIN_INITIAL_PASSWORD (set privately in Netlify,
//   never in the code); the owner must choose their own password straight
//   away, after which the initial password stops working.
// • Sessions: a random id stored server-side, sent as a signed cookie
//   (HttpOnly, Secure, SameSite=Strict, __Host- prefix). Logging out
//   deletes the session; changing the password ends every other session.
// • Expiry: 3 days without use, 14 days at most.
// • Repeated wrong passwords: 5 per connection per 15 minutes, then a
//   15-minute lock; plus an overall limit across all connections.
// • CSRF: every change needs the session's token in X-CSRF-Token and a
//   same-origin request.
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }
export const SESSION = { idleMs: 3 * 24 * 3600e3, maxMs: 14 * 24 * 3600e3, touchMs: 10 * 60e3 }
export const LIMITS = { perIp: 5, windowMs: 15 * 60e3, lockMs: 15 * 60e3, global: 40, globalLockMs: 10 * 60e3 }
export const MIN_PASSWORD = 10

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64url')
export const randomId = (bytes = 18) => b64u(crypto.randomBytes(bytes))

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 })
  return { algo: 'scrypt', ...SCRYPT, salt: b64u(salt), hash: b64u(hash) }
}
export async function verifyPassword(password, rec) {
  if (!rec || rec.algo !== 'scrypt') return false
  const hash = await scrypt(String(password).normalize('NFKC'), Buffer.from(rec.salt, 'base64url'), rec.keylen, {
    N: rec.N,
    r: rec.r,
    p: rec.p,
    maxmem: 64 * 1024 * 1024,
  })
  return safeEqual(b64u(hash), rec.hash)
}

/** Simple, friendly password rules. Returns an error message or ''. */
export function passwordProblem(pw, { initial } = {}) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (pw.length > 200) return 'That password is too long.'
  if (/^(.)\1+$/.test(pw)) return 'Choose a password that isn’t one repeated character.'
  if (initial && pw === initial) return 'Choose a new password, different from the one you were given.'
  if (/^(password|rosepainting|painting|123456)/i.test(pw)) return 'That password is too easy to guess.'
  return ''
}

export function createAuth({ store, env, now = () => Date.now() }) {
  const secret = env.SESSION_SECRET || ''
  const configured = secret.length >= 32
  const sign = (sid) => b64u(crypto.createHmac('sha256', secret).update(sid).digest())

  const getPassword = () => store.getJSON('password')

  // ── rate limiting ──
  const ipKey = (ip) => `rl/${sha(`${secret}:${ip || 'unknown'}`)}`
  async function lockState(ip) {
    const t = now()
    const [rec, glob] = await Promise.all([store.getJSON(ipKey(ip)), store.getJSON('rl/global')])
    if (rec?.lockedUntil > t) return { locked: true, retryMs: rec.lockedUntil - t }
    if (glob?.lockedUntil > t) return { locked: true, retryMs: glob.lockedUntil - t }
    return { locked: false }
  }
  async function recordFailure(ip) {
    const t = now()
    const bump = async (key, max, lockMs) => {
      const rec = (await store.getJSON(key)) || { fails: [] }
      rec.fails = (rec.fails || []).filter((x) => t - x < LIMITS.windowMs)
      rec.fails.push(t)
      if (rec.fails.length >= max) {
        rec.lockedUntil = t + lockMs
        rec.fails = []
      }
      await store.setJSON(key, rec)
    }
    await bump(ipKey(ip), LIMITS.perIp, LIMITS.lockMs)
    await bump('rl/global', LIMITS.global, LIMITS.globalLockMs)
  }
  const clearFailures = (ip) => store.delete(ipKey(ip))

  // ── sessions ──
  async function createSession({ mustChange, epoch }) {
    const sid = randomId(24)
    const t = now()
    const rec = { sid, csrf: randomId(24), created: t, lastSeen: t, epoch, mustChange: !!mustChange }
    await store.setJSON(`sessions/${sid}`, rec)
    return rec
  }

  const isLocalHttp = (req) => {
    const u = new URL(req.url)
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  }
  function readCookie(req) {
    // The plain "rps_session" name exists only for http://localhost development.
    const want = isLocalHttp(req) ? 'rps_session' : '__Host-rps_session'
    const raw = req.headers.get('cookie') || ''
    for (const part of raw.split(/;\s*/)) {
      const i = part.indexOf('=')
      if (part.slice(0, i) === want) return part.slice(i + 1)
    }
    return ''
  }

  /** The signed-in session for this request, or null. */
  async function getSession(req) {
    if (!configured) return null
    const value = readCookie(req)
    const dot = value.lastIndexOf('.')
    if (dot < 1) return null
    const sid = value.slice(0, dot)
    if (!/^[\w-]{20,64}$/.test(sid) || !safeEqual(value.slice(dot + 1), sign(sid))) return null
    const rec = await store.getJSON(`sessions/${sid}`)
    if (!rec) return null
    const t = now()
    const pw = await getPassword()
    const epoch = pw?.epoch || 0
    if (t - rec.created > SESSION.maxMs || t - rec.lastSeen > SESSION.idleMs || rec.epoch !== epoch) {
      await store.delete(`sessions/${sid}`)
      return null
    }
    if (t - rec.lastSeen > SESSION.touchMs) {
      rec.lastSeen = t
      await store.setJSON(`sessions/${sid}`, rec)
    }
    return { ...rec, expiresAt: Math.min(rec.created + SESSION.maxMs, rec.lastSeen + SESSION.idleMs) }
  }

  function cookieHeader(req, sid, maxAgeSec) {
    // Secure cookies everywhere except plain-http localhost during development.
    const local = isLocalHttp(req)
    const name = local ? 'rps_session' : '__Host-rps_session'
    const value = sid ? `${sid}.${sign(sid)}` : ''
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${local ? '' : '; Secure'}`
  }

  async function login(req, password, ip) {
    if (!configured) return { status: 503, error: 'The dashboard isn’t set up yet. Ask your website developer to finish the setup.' }
    const lock = await lockState(ip)
    if (lock.locked) {
      const mins = Math.max(1, Math.ceil(lock.retryMs / 60e3))
      return { status: 429, error: `Too many attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`, retryAfter: Math.ceil(lock.retryMs / 1000) }
    }
    const pw = await getPassword()
    let ok = false
    let mustChange = false
    if (pw) ok = await verifyPassword(password, pw)
    const initial = env.ADMIN_INITIAL_PASSWORD || ''
    const resetAllowed = !pw || env.ADMIN_PASSWORD_RESET === 'yes'
    if (!ok && resetAllowed && initial.length >= 12 && typeof password === 'string' && safeEqual(password, initial)) {
      ok = true
      mustChange = true
    }
    if (!ok) {
      await recordFailure(ip)
      return { status: 401, error: 'That password isn’t right. Please try again.' }
    }
    await clearFailures(ip)
    await pruneStale().catch(() => {})
    const s = await createSession({ mustChange, epoch: pw?.epoch || 0 })
    return { status: 200, session: s, cookie: cookieHeader(req, s.sid, Math.round(SESSION.maxMs / 1000)) }
  }

  /**
   * Tidy-up on each successful sign-in, so storage never grows without limit:
   * removes expired sessions and finished wrong-password records.
   */
  async function pruneStale(maxDeletes = 200) {
    const t = now()
    let deleted = 0
    for (const k of await store.list('sessions/')) {
      if (deleted >= maxDeletes) return
      const rec = await store.getJSON(k)
      if (!rec || t - rec.created > SESSION.maxMs || t - rec.lastSeen > SESSION.idleMs) {
        await store.delete(k)
        deleted++
      }
    }
    for (const k of await store.list('rl/')) {
      if (deleted >= maxDeletes) return
      const rec = await store.getJSON(k)
      const active = rec && ((rec.lockedUntil || 0) > t || (rec.fails || []).some((x) => t - x < LIMITS.windowMs))
      if (!active) {
        await store.delete(k)
        deleted++
      }
    }
  }

  async function logout(req, session) {
    if (session) await store.delete(`sessions/${session.sid}`)
    return cookieHeader(req, '', 0)
  }

  /** Change password; ends every session and starts a fresh one for this device. */
  async function changePassword(req, session, current, next) {
    const pw = await getPassword()
    if (!session.mustChange) {
      if (!pw || !(await verifyPassword(current, pw))) return { status: 400, error: 'Your current password isn’t right.' }
    }
    const problem = passwordProblem(next, { initial: env.ADMIN_INITIAL_PASSWORD })
    if (problem) return { status: 400, error: problem }
    const epoch = (pw?.epoch || 0) + 1
    await store.setJSON('password', { ...(await hashPassword(next)), epoch, changedAt: new Date(now()).toISOString() })
    for (const k of await store.list('sessions/')) await store.delete(k)
    const s = await createSession({ mustChange: false, epoch })
    return { status: 200, session: s, cookie: cookieHeader(req, s.sid, Math.round(SESSION.maxMs / 1000)) }
  }

  /** Same-origin + CSRF token check for anything that changes data. */
  function checkCsrf(req, session) {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin) return false
    const site = req.headers.get('sec-fetch-site')
    if (site && !['same-origin', 'none'].includes(site)) return false
    return !!session && safeEqual(req.headers.get('x-csrf-token') || '', session.csrf)
  }
  function sameOrigin(req) {
    const origin = req.headers.get('origin')
    return !origin || origin === new URL(req.url).origin
  }

  return { configured, login, logout, getSession, changePassword, checkCsrf, sameOrigin }
}
