import { useState } from 'react'
import { api } from './api.js'
import { BrushMark } from '../components/Logo.jsx'
import { Button, Icon } from './ui.jsx'

function PasswordInput({ id, value, onChange, autoComplete, label }) {
  const [show, setShow] = useState(false)
  return (
    <div className="a-field">
      <div className="a-field-top">
        <label htmlFor={id}>{label}</label>
      </div>
      <div className="a-pw">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </div>
    </div>
  )
}

export default function Login({ onIn, expired, initialError }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(initialError || '')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('login', { method: 'POST', body: { password: pw } })
      onIn(r.mustChangePassword)
    } catch (err) {
      setError(err.message)
      setPw('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="a-auth">
      <form className="a-auth-card" onSubmit={submit}>
        <BrushMark size={52} />
        <h1>Website manager</h1>
        <p className="a-muted">Sign in to update the photos, projects and text on your website.</p>
        {expired && !error && <p className="a-note">You were signed out to keep your account safe. Please sign in again.</p>}
        {/* A hidden username lets password managers save the login. */}
        <input type="text" name="username" autoComplete="username" value="Rose Painting owner" readOnly hidden />
        <PasswordInput id="pw" label="Password" value={pw} onChange={setPw} autoComplete="current-password" />
        {error && (
          <p className="a-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy} className="a-btn-block" disabled={!pw}>
          Sign in
        </Button>
        <p className="a-muted a-small">Forgot your password? Ask your website developer to reset it.</p>
      </form>
    </div>
  )
}

export function ChoosePassword({ onDone }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (a !== b) return setError('The two passwords don’t match.')
    setBusy(true)
    setError('')
    try {
      await api('password', { method: 'POST', body: { next: a } })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="a-auth">
      <form className="a-auth-card" onSubmit={submit}>
        <BrushMark size={52} />
        <h1>Choose your password</h1>
        <p className="a-muted">This replaces the temporary password you were given. Use at least 10 characters — a short sentence is easy to remember and hard to guess.</p>
        <input type="text" name="username" autoComplete="username" value="Rose Painting owner" readOnly hidden />
        <PasswordInput id="np" label="New password" value={a} onChange={setA} autoComplete="new-password" />
        <PasswordInput id="np2" label="Type it again" value={b} onChange={setB} autoComplete="new-password" />
        {error && (
          <p className="a-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy} className="a-btn-block" disabled={!a || !b}>
          Save password
        </Button>
      </form>
    </div>
  )
}
