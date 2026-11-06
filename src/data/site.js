// ─────────────────────────────────────────────────────────────
// Business details — the built-in defaults. The owner edits these in the
// dashboard (Business settings); published values replace them on load.
// ─────────────────────────────────────────────────────────────
export const business = {
  name: 'Rose Painting Solutions',
  email: '',
  serviceArea: '',
  description: '',
  instructions: '',
  social: {},
  shortName: 'Rose',
  phoneDisplay: '(330) 614-0776',
  phoneHref: 'tel:+13306140776',
  hours: {
    days: 'Monday–Friday',
    daysShort: 'Mon–Fri',
    time: '9:00 AM – 5:00 PM',
    timeShort: '9 AM–5 PM',
    closed: 'Saturday–Sunday',
    // Used for the live "Open now" indicator. 0 = Sunday … 6 = Saturday.
    openDays: [1, 2, 3, 4, 5],
    openHour: 9,
    closeHour: 17,
    timeZone: 'America/New_York',
  },
}

export const nav = [
  { label: 'Services', href: '#services' },
  { label: 'Our work', href: '#work' },
  { label: 'Ideas', href: '#ideas' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
]

// Real client quotes only. Leave empty to hide the testimonial block.
// Example:
// { quote: 'They made our tired living room look brand new.', name: 'Sarah M.', room: 'Living room' }
export const testimonials = []
