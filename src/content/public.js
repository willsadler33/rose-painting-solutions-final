// ─────────────────────────────────────────────────────────────
// The public view of a content document: only what visitors may see
// (live photos and projects, enabled services), with image addresses
// resolved. The server sends exactly this to the website.
// ─────────────────────────────────────────────────────────────
import { formatHours } from './schema.js'

/** Address of an uploaded photo's size variant. Revisions make URLs immutable. */
export const uploadUrl = (m, variant) => `/media/${m.id}/${m.rev}/${variant}.${m.ext || 'webp'}`

/** A media item as the site's components expect a photo. */
export function photoOf(m) {
  if (!m) return null
  if (m.kind === 'static') {
    return { src: m.src, small: m.small, smallW: m.smallW || 800, thumb: m.thumb || m.small, w: m.w, h: m.h }
  }
  const lg = m.sizes?.lg || { w: m.w, h: m.h }
  const md = m.sizes?.md || lg
  return {
    src: uploadUrl(m, 'lg'),
    small: uploadUrl(m, m.sizes?.md ? 'md' : 'lg'),
    smallW: md.w,
    thumb: uploadUrl(m, m.sizes?.thumb ? 'thumb' : 'md'),
    w: lg.w,
    h: lg.h,
  }
}

export function toPublic(doc, { includeAll = false } = {}) {
  const show = (s) => includeAll ? s !== 'hidden' : s === 'live'
  const media = doc.media || {}
  const cat = Object.fromEntries((doc.categories || []).map((c) => [c.id, c.name]))

  const gallery = (doc.gallery || [])
    .filter((g) => show(g.status) && media[g.media] && !media[g.media].deletedAt)
    .map((g) => {
      const m = media[g.media]
      return {
        id: m.id,
        ...photoOf(m),
        tone: m.tone,
        caption: m.title || 'Finished room',
        group: m.project || cat[m.category] || '',
        description: m.description || '',
        alt: m.alt || m.title || 'Finished painting project',
      }
    })

  const slot = (s, role, title) => {
    const m = media[s.media]
    if (!m || m.deletedAt) return null
    return {
      ...photoOf(m),
      alt: m.alt || `${role}: ${title}`,
      tone: m.tone,
      focus: s.focus,
      focusM: s.focusM,
      zoom: s.zoom || 1,
    }
  }
  const projects = (doc.projects || [])
    .filter((p) => show(p.status) && !p.deletedAt)
    .map((p) => {
      const before = slot(p.before, 'Before', p.title)
      const after = slot(p.after, 'After', p.title)
      if (!before || !after) return null
      return {
        id: p.id,
        title: p.title,
        change: p.change || '',
        summary: p.summary || '',
        location: p.location || '',
        service: p.service || '',
        before,
        after,
      }
    })
    .filter(Boolean)

  const b = doc.business || {}
  return {
    v: doc.rev || 0,
    business: { ...b, hours: { ...b.hours, ...formatHours(b.hours || {}) } },
    text: doc.text || {},
    services: (doc.services || []).filter((s) => s.enabled !== false),
    reasons: doc.reasons || [],
    gallery,
    projects,
  }
}
