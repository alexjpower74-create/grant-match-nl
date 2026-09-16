// scripts/scan.mjs end to end against a local server that plays both the SAMPLE site and the Worker.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { ROOT, samplePrograms, sampleHtml } from './helpers.mjs'

const REMOVED_QUOTE = 'Projects costing at least $10,000'
fs.mkdirSync(path.join(ROOT, 'core', 'tests', '.tmp'), { recursive: true })
const TMP = fs.mkdtempSync(path.join(ROOT, 'core', 'tests', '.tmp', 'scan-test-'))

const pages = new Map()
const posts = []
let server
let origin

before(async () => {
  for (const p of samplePrograms()) for (const s of p.sources) pages.set(new URL(s.url).pathname, s.id)
  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/admin/checks') {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        posts.push({ auth: req.headers.authorization ?? null, body })
        if (req.headers.authorization !== 'Bearer test-admin-token') {
          res.writeHead(401)
          res.end('{"error":"no"}')
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{"stored":42}')
      })
      return
    }
    if (req.url === '/robots.txt') {
      res.writeHead(200)
      res.end('User-agent: *\nDisallow:\n')
      return
    }
    const id = pages.get(req.url)
    if (!id) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    const html = sampleHtml(id)
    res.end(id === 'nl-sample-growth-grant--main' ? html.replace(REMOVED_QUOTE, 'Projects of any size') : html)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
  return new Promise((resolve) => server.close(resolve))
})

function scan(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts/scan.mjs'), ...args], {
      cwd: ROOT,
      env: { ...process.env, GM_ADMIN_TOKEN: '', GM_SCAN_ORIGIN_MAP: JSON.stringify({ 'https://sample.invalid': origin }), ...env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => {
      stdout += c
    })
    child.stderr.on('data', (c) => {
      stderr += c
    })
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

test('--dry: summary names the missing quote, latest.json is written, raw pages are cached, nothing is POSTed', async () => {
  const scans = path.join(TMP, 'dry')
  const r = await scan(['--sample', '--dry', '--only', 'nl-sample-growth-grant', '--scans', scans])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Checked 2 source pages: 2 fetched fine, 0 not\./)
  assert.match(r.stdout, /Quotes missing for nl-sample-growth-grant: 1\n {2}nl-sample-growth-grant--main criteria\[4\]\.quote/)
  assert.match(r.stdout, /Page text changed since it was saved: nl-sample-growth-grant--main\n/)
  assert.match(r.stdout, /Dry run: nothing sent to the Worker\./)

  const latest = JSON.parse(fs.readFileSync(path.join(scans, 'latest.json'), 'utf8'))
  assert.equal(latest.trigger, 'node')
  assert.deepEqual(
    latest.sources.map((s) => s.source_id),
    ['nl-sample-growth-grant--main', 'nl-sample-growth-grant--contact'],
  )

  const stamps = fs.readdirSync(scans).filter((f) => f !== 'latest.json')
  assert.equal(stamps.length, 1)
  assert.match(stamps[0], /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/)
  const cached = fs.readFileSync(path.join(scans, stamps[0], 'nl-sample-growth-grant--contact.html'), 'utf8')
  assert.equal(cached, sampleHtml('nl-sample-growth-grant--contact'), 'raw bytes cached as served')
  assert.equal(posts.length, 0)
})

test('without --dry the result is POSTed with the Bearer token and the stored id is reported', async () => {
  posts.length = 0
  const r = await scan(['--sample', '--only', 'nl-sample-community-fund', '--scans', path.join(TMP, 'post'), '--worker', origin], {
    GM_ADMIN_TOKEN: 'test-admin-token',
  })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(posts.length, 1)
  assert.equal(posts[0].auth, 'Bearer test-admin-token')
  const body = JSON.parse(posts[0].body)
  assert.deepEqual(
    body.sources.map((s) => s.source_id),
    ['nl-sample-community-fund--main'],
  )
  assert.match(r.stdout, /stored run 42/)
  assert.ok(!r.stdout.includes('test-admin-token') && !r.stderr.includes('test-admin-token'), 'the token is never printed')
})

test('the token can come from a .dev.vars file; a missing token stops before any fetch; a 401 exits 1', async () => {
  const devVars = path.join(TMP, '.dev.vars')
  fs.writeFileSync(devVars, 'ALLOW_NOW=1\nADMIN_TOKEN=test-admin-token\n')
  posts.length = 0
  const fromFile = await scan([
    '--sample',
    '--only',
    'nl-sample-community-fund',
    '--scans',
    path.join(TMP, 'file'),
    '--worker',
    origin,
    '--dev-vars',
    devVars,
  ])
  assert.equal(fromFile.status, 0, fromFile.stderr)
  assert.equal(posts[0].auth, 'Bearer test-admin-token')

  const none = await scan(['--sample', '--scans', path.join(TMP, 'none'), '--worker', origin, '--dev-vars', path.join(TMP, 'missing.vars')])
  assert.equal(none.status, 1)
  assert.match(none.stderr, /no admin token/)
  assert.equal(fs.existsSync(path.join(TMP, 'none')), false, 'nothing fetched or written')

  const wrong = await scan(['--sample', '--only', 'nl-sample-community-fund', '--scans', path.join(TMP, 'wrong'), '--worker', origin], {
    GM_ADMIN_TOKEN: 'wrong',
  })
  assert.equal(wrong.status, 1)
  assert.match(wrong.stderr, /the Worker answered HTTP 401/)
})

test('--sample scans even when the real data has a problem; scanning the real set is refused', async () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'data-'))
  fs.cpSync(path.join(ROOT, 'data', 'reference'), path.join(dir, 'reference'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'sources'))
  for (const f of fs.readdirSync(path.join(ROOT, 'data', 'sources')).filter((x) => x.startsWith('ref-'))) {
    fs.copyFileSync(path.join(ROOT, 'data', 'sources', f), path.join(dir, 'sources', f))
  }
  fs.mkdirSync(path.join(dir, 'programs'))
  fs.writeFileSync(path.join(dir, 'programs', 'nl-broken.json'), '{ not json')

  const sample = await scan([
    '--sample',
    '--dry',
    '--only',
    'nl-sample-community-fund',
    '--data',
    dir,
    '--scans',
    path.join(TMP, 'sample-ok'),
  ])
  assert.equal(sample.status, 0, sample.stderr)
  assert.match(sample.stdout, /Checked 1 source page: 1 fetched fine, 0 not\./)

  const real = await scan(['--dry', '--data', dir, '--scans', path.join(TMP, 'real-refused')])
  assert.equal(real.status, 1)
  assert.match(real.stderr, /nl-broken\.json: \$: not valid JSON/)
  assert.equal(fs.existsSync(path.join(TMP, 'real-refused')), false, 'nothing fetched or written')
})

test('--only with an unknown slug is refused', async () => {
  const r = await scan(['--sample', '--dry', '--only', 'nl-sample-nope', '--scans', path.join(TMP, 'nope')])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no program named nl-sample-nope/)
})
