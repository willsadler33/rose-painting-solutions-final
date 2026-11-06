import { useDoc } from '../App.jsx'
import { mediaSrc } from '../api.js'
import { Empty, Icon, timeAgo } from '../ui.jsx'

export default function Overview() {
  const { doc } = useDoc()
  const photos = Object.values(doc.media).filter((m) => !m.deletedAt)
  const projects = doc.projects.filter((p) => !p.deletedAt)
  const count = (s) => projects.filter((p) => p.status === s).length
  const galleryLive = doc.gallery.filter((g) => g.status === 'live' && !doc.media[g.media]?.deletedAt).length
  const recent = [...photos].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <header className="a-pagehead">
        <h1>{greeting}</h1>
        <p className="a-muted">Here’s your website at a glance.</p>
      </header>

      <section className="a-quick" aria-label="Quick actions">
        <a href="#/projects/new" className="a-quick-main">
          <Icon name="compare" size={26} />
          <span>
            <strong>Create before &amp; after</strong>
            <small>Upload two photos of a job and publish it</small>
          </span>
        </a>
        <a href="#/library/upload">
          <Icon name="upload" /> Upload photos
        </a>
        <a href="#/gallery">
          <Icon name="photo" /> Edit gallery
        </a>
        <a href="#/content">
          <Icon name="text" /> Edit website text
        </a>
        <a href="/?preview" target="_blank" rel="noopener">
          <Icon name="eye" /> Preview website
        </a>
      </section>

      <section className="a-stats" aria-label="Your content">
        <a href="#/library" className="a-stat">
          <strong>{photos.length}</strong>
          <span>photos in your library</span>
        </a>
        <a href="#/projects" className="a-stat">
          <strong>{projects.length}</strong>
          <span>before &amp; after projects</span>
        </a>
        <a href="#/projects" className="a-stat">
          <strong>{count('live')}</strong>
          <span>projects live on the website</span>
        </a>
        <a href="#/projects" className="a-stat">
          <strong>{count('draft') + count('hidden')}</strong>
          <span>
            projects not shown ({count('draft')} draft, {count('hidden')} hidden)
          </span>
        </a>
        <a href="#/gallery" className="a-stat">
          <strong>{galleryLive}</strong>
          <span>photos in the live gallery</span>
        </a>
      </section>

      <div className="a-two">
        <section className="a-panel">
          <h2>Recently updated photos</h2>
          {recent.length === 0 ? (
            <Empty title="No photos yet">Upload your first photos to get started.</Empty>
          ) : (
            <ul className="a-recent">
              {recent.map((m) => (
                <li key={m.id}>
                  <a href={`#/library/edit/${m.id}`}>
                    <img src={mediaSrc(m, 'thumb')} alt="" loading="lazy" style={{ background: m.tone, objectPosition: m.focus }} />
                    <span>
                      <strong>{m.title || 'Untitled photo'}</strong>
                      <small>{m.updatedAt?.startsWith('2026-10-01') ? 'From the original website' : `Updated ${timeAgo(m.updatedAt)}`}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="a-panel">
          <h2>Recent changes</h2>
          {doc.activity.length === 0 ? (
            <p className="a-muted">Changes you make will be listed here.</p>
          ) : (
            <ol className="a-activity">
              {doc.activity.slice(0, 10).map((a, i) => (
                <li key={i}>
                  <span>{a.what}</span>
                  <time dateTime={a.at}>{timeAgo(a.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
