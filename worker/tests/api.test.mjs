// Worker API tests, SAMPLE data set. Run through `npm test` (tests/run.mjs starts everything).
// Files run one at a time and tests in order: the check-run tests change what later answers see.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseProfile } from '../../core/profile.js'
import { matchPrograms } from '../../core/match.js'
import { sourceStatusFrom } from '../../core/checks.js'
import { loadSample, plan } from './fixture-server.mjs'

const BASE = `http://127.0.0.1:${process.env.GM_WORKER_PORT || 7402}`
const FIXTURE = `http://127.0.0.1:${process.env.GM_FIXTURE_PORT || 7404}`
const TOKEN = 'test-admin-token'
const NOW = '2026-09-14T12:00:00Z'
const STALE_NOW = '2026-12-01T12:00:00Z' // +78 days

const PROFILES = {
  auto: 'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=500k_1m&owners=none&purposes=equipment,digital&cost=25k_50k',
  daycare:
    'name=SAMPLE Daycare&community=gander&industry=62&structure=sole_proprietor&employees=4&years=1to2&revenue=100k_300k&owners=women&purposes=hire,training&cost=10k_25k',
}

const bundle = loadSample()
const planted = plan(bundle)

const q = (profile, extra = '') => `${new URLSearchParams(profile).toString()}${extra}`
async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { status: res.status, headers: res.headers, body: await res.json() }
}
async function post(path, body, token = TOKEN) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token == null ? {} : { authorization: `Bearer ${token}` }) },
    body: body == null ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// What core says, given the same clock and the same stored check runs the Worker sees.
async function expected(profileQuery, now) {
  const { runs } = (await get('/api/checks?limit=50')).body
  const sourceStatus = sourceStatusFrom([...runs].reverse())
  const { profile, errors } = parseProfile(new URLSearchParams(profileQuery), {
    communities: bundle.communities,
    industries: bundle.industries,
  })
  assert.deepEqual(errors, [])
  return { profile, ...matchPrograms(bundle.programs, profile, { now: new Date(now), sourceStatus }) }
}

test('health says sample', async () => {
  const { status, body } = await get('/api/health')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.data_set, 'sample')
  assert.equal(body.programs, bundle.programs.length)
  assert.equal(body.built_from, bundle.built_from)
})

test('options lists and their sources', async () => {
  const { status, body } = await get('/api/options')
  assert.equal(status, 200)
  for (const key of ['communities', 'industries', 'structures', 'years', 'revenue', 'cost', 'owners', 'purposes']) {
    assert.ok(Array.isArray(body[key]) && body[key].length > 0, `${key} is a non-empty list`)
  }
  assert.deepEqual(body.communities, bundle.communities.communities)
  assert.deepEqual(body.industries, bundle.industries.industries)
  assert.ok(body.communities.some((c) => c.id === 'grand-falls-windsor'))
  assert.deepEqual(body.sources.communities, bundle.communities.source)
  assert.deepEqual(body.sources.industries, bundle.industries.source)
})

test('400 with errors when community is missing', async () => {
  const params = new URLSearchParams(PROFILES.auto)
  params.delete('community')
  const { status, body } = await get(`/api/match?${params}&now=${NOW}`)
  assert.equal(status, 400)
  assert.equal(body.error, 'Some answers are missing.')
  assert.ok(
    body.errors.some((e) => e.field === 'community'),
    'names the community field',
  )
})

for (const [name, profile] of Object.entries(PROFILES)) {
  test(`/api/match deep-equals core matchPrograms for ${name}`, async () => {
    const { status, body } = await get(`/api/match?${q(profile)}&now=${NOW}`)
    assert.equal(status, 200)
    const want = await expected(profile, NOW)
    assert.equal(body.evaluated_at, new Date(NOW).toISOString())
    assert.deepStrictEqual(body.profile, want.profile)
    assert.deepStrictEqual(body.open, want.open)
    assert.deepStrictEqual(body.closed, want.closed)
    assert.deepStrictEqual(body.counts, want.counts)
    assert.ok(body.open.length + body.closed.length === bundle.programs.length)
  })
}

test("the closed SAMPLE program is in closed as Doesn't fit", async () => {
  const { body } = await get(`/api/match?${q(PROFILES.auto)}&now=${NOW}`)
  const stated = bundle.programs.filter((p) => p.intake.status === 'closed').map((p) => p.slug)
  assert.ok(stated.length >= 1, 'the SAMPLE set has a closed program')
  for (const slug of stated) {
    const r = body.closed.find((x) => x.slug === slug)
    assert.ok(r, `${slug} is in closed`)
    assert.equal(r.fit.label, "Doesn't fit")
    assert.ok(!body.open.some((x) => x.slug === slug), `${slug} is not in open`)
  }
})

test('program detail 200 / 404 / 400, and no profile means no status or fit', async () => {
  const slug = bundle.programs[0].slug
  const withProfile = await get(`/api/programs/${slug}?${q(PROFILES.auto)}&now=${NOW}`)
  assert.equal(withProfile.status, 200)
  assert.equal(withProfile.body.result.slug, slug)
  assert.ok(withProfile.body.profile)
  assert.ok(withProfile.body.result.fit)

  const bare = await get(`/api/programs/${slug}?now=${NOW}`)
  assert.equal(bare.status, 200)
  assert.equal(bare.body.profile, null)
  assert.equal(bare.body.result.fit, null)
  assert.ok(bare.body.result.criteria.length > 0)
  for (const c of bare.body.result.criteria) assert.equal(c.status, null, `${c.id} status is null`)

  assert.equal((await get(`/api/programs/ca-no-such-program?now=${NOW}`)).status, 404)
  const bad = await get(`/api/programs/${slug}?community=nowhere-at-all&now=${NOW}`)
  assert.equal(bad.status, 400)
  assert.ok(Array.isArray(bad.body.errors) && bad.body.errors.length > 0)

  const list = await get(`/api/programs?now=${NOW}`)
  assert.equal(list.status, 200)
  const names = list.body.programs.map((p) => p.name)
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, 'en')),
  )
})

test('now +78 days: stale and no Looks like a fit', async () => {
  const { body } = await get(`/api/match?${q(PROFILES.auto)}&now=${STALE_NOW}`)
  const all = [...body.open, ...body.closed]
  assert.ok(all.length > 0)
  for (const r of all) assert.equal(r.verification.stale, true, `${r.slug} is stale`)
  assert.ok(!all.some((r) => r.fit.label === 'Looks like a fit'))
  assert.equal(body.counts.looks, 0)
})

test('401 with no token or a wrong token', async () => {
  const run = { started_at: NOW, finished_at: NOW, trigger: 'node', sources: [] }
  assert.equal((await post('/api/admin/checks', run, null)).status, 401)
  assert.equal((await post('/api/admin/checks', run, 'wrong-token')).status, 401)
  assert.equal((await post('/api/admin/checks', run, `${TOKEN}x`)).status, 401)
  assert.equal((await post('/api/admin/scan', null, null)).status, 401)
  assert.equal((await post('/api/admin/scan', null, 'wrong-token')).status, 401)
  assert.equal((await post('/api/admin/checks', { nonsense: true })).status, 400)
})

test('a stored run with one missing quote makes that program needs_review, not Looks like a fit', async () => {
  const before = await get(`/api/match?${q(PROFILES.auto)}&now=${NOW}`)
  const target = before.body.open.find((r) => r.fit.label === 'Looks like a fit')
  assert.ok(target, 'SAMPLE Auto Service has a Looks like a fit program to break')
  const record = bundle.programs.find((p) => p.slug === target.slug)
  const source = record.sources[0]
  const quote = record.criteria.find((c) => c.source === source.id) || record.criteria[0]
  const run = {
    started_at: '2026-09-14T11:00:00.000Z',
    finished_at: '2026-09-14T11:00:05.000Z',
    trigger: 'node',
    sources: [
      {
        source_id: source.id,
        program_slug: record.slug,
        url: source.url,
        ok: true,
        error: null,
        http_status: 200,
        fetched_at: '2026-09-14T11:00:01.000Z',
        sha256: 'x',
        text_sha256: 'y',
        changed: true,
        quotes_total: 3,
        quotes_found: 2,
        missing: [{ path: 'criteria[0].quote', quote: quote.quote }],
      },
    ],
  }
  const stored = await post('/api/admin/checks', run)
  assert.equal(stored.status, 200)
  assert.ok(Number.isInteger(stored.body.stored))

  const after = await get(`/api/match?${q(PROFILES.auto)}&now=${NOW}`)
  const r = [...after.body.open, ...after.body.closed].find((x) => x.slug === target.slug)
  assert.equal(r.verification.needs_review, true)
  assert.notEqual(r.fit.label, 'Looks like a fit')

  const { body } = await get('/api/checks')
  const listed = body.runs.find((x) => x.id === stored.body.stored)
  assert.ok(listed, '/api/checks lists the run')
  assert.equal(listed.trigger, 'node')
  assert.equal(listed.quotes_missing, 1)
  assert.deepEqual(listed.sources[0].missing, run.sources[0].missing)
})

test('POST /api/admin/scan against the fixture server stores the missing quote and the robots error', { timeout: 180_000 }, async () => {
  const res = await post('/api/admin/scan', null)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const run = res.body
  assert.equal(run.trigger, 'manual')
  const removed = run.sources.find((s) => s.source_id === planted.removed.source_id)
  assert.ok(removed.ok)
  assert.equal(removed.changed, true)
  assert.ok(
    removed.missing.some((m) => m.quote === planted.removed.quote),
    'the removed quote is named',
  )
  const blocked = run.sources.find((s) => s.source_id === planted.blocked.source_id)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, 'robots.txt disallows')

  const others = run.sources.filter((s) => s.source_id !== planted.removed.source_id && s.source_id !== planted.blocked.source_id)
  for (const s of others) assert.deepEqual(s.missing, [], `${s.source_id} has every quote`)

  const requests = await (await fetch(`${FIXTURE}/__requests`)).json()
  assert.ok(!requests.some((r) => r.path === planted.blocked.path), 'the disallowed page was never requested')
  assert.ok(requests.every((r) => r.ua.startsWith('APCO-Software-Tools-research/1.0')))

  const { body } = await get('/api/checks?limit=1')
  assert.equal(body.runs[0].id, run.id)
  assert.equal(body.runs[0].sources_ok, run.sources.length - 1)
})

test('/__scheduled stores a run with trigger cron', { timeout: 180_000 }, async () => {
  const before = (await get('/api/checks?limit=1')).body.runs[0]?.id ?? 0
  const res = await fetch(`${BASE}/__scheduled?cron=15+10+*+*+1`)
  assert.equal(res.status, 200)
  const until = Date.now() + 150_000
  let run
  while (Date.now() < until) {
    run = (await get('/api/checks?limit=1')).body.runs[0]
    if (run && run.id > before) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  assert.ok(run && run.id > before, 'a new run was stored')
  assert.equal(run.trigger, 'cron')
  assert.equal(
    run.sources_total,
    bundle.programs.reduce((n, p) => n + p.sources.length, 0),
  )
})

test('CORS on a 404 and on OPTIONS', async () => {
  const res = await fetch(`${BASE}/api/nothing-here`)
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
  assert.ok((await res.json()).error)
  const pre = await fetch(`${BASE}/api/match`, { method: 'OPTIONS' })
  assert.equal(pre.status, 204)
  assert.equal(pre.headers.get('access-control-allow-origin'), '*')
})

test('an oversized admin body is refused', async () => {
  const res = await fetch(`${BASE}/api/admin/checks`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ pad: 'x'.repeat(1_100_000) }),
  })
  assert.equal(res.status, 413)
})

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? filesUnder(p) : [p]
  })
}

test('after matching with name=SAMPLE Auto Service, no stored table or file contains that name', async () => {
  const marker = 'SAMPLE Auto Service'
  assert.equal((await get(`/api/match?${q(PROFILES.auto)}&now=${NOW}`)).status, 200)
  assert.equal((await get(`/api/programs/${bundle.programs[0].slug}?${q(PROFILES.auto)}&now=${NOW}`)).status, 200)
  const files = filesUnder(process.env.GM_PERSIST).filter((f) => /\.sqlite(-wal|-shm)?$/.test(f))
  assert.ok(files.length > 0, 'found the local D1 files')
  for (const f of files) {
    const bytes = readFileSync(f)
    assert.ok(!bytes.includes(Buffer.from(marker)) && !bytes.includes(Buffer.from(marker, 'utf16le')), `${f} does not contain the name`)
  }
})
