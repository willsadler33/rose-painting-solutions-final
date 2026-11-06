import { useEffect, useId, useRef, useState } from 'react'
import { business } from '../data/site.js'

/*
  Security notes
  - All input is validated and length-limited here AND must be re-validated by
    the receiving service; client checks are for usability, not trust.
  - Spam: a hidden honeypot field plus a very short minimum fill time (1.2s,
    low enough that fast autofill + paste still sends). Bots that trip
    either get a normal-looking success message and nothing is sent.
  - The endpoint must be https. Nothing secret lives in the browser bundle.
  - React escapes everything we render, so user text is never treated as HTML.
*/

const ENDPOINT = (import.meta.env.VITE_FORM_ENDPOINT || '').trim()
const LIMITS = { name: 80, phone: 30, email: 120, message: 2000 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^[+()\-.\s\d]{7,30}$/

function validEndpoint(url) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function validate(v) {
  const e = {}
  if (!v.name.trim()) e.name = 'Enter your name so we know who to ask for.'
  if (!v.phone.trim() && !v.email.trim()) e.phone = 'Add a phone number or an email so we can reply.'
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) e.phone = 'Enter a phone number using digits, e.g. (330) 555-0123.'
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = 'Enter an email address like name@example.com.'
  if (v.message.trim().length < 10) e.message = 'Tell us a little about the room — at least a sentence.'
  return e
}

export default function ContactForm() {
  const uid = useId()
  const [values, setValues] = useState({ name: '', phone: '', email: '', message: '', hp_x7: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent | error | offline
  const startedAt = useRef(0) // set on first keystroke
  const formRef = useRef(null)
  const statusRef = useRef(null)

  useEffect(() => {
    if (status !== 'idle' && status !== 'sending') statusRef.current?.focus()
  }, [status])

  const set = (k) => (e) => {
    if (!startedAt.current) startedAt.current = Date.now()
    const value = e.target.value.slice(0, LIMITS[k] ?? 200)
    setValues((v) => ({ ...v, [k]: value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (status === 'sending') return
    const errs = validate(values)
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = formRef.current?.querySelector(`[name="${Object.keys(errs)[0]}"]`)
      first?.focus()
      return
    }

    // Spam traps: pretend success, send nothing.
    if (values.hp_x7 || (startedAt.current && Date.now() - startedAt.current < 1200)) {
      setStatus('sent')
      return
    }
    if (!validEndpoint(ENDPOINT)) {
      setStatus('offline')
      return
    }

    setStatus('sending')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: controller.signal,
        body: JSON.stringify({
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          message: values.message.trim(),
          _subject: `New painting enquiry from ${values.name.trim()}`,
        }),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    } finally {
      clearTimeout(timer)
    }
  }

  if (status === 'sent') {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="flex min-h-[28rem] flex-col justify-center text-center outline-none">
        <svg className="mx-auto" width="64" height="56" viewBox="0 0 30 26" aria-hidden="true">
          <path d="M3 14.5c2.6 1.2 5 3.6 7 7.4C14 13 19.5 6.6 27 3" fill="none" stroke="#B08A36" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 className="t-h3 mt-6 text-ink">Enquiry sent. Thank you{values.name ? `, ${values.name.trim().split(' ')[0]}` : ''}.</h3>
        <p className="mx-auto mt-3 max-w-sm text-ink-soft">
          We reply during business hours, {business.hours.days}, {business.hours.time}. For anything urgent, call{' '}
          <a className="font-semibold text-cobalt underline underline-offset-4" href={business.phoneHref}>
            {business.phoneDisplay}
          </a>
          .
        </p>
      </div>
    )
  }

  const field = (k, label, props = {}) => {
    const id = `${uid}-${k}`
    const err = errors[k]
    const Tag = props.as === 'textarea' ? 'textarea' : 'input'
    const { as, hint, ...rest } = props
    return (
      <div className={props.as === 'textarea' ? 'sm:col-span-2' : ''}>
        <label htmlFor={id} className="mb-2 block text-[0.95rem] font-semibold text-ink">
          {label}
          {hint && <span className="font-normal text-ink-soft"> {hint}</span>}
        </label>
        <Tag
          id={id}
          name={k}
          value={values[k]}
          onChange={set(k)}
          maxLength={LIMITS[k]}
          aria-invalid={err ? 'true' : undefined}
          aria-describedby={err ? `${id}-err` : undefined}
          className={`field ${Tag === 'textarea' ? 'min-h-[8.5rem] resize-y' : ''}`}
          {...rest}
        />
        {err && (
          <p id={`${id}-err`} className="mt-2 text-[0.9rem] font-medium text-[#b4233a]">
            {err}
          </p>
        )}
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="t-h3 text-ink">Request a free quote</h3>
        <p className="mt-2 text-ink-soft t-small">Tell us about the room. Add a phone number or email (or both).</p>
      </div>
      {field('name', 'Name', { autoComplete: 'name', required: true })}
      {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
      <div className="sm:col-span-2">{field('email', 'Email', { type: 'email', autoComplete: 'email' })}</div>
      {field('message', 'About your room', {
        as: 'textarea',
        rows: 4,
        placeholder: 'e.g. Living room and hallway, some scuffs and nail holes, thinking of a lighter colour.',
        required: true,
      })}

      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-hp`}>Leave this field empty</label>
        <input id={`${uid}-hp`} name="hp_x7" tabIndex={-1} autoComplete="new-password" value={values.hp_x7} onChange={set('hp_x7')} />
      </div>

      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary w-full" disabled={status === 'sending'} aria-busy={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send enquiry'}
        </button>
        <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
          {status === 'error' && (
            <p className="mt-4 rounded-[12px] bg-[#fff1f3] p-4 text-[0.95rem] text-[#8d1c2e]">
              Your enquiry didn’t send. Check your connection and try again, or call{' '}
              <a href={business.phoneHref} className="font-semibold underline">
                {business.phoneDisplay}
              </a>
              .
            </p>
          )}
          {status === 'offline' && (
            <p className="mt-4 rounded-[12px] bg-wash p-4 text-[0.95rem] text-ink">
              Online enquiries aren’t switched on yet. Please call{' '}
              <a href={business.phoneHref} className="font-semibold text-cobalt underline">
                {business.phoneDisplay}
              </a>{' '}
              — {business.hours.daysShort}, {business.hours.time}.
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-[0.85rem] text-ink-soft">
          We only use your details to reply to this enquiry.
        </p>
      </div>
    </form>
  )
}
