// One API for every page: the Worker over HTTP, or ?mock=1 → the real core in the browser (api.mock.js).
import { PROFILE_KEYS } from './render.js'

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `The server answered ${status}.`)
    this.status = status
    this.body = body
  }
}

function baseUrl(params) {
  const override = params.get('api')
  if (override) return override.replace(/\/+$/, '')
  const meta = document.querySelector('meta[name="api-base"]')
  return (meta?.content || 'http://127.0.0.1:7402').replace(/\/+$/, '')
}

function profileQuery(params) {
  const q = new URLSearchParams()
  for (const k of PROFILE_KEYS) if (params.has(k)) q.set(k, params.get(k))
  if (params.has('now')) q.set('now', params.get('now'))
  return q
}

function httpApi(params) {
  const base = baseUrl(params)
  const now = params.get('now')
  async function get(path, query = new URLSearchParams()) {
    if (now && !query.has('now')) query.set('now', now)
    const qs = query.toString()
    let res
    try {
      res = await fetch(`${base}${path}${qs ? `?${qs}` : ''}`, { headers: { accept: 'application/json' } })
    } catch {
      throw new ApiError(0, { error: "We couldn't reach the Grant Match server. Try again in a minute." })
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, body)
    return body
  }
  return {
    mode: 'http',
    options: () => get('/api/options'),
    match: (p) => get('/api/match', profileQuery(p)),
    programs: () => get('/api/programs'),
    program: (slug, p) => get(`/api/programs/${encodeURIComponent(slug)}`, profileQuery(p)),
    checks: () => get('/api/checks', new URLSearchParams({ limit: '20' })),
  }
}

let cached
export async function api(params = new URLSearchParams(location.search)) {
  if (cached) return cached
  if (params.get('mock') === '1') {
    const { createMockApi } = await import('./api.mock.js')
    cached = await createMockApi(params)
  } else {
    cached = httpApi(params)
  }
  return cached
}
