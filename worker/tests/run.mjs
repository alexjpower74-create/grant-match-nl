#!/usr/bin/env node
// npm test (worker/): fresh local D1, SAMPLE fixture server, wrangler dev --local --test-scheduled, node --test.
// Always stops what it started, pass or fail.
import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { startFixtureServer } from './fixture-server.mjs'

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_PORT = Number(process.env.GM_WORKER_PORT || 7402)
const FIXTURE_PORT = Number(process.env.GM_FIXTURE_PORT || 7404)
const PERSIST = '.wrangler/test-state'
const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', GM_WORKER_PORT: String(WORKER_PORT), GM_FIXTURE_PORT: String(FIXTURE_PORT), GM_PERSIST: resolve(workerDir, PERSIST) }

let dev
let fixture
let stopping = false

function stop(code) {
  if (stopping) return
  stopping = true
  if (dev && dev.exitCode === null) {
    try {
      process.kill(-dev.pid, 'SIGTERM')
    } catch {}
  }
  fixture?.server.close()
  setTimeout(() => {
    if (dev && dev.exitCode === null) {
      try {
        process.kill(-dev.pid, 'SIGKILL')
      } catch {}
    }
    process.exit(code)
  }, 1500).unref()
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop(130))

async function waitForHealth(ms) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (dev.exitCode !== null) throw new Error(`wrangler dev exited with ${dev.exitCode}`)
    try {
      const res = await fetch(`http://127.0.0.1:${WORKER_PORT}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('The Worker did not answer /api/health in time.')
}

async function main() {
  rmSync(resolve(workerDir, PERSIST), { recursive: true, force: true })
  const migrate = spawnSync('wrangler', ['d1', 'migrations', 'apply', 'grant-match-nl', '--local', '--persist-to', PERSIST], { cwd: workerDir, env, stdio: 'inherit' })
  if (migrate.status !== 0) throw new Error('Applying the D1 migrations failed.')

  fixture = await startFixtureServer(FIXTURE_PORT)

  const originMap = JSON.stringify({ 'https://sample.invalid': `http://127.0.0.1:${FIXTURE_PORT}` })
  dev = spawn(
    'wrangler',
    ['dev', '--local', '--port', String(WORKER_PORT), '--persist-to', PERSIST, '--test-scheduled',
      '--var', 'DATA_SET:sample', '--var', 'ALLOW_NOW:1', '--var', 'ADMIN_TOKEN:test-admin-token',
      '--var', `SOURCE_ORIGIN_MAP:${originMap}`],
    { cwd: workerDir, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  )
  const log = []
  dev.stdout.on('data', (d) => log.push(String(d)))
  dev.stderr.on('data', (d) => log.push(String(d)))

  try {
    await waitForHealth(90_000)
  } catch (err) {
    console.error(log.join(''))
    throw err
  }

  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['tests/api.test.mjs', 'tests/real.test.mjs']
  const test = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: workerDir, env, stdio: 'inherit' })
  const code = await new Promise((r) => test.on('exit', (c) => r(c ?? 1)))
  if (code !== 0 && process.env.GM_WORKER_LOG) console.error(log.join(''))
  stop(code)
}

main().catch((err) => {
  console.error(err.message)
  stop(1)
})
