// Talking to the content & photo API from the dashboard.
let csrf = ''
let onSignedOut = () => {}
export const setCsrf = (t) => (csrf = t || '')
export const whenSignedOut = (fn) => (onSignedOut = fn)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Can’t reach the website. Check your internet connection and try again.', 0)
  }
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* not JSON */
  }
  if (res.status === 401 && path !== 'login') onSignedOut()
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status)
  if (data.csrf) setCsrf(data.csrf)
  return data
}

/**
 * Upload one photo size with progress. Retries twice on network trouble,
 * which helps on patchy mobile connections.
 */
export function uploadBytes(id, rev, variant, blob, onProgress) {
  const attempt = () =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', `/api/admin/media/${id}/${rev}/${variant}`)
      xhr.withCredentials = true
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
      xhr.setRequestHeader('X-CSRF-Token', csrf)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => {
        let data = {}
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          /* ignore */
        }
        if (xhr.status === 401) onSignedOut()
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new ApiError(data.error || 'The upload didn’t finish. Please try again.', xhr.status))
      }
      xhr.onerror = () => reject(new ApiError('The upload was interrupted. Check your connection and try again.', 0))
      xhr.ontimeout = xhr.onerror
      xhr.timeout = 120_000
      xhr.send(blob)
    })
  return (async () => {
    for (let i = 0; ; i++) {
      try {
        return await attempt()
      } catch (e) {
        if (i >= 2 || (e.status && e.status < 500)) throw e
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
      }
    }
  })()
}

/** Where the dashboard can show a photo (owner's session can see unpublished ones). */
export function mediaSrc(m, variant = 'md') {
  if (!m) return ''
  if (m.kind === 'static') {
    const p = variant === 'lg' || variant === 'master' ? m.src : variant === 'thumb' ? m.thumb || m.small : m.small
    return `/${p}`
  }
  const v = m.sizes?.[variant] || variant === 'master' ? variant : 'lg'
  return `/media/${m.id}/${m.rev}/${v}.${m.ext || 'webp'}`
}
