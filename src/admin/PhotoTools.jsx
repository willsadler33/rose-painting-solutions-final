import { useRef, useState } from 'react'
import { mediaSrc } from './api.js'
import { processAndUpload, titleFromFile } from './images.js'
import { Button, Empty, Icon, Modal, Progress, Tape } from './ui.jsx'

/** A new photo-library entry for a freshly uploaded photo. */
export function newMedia(up, fields = {}) {
  const now = new Date().toISOString()
  return {
    kind: 'upload',
    title: 'New photo',
    description: '',
    alt: '',
    project: '',
    category: '',
    focus: '50% 50%',
    edits: { rotate: 0, crop: null, brightness: 0, contrast: 0 },
    createdAt: now,
    updatedAt: now,
    ...up,
    ...fields,
  }
}

/** Where a photo appears: [{ kind: 'gallery'|'project', label, status }] */
export function usageOf(doc, id) {
  const out = []
  const g = doc.gallery.find((x) => x.media === id)
  if (g) out.push({ kind: 'gallery', label: 'Photo gallery', status: g.status })
  for (const p of doc.projects) {
    if (p.deletedAt) continue
    if (p.before.media === id) out.push({ kind: 'project', label: `${p.title} (before)`, status: p.status, id: p.id })
    if (p.after.media === id) out.push({ kind: 'project', label: `${p.title} (after)`, status: p.status, id: p.id })
  }
  return out
}

/**
 * Drop zone + file picker that optimises and uploads photos one by one,
 * with a progress bar and a plain-language error for each.
 * onUploaded(mediaEntry, file) is called for every photo that finishes.
 */
export function Uploader({ onUploaded, multiple = true, label = 'Add photos', hint, compact = false }) {
  const input = useRef(null)
  const [items, setItems] = useState([])
  const [over, setOver] = useState(false)

  const run = async (files) => {
    const list = [...files].slice(0, 30)
    const start = items.length
    setItems((it) => [...it, ...list.map((f) => ({ name: f.name, pct: 0, stage: 'Waiting', preview: URL.createObjectURL(f) }))])
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      const k = start + i
      const set = (patch) => setItems((it) => it.map((x, j) => (j === k ? { ...x, ...patch } : x)))
      try {
        const up = await processAndUpload(f, { onProgress: ({ stage, pct }) => set({ stage, pct }) })
        set({ stage: 'Uploaded', pct: 1, done: true })
        await onUploaded(newMedia(up, { title: titleFromFile(f.name) }), f)
      } catch (e) {
        set({ stage: e.message, error: true })
      }
    }
  }

  return (
    <div className={`a-upload ${compact ? 'is-compact' : ''}`}>
      <div
        className={`a-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (e.dataTransfer.files?.length) run(e.dataTransfer.files)
        }}
      >
        <Icon name="upload" size={28} />
        <p>
          <strong>{label}</strong>
          <span className="a-hide-sm"> — drag photos here, or</span>
        </p>
        <Button icon="photo" onClick={() => input.current?.click()}>
          Choose {multiple ? 'photos' : 'a photo'}
        </Button>
        {hint && <p className="a-hint">{hint}</p>}
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple={multiple}
          hidden
          onChange={(e) => {
            if (e.target.files?.length) run(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="a-uplist">
          {items.map((it, i) => (
            <li key={i} className={it.error ? 'is-error' : it.done ? 'is-done' : ''}>
              <img src={it.preview} alt="" />
              <div>
                <span className="a-upname">{it.name}</span>
                {!it.error && <Progress value={it.pct} label={`Uploading ${it.name}`} />}
                <span className="a-upstage" role={it.error ? 'alert' : undefined}>
                  {it.error ? it.stage : it.done ? 'Uploaded' : `${it.stage}…`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Pick an existing photo from the library. */
export function PhotoPicker({ doc, onPick, onClose, title = 'Choose a photo', exclude = [] }) {
  const [q, setQ] = useState('')
  const list = Object.values(doc.media)
    .filter((m) => !m.deletedAt && !exclude.includes(m.id))
    .filter((m) => !q || `${m.title} ${m.project} ${m.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="a-search">
        <Icon name="search" />
        <input type="search" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search photos" />
      </div>
      {list.length === 0 ? (
        <Empty title="No photos found">Try a different search, or upload a new photo.</Empty>
      ) : (
        <ul className="a-pickgrid">
          {list.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)}>
                <img src={mediaSrc(m, 'thumb')} alt="" loading="lazy" style={{ background: m.tone }} />
                <span>{m.title || 'Untitled photo'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/** Small thumbnail with title and status. */
export function PhotoThumb({ m, status }) {
  return (
    <span className="a-thumb">
      <img src={mediaSrc(m, 'thumb')} alt="" loading="lazy" style={{ background: m?.tone, objectPosition: m?.focus }} />
      {status && <Tape status={status} />}
    </span>
  )
}
