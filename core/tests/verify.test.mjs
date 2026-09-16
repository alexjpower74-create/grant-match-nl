import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyProgram, quotesOf } from '../verify.js'
import { validateProgram } from '../schema.js'
import { sampleProgram, samplePrograms, samplePageTexts, clone } from './helpers.mjs'

const has = (problems, prefix) => problems.some((p) => p.startsWith(prefix))

test('every SAMPLE program verifies clean', async () => {
  const texts = await samplePageTexts()
  for (const p of samplePrograms()) assert.deepEqual(verifyProgram(p, texts), [], p.slug)
})

test('a one-character-changed quote is flagged with its path', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-growth-grant')
  p.criteria[2].quote = p.criteria[2].quote.replace('fewer', 'fewor')
  const problems = verifyProgram(p, texts)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /^criteria\[2\]\.quote: this quote is not in the page text of nl-sample-growth-grant--main/)
})

test('case and curly quotes matter: no normalisation beyond pageText', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-women-entrepreneur-loan')
  p.contacts[0].quote = p.contacts[0].quote.replaceAll('‑', '-')
  assert.ok(has(verifyProgram(p, texts), 'contacts[0].quote:'))
  const q = sampleProgram('nl-sample-equipment-loan')
  q.intake.quote = 'applications are accepted year-round.'
  assert.ok(has(verifyProgram(q, texts), 'intake.quote:'))
})

test('a bound number that is not in its quote is flagged', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-growth-grant')
  p.criteria[2].rule.lt = 1000
  assert.deepEqual(verifyProgram(p, texts), ['criteria[2].rule.lt: 1000 is not written in this criterion’s quote'])
  const q = sampleProgram('nl-sample-equipment-loan')
  q.criteria[2].rule.lt = 1000000 // the page says $10 million
  assert.ok(has(verifyProgram(q, texts), 'criteria[2].rule.lt:'))
})

test('a wrong amount or percentage is flagged', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-growth-grant')
  p.max_amount.amount = 5000
  p.cost_share.percent = 60
  const problems = verifyProgram(p, texts)
  assert.ok(has(problems, 'max_amount.amount:'))
  assert.ok(has(problems, 'cost_share.percent:'))
})

test('a missing source file, or a source not in sources, is flagged', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-growth-grant')
  const without = { ...texts }
  delete without['nl-sample-growth-grant--contact']
  assert.deepEqual(verifyProgram(p, without), ['sources[1]: the saved page data/sources/nl-sample-growth-grant--contact.html is missing'])

  const q = sampleProgram('nl-sample-growth-grant')
  q.criteria[0].source = 'nl-sample-growth-grant--elsewhere'
  assert.ok(has(verifyProgram(q, texts), 'criteria[0].source: "nl-sample-growth-grant--elsewhere" is not in sources'))
})

test('a bad hash is flagged', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-community-fund')
  p.sources[0].sha256 = 'f'.repeat(64)
  assert.ok(has(verifyProgram(p, texts), 'sources[0].sha256: does not match the saved file'))
  const q = sampleProgram('nl-sample-community-fund')
  q.sources[0].text_sha256 = 'e'.repeat(64)
  assert.ok(has(verifyProgram(q, texts), 'sources[0].text_sha256:'))
})

test('a deadline date that is not in its quote is flagged', async () => {
  const texts = await samplePageTexts()
  for (const date of ['2026-10-16', '2026-11-15']) {
    const p = sampleProgram('nl-sample-wage-subsidy')
    p.intake.deadline.date = date
    assert.ok(has(verifyProgram(p, texts), 'intake.deadline.date:'), date)
  }
})

test('a phone or email not in its contact quote is flagged', async () => {
  const texts = await samplePageTexts()
  const p = sampleProgram('nl-sample-women-entrepreneur-loan')
  p.contacts[0].phone = '709-555-0198'
  p.contacts[0].email = 'other@sample.invalid'
  const problems = verifyProgram(p, texts)
  assert.ok(has(problems, 'contacts[0].phone:'))
  assert.ok(has(problems, 'contacts[0].email:'))
})

test('schema: SAMPLE naming, enums, unique criterion ids, rule shapes', () => {
  const p = sampleProgram('nl-sample-growth-grant')
  assert.deepEqual(validateProgram(p), [])
  const withUnclear = clone(p)
  withUnclear.criteria[1].rule = { kind: 'structure', in: ['corporation', 'sole_proprietor'], unclear: ['cooperative', 'nonprofit'] }
  assert.deepEqual(validateProgram(withUnclear), [])
  withUnclear.criteria[3].rule = { kind: 'purpose', any: ['equipment'], unclear: ['digital', 'research'] }
  assert.deepEqual(validateProgram(withUnclear), [], 'unclear is allowed on purpose rules (API §4, DECISIONS #22)')

  const cases = [
    [
      (r) => {
        r.name = 'Growth Grant'
      },
      'name:',
    ],
    [
      (r) => {
        r.sources[0].url = 'https://www.gov.nl.ca/x'
      },
      'sources[0].url:',
    ],
    [
      (r) => {
        r.sample = false
      },
      'url:',
    ],
    [
      (r) => {
        r.level = 'city'
      },
      'level:',
    ],
    [
      (r) => {
        r.intake.status = 'maybe'
      },
      'intake.status:',
    ],
    [
      (r) => {
        r.criteria[1].id = 'location'
      },
      'criteria[1].id:',
    ],
    [
      (r) => {
        r.criteria[1].rule = { kind: 'structure', in: ['llc'] }
      },
      'criteria[1].rule.in[0]:',
    ],
    [
      (r) => {
        r.criteria[2].rule = { kind: 'employees' }
      },
      'criteria[2].rule:',
    ],
    [
      (r) => {
        r.criteria[1].rule = { kind: 'structure', in: ['corporation'], unclear: ['corporation'] }
      },
      'criteria[1].rule.unclear:',
    ],
    [
      (r) => {
        r.criteria[1].rule = { kind: 'structure', in: ['corporation'], unclear: ['llc'] }
      },
      'criteria[1].rule.unclear[0]:',
    ],
    [
      (r) => {
        r.criteria[1].rule = { kind: 'structure', in: ['corporation'], unclear: [] }
      },
      'criteria[1].rule.unclear:',
    ],
    [
      (r) => {
        r.criteria[2].rule = { kind: 'employees', lt: 100, unclear: ['x'] }
      },
      'criteria[2].rule.unclear:',
    ],
    [
      (r) => {
        r.criteria[2].rule = { kind: 'employees', lt: 100, normally: false }
      },
      'criteria[2].rule.normally:',
    ],
    [
      (r) => {
        r.criteria[1].rule = { kind: 'structure', in: ['corporation'], normally: true }
      },
      'criteria[1].rule.normally:',
    ],
    [
      (r) => {
        r.criteria[3].rule = { kind: 'purpose', any: ['digital'], unclear: ['digital'] }
      },
      'criteria[3].rule.unclear:',
    ],
    [
      (r) => {
        r.criteria[3].rule = { kind: 'purpose', any: ['digital'], unclear: ['gardening'] }
      },
      'criteria[3].rule.unclear[0]:',
    ],
    [
      (r) => {
        r.criteria[0].rule = { kind: 'location', province: 'NL', unclear: ['gander'] }
      },
      'criteria[0].rule.unclear:',
    ],
    [
      (r) => {
        r.criteria[5].rule = { kind: 'self_check', note: 'x' }
      },
      'criteria[5].rule.note:',
    ],
    [
      (r) => {
        r.criteria[0].quote = ' short'
      },
      'criteria[0].quote:',
    ],
    [
      (r) => {
        r.extra = 1
      },
      'extra:',
    ],
    [
      (r) => {
        r.sources[0].fetched_at = '2026-09-01 12:00'
      },
      'sources[0].fetched_at:',
    ],
    [
      (r) => {
        r.sources[0].id = 'other--main'
      },
      'sources[0].id:',
    ],
  ]
  for (const [mutate, prefix] of cases) {
    const r = clone(p)
    mutate(r)
    assert.ok(has(validateProgram(r), prefix), `expected a problem at ${prefix}`)
  }
})

test('quotesOf lists every quote with its path', () => {
  const paths = quotesOf(sampleProgram('nl-sample-wage-subsidy')).map((q) => q.path)
  assert.deepEqual(paths, [
    'summary.quote',
    'funding_types[0].quote',
    'intake.quote',
    'intake.deadline.quote',
    'max_amount.quote',
    'cost_share.quote',
    'criteria[0].quote',
    'criteria[1].quote',
    'criteria[2].quote',
  ])
})
