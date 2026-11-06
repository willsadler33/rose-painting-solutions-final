import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ── icons (simple strokes, currentColor) ─────────────────────
const P = {
  home: 'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
  photo: 'M4 6h16v13H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5h.01',
  compare: 'M12 3v18M4 6h5v12H4zM15 6h5v12h-5z',
  text: 'M5 6h14M5 11h14M5 16h9',
  brush: 'M14 4l6 6-8 8-6-6zM6 12l-2 2c-1 1-1 3 0 4l2-2M10 16l-4 4',
  store: 'M4 9h16l-1-4H5zM5 9v10h14V9M9 19v-5h6v5',
  library: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 7.6C3.9 9.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  restore: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  crop: 'M6 2v16h16M2 6h16v16',
  target: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  phone: 'M7 3h10v18H7zM11 18h2',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
}
export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`ic ${className}`} aria-hidden="true">
      <path d={P[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── buttons ──────────────────────────────────────────────────
export function Button({ variant = 'primary', icon, children, busy, className = '', ...rest }) {
  return (
    <button type="button" className={`a-btn a-btn-${variant} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? <span className="a-spin" aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  )
}
export function IconButton({ icon, label, className = '', ...rest }) {
  return (
    <button type="button" className={`a-iconbtn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

// ── status tape (same painter's tape as the website) ────────
const STATUS = {
  live: { label: 'Live', cls: 'is-live', tip: 'Shown on your website' },
  draft: { label: 'Draft', cls: 'is-draft', tip: 'Not on your website yet' },
  hidden: { label: 'Hidden', cls: 'is-hidden', tip: 'Taken off your website, kept here' },
}
export function Tape({ status }) {
  const s = STATUS[status] || STATUS.draft
  return (
    <span className={`a-tape ${s.cls}`} title={s.tip}>
      {s.label}
    </span>
  )
}
export function StatusPicker({ value, onChange, label = 'Show on website' }) {
  return (
    <div role="radiogroup" aria-label={label} className="a-seg">
      {['live', 'draft', 'hidden'].map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)} title={STATUS[s].tip}>
          {STATUS[s].label}
        </button>
      ))}
    </div>
  )
}

// ── form fields ──────────────────────────────────────────────
export function Field({ label, hint, value, onChange, max, multiline, rows = 3, placeholder, type = 'text', inputMode, autoComplete, error }) {
  const id = useId()
  const len = (value || '').length
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div className={`a-field ${error ? 'has-error' : ''}`}>
      <div className="a-field-top">
        <label htmlFor={id}>{label}</label>
        {max && (
          <span className={`a-count ${len > max * 0.9 ? 'is-near' : ''}`} aria-live="polite">
            {len}/{max}
          </span>
        )}
      </div>
      <Tag
        id={id}
        value={value || ''}
        onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
        maxLength={max}
        rows={multiline ? rows : undefined}
        type={multiline ? undefined : type}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-describedby={hint || error ? `${id}-h` : undefined}
        aria-invalid={error ? true : undefined}
      />
      {(hint || error) && (
        <p id={`${id}-h`} className="a-hint">
          {error || hint}
        </p>
      )}
    </div>
  )
}
export function Select({ label, value, onChange, options, hint }) {
  const id = useId()
  return (
    <div className="a-field">
      <div className="a-field-top">
        <label htmlFor={id}>{label}</label>
      </div>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="a-hint">{hint}</p>}
    </div>
  )
}

// ── modal ────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const first = ref.current?.querySelector('input, textarea, select, button:not(.a-modal-x)')
    ;(first || ref.current)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = [...ref.current.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')].filter((x) => !x.disabled)
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus())
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus())
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('a-noscroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('a-noscroll')
      prev?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return createPortal(
    <div className="a-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`a-modal ${wide ? 'is-wide' : ''}`} tabIndex={-1}>
        <header className="a-modal-head">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} className="a-modal-x" />
        </header>
        <div className="a-modal-body">{children}</div>
        {footer && <footer className="a-modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// ── confirm + toasts (one provider) ──────────────────────────
const UICtx = createContext(null)
export const useUI = () => useContext(UICtx)
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirm] = useState(null)
  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirm({ ...opts, resolve })),
    [],
  )
  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="a-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`a-toast is-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'error' ? 'close' : 'check'} />
            {t.text}
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal
          title={confirmState.title}
          onClose={() => (confirmState.resolve(false), setConfirm(null))}
          footer={
            <>
              <Button variant="ghost" onClick={() => (confirmState.resolve(false), setConfirm(null))}>
                {confirmState.cancel || 'Cancel'}
              </Button>
              <Button variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => (confirmState.resolve(true), setConfirm(null))}>
                {confirmState.ok || 'OK'}
              </Button>
            </>
          }
        >
          <p className="a-confirm-text">{confirmState.text}</p>
        </Modal>
      )}
    </UICtx.Provider>
  )
}

export function Progress({ value, label }) {
  return (
    <div className="a-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="a-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export const timeAgo = (iso) => {
  if (!iso) return ''
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.round(s / 86400)} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
