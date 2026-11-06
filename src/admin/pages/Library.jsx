import { useState } from 'react'
import { go, useDoc } from '../App.jsx'
import { mediaSrc } from '../api.js'
import { isId, slug } from '../../content/schema.js'
import PhotoEditor from '../PhotoEditor.jsx'
import { Uploader, usageOf } from '../PhotoTools.jsx'
import { Button, Empty, Icon, IconButton, Modal, Select, timeAgo, useUI } from '../ui.jsx'

function Categories({ onClose }) {
  const { doc, save } = useDoc()
  const { confirm } = useUI()
  const [name, setName] = useState('')
  const inUse = (id) => Object.values(doc.media).filter((m) => m.category === id).length + doc.projects.filter((p) => p.category === id).length
  return (
    <Modal title="Photo categories" onClose={onClose}>
      <p className="a-muted">Categories help you find photos. Rename or add your own.</p>
      <ul className="a-catlist">
        {doc.categories.map((c) => (
          <li key={c.id}>
            <input
              aria-label={`Rename ${c.name}`}
              defaultValue={c.name}
              maxLength={40}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== c.name) save((d) => (d.categories.find((x) => x.id === c.id).name = v), `Renamed category to “${v}”`)
              }}
            />
            <IconButton
              icon="trash"
              label={`Remove ${c.name}`}
              onClick={async () => {
                const n = inUse(c.id)
                if (await confirm({ title: `Remove “${c.name}”?`, text: n ? `${n} photo${n === 1 ? '' : 's'} or project${n === 1 ? '' : 's'} will have no category. Nothing is deleted.` : 'Nothing is deleted.', ok: 'Remove', danger: true }))
                  save((d) => {
                    d.categories = d.categories.filter((x) => x.id !== c.id)
                    for (const m of Object.values(d.media)) if (m.category === c.id) m.category = ''
                    for (const p of d.projects) if (p.category === c.id) p.category = ''
                  }, `Removed category “${c.name}”`)
              }}
            />
          </li>
        ))}
      </ul>
      <form
        className="a-row"
        onSubmit={(e) => {
          e.preventDefault()
          const v = name.trim()
          if (!v) return
          let id = slug(v, 'category')
          for (let i = 2; doc.categories.some((x) => x.id === id); i++) id = `${slug(v, 'category')}-${i}`
          if (!isId(id)) return
          save((d) => d.categories.push({ id, name: v }), `Added category “${v}”`)
          setName('')
        }}
      >
        <input aria-label="New category name" placeholder="New category name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" icon="plus" disabled={!name.trim() || doc.categories.length >= 24}>
          Add
        </Button>
      </form>
    </Modal>
  )
}

export default function Library({ sub = [] }) {
  const { doc, save } = useDoc()
  const { confirm, toast } = useUI()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [selected, setSelected] = useState([])
  const [cats, setCats] = useState(false)
  const view = sub[0] === 'bin' ? 'bin' : 'all'
  const editing = sub[0] === 'edit' && doc.media[sub[1]] ? sub[1] : null
  const all = Object.values(doc.media)
  const bin = all.filter((m) => m.deletedAt)
  const list = all
    .filter((m) => !m.deletedAt)
    .filter((m) => cat === 'all' || (cat === 'none' ? !m.category : m.category === cat))
    .filter((m) => !q || `${m.title} ${m.project} ${m.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const toBin = async (ids) => {
    const blocked = ids.filter((id) => usageOf(doc, id).some((u) => u.kind === 'project'))
    if (blocked.length) {
      toast(`${blocked.length === 1 ? 'That photo is' : `${blocked.length} photos are`} part of a before & after project. Change the project’s photo first.`, 'error')
      ids = ids.filter((id) => !blocked.includes(id))
      if (!ids.length) return
    }
    const inGallery = ids.filter((id) => doc.gallery.some((g) => g.media === id)).length
    if (
      !(await confirm({
        title: `Move ${ids.length === 1 ? 'this photo' : `${ids.length} photos`} to the bin?`,
        text: `${inGallery ? 'They’ll come out of the photo gallery. ' : ''}You can restore them from the bin.`,
        ok: 'Move to bin',
        danger: true,
      }))
    )
      return
    await save((d) => {
      for (const id of ids) d.media[id].deletedAt = new Date().toISOString()
      d.gallery = d.gallery.filter((g) => !ids.includes(g.media))
    }, `Moved ${ids.length} photo${ids.length === 1 ? '' : 's'} to the bin`)
    setSelected([])
  }

  return (
    <>
      <header className="a-pagehead a-pagehead-row">
        <div>
          <h1>Media library</h1>
          <p className="a-muted">Every photo you’ve uploaded, plus the photos your website came with.</p>
        </div>
        <div className="a-row">
          <Button variant="ghost" onClick={() => setCats(true)}>
            Categories
          </Button>
          <a href={view === 'bin' ? '#/library' : '#/library/bin'} className="a-btn a-btn-ghost">
            <Icon name={view === 'bin' ? 'library' : 'trash'} />
            <span>{view === 'bin' ? 'Back to library' : `Bin (${bin.length})`}</span>
          </a>
        </div>
      </header>

      {view === 'bin' ? (
        <section className="a-panel">
          <h2>Bin</h2>
          {bin.length === 0 ? (
            <Empty title="The bin is empty" />
          ) : (
            <ul className="a-binlist">
              {bin.map((m) => (
                <li key={m.id}>
                  <span className="a-binitem">
                    <img src={mediaSrc(m, 'thumb')} alt="" style={{ background: m.tone }} />
                    <span>
                      <strong>{m.title || 'Untitled photo'}</strong>
                      <small className="a-muted">moved to the bin {timeAgo(m.deletedAt)}</small>
                    </span>
                  </span>
                  <span className="a-row">
                    <Button variant="ghost" icon="restore" onClick={() => save((d) => (d.media[m.id].deletedAt = null), `Restored “${m.title}”`).then(() => toast('Restored to your library'))}>
                      Restore
                    </Button>
                    <Button
                      variant="danger-ghost"
                      icon="trash"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete for good?', text: `“${m.title}” will be removed permanently the next time you publish. This can’t be undone after that.`, ok: 'Delete for good', danger: true }))
                          save((d) => delete d.media[m.id], `Deleted “${m.title}” permanently`)
                      }}
                    >
                      Delete for good
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <section className="a-panel">
            <Uploader
              label="Upload photos"
              hint="Photos are made web-ready on your device first: resized, saved in a fast format, and location data removed."
              onUploaded={(m) => save((d) => (d.media[m.id] = m), `Uploaded “${m.title}”`)}
            />
          </section>
          <section className="a-panel">
            <div className="a-filters">
              <div className="a-search">
                <Icon name="search" />
                <input type="search" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search photos" />
              </div>
              <Select
                label="Category"
                value={cat}
                onChange={setCat}
                options={[{ value: 'all', label: 'All categories' }, ...doc.categories.map((c) => ({ value: c.id, label: c.name })), { value: 'none', label: 'No category' }]}
              />
            </div>
            {selected.length > 0 && (
              <div className="a-bulk" role="region" aria-label="Selected photos">
                <strong>{selected.length} selected</strong>
                <select
                  aria-label="Set category for selected photos"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    save((d) => selected.forEach((id) => (d.media[id].category = v === '_none' ? '' : v)), `Changed category of ${selected.length} photos`).then(() => toast('Category updated'))
                  }}
                >
                  <option value="">Set category…</option>
                  {doc.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="_none">No category</option>
                </select>
                <Button variant="danger-ghost" icon="trash" onClick={() => toBin(selected)}>
                  Move to bin
                </Button>
                <Button variant="ghost" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
            )}
            {list.length === 0 ? (
              <Empty title="No photos here">Try another search or category.</Empty>
            ) : (
              <ul className="a-grid">
                {list.map((m) => {
                  const used = usageOf(doc, m.id)
                  const sel = selected.includes(m.id)
                  return (
                    <li key={m.id} className={sel ? 'is-selected' : ''}>
                      <button type="button" className="a-grid-img" onClick={() => go(`library/edit/${m.id}`)} aria-label={`Edit ${m.title || 'photo'}`}>
                        <img src={mediaSrc(m, 'thumb')} alt="" loading="lazy" style={{ background: m.tone, objectPosition: m.focus }} />
                      </button>
                      <label className="a-grid-check">
                        <input type="checkbox" checked={sel} onChange={() => toggle(m.id)} aria-label={`Select ${m.title || 'photo'}`} />
                      </label>
                      <div className="a-grid-text">
                        <strong>{m.title || 'Untitled photo'}</strong>
                        <small>{used.length ? `In ${used.map((u) => u.label).join(', ')}` : 'Not used yet'}</small>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
      {cats && <Categories onClose={() => setCats(false)} />}
      {editing && <PhotoEditor id={editing} onClose={() => go('library')} />}
    </>
  )
}
