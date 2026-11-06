import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, setCsrf, whenSignedOut } from './api.js'
import { BrushMark } from '../components/Logo.jsx'
import { Button, Icon, useUI } from './ui.jsx'
import Login, { ChoosePassword } from './Login.jsx'
import Overview from './pages/Overview.jsx'
import Gallery from './pages/Gallery.jsx'
import Projects from './pages/Projects.jsx'
import Content from './pages/Content.jsx'
import Services from './pages/Services.jsx'
import Business from './pages/Business.jsx'
import Library from './pages/Library.jsx'
import Account from './pages/Account.jsx'

// ── the working copy (draft) shared by every page ───────────
const DocCtx = createContext(null)
export const useDoc = () => useContext(DocCtx)

export const NAV = [
  { path: '', label: 'Overview', icon: 'home' },
  { path: 'projects', label: 'Before & after', icon: 'compare' },
  { path: 'gallery', label: 'Photo gallery', icon: 'photo' },
  { path: 'content', label: 'Website text', icon: 'text' },
  { path: 'services', label: 'Services', icon: 'brush' },
  { path: 'business', label: 'Business settings', icon: 'store' },
  { path: 'library', label: 'Media library', icon: 'library' },
  { path: 'account', label: 'Account & security', icon: 'lock' },
]
const TABS = ['', 'projects', 'gallery', 'content']

function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '')
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
export const go = (path) => (location.hash = `#/${path}`)

export default function App() {
  const [auth, setAuth] = useState({ state: 'checking' })
  const { toast } = useUI()

  useEffect(() => {
    whenSignedOut(() => setAuth({ state: 'out', expired: true }))
    api('session')
      .then((s) => setAuth(s.authenticated ? { state: s.mustChangePassword ? 'change' : 'in' } : { state: 'out' }))
      .catch((e) => setAuth({ state: 'out', error: e.message }))
  }, [])

  let screen
  if (auth.state === 'checking') screen = <div className="a-splash"><BrushMark size={56} /></div>
  else if (auth.state === 'out') screen = <Login expired={auth.expired} initialError={auth.error} onIn={(must) => setAuth({ state: must ? 'change' : 'in' })} />
  else if (auth.state === 'change') screen = <ChoosePassword onDone={() => (toast('Password saved. Welcome!'), setAuth({ state: 'in' }))} />
  else screen = <Dashboard onSignOut={() => setAuth({ state: 'out' })} />
  return (
    <>
      <TestCopyBanner />
      {screen}
    </>
  )
}

/** On Deploy Previews the dashboard works on a separate test copy — say so plainly. */
function TestCopyBanner() {
  const [env, setEnv] = useState('')
  const ref = useRef(null)
  // Sticky headers and the sidebar sit below the notice (see --a-banner in admin.css).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--a-banner', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => (ro.disconnect(), root.style.removeProperty('--a-banner'))
  }, [env])
  useEffect(() => {
    fetch('/api/health', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((h) => setEnv(h.dataEnv || ''))
      .catch(() => {})
  }, [])
  if (env !== 'preview') return null
  return (
    <div className="a-testcopy" role="status" ref={ref}>
      <strong>Test copy.</strong> This is a preview of the website manager. Changes here don’t affect your live website, and it has its own password.
    </div>
  )
}

function Dashboard({ onSignOut }) {
  const route = useRoute()
  const { toast } = useUI()
  const [state, setState] = useState(null) // { doc, hasUnpublished, publishedAt }
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const docRef = useRef(null)
  const queue = useRef(Promise.resolve())

  const load = useCallback(async () => {
    try {
      const r = await api('draft')
      docRef.current = r.doc
      setState({ doc: r.doc, hasUnpublished: r.hasUnpublished, publishedAt: r.publishedAt })
      setLoadError('')
    } catch (e) {
      setLoadError(e.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  /**
   * Change the draft. `mutate` edits a copy; `what` describes it for "Recent changes".
   * Saves run one after another so quick edits never trip over each other.
   */
  const save = useCallback(
    (mutate, what) => {
      const run = async () => {
        const base = docRef.current
        const next = structuredClone(base)
        mutate(next)
        if (what) next.activity = [{ at: new Date().toISOString(), what }, ...(next.activity || [])].slice(0, 60)
        setSaving(true)
        try {
          const r = await api('draft', { method: 'PUT', body: { doc: next, baseRev: base.rev } })
          docRef.current = r.doc
          setState((s) => ({ ...s, doc: r.doc, hasUnpublished: true }))
          return r.doc
        } catch (e) {
          if (e.status === 409) {
            toast('These changes were also being edited elsewhere. Loading the latest version…', 'error')
            await load()
          } else toast(e.message, 'error')
          throw e
        } finally {
          setSaving(false)
        }
      }
      const p = queue.current.then(run, run)
      queue.current = p.catch(() => {})
      return p
    },
    [load, toast],
  )

  const publish = useCallback(async () => {
    setPublishing(true)
    try {
      await queue.current
      const r = await api('publish', { method: 'POST', body: {} })
      toast('Published. Your website will show the changes within a minute.')
      await load()
      return r
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setPublishing(false)
    }
  }, [load, toast])

  const signOut = async () => {
    try {
      await api('logout', { method: 'POST', body: {} })
    } catch {
      /* ignore */
    }
    setCsrf('')
    onSignOut()
  }

  if (loadError)
    return (
      <div className="a-splash">
        <p>{loadError}</p>
        <Button onClick={load}>Try again</Button>
      </div>
    )
  if (!state) return <div className="a-splash"><BrushMark size={56} /></div>

  const [section, ...rest] = route.split('/')
  const page = {
    '': <Overview />,
    projects: <Projects sub={rest} />,
    gallery: <Gallery />,
    content: <Content />,
    services: <Services />,
    business: <Business />,
    library: <Library sub={rest} />,
    account: <Account onSignOut={signOut} />,
  }[section] ?? <Overview />

  return (
    <DocCtx.Provider value={{ ...state, save, publish, publishing, saving, reload: load }}>
      <div className="a-shell">
        <aside className="a-side">
          <a href="#/" className="a-brand">
            <BrushMark tone="dark" size={36} />
            <span>
              <strong>Rose</strong>
              <small>Website manager</small>
            </span>
          </a>
          <nav aria-label="Dashboard">
            {NAV.map((n) => (
              <a key={n.path} href={`#/${n.path}`} aria-current={section === n.path ? 'page' : undefined}>
                <Icon name={n.icon} />
                {n.label}
              </a>
            ))}
          </nav>
          <div className="a-side-foot">
            <a href="/" target="_blank" rel="noopener">
              <Icon name="external" /> View website
            </a>
            <button type="button" onClick={signOut}>
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </aside>

        <div className="a-main">
          <header className="a-top">
            <a href="#/" className="a-brand a-brand-sm">
              <BrushMark size={30} />
              <strong>Rose</strong>
            </a>
            <span className="a-saving" aria-live="polite">
              {saving ? 'Saving…' : 'All changes saved'}
            </span>
          </header>

          <PublishBar />
          <main className="a-page" id="main">
            {page}
          </main>
        </div>

        <nav className="a-tabs" aria-label="Dashboard">
          {NAV.filter((n) => TABS.includes(n.path)).map((n) => (
            <a key={n.path} href={`#/${n.path}`} aria-current={section === n.path ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.path === '' ? 'Home' : n.path === 'projects' ? 'Projects' : n.path === 'gallery' ? 'Gallery' : 'Text'}</span>
            </a>
          ))}
          <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}>
            <Icon name="menu" />
            <span>More</span>
          </button>
        </nav>
        {menuOpen && (
          <div className="a-sheet-back" onClick={() => setMenuOpen(false)}>
            <div className="a-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
              {NAV.filter((n) => !TABS.includes(n.path)).map((n) => (
                <a key={n.path} href={`#/${n.path}`} onClick={() => setMenuOpen(false)}>
                  <Icon name={n.icon} />
                  {n.label}
                </a>
              ))}
              <a href="/" target="_blank" rel="noopener">
                <Icon name="external" /> View website
              </a>
              <button type="button" onClick={signOut}>
                <Icon name="logout" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </DocCtx.Provider>
  )
}

function PublishBar() {
  const { hasUnpublished, publish, publishing, publishedAt } = useDoc()
  const { confirm } = useUI()
  if (!hasUnpublished)
    return (
      <div className="a-pubbar is-clean" role="status">
        <Icon name="check" /> Your website is up to date.
        {publishedAt && <span className="a-muted a-hide-sm">Last published {new Date(publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
      </div>
    )
  return (
    <div className="a-pubbar" role="region" aria-label="Unpublished changes">
      <span className="a-pubbar-text">
        <strong>Unpublished changes.</strong> <span className="a-hide-sm">Visitors still see the previous version.</span>
      </span>
      <span className="a-pubbar-actions">
        <a className="a-btn a-btn-ghost a-btn-sm" href="/?preview" target="_blank" rel="noopener">
          <Icon name="eye" />
          <span>Preview</span>
        </a>
        <Button
          className="a-btn-sm"
          icon="upload"
          busy={publishing}
          onClick={async () => {
            if (await confirm({ title: 'Publish your changes?', text: 'Everything you’ve changed since the last publish will appear on your website.', ok: 'Publish' })) publish()
          }}
        >
          Publish
        </Button>
      </span>
    </div>
  )
}
