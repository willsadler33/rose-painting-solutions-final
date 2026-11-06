import { useState } from 'react'
import { useDoc } from '../App.jsx'
import { cleanEmail, cleanUrl, DAY_NAMES, formatHours, telHref } from '../../content/schema.js'
import { Button, Field, Select, useUI } from '../ui.jsx'

const TIMES = Array.from({ length: 49 }, (_, i) => i / 2).map((h) => {
  const hh = Math.floor(h)
  const label = `${hh % 12 === 0 ? 12 : hh % 12}:${h % 1 ? '30' : '00'} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`
  return { value: String(h), label: h === 24 ? 'Midnight' : label }
})
const SOCIAL = [
  ['facebook', 'Facebook page'],
  ['instagram', 'Instagram'],
  ['google', 'Google Business profile'],
  ['nextdoor', 'Nextdoor'],
  ['yelp', 'Yelp'],
  ['website', 'Other website'],
]

export default function Business() {
  const { doc, save } = useDoc()
  const { toast } = useUI()
  const [b, setB] = useState(() => structuredClone(doc.business))
  const [busy, setBusy] = useState(false)
  const h = b.hours
  const hoursText = formatHours(h)
  const errors = {
    name: !b.name.trim() && 'Enter your business name.',
    phone: !telHref(b.phoneDisplay) && 'Enter a phone number, e.g. (330) 614-0776.',
    email: b.email && !cleanEmail(b.email) && 'That email address doesn’t look right.',
    hours: h.closeHour <= h.openHour && 'Closing time must be after opening time.',
    ...Object.fromEntries(SOCIAL.map(([k]) => [k, b.social?.[k] && !cleanUrl(b.social[k]) && 'Paste the full link, starting with https://'])),
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const dirty = JSON.stringify(b) !== JSON.stringify(doc.business)
  const setHours = (patch) => setB({ ...b, hours: { ...h, ...patch } })

  const onSave = async () => {
    setBusy(true)
    try {
      await save((d) => (d.business = { ...d.business, ...b }), 'Updated business settings')
      toast('Business settings saved. Publish to show them on your website.')
    } catch {
      /* shown */
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="a-pagehead a-pagehead-row">
        <div>
          <h1>Business settings</h1>
          <p className="a-muted">Your contact details and opening hours, wherever they appear on the website.</p>
        </div>
        <Button icon="check" busy={busy} disabled={!dirty || hasErrors} onClick={onSave}>
          Save settings
        </Button>
      </header>

      <section className="a-panel">
        <h2>Contact details</h2>
        <div className="a-form a-form-2">
          <Field label="Business name" value={b.name} onChange={(v) => setB({ ...b, name: v })} max={80} error={errors.name} hint="The logo artwork itself doesn’t change." />
          <Field label="Phone number" value={b.phoneDisplay} onChange={(v) => setB({ ...b, phoneDisplay: v })} max={30} type="tel" inputMode="tel" error={errors.phone} hint="Shown on every “Call” button." />
          <Field
            label="Email address (optional)"
            value={b.email}
            onChange={(v) => setB({ ...b, email: v })}
            max={120}
            type="email"
            inputMode="email"
            error={errors.email}
            hint="Shown on the website. Enquiry-form messages are delivered separately and aren’t affected."
          />
          <Field label="Areas you cover (optional)" value={b.serviceArea} onChange={(v) => setB({ ...b, serviceArea: v })} max={160} placeholder="e.g. Akron, Canton and surrounding areas" />
          <Field label="About the business (optional)" value={b.description} onChange={(v) => setB({ ...b, description: v })} max={400} multiline hint="A short description, kept with your settings." />
          <Field label="Note for customers (optional)" value={b.instructions} onChange={(v) => setB({ ...b, instructions: v })} max={300} multiline placeholder="e.g. Please include photos of the room when you send an enquiry." hint="Shown in the contact section." />
        </div>
      </section>

      <section className="a-panel">
        <h2>Opening hours</h2>
        <div className="a-field">
          <span className="a-label">Open on</span>
          <div className="a-days" role="group" aria-label="Open on">
            {DAY_NAMES.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={h.openDays.includes(i)}
                onClick={() => setHours({ openDays: h.openDays.includes(i) ? h.openDays.filter((x) => x !== i) : [...h.openDays, i].sort() })}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        <div className="a-form a-form-2">
          <Select label="Opens at" value={String(h.openHour)} onChange={(v) => setHours({ openHour: Number(v) })} options={TIMES.slice(0, 48)} />
          <Select label="Closes at" value={String(h.closeHour)} onChange={(v) => setHours({ closeHour: Number(v) })} options={TIMES.slice(1)} />
        </div>
        {errors.hours ? (
          <p className="a-error">{errors.hours}</p>
        ) : (
          <p className="a-hint">
            Your website will say: <strong>{hoursText.days}, {hoursText.time}</strong>
            {hoursText.closed && <> and “Closed” for {hoursText.closed}</>}.
          </p>
        )}
      </section>

      <section className="a-panel">
        <h2>Social media (optional)</h2>
        <p className="a-muted">Links appear in the footer of your website. Leave blank to hide.</p>
        <div className="a-form a-form-2">
          {SOCIAL.map(([k, label]) => (
            <Field key={k} label={label} value={b.social?.[k] || ''} onChange={(v) => setB({ ...b, social: { ...b.social, [k]: v } })} max={300} type="url" inputMode="url" placeholder="https://" error={errors[k]} />
          ))}
        </div>
      </section>
      <div className="a-stickysave">
        <Button icon="check" busy={busy} disabled={!dirty || hasErrors} onClick={onSave}>
          Save settings
        </Button>
      </div>
    </>
  )
}
