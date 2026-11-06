// ─────────────────────────────────────────────────────────────
// The starting content document, built from the site's own data files.
// It is what the dashboard opens with on first use, and what the public
// site shows if the content service can't be reached.
//
// Existing photos stay where they are (public/images/...) and are listed
// as "static" photos; the confirmed before/after pairings are copied
// exactly from data/projects.js.
// ─────────────────────────────────────────────────────────────
import { business } from '../data/site.js'
import { text } from '../data/text.js'
import { services } from '../data/services.js'
import { reasons } from '../data/content.js'
import { portfolio } from '../data/portfolio.js'
import { transformations } from '../data/projects.js'
import { DEFAULT_CATEGORIES, slug } from './schema.js'

const EPOCH = '2026-10-01T00:00:00.000Z'

export function buildSeed() {
  const clone = (v) => JSON.parse(JSON.stringify(v))
  const media = {}

  // Finished rooms (photos 01–05), in their current order.
  const gallery = portfolio.map((p) => {
    const id = `photo-${p.id}`
    media[id] = {
      id,
      kind: 'static',
      title: p.caption,
      description: '',
      alt: p.alt,
      project: p.group,
      category: 'finished',
      tone: p.tone,
      focus: '50% 50%',
      w: p.w,
      h: p.h,
      src: p.src,
      small: p.small,
      thumb: p.small,
      smallW: 800,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    }
    return { media: id, status: 'live' }
  })

  // Before & after projects, pairings exactly as confirmed by the owner.
  const projects = transformations.map((t) => {
    const slot = (role, p) => {
      const id = slug(p.src.split('/').pop().replace(/\.webp$/, ''))
      media[id] = {
        id,
        kind: 'static',
        title: `${t.title} (${role})`,
        description: '',
        alt: p.alt,
        project: t.title,
        category: 'before-after',
        tone: p.tone,
        focus: p.focus || '50% 50%',
        w: p.w,
        h: p.h,
        src: p.src,
        small: p.small,
        thumb: p.thumb,
        smallW: p.smallW,
        createdAt: EPOCH,
        updatedAt: EPOCH,
      }
      return { media: id, focus: p.focus || '50% 50%', focusM: p.focusM || p.focus || '50% 50%', zoom: 1 }
    }
    return {
      id: t.id,
      title: t.title,
      change: t.change,
      summary: t.summary,
      category: 'before-after',
      location: '',
      service: '',
      status: 'live',
      before: slot('before', t.before),
      after: slot('after', t.after),
      updatedAt: EPOCH,
    }
  })

  return clone({
    version: 1,
    rev: 0,
    business: {
      ...business,
      email: '',
      serviceArea: '',
      description: '',
      instructions: '',
      social: {},
    },
    text,
    services: services.map((s, i) => ({ id: slug(s.title, `service-${i + 1}`), ...s, enabled: true })),
    reasons,
    categories: DEFAULT_CATEGORIES,
    media,
    gallery,
    projects,
    activity: [],
    updatedAt: EPOCH,
  })
}
