const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const KEY_STORAGE = 'siwes-access-key'

export function getAccessKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setAccessKey(key) {
  try {
    localStorage.setItem(KEY_STORAGE, key)
  } catch {
    /* private mode: key only lives for this session */
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

function describe(data, status) {
  if (!data) return `Request failed (${status})`
  if (typeof data.detail === 'string') return data.detail
  // DRF field errors: { name: ["This field is required."] }
  return Object.entries(data)
    .map(([field, errs]) => `${field}: ${[].concat(errs).join(' ')}`)
    .join('\n')
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const key = getAccessKey()
  if (key) headers['X-Access-Key'] = key

  let res
  try {
    res = await fetch(`${BASE}/api/${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (res.status === 403) window.dispatchEvent(new Event('siwes:needs-key'))
  if (!res.ok) throw new ApiError(describe(data, res.status), res.status, data)
  return data
}

export const get = (path) => api(path)
export const post = (path, body = {}) => api(path, { method: 'POST', body })
export const patch = (path, body) => api(path, { method: 'PATCH', body })
export const del = (path, body) => api(path, { method: 'DELETE', body })
