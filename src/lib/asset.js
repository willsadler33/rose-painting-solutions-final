// Paths to files in /public. Relative paths respect Vite's `base`; site-absolute
// paths ("/media/…", used for uploaded photos) and full URLs are left untouched.
export const asset = (path) =>
  /^(\/|https?:)/.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`
