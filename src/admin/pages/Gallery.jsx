import { useState } from 'react'
import { useDoc } from '../App.jsx'
import PhotoEditor from '../PhotoEditor.jsx'
import { PhotoPicker, PhotoThumb, Uploader } from '../PhotoTools.jsx'
import { Button, Empty, IconButton, StatusPicker, useUI } from '../ui.jsx'

/** Reorder helper shared with other lists. */
export const moveItem = (arr, from, to) => {
  const a = [...arr]
  const [x] = a.splice(from, 1)
  a.splice(Math.max(0, Math.min(a.length, to)), 0, x)
  return a
}

export function SortableList({ items, keyOf, onMove, render }) {
  const [dragging, setDragging] = useState(null)
  return (
    <ol className="a-sortable">
      {items.map((it, i) => (
        <li
          key={keyOf(it)}
          draggable
          onDragStart={(e) => {
            setDragging(i)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragging !== null && dragging !== i) onMove(dragging, i)
            setDragging(null)
          }}
          onDragEnd={() => setDragging(null)}
          className={dragging === i ? 'is-dragging' : ''}
        >
          <span className="a-handle" aria-hidden="true" title="Drag to reorder">
            ⋮⋮
          </span>
          {render(it, i)}
          <span className="a-order">
            <IconButton icon="up" label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)} />
            <IconButton icon="down" label="Move down" disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)} />
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function Gallery() {
  const { doc, save } = useDoc()
  const { toast, confirm } = useUI()
  const [editing, setEditing] = useState(null)
  const [picking, setPicking] = useState(false)
  const items = doc.gallery.filter((g) => doc.media[g.media] && !doc.media[g.media].deletedAt)

  const setStatus = (id, status) =>
    save((d) => {
      d.gallery.find((g) => g.media === id).status = status
    }, `Set “${doc.media[id].title}” to ${status}`).then(() => toast(status === 'live' ? 'Will show on your website once published' : 'Saved'))

  return (
    <>
      <header className="a-pagehead">
        <h1>Photo gallery</h1>
        <p className="a-muted">The “{doc.text.finishedTitle}” strip under your before &amp; after projects. Drag to change the order.</p>
      </header>

      <section className="a-panel">
        <h2>Add photos</h2>
        <Uploader
          label="Add finished-job photos"
          hint="New photos are added as Draft, so nothing appears on your website until you’re happy."
          onUploaded={(m) =>
            save((d) => {
              d.media[m.id] = { ...m, category: m.category || 'finished' }
              d.gallery.push({ media: m.id, status: 'draft' })
            }, `Uploaded “${m.title}” to the gallery`)
          }
        />
        <Button variant="ghost" icon="library" onClick={() => setPicking(true)}>
          Add from media library
        </Button>
      </section>

      <section className="a-panel">
        <h2>
          In the gallery <span className="a-muted">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <Empty title="Your gallery is empty">Add photos above. The gallery section is hidden on your website until it has a live photo.</Empty>
        ) : (
          <SortableList
            items={items}
            keyOf={(g) => g.media}
            onMove={(from, to) =>
              save((d) => {
                const visible = d.gallery.filter((g) => d.media[g.media] && !d.media[g.media].deletedAt)
                const ordered = moveItem(visible, from, to)
                d.gallery = [...ordered, ...d.gallery.filter((g) => !ordered.includes(g))]
              }, 'Reordered the gallery')
            }
            render={(g) => {
              const m = doc.media[g.media]
              return (
                <div className="a-rowitem">
                  <PhotoThumb m={m} status={g.status} />
                  <div className="a-rowitem-text">
                    <strong>{m.title || 'Untitled photo'}</strong>
                    <small>{m.description || m.project || (m.alt ? '' : 'Tip: add a description for screen readers')}</small>
                    <StatusPicker value={g.status} onChange={(s) => setStatus(g.media, s)} />
                  </div>
                  <div className="a-rowitem-actions">
                    <Button variant="ghost" icon="edit" onClick={() => setEditing(g.media)}>
                      Edit
                    </Button>
                    <IconButton
                      icon="close"
                      label="Remove from gallery"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Remove from the gallery?',
                            text: 'The photo stays in your media library, so you can add it back at any time.',
                            ok: 'Remove',
                          })
                        )
                          save((d) => {
                            d.gallery = d.gallery.filter((x) => x.media !== g.media)
                          }, `Removed “${m.title}” from the gallery`)
                      }}
                    />
                  </div>
                </div>
              )
            }}
          />
        )}
      </section>

      {editing && <PhotoEditor id={editing} onClose={() => setEditing(null)} />}
      {picking && (
        <PhotoPicker
          doc={doc}
          title="Add a photo to the gallery"
          exclude={doc.gallery.map((g) => g.media)}
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setPicking(false)
            save((d) => d.gallery.push({ media: m.id, status: 'draft' }), `Added “${m.title}” to the gallery`).then(() => toast('Added as Draft'))
          }}
        />
      )}
    </>
  )
}
