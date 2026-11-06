import { useState } from 'react'
import { useDoc } from '../App.jsx'
import { text as ORIGINAL, TEXT_LIMITS } from '../../data/text.js'
import { Button, Field, useUI } from '../ui.jsx'

const GROUPS = [
  {
    title: 'Top of the homepage',
    fields: [
      ['heroLine1', 'Headline, first line'],
      ['heroLine2', 'Headline, second line'],
      ['heroLede', 'Text under the headline', true],
      ['ctaPrimary', 'Main button'],
      ['ctaSecondary', 'Second button'],
    ],
    preview: (t) => (
      <div className="a-pv a-pv-hero">
        <p className="a-pv-h1">
          <span>{t.heroLine1}</span>
          <span className="a-pv-indent">{t.heroLine2}</span>
        </p>
        <p>{t.heroLede}</p>
        <p className="a-pv-btns">
          <span className="a-pv-btn is-light">{t.ctaPrimary}</span>
          <span className="a-pv-btn">{t.ctaSecondary}</span>
        </p>
      </div>
    ),
  },
  {
    title: 'Services',
    fields: [
      ['servicesTitle', 'Heading'],
      ['servicesIntro', 'Introduction', true],
    ],
    preview: (t) => (
      <div className="a-pv a-pv-light">
        <p className="a-pv-h2">{t.servicesTitle}</p>
        <p>{t.servicesIntro}</p>
      </div>
    ),
  },
  {
    title: 'Our work',
    fields: [
      ['workTitle', 'Heading'],
      ['workIntro', 'Introduction', true],
      ['beforeLabel', 'Label on before photos'],
      ['afterLabel', 'Label on after photos'],
      ['angleNote', 'Note under the projects', true],
      ['finishedTitle', 'Gallery heading'],
    ],
    preview: (t) => (
      <div className="a-pv">
        <p className="a-pv-h2">{t.workTitle}</p>
        <p>{t.workIntro}</p>
        <p className="a-pv-tapes">
          <span className="a-tape is-role">{t.beforeLabel}</span>
          <span className="a-tape is-role">{t.afterLabel}</span>
        </p>
        <p className="a-pv-small">{t.angleNote}</p>
        <p className="a-pv-h3">{t.finishedTitle}</p>
      </div>
    ),
  },
  {
    title: 'Contact section',
    fields: [
      ['contactTitle', 'Heading'],
      ['contactIntro', 'Introduction', true],
    ],
    preview: (t) => (
      <div className="a-pv a-pv-cobalt">
        <p className="a-pv-h2">{t.contactTitle}</p>
        <p>{t.contactIntro}</p>
      </div>
    ),
  },
  {
    title: 'Footer',
    fields: [['footerDescription', 'Line after your business name']],
    preview: (t, d) => (
      <div className="a-pv a-pv-small-dark">
        © {new Date().getFullYear()} {d.business.name}. {t.footerDescription}
      </div>
    ),
  },
]

export default function Content() {
  const { doc, save } = useDoc()
  const { toast } = useUI()
  const [t, setT] = useState(() => ({ ...doc.text }))
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(t) !== JSON.stringify(doc.text)
  const empty = Object.entries(t).filter(([, v]) => !String(v || '').trim()).map(([k]) => k)

  const onSave = async () => {
    setBusy(true)
    try {
      const changed = Object.keys(t).filter((k) => t[k] !== doc.text[k]).length
      await save((d) => (d.text = { ...d.text, ...t }), `Edited website text (${changed} ${changed === 1 ? 'change' : 'changes'})`)
      toast('Text saved. Publish to show it on your website.')
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
          <h1>Website text</h1>
          <p className="a-muted">Change the wording on your website. The layout and design stay the same.</p>
        </div>
        <Button icon="check" busy={busy} disabled={!dirty || empty.length > 0} onClick={onSave}>
          Save text
        </Button>
      </header>
      {empty.length > 0 && <p className="a-error">Every piece of text needs some words — fill in the empty boxes before saving.</p>}
      {GROUPS.map((g) => (
        <section key={g.title} className="a-panel a-textgroup">
          <h2>{g.title}</h2>
          <div className="a-textgroup-grid">
            <div className="a-form">
              {g.fields.map(([k, label, multi]) => (
                <div key={k} className="a-textfield">
                  <Field label={label} value={t[k]} onChange={(v) => setT({ ...t, [k]: v })} max={TEXT_LIMITS[k]} multiline={multi} rows={3} />
                  {t[k] !== ORIGINAL[k] && (
                    <button type="button" className="a-linkbtn" onClick={() => setT({ ...t, [k]: ORIGINAL[k] })}>
                      Restore original wording
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div aria-label="Preview">
              <span className="a-label">Preview</span>
              {g.preview(t, doc)}
            </div>
          </div>
        </section>
      ))}
      <div className="a-stickysave">
        <Button icon="check" busy={busy} disabled={!dirty || empty.length > 0} onClick={onSave}>
          Save text
        </Button>
      </div>
    </>
  )
}
