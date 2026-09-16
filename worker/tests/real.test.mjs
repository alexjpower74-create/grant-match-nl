// Real data set checks. Skipped unless GM_REAL=1 (the lead runs this in QA with DATA_SET=real).
import { test } from 'node:test'
import assert from 'node:assert/strict'

const REAL = process.env.GM_REAL === '1'
const BASE = `http://127.0.0.1:${process.env.GM_WORKER_PORT || 7402}`
const get = async (path) => {
  const res = await fetch(`${BASE}${path}`)
  return { status: res.status, body: await res.json() }
}

test('real data: every program answers, every criterion has a quote with context, CDAP is closed', {
  skip: !REAL && 'set GM_REAL=1',
}, async () => {
  const health = await get('/api/health')
  assert.equal(health.body.data_set, 'real')
  const { body } = await get('/api/programs')
  assert.ok(body.programs.length > 0)
  for (const p of body.programs) {
    const detail = await get(`/api/programs/${encodeURIComponent(p.slug)}`)
    assert.equal(detail.status, 200, `${p.slug} answers`)
    assert.equal(detail.body.result.sample, false, `${p.slug} is not SAMPLE`)
    for (const c of detail.body.result.criteria) {
      assert.ok(typeof c.quote === 'string' && c.quote.length >= 12, `${p.slug} ${c.id} has a quote`)
      assert.ok(c.context && typeof c.context.before === 'string' && typeof c.context.after === 'string', `${p.slug} ${c.id} has context`)
      assert.ok(c.source_url, `${p.slug} ${c.id} has a source_url`)
    }
  }
  const cdap = body.programs.find((p) => p.slug === 'ca-canada-digital-adoption-program')
  if (cdap) {
    assert.equal(cdap.intake.status, 'closed')
    assert.ok(cdap.intake.quote?.quote, 'CDAP closed status has its quote')
  }
})
