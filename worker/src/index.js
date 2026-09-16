// Grant Match NL — Cloudflare Worker (docs/API.md §11). Local only.
// Results come straight from core; this file never reshapes a ProgramResult.
// No profile, name or answer is ever stored or logged here.
import { parseProfile, STRUCTURES, YEARS, REVENUE, COST, OWNERS, PURPOSES } from '../../core/profile.js'
import { evaluateProgram, matchPrograms } from '../../core/match.js'
import { runChecks, sourceStatusFrom } from '../../core/checks.js'
import realBundle from '../../data/build/programs.json'
import sampleBundle from '../../data/build/sample.json'

const MAX_BODY_BYTES = 1_000_000
const STATUS_RUN_WINDOW = 50
const PROFILE_FIELDS = ['name', 'community', 'industry', 'structure', 'employees', 'years', 'revenue', 'owners', 'purposes', 'cost']
const TRIGGERS = new Set(['node', 'cron', 'manual'])

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  })
}

export function bundleFor(env) {
  return env.DATA_SET === 'sample' ? sampleBundle : realBundle
}

function clock(url, env) {
  const raw = url.searchParams.get('now')
  if (raw == null || env.ALLOW_NOW !== '1') return new Date()
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'The now parameter is not a valid date.')
  return d
}

function hasProfile(params) {
  return PROFILE_FIELDS.some((f) => params.has(f))
}

function profileParams(params) {
  const out = new URLSearchParams()
  for (const f of PROFILE_FIELDS) if (params.has(f)) out.set(f, params.get(f))
  return out
}

function parse(params, bundle) {
  return parseProfile(profileParams(params), { communities: bundle.communities, industries: bundle.industries })
}

// ---------- tokens ----------

async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

// Compares fixed-length digests byte by byte without an early exit, so timing says nothing about the token.
export async function tokensEqual(given, expected) {
  if (typeof expected !== 'string' || expected.length === 0) return false
  const [a, b] = await Promise.all([digest(String(given ?? '')), digest(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function requireAdmin(request, env) {
  const header = request.headers.get('authorization') || ''
  const m = /^Bearer (.+)$/.exec(header)
  if (!(await tokensEqual(m ? m[1] : '', env.ADMIN_TOKEN))) throw new HttpError(401, 'A valid admin token is required.')
}

async function readJsonBody(request) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'The request body is too large.')
  const reader = request.body?.getReader()
  const chunks = []
  let size = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new HttpError(413, 'The request body is too large.')
      }
      chunks.push(value)
    }
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.')
  }
}

// ---------- check runs (D1) ----------

const isIso = (s) => typeof s === 'string' && !Number.isNaN(new Date(s).getTime())

export function validateChecksResult(body) {
  const problems = []
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['The body must be a ChecksResult object.']
  if (!isIso(body.started_at)) problems.push('started_at must be an ISO date.')
  if (!isIso(body.finished_at)) problems.push('finished_at must be an ISO date.')
  if (!TRIGGERS.has(body.trigger)) problems.push('trigger must be node, cron or manual.')
  if (!Array.isArray(body.sources)) return [...problems, 'sources must be a list.']
  body.sources.forEach((s, i) => {
    {
      const at = `sources[${i}]`
      if (!s || typeof s !== 'object') {
        problems.push(`${at} must be an object.`)
        return
      }
      for (const k of ['source_id', 'program_slug', 'url']) if (typeof s[k] !== 'string' || !s[k]) problems.push(`${at}.${k} is required.`)
      if (typeof s.ok !== 'boolean') problems.push(`${at}.ok must be true or false.`)
      if (!Array.isArray(s.missing)) problems.push(`${at}.missing must be a list.`)
      for (const k of ['quotes_total', 'quotes_found'])
        if (!Number.isInteger(s[k]) || s[k] < 0) problems.push(`${at}.${k} must be a whole number.`)
    }
  })
  return problems
}

export async function storeRun(db, result) {
  const sources = result.sources
  const sourcesOk = sources.filter((s) => s.ok).length
  const quotesMissing = sources.reduce((n, s) => n + s.missing.length, 0)
  const run = await db
    .prepare(
      'INSERT INTO check_runs (trigger, started_at, finished_at, sources_total, sources_ok, quotes_missing) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(result.trigger, result.started_at, result.finished_at, sources.length, sourcesOk, quotesMissing)
    .first()
  const insert = db.prepare(
    `INSERT INTO check_sources (run_id, position, source_id, program_slug, url, ok, error, http_status, fetched_at,
       sha256, text_sha256, changed, quotes_total, quotes_found, missing_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const rows = sources.map((s, i) =>
    insert.bind(
      run.id,
      i,
      s.source_id,
      s.program_slug,
      s.url,
      s.ok ? 1 : 0,
      s.error ?? null,
      s.http_status ?? null,
      s.fetched_at ?? null,
      s.sha256 ?? null,
      s.text_sha256 ?? null,
      s.changed ? 1 : 0,
      s.quotes_total,
      s.quotes_found,
      JSON.stringify(s.missing),
    ),
  )
  if (rows.length) await db.batch(rows)
  return run.id
}

function sourceFromRow(r) {
  return {
    source_id: r.source_id,
    program_slug: r.program_slug,
    url: r.url,
    ok: r.ok === 1,
    error: r.error,
    http_status: r.http_status,
    fetched_at: r.fetched_at,
    sha256: r.sha256,
    text_sha256: r.text_sha256,
    changed: r.changed === 1,
    quotes_total: r.quotes_total,
    quotes_found: r.quotes_found,
    missing: JSON.parse(r.missing_json),
  }
}

// Newest first, each with its sources in stored order.
export async function loadRuns(db, limit) {
  const { results: runs } = await db
    .prepare(
      'SELECT id, trigger, started_at, finished_at, sources_total, sources_ok, quotes_missing FROM check_runs ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all()
  if (!runs.length) return []
  const ids = runs.map((r) => r.id)
  const { results: rows } = await db
    .prepare(`SELECT * FROM check_sources WHERE run_id IN (${ids.map(() => '?').join(',')}) ORDER BY run_id, position`)
    .bind(...ids)
    .all()
  const byRun = new Map(ids.map((id) => [id, []]))
  for (const r of rows) byRun.get(r.run_id).push(sourceFromRow(r))
  return runs.map((r) => ({ ...r, sources: byRun.get(r.id) }))
}

async function sourceStatus(env) {
  const newestFirst = await loadRuns(env.DB, STATUS_RUN_WINDOW)
  return sourceStatusFrom(newestFirst.reverse())
}

function originMap(env) {
  if (!env.SOURCE_ORIGIN_MAP) return undefined
  try {
    return JSON.parse(env.SOURCE_ORIGIN_MAP)
  } catch {
    throw new HttpError(500, 'SOURCE_ORIGIN_MAP is not valid JSON.')
  }
}

export async function scanAndStore(env, trigger) {
  const result = await runChecks({
    programs: bundleFor(env).programs,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    originMap: originMap(env),
  })
  const stored = { ...result, trigger }
  const id = await storeRun(env.DB, stored)
  const [run] = (await loadRuns(env.DB, 1)).filter((r) => r.id === id)
  return run
}

// ---------- routes ----------

async function route(request, env, url) {
  const { pathname, searchParams } = url
  const method = request.method
  const bundle = bundleFor(env)

  if (method === 'GET' && pathname === '/api/health') {
    return json(200, { ok: true, data_set: bundle.data_set, programs: bundle.programs.length, built_from: bundle.built_from })
  }

  if (method === 'GET' && pathname === '/api/options') {
    const ref = (list) => list.source
    return json(200, {
      communities: bundle.communities.communities,
      industries: bundle.industries.industries,
      structures: STRUCTURES,
      years: YEARS,
      revenue: REVENUE,
      cost: COST,
      owners: OWNERS,
      purposes: PURPOSES,
      sources: { communities: ref(bundle.communities), industries: ref(bundle.industries) },
    })
  }

  if (method === 'GET' && pathname === '/api/match') {
    const now = clock(url, env)
    const { profile, errors } = parse(searchParams, bundle)
    if (errors.length) throw new HttpError(400, 'Some answers are missing.', { errors })
    const result = matchPrograms(bundle.programs, profile, { now, sourceStatus: await sourceStatus(env) })
    return json(200, { profile, evaluated_at: now.toISOString(), ...result })
  }

  if (method === 'GET' && pathname === '/api/programs') {
    const now = clock(url, env)
    const status = await sourceStatus(env)
    const programs = bundle.programs
      .map((p) => evaluateProgram(p, null, { now, sourceStatus: status }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    return json(200, { programs })
  }

  const detail = /^\/api\/programs\/([^/]+)$/.exec(pathname)
  if (method === 'GET' && detail) {
    const now = clock(url, env)
    let slug
    try {
      slug = decodeURIComponent(detail[1])
    } catch {
      throw new HttpError(404, 'No program has that name.')
    }
    const program = bundle.programs.find((p) => p.slug === slug)
    if (!program) throw new HttpError(404, 'No program has that name.')
    let profile = null
    if (hasProfile(searchParams)) {
      const parsed = parse(searchParams, bundle)
      if (parsed.errors.length) throw new HttpError(400, 'Some answers are missing.', { errors: parsed.errors })
      profile = parsed.profile
    }
    const result = evaluateProgram(program, profile, { now, sourceStatus: await sourceStatus(env) })
    return json(200, { profile, result })
  }

  if (method === 'GET' && pathname === '/api/checks') {
    const raw = Number(searchParams.get('limit') ?? 20)
    const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100) : 20
    return json(200, { runs: await loadRuns(env.DB, limit) })
  }

  if (pathname === '/api/admin/checks') {
    if (method !== 'POST') throw new HttpError(405, 'Use POST.')
    await requireAdmin(request, env)
    const body = await readJsonBody(request)
    const problems = validateChecksResult(body)
    if (problems.length) throw new HttpError(400, 'That is not a valid check run.', { problems })
    return json(200, { stored: await storeRun(env.DB, body) })
  }

  if (pathname === '/api/admin/scan') {
    if (method !== 'POST') throw new HttpError(405, 'Use POST.')
    await requireAdmin(request, env)
    return json(200, await scanAndStore(env, 'manual'))
  }

  throw new HttpError(404, 'Not found.')
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)
    try {
      return await route(request, env, url)
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message, ...err.extra })
      // Never log the request: its query string can hold a profile.
      console.error('Internal error:', err && err.name)
      return json(500, { error: 'Something went wrong on our side.' })
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(scanAndStore(env, 'cron'))
  },
}
