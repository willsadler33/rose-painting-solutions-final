import { useMemo, useRef, useState } from 'react'
import { go, useDoc } from '../App.jsx'
import { mediaSrc } from '../api.js'
import CompareSlider from '../../components/CompareSlider.jsx'
import { slug } from '../../content/schema.js'
import PhotoEditor from '../PhotoEditor.jsx'
import { PhotoPicker, Uploader } from '../PhotoTools.jsx'
import { Button, Empty, Field, Icon, IconButton, Select, StatusPicker, Tape, timeAgo, useUI } from '../ui.jsx'
import { moveItem, SortableList } from './Gallery.jsx'

const blankSlot = { media: '', focus: '50% 50%', focusM: '50% 50%', zoom: 1 }
const FRAMES = { desktop: { ratio: 16 / 9, css: '16 / 9', key: 'focus', label: 'Computer' }, phone: { ratio: 4 / 5, css: '4 / 5', key: 'focusM', label: 'Phone' } }

export default function Projects({ sub = [] }) {
  if (sub[0] === 'new') return <Builder key="new" />
  if (sub[0]) return <Builder key={sub[0]} id={sub[0]} />
  return <ProjectList />
}

function ProjectList() {
  const { doc, save } = useDoc()
  const { confirm, toast } = useUI()
  const live = doc.projects.filter((p) => !p.deletedAt)
  const bin = doc.projects.filter((p) => p.deletedAt)
  return (
    <>
      <header className="a-pagehead a-pagehead-row">
        <div>
          <h1>Before &amp; after</h1>
          <p className="a-muted">Each project shows on your website as a slider visitors can drag. Drag to change the order.</p>
        </div>
        <Button icon="plus" onClick={() => go('projects/new')}>
          Create before &amp; after
        </Button>
      </header>
      <section className="a-panel">
        {live.length === 0 ? (
          <Empty title="No projects yet" action={<Button icon="plus" onClick={() => go('projects/new')}>Create your first project</Button>}>
            Upload a before photo and an after photo of a job, and it becomes an interactive slider on your website.
          </Empty>
        ) : (
          <SortableList
            items={live}
            keyOf={(p) => p.id}
            onMove={(from, to) =>
              save((d) => {
                const visible = d.projects.filter((p) => !p.deletedAt)
                d.projects = [...moveItem(visible, from, to), ...d.projects.filter((p) => p.deletedAt)]
              }, 'Reordered before & after projects')
            }
            render={(p) => (
              <div className="a-rowitem">
                <span className="a-pairthumb" aria-hidden="true">
                  <img src={mediaSrc(doc.media[p.before.media], 'thumb')} alt="" />
                  <img src={mediaSrc(doc.media[p.after.media], 'thumb')} alt="" />
                  <Tape status={p.status} />
                </span>
                <div className="a-rowitem-text">
                  <strong>{p.title}</strong>
                  <small>{p.change || p.summary || `Updated ${timeAgo(p.updatedAt)}`}</small>
                  <StatusPicker
                    value={p.status}
                    onChange={(s) =>
                      save((d) => (d.projects.find((x) => x.id === p.id).status = s), `Set project “${p.title}” to ${s}`).then(() =>
                        toast(s === 'live' ? 'Will show on your website once published' : 'Saved'),
                      )
                    }
                  />
                </div>
                <div className="a-rowitem-actions">
                  <Button variant="ghost" icon="edit" onClick={() => go(`projects/${p.id}`)}>
                    Edit
                  </Button>
                  <IconButton
                    icon="trash"
                    label="Move to bin"
                    onClick={async () => {
                      if (await confirm({ title: `Move “${p.title}” to the bin?`, text: 'It comes off your website when you next publish. You can restore it from the bin below.', ok: 'Move to bin', danger: true }))
                        save((d) => (d.projects.find((x) => x.id === p.id).deletedAt = new Date().toISOString()), `Moved project “${p.title}” to the bin`)
                    }}
                  />
                </div>
              </div>
            )}
          />
        )}
      </section>
      {bin.length > 0 && (
        <section className="a-panel">
          <h2>Bin</h2>
          <ul className="a-binlist">
            {bin.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.title}</strong> <small className="a-muted">moved to the bin {timeAgo(p.deletedAt)}</small>
                </span>
                <span className="a-row">
                  <Button variant="ghost" icon="restore" onClick={() => save((d) => ((d.projects.find((x) => x.id === p.id).deletedAt = null), (d.projects.find((x) => x.id === p.id).status = 'hidden')), `Restored project “${p.title}”`).then(() => toast('Restored as Hidden'))}>
                    Restore
                  </Button>
                  <Button
                    variant="danger-ghost"
                    icon="trash"
                    onClick={async () => {
                      if (await confirm({ title: 'Delete for good?', text: `“${p.title}” will be deleted permanently. Its photos stay in your media library.`, ok: 'Delete for good', danger: true }))
                        save((d) => (d.projects = d.projects.filter((x) => x.id !== p.id)), `Deleted project “${p.title}”`)
                    }}
                  >
                    Delete for good
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Shows the whole photo with a bright window = the part visitors will see. Drag it; zoom with the slider. */
function FrameEditor({ m, slot, frame, onChange }) {
  const box = useRef(null)
  const drag = useRef(null)
  const ir = m.w / m.h
  const z = slot.zoom || 1
  const fr = frame.ratio
  const vx = (ir > fr ? fr / ir : 1) / z // visible share of the photo's width
  const vy = (ir > fr ? 1 : ir / fr) / z
  const [px, py] = (slot[frame.key] || '50% 50%').split(' ').map((v) => parseFloat(v) / 100)
  const sx = px * (1 - vx)
  const sy = py * (1 - vy)
  const setFromStart = (nx, ny) => {
    const fx = vx >= 0.999 ? 50 : Math.round(Math.min(1, Math.max(0, nx / (1 - vx))) * 100)
    const fy = vy >= 0.999 ? 50 : Math.round(Math.min(1, Math.max(0, ny / (1 - vy))) * 100)
    onChange({ ...slot, [frame.key]: `${fx}% ${fy}%` })
  }
  const down = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = box.current.getBoundingClientRect()
    drag.current = { x0: e.clientX, y0: e.clientY, sx, sy, W: r.width, H: r.height }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    setFromStart(d.sx + (e.clientX - d.x0) / d.W, d.sy + (e.clientY - d.y0) / d.H)
  }
  const nudge = (e) => {
    const step = 0.03
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!k) return
    e.preventDefault()
    setFromStart(sx + k[0], sy + k[1])
  }
  return (
    <div className="a-frameedit">
      <div ref={box} className="a-frameedit-img" style={{ aspectRatio: `${m.w} / ${m.h}` }}>
        <img src={mediaSrc(m, 'md')} alt="" draggable="false" />
        <div
          className="a-window"
          role="slider"
          tabIndex={0}
          aria-label="Visible area — drag, or use the arrow keys"
          aria-valuetext={slot[frame.key]}
          style={{ left: `${sx * 100}%`, top: `${sy * 100}%`, width: `${vx * 100}%`, height: `${vy * 100}%` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={nudge}
        />
      </div>
      <label className="a-slider">
        <span>
          Zoom <output>{z.toFixed(1)}×</output>
        </span>
        <input type="range" min="1" max="2.5" step="0.05" value={z} onChange={(e) => onChange({ ...slot, zoom: Number(e.target.value) })} />
      </label>
    </div>
  )
}

function Slot({ role, slot, media, onUploaded, onPick, onClear, onEdit }) {
  const [picking, setPicking] = useState(false)
  const { doc } = useDoc()
  const m = media[slot.media]
  return (
    <div className={`a-slot is-${role}`}>
      <span className="a-tape is-role">{role === 'before' ? doc.text.beforeLabel : doc.text.afterLabel}</span>
      <h3>{role === 'before' ? 'Before photo' : 'After photo'}</h3>
      {m ? (
        <>
          <img className="a-slot-img" src={mediaSrc(m, 'md')} alt={m.alt || ''} style={{ background: m.tone }} />
          <div className="a-row">
            <Button variant="ghost" icon="edit" onClick={onEdit}>
              Crop / details
            </Button>
            <Button variant="ghost" icon="close" onClick={onClear}>
              Change photo
            </Button>
          </div>
        </>
      ) : (
        <>
          <Uploader
            multiple={false}
            compact
            label={role === 'before' ? 'Upload the BEFORE photo' : 'Upload the AFTER photo'}
            hint={role === 'before' ? 'The room before you started.' : 'The finished room.'}
            onUploaded={onUploaded}
          />
          <Button variant="ghost" icon="library" onClick={() => setPicking(true)}>
            Choose from library
          </Button>
        </>
      )}
      {picking && <PhotoPicker doc={doc} title={`Choose the ${role} photo`} onClose={() => setPicking(false)} onPick={(m2) => (setPicking(false), onPick(m2))} />}
    </div>
  )
}

function Builder({ id }) {
  const { doc, save, publish } = useDoc()
  const { toast, confirm } = useUI()
  const existing = id ? doc.projects.find((p) => p.id === id) : null
  const [p, setP] = useState(() =>
    existing
      ? structuredClone(existing)
      : { id: '', title: '', change: '', summary: '', category: 'before-after', location: '', service: '', status: 'draft', before: { ...blankSlot }, after: { ...blankSlot } },
  )
  const [added, setAdded] = useState({}) // photos uploaded in this session, not yet saved
  const [frame, setFrame] = useState('desktop')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState('')
  const media = useMemo(() => ({ ...doc.media, ...added }), [doc.media, added])

  if (id && !existing)
    return (
      <Empty title="This project doesn’t exist any more" action={<Button onClick={() => go('projects')}>Back to projects</Button>} />
    )

  const set = (patch) => setP((x) => ({ ...x, ...patch }))
  const setSlot = (role, patch) => setP((x) => ({ ...x, [role]: { ...x[role], ...patch } }))
  const ready = p.before.media && p.after.media && p.title.trim()
  const dirty = JSON.stringify(p) !== JSON.stringify(existing || {}) || Object.keys(added).length > 0
  const problems = [!p.before.media && 'Add the before photo.', !p.after.media && 'Add the after photo.', !p.title.trim() && 'Give the project a title.'].filter(Boolean)
  const asPreview = (slot, key) => {
    const m = media[slot.media]
    if (!m) return null
    const src = mediaSrc(m, 'lg')
    return { src, small: mediaSrc(m, 'md'), smallW: m.sizes?.md?.w || 800, w: m.w, h: m.h, alt: m.alt, tone: m.tone, focus: slot[key], focusM: slot[key], zoom: slot.zoom }
  }

  const doSave = async (status) => {
    const final = { ...p, status: status || p.status, updatedAt: new Date().toISOString() }
    if (!final.id) {
      const base = slug(final.title, 'project')
      let candidate = base
      for (let i = 2; doc.projects.some((x) => x.id === candidate); i++) candidate = `${base}-${i}`
      final.id = candidate
    }
    await save((d) => {
      for (const [k, m] of Object.entries(added)) d.media[k] = m
      // Photos of a project are labelled with it (only where the owner hasn't set a project name).
      for (const role of ['before', 'after']) {
        const m = d.media[final[role].media]
        if (m && !m.project) m.project = final.title
        if (m && !m.category) m.category = 'before-after'
      }
      const i = d.projects.findIndex((x) => x.id === final.id)
      if (i >= 0) d.projects[i] = final
      else d.projects.unshift(final)
    }, existing ? `Updated project “${final.title}”` : `Created project “${final.title}”`)
    setAdded({})
    return final
  }

  const onSaveDraft = async () => {
    setBusy('save')
    try {
      const final = await doSave(existing ? undefined : 'draft')
      toast(existing ? 'Project saved' : 'Saved as a draft')
      go(`projects/${final.id}`)
    } catch {
      /* toast shown */
    } finally {
      setBusy('')
    }
  }
  const onPublish = async () => {
    if (!(await confirm({ title: 'Publish this project?', text: 'It will appear on your website, together with any other unpublished changes.', ok: 'Publish now' }))) return
    setBusy('publish')
    try {
      const final = await doSave('live')
      await publish()
      go(`projects/${final.id}`)
    } catch {
      /* toast shown */
    } finally {
      setBusy('')
    }
  }

  const fr = FRAMES[frame]
  const before = asPreview(p.before, fr.key)
  const after = asPreview(p.after, fr.key)

  return (
    <>
      <header className="a-pagehead a-pagehead-row">
        <div>
          <a
            href="#/projects"
            className="a-back"
            onClick={async (e) => {
              if (dirty) {
                e.preventDefault()
                if (await confirm({ title: 'Leave without saving?', text: 'Your changes to this project will be lost.', ok: 'Leave', danger: true })) go('projects')
              }
            }}
          >
            ← All projects
          </a>
          <h1>{existing ? existing.title : 'Create before & after'}</h1>
        </div>
        {existing && <Tape status={existing.status} />}
      </header>

      <ol className="a-steps">
        <li className="a-panel">
          <h2>Photos</h2>
          <p className="a-muted">Use one photo from before you started and one of the finished job, ideally taken from the same spot.</p>
          <div className="a-slots">
            {['before', 'after'].map((role) => (
              <Slot
                key={role}
                role={role}
                slot={p[role]}
                media={media}
                onUploaded={(m) => {
                  setAdded((a) => ({ ...a, [m.id]: { ...m, category: 'before-after', title: `${p.title || 'New project'} (${role})` } }))
                  setSlot(role, { media: m.id, focus: '50% 50%', focusM: '50% 50%', zoom: 1 })
                }}
                onPick={(m) => setSlot(role, { media: m.id, focus: m.focus || '50% 50%', focusM: m.focus || '50% 50%', zoom: 1 })}
                onClear={() => setSlot(role, { ...blankSlot })}
                onEdit={() => (added[p[role].media] ? toast('Save the project first, then you can crop this photo.') : setEditing(p[role].media))}
              />
            ))}
          </div>
          {p.before.media && p.after.media && (
            <Button
              variant="ghost"
              icon="swap"
              onClick={async () => {
                if (await confirm({ title: 'Swap before and after?', text: 'The photo now marked BEFORE will become AFTER, and the other way round.', ok: 'Swap them' }))
                  setP((x) => ({ ...x, before: x.after, after: x.before }))
              }}
            >
              Swap before and after
            </Button>
          )}
        </li>

        <li className="a-panel">
          <h2>Details</h2>
          <div className="a-form a-form-2">
            <Field label="Project title" value={p.title} onChange={(v) => set({ title: v })} max={60} placeholder="e.g. Living room repaint" hint="The big heading next to the slider." />
            <Field label="Short line" value={p.change} onChange={(v) => set({ change: v })} max={48} placeholder="e.g. Dark grey to bright white" hint="Shown on the project card." />
            <Field label="Description" value={p.summary} onChange={(v) => set({ summary: v })} max={260} multiline placeholder="What you did, in a sentence or two." />
            <div className="a-form">
              <Field label="Service" value={p.service} onChange={(v) => set({ service: v })} max={60} placeholder="e.g. Interior painting" />
              <Field label="Location (optional)" value={p.location} onChange={(v) => set({ location: v })} max={60} placeholder="e.g. Akron, OH" hint="Keep it general — never a customer’s address." />
              <Select label="Category" value={p.category} onChange={(v) => set({ category: v })} options={[{ value: '', label: 'No category' }, ...doc.categories.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          </div>
        </li>

        <li className="a-panel">
          <h2>Framing &amp; preview</h2>
          {!before || !after ? (
            <p className="a-muted">Add both photos to see the slider.</p>
          ) : (
            <>
              <div className="a-seg" role="radiogroup" aria-label="Preview on">
                {Object.entries(FRAMES).map(([k, f]) => (
                  <button key={k} type="button" role="radio" aria-checked={frame === k} onClick={() => setFrame(k)}>
                    <Icon name={k} /> {f.label}
                  </button>
                ))}
              </div>
              <p className="a-hint">
                The bright window shows what visitors see on a {fr.label.toLowerCase()}. Drag it to choose the best part of each photo, and zoom in to line the two up.
              </p>
              <div className="a-frames">
                {['before', 'after'].map((role) => (
                  <div key={role}>
                    <span className="a-label">{role === 'before' ? doc.text.beforeLabel : doc.text.afterLabel}</span>
                    <FrameEditor m={media[p[role].media]} slot={p[role]} frame={fr} onChange={(s) => setSlot(role, s)} />
                  </div>
                ))}
              </div>
              <div className={`a-preview is-${frame}`}>
                <span className="a-label">Live preview — drag the slider</span>
                <CompareSlider
                  key={`${frame}-${p.before.media}-${p.after.media}`}
                  before={before}
                  after={after}
                  label={p.title || 'Preview'}
                  beforeLabel={doc.text.beforeLabel}
                  afterLabel={doc.text.afterLabel}
                  className="a-compare"
                  sizes="40rem"
                />
                {p.title && (
                  <div className="a-preview-text">
                    <strong>{p.title}</strong>
                    {p.summary && <p>{p.summary}</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </li>

        <li className="a-panel a-savepanel">
          <h2>Save</h2>
          {existing ? (
            <div className="a-field">
              <span className="a-label">Show on website</span>
              <StatusPicker value={p.status} onChange={(s) => set({ status: s })} />
            </div>
          ) : null}
          {problems.length > 0 && (
            <ul className="a-problems">
              {problems.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <div className="a-row a-row-end">
            <Button variant="ghost" icon="check" busy={busy === 'save'} disabled={!ready || !!busy || (!dirty && !!existing)} onClick={onSaveDraft}>
              {existing ? 'Save changes' : 'Save as draft'}
            </Button>
            <Button icon="upload" busy={busy === 'publish'} disabled={!ready || !!busy} onClick={onPublish}>
              Publish now
            </Button>
          </div>
        </li>
      </ol>

      {editing && <PhotoEditor id={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
