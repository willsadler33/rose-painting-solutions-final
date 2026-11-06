import { useEffect, useState } from 'react'
import { useDoc } from '../App.jsx'
import { api } from '../api.js'
import { Button, Empty, Field, useUI } from '../ui.jsx'

export default function Account({ onSignOut }) {
  const { reload, hasUnpublished } = useDoc()
  const { toast, confirm } = useUI()
  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')
  const [history, setHistory] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    api('history').then((r) => setHistory(r.items)).catch(() => setHistory([]))
    api('session').then(setSession).catch(() => {})
  }, [])

  const changePw = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pw.next !== pw.again) return setPwError('The two new passwords don’t match.')
    setPwBusy(true)
    try {
      await api('password', { method: 'POST', body: { current: pw.current, next: pw.next } })
      setPw({ current: '', next: '', again: '' })
      toast('Password changed. Any other devices have been signed out.')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <>
      <header className="a-pagehead">
        <h1>Account &amp; security</h1>
      </header>

      <section className="a-panel">
        <h2>Change your password</h2>
        <form className="a-form a-narrow" onSubmit={changePw}>
          <input type="text" name="username" autoComplete="username" value="Rose Painting owner" readOnly hidden />
          <Field label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} />
          <Field label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} hint="At least 10 characters. A short sentence works well." />
          <Field label="New password again" type="password" autoComplete="new-password" value={pw.again} onChange={(v) => setPw({ ...pw, again: v })} />
          {pwError && (
            <p className="a-error" role="alert">
              {pwError}
            </p>
          )}
          <Button type="submit" busy={pwBusy} disabled={!pw.current || !pw.next || !pw.again}>
            Change password
          </Button>
        </form>
      </section>

      <section className="a-panel">
        <h2>Signing in</h2>
        <p className="a-muted">
          For safety you’re signed out automatically after 3 days without using the dashboard, and every 2 weeks regardless.
          {session?.expiresAt && <> This device stays signed in until {new Date(session.expiresAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} unless you sign out.</>}
        </p>
        <Button variant="ghost" icon="logout" onClick={onSignOut}>
          Sign out of this device
        </Button>
      </section>

      <section className="a-panel">
        <h2>Earlier versions of your website</h2>
        <p className="a-muted">Every time you publish, the previous version is kept. Bring one back and it becomes your draft — check it, then publish.</p>
        {history === null ? (
          <p className="a-muted">Loading…</p>
        ) : history.length === 0 ? (
          <Empty title="No earlier versions yet">They appear here after you publish.</Empty>
        ) : (
          <ul className="a-binlist">
            {history.map((h) => (
              <li key={h.id}>
                <span>
                  <strong>{h.note === 'Original website' ? 'Original website' : new Date(h.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
                  <small className="a-muted">
                    {' '}
                    {h.photos} photos, {h.projects} projects
                  </small>
                </span>
                <Button
                  variant="ghost"
                  icon="restore"
                  onClick={async () => {
                    if (!(await confirm({ title: 'Bring back this version?', text: 'Your current draft will be replaced with this version. Nothing changes on your website until you publish.', ok: 'Bring it back' }))) return
                    try {
                      await api('restore', { method: 'POST', body: { id: h.id } })
                      await reload()
                      toast('Version restored as your draft. Preview it, then publish.')
                    } catch (e) {
                      toast(e.message, 'error')
                    }
                  }}
                >
                  Bring back
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="a-panel">
        <h2>Undo unpublished changes</h2>
        <p className="a-muted">Throw away everything you’ve changed since you last published, and go back to what’s on your website now.</p>
        <Button
          variant="danger-ghost"
          disabled={!hasUnpublished}
          onClick={async () => {
            if (!(await confirm({ title: 'Undo all unpublished changes?', text: 'This can’t be undone. Your website stays exactly as it is.', ok: 'Undo changes', danger: true }))) return
            try {
              await api('discard', { method: 'POST', body: {} })
              await reload()
              toast('Unpublished changes undone')
            } catch (e) {
              toast(e.message, 'error')
            }
          }}
        >
          Undo unpublished changes
        </Button>
      </section>
    </>
  )
}
