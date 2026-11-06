import { useState } from 'react'
import { useDoc } from '../App.jsx'
import { slug } from '../../content/schema.js'
import { Button, Field, IconButton, Modal, useUI } from '../ui.jsx'
import { moveItem, SortableList } from './Gallery.jsx'

// The six chip colours used on the website, from palest to darkest.
const TONES = [
  { tone: '#f5efe2', ink: '#151310' },
  { tone: '#ecdcb2', ink: '#151310' },
  { tone: '#d9b866', ink: '#151310' },
  { tone: '#b08a36', ink: '#151310' },
  { tone: '#3a342b', ink: '#ffffff' },
  { tone: '#151310', ink: '#ffffff' },
]

function ServiceForm({ initial, onClose, onSave, isNew }) {
  const [s, setS] = useState(() => ({ ...initial, includes: [...(initial.includes || []), '', '', ''].slice(0, Math.max(3, (initial.includes || []).length + 1)) }))
  const ok = s.title.trim()
  return (
    <Modal
      title={isNew ? 'Add a service' : 'Edit service'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon="check" disabled={!ok} onClick={() => onSave({ ...s, includes: s.includes.map((x) => x.trim()).filter(Boolean).slice(0, 6) })}>
            Save service
          </Button>
        </>
      }
    >
      <div className="a-form">
        <Field label="Service name" value={s.title} onChange={(v) => setS({ ...s, title: v })} max={48} />
        <Field label="Description" value={s.summary} onChange={(v) => setS({ ...s, summary: v })} max={160} multiline rows={2} />
        <div className="a-field">
          <div className="a-field-top">
            <span className="a-label">What’s included (up to 6)</span>
          </div>
          {s.includes.map((x, i) => (
            <input
              key={i}
              aria-label={`Included item ${i + 1}`}
              value={x}
              maxLength={40}
              onChange={(e) => {
                const inc = [...s.includes]
                inc[i] = e.target.value
                if (i === inc.length - 1 && e.target.value && inc.length < 6) inc.push('')
                setS({ ...s, includes: inc })
              }}
              className="a-input-stack"
            />
          ))}
        </div>
        <div className="a-field">
          <div className="a-field-top">
            <span className="a-label">Colour</span>
          </div>
          <div className="a-swatches" role="radiogroup" aria-label="Colour">
            {TONES.map((t, i) => (
              <button
                key={t.tone}
                type="button"
                role="radio"
                aria-checked={s.tone === t.tone}
                aria-label={`Colour ${i + 1}`}
                style={{ background: t.tone, color: t.ink }}
                onClick={() => setS({ ...s, ...t })}
              >
                Aa
              </button>
            ))}
          </div>
        </div>
        <div className="a-svc-preview" style={{ background: s.tone, color: s.ink }}>
          <strong>{s.title || 'Service name'}</strong>
          <span>{s.summary}</span>
        </div>
      </div>
    </Modal>
  )
}

export default function Services() {
  const { doc, save } = useDoc()
  const { confirm, toast } = useUI()
  const [editing, setEditing] = useState(null)

  const upsert = async (s, isNew) => {
    await save((d) => {
      if (isNew) {
        let id = slug(s.title, 'service')
        for (let i = 2; d.services.some((x) => x.id === id); i++) id = `${slug(s.title, 'service')}-${i}`
        d.services.push({ ...s, id, enabled: true })
      } else d.services = d.services.map((x) => (x.id === s.id ? s : x))
    }, `${isNew ? 'Added' : 'Edited'} service “${s.title}”`)
    setEditing(null)
    toast('Service saved')
  }

  return (
    <>
      <header className="a-pagehead a-pagehead-row">
        <div>
          <h1>Services</h1>
          <p className="a-muted">The paint-chip list of services on your website. Switch off any you no longer offer.</p>
        </div>
        <Button icon="plus" disabled={doc.services.length >= 16} onClick={() => setEditing({ isNew: true, s: { title: '', summary: '', includes: [], ...TONES[0], enabled: true } })}>
          Add a service
        </Button>
      </header>
      <section className="a-panel">
        <SortableList
          items={doc.services}
          keyOf={(s) => s.id}
          onMove={(from, to) => save((d) => (d.services = moveItem(d.services, from, to)), 'Reordered services')}
          render={(s) => (
            <div className={`a-rowitem ${s.enabled ? '' : 'is-off'}`}>
              <span className="a-chip" style={{ background: s.tone, color: s.ink }} aria-hidden="true">
                Aa
              </span>
              <div className="a-rowitem-text">
                <strong>{s.title}</strong>
                <small>{s.enabled ? s.summary : 'Switched off — not shown on your website'}</small>
              </div>
              <div className="a-rowitem-actions">
                <label className="a-switch">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => {
                      const on = e.target.checked // read now: the save runs a moment later
                      save((d) => (d.services.find((x) => x.id === s.id).enabled = on), `${on ? 'Switched on' : 'Switched off'} “${s.title}”`)
                    }}
                  />
                  <span>{s.enabled ? 'Shown' : 'Off'}</span>
                </label>
                <Button variant="ghost" icon="edit" onClick={() => setEditing({ s })}>
                  Edit
                </Button>
                <IconButton
                  icon="trash"
                  label={`Delete ${s.title}`}
                  onClick={async () => {
                    if (await confirm({ title: `Delete “${s.title}”?`, text: 'If you might offer it again, switch it off instead.', ok: 'Delete', danger: true }))
                      save((d) => (d.services = d.services.filter((x) => x.id !== s.id)), `Deleted service “${s.title}”`)
                  }}
                />
              </div>
            </div>
          )}
        />
      </section>
      {editing && <ServiceForm initial={editing.s} isNew={editing.isNew} onClose={() => setEditing(null)} onSave={(s) => upsert(s, editing.isNew)} />}
    </>
  )
}
