import { useEffect, useMemo, useRef, useState } from 'react'
import { useDoc } from './App.jsx'
import { mediaSrc } from './api.js'
import { decode, processAndUpload, render } from './images.js'
import { Button, Field, Icon, Modal, Progress, Select, useUI } from './ui.jsx'
import { usageOf } from './PhotoTools.jsx'

const NO_EDITS = { rotate: 0, crop: null, brightness: 0, contrast: 0 }
const same = (a, b) => JSON.stringify({ ...NO_EDITS, ...a }) === JSON.stringify({ ...NO_EDITS, ...b })
const RATIOS = [
  { label: 'Free', v: 0 },
  { label: '4:3', v: 4 / 3 },
  { label: '3:4', v: 3 / 4 },
  { label: '16:9', v: 16 / 9 },
  { label: 'Square', v: 1 },
]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** Crop box over the (rotated) photo: drag to move, drag a corner to resize. */
function Cropper({ crop, onChange, ratio, imgRatio }) {
  const box = useRef(null)
  const drag = useRef(null)
  const c = crop || { x: 0, y: 0, w: 1, h: 1 }
  const start = (mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = box.current.getBoundingClientRect()
    drag.current = { mode, x0: e.clientX, y0: e.clientY, c0: { ...c }, W: r.width, H: r.height }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x0) / d.W
    const dy = (e.clientY - d.y0) / d.H
    let { x, y, w, h } = d.c0
    if (d.mode === 'move') {
      x = clamp(x + dx, 0, 1 - w)
      y = clamp(y + dy, 0, 1 - h)
    } else {
      const left = d.mode.includes('l')
      const top = d.mode.includes('t')
      let nw = clamp(w + (left ? -dx : dx), 0.08, left ? x + w : 1 - x)
      let nh = clamp(h + (top ? -dy : dy), 0.08, top ? y + h : 1 - y)
      if (ratio) {
        // keep the chosen shape (ratio is in pixels; convert via the photo's own ratio)
        const k = ratio / imgRatio
        nh = nw / k
        if (top ? nh > y + h : nh > 1 - y) {
          nh = top ? y + h : 1 - y
          nw = nh * k
        }
      }
      if (left) x = x + w - nw
      if (top) y = y + h - nh
      w = nw
      h = nh
    }
    onChange({ x, y, w, h })
  }
  const end = () => (drag.current = null)
  return (
    <div ref={box} className="a-crop" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div
        className="a-crop-box"
        style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}
        onPointerDown={start('move')}
      >
        {['tl', 'tr', 'bl', 'br'].map((k) => (
          <span key={k} className={`a-crop-h is-${k}`} onPointerDown={start(k)} />
        ))}
      </div>
    </div>
  )
}

export default function PhotoEditor({ id, onClose, startTab = 'details' }) {
  const { doc, save } = useDoc()
  const { toast, confirm } = useUI()
  const m = doc.media[id]
  const [tab, setTab] = useState(startTab)
  const [f, setF] = useState(() => ({ title: m.title, description: m.description, alt: m.alt, project: m.project, category: m.category }))
  const [edits, setEdits] = useState(() => ({ ...NO_EDITS, ...(m.edits || {}) }))
  const [focus, setFocus] = useState(m.focus || '50% 50%')
  const [ratio, setRatio] = useState(0)
  const [src, setSrc] = useState(null)
  const [busy, setBusy] = useState(null)
  const fileRef = useRef(null)
  const previewRef = useRef(null)
  const finalRef = useRef(null)
  const used = usageOf(doc, id)

  // The source we edit from: the private high-quality copy where there is one.
  const sourceUrl = m.kind === 'upload' && m.hasMaster ? mediaSrc(m, 'master') : mediaSrc(m, 'lg')
  useEffect(() => {
    let cancelled = false
    decode(sourceUrl)
      .then((s) => !cancelled && setSrc(s))
      .catch((e) => toast(e.message, 'error'))
    return () => (cancelled = true)
  }, [sourceUrl, toast])

  // Preview of the whole photo (rotation only) under the crop box
  const rotated = useMemo(() => (src ? render(src, { rotate: edits.rotate }, 900) : null), [src, edits.rotate])
  useEffect(() => {
    const host = previewRef.current
    if (!host || !rotated) return
    host.replaceChildren(rotated)
  }, [rotated, tab])
  // Preview of the finished photo (for the focus point)
  useEffect(() => {
    const host = finalRef.current
    if (!host || !src || tab !== 'focus') return
    host.replaceChildren(render(src, edits, 900))
  }, [src, edits, tab])

  const editsChanged = !same(edits, m.edits)
  const detailsChanged = JSON.stringify(f) !== JSON.stringify({ title: m.title, description: m.description, alt: m.alt, project: m.project, category: m.category }) || focus !== m.focus
  const filter = `brightness(${1 + edits.brightness / 100}) contrast(${1 + edits.contrast / 100})`

  const commit = async (upload) => {
    await save(
      (d) => {
        d.media[id] = { ...d.media[id], ...f, focus, ...(upload ? { ...upload, kind: 'upload', edits } : {}), updatedAt: new Date().toISOString() }
      },
      upload ? `Edited photo “${f.title || 'Untitled'}”` : `Updated details of “${f.title || 'Untitled'}”`,
    )
  }

  const onSave = async () => {
    try {
      let upload = null
      if (editsChanged || (m.kind === 'static' && !same(edits, NO_EDITS))) {
        setBusy({ stage: 'Applying edits', pct: 0 })
        // A photo that came with the website gets its own private original on first edit.
        upload = await processAndUpload(sourceUrl, { id, edits, withMaster: m.kind === 'static', onProgress: setBusy })
        if (m.kind === 'static') upload.hasMaster = true
      }
      await commit(upload)
      toast('Photo saved')
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const onReplace = async (file) => {
    if (!file) return
    const ok = await confirm({
      title: 'Replace this photo?',
      text: used.length
        ? `The new photo will appear everywhere this one is used (${used.map((u) => u.label).join(', ')}). Its title and description stay the same.`
        : 'The new photo will take this one’s place. Its title and description stay the same.',
      ok: 'Replace photo',
    })
    if (!ok) return
    try {
      setBusy({ stage: 'Preparing photo', pct: 0 })
      const up = await processAndUpload(file, { id, withMaster: true, onProgress: setBusy })
      setEdits(NO_EDITS)
      await save((d) => {
        d.media[id] = { ...d.media[id], ...f, ...up, kind: 'upload', edits: NO_EDITS, focus: '50% 50%', updatedAt: new Date().toISOString() }
      }, `Replaced photo “${f.title || 'Untitled'}”`)
      toast('Photo replaced')
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const rotRatio = src ? (edits.rotate % 180 ? src.h / src.w : src.w / src.h) : 1
  const setFocusFromEvent = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100))
    const y = Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100))
    setFocus(`${x}% ${y}%`)
  }
  const [fx, fy] = focus.split(' ').map((v) => parseFloat(v))

  return (
    <Modal
      title="Edit photo"
      onClose={busy ? () => {} : onClose}
      wide
      footer={
        busy ? (
          <div className="a-busyline">
            <span>{busy.stage}…</span>
            <Progress value={busy.pct || 0} label={busy.stage} />
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button icon="check" onClick={onSave} disabled={!editsChanged && !detailsChanged}>
              Save photo
            </Button>
          </>
        )
      }
    >
      <div role="tablist" aria-label="Edit" className="a-seg a-seg-wide">
        {[
          ['details', 'Details'],
          ['adjust', 'Crop & adjust'],
          ['focus', 'Focus point'],
        ].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="a-editor-details">
          <img className="a-editor-thumb" src={mediaSrc(m, 'md')} alt="" style={{ background: m.tone, objectPosition: focus }} />
          <div className="a-form">
            <Field label="Photo title" value={f.title} onChange={(v) => setF({ ...f, title: v })} max={80} hint="Shown with the photo on your website." />
            <Field label="Short description" value={f.description} onChange={(v) => setF({ ...f, description: v })} max={300} multiline hint="Optional. Shown when someone opens the photo full screen." />
            <Field label="Project name" value={f.project} onChange={(v) => setF({ ...f, project: v })} max={60} placeholder="e.g. Kitchen repaint, Maple Street" hint="Optional. Groups related photos." />
            <Select
              label="Category"
              value={f.category || ''}
              onChange={(v) => setF({ ...f, category: v })}
              options={[{ value: '', label: 'No category' }, ...doc.categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Field
              label="Description for screen readers"
              value={f.alt}
              onChange={(v) => setF({ ...f, alt: v })}
              max={250}
              multiline
              rows={2}
              hint="Describe what the photo shows, for visitors who can’t see it. e.g. “Living room with freshly painted white walls and grey carpet”."
            />
            {used.length > 0 && <p className="a-hint">Used in: {used.map((u) => u.label).join(', ')}</p>}
            <div className="a-row">
              <Button variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
                Replace photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => (onReplace(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
          </div>
        </div>
      )}

      {tab === 'adjust' && (
        <div className="a-adjust">
          <div className="a-adjust-stage" style={{ aspectRatio: rotRatio }}>
            {!src && <span className="a-spin a-spin-lg" aria-label="Loading photo" />}
            <div ref={previewRef} className="a-adjust-img" style={{ filter }} />
            {src && <Cropper crop={edits.crop} onChange={(crop) => setEdits({ ...edits, crop })} ratio={ratio} imgRatio={rotRatio} />}
          </div>
          <div className="a-adjust-tools">
            <div className="a-row">
              <Button variant="ghost" icon="rotate" onClick={() => setEdits({ ...edits, rotate: (edits.rotate + 90) % 360, crop: null })}>
                Rotate
              </Button>
              <Button variant="ghost" icon="restore" onClick={() => setEdits(NO_EDITS)} disabled={same(edits, NO_EDITS)}>
                Reset edits
              </Button>
            </div>
            <div className="a-field">
              <div className="a-field-top">
                <span className="a-label">Crop shape</span>
              </div>
              <div className="a-seg" role="radiogroup" aria-label="Crop shape">
                {RATIOS.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    role="radio"
                    aria-checked={ratio === r.v}
                    onClick={() => {
                      setRatio(r.v)
                      if (!r.v) return
                      // fit the largest box of that shape, centred
                      const k = r.v / rotRatio
                      const w = Math.min(1, k)
                      const h = w / k
                      setEdits({ ...edits, crop: { x: (1 - w) / 2, y: (1 - h) / 2, w, h } })
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {[
              ['brightness', 'Brightness'],
              ['contrast', 'Contrast'],
            ].map(([k, label]) => (
              <label key={k} className="a-slider">
                <span>
                  {label} <output>{edits[k] > 0 ? `+${edits[k]}` : edits[k]}%</output>
                </span>
                <input type="range" min={-15} max={15} step={1} value={edits[k]} onChange={(e) => setEdits({ ...edits, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <p className="a-hint">Small corrections only (up to 15%), so photos of your work stay true to life.</p>
          </div>
        </div>
      )}

      {tab === 'focus' && (
        <div className="a-focus">
          <p className="a-hint">Tap the most important part of the photo. When the photo is shown in a different shape, this spot stays in view.</p>
          <div className="a-focus-stage" onClick={setFocusFromEvent} style={{ filter }}>
            <div ref={finalRef} className="a-adjust-img" />
            <span className="a-focus-dot" style={{ left: `${fx}%`, top: `${fy}%` }} aria-hidden="true">
              <Icon name="target" />
            </span>
          </div>
          <div className="a-focus-previews" aria-label="How it will be cropped">
            {[['Wide', '16 / 9'], ['Square', '1 / 1'], ['Tall', '3 / 4']].map(([label, ar]) => (
              <figure key={label}>
                <img src={mediaSrc(m, 'md')} alt="" style={{ aspectRatio: ar, objectPosition: focus }} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
