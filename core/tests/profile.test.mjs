import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProfile, profileToQuery, STRUCTURES, YEARS, REVENUE, COST, OWNERS, PURPOSES, FUNDING_TYPES } from '../profile.js'
import { reference, profileFrom, AUTO_QUERY, DAYCARE_QUERY } from './helpers.mjs'

test('both test profiles parse and are normalised', () => {
  const auto = profileFrom(AUTO_QUERY)
  assert.equal(auto.name, 'SAMPLE Auto Service')
  assert.deepEqual(auto.community, { id: 'grand-falls-windsor', name: 'Grand Falls-Windsor', census_division: 6 })
  assert.deepEqual(auto.industry, { id: '81', name: 'Other services (except public administration)' })
  assert.equal(auto.employees, 6)
  assert.deepEqual(auto.owners, [])
  assert.deepEqual(auto.purposes, ['equipment', 'digital'])
  assert.equal(auto.cost, '25k_50k')

  const daycare = profileFrom(DAYCARE_QUERY)
  assert.equal(daycare.community.id, 'gander')
  assert.deepEqual(daycare.owners, ['women'])
})

test('parseProfile(profileToQuery(p)) round-trips', () => {
  for (const q of [AUTO_QUERY, DAYCARE_QUERY, `${AUTO_QUERY.replace('owners=none&', '').replace('&cost=25k_50k', '')}`]) {
    const p = profileFrom(q)
    const again = parseProfile(new URLSearchParams(profileToQuery(p)), reference())
    assert.deepEqual(again.errors, [])
    assert.deepEqual(again.profile, p)
  }
  // Plain objects work as input too.
  const p = profileFrom(DAYCARE_QUERY)
  assert.deepEqual(parseProfile(Object.fromEntries(new URLSearchParams(profileToQuery(p))), reference()).profile, p)
})

test('owners: absent vs none vs a list', () => {
  assert.equal(profileFrom(AUTO_QUERY, { owners: null }).owners, null)
  assert.deepEqual(profileFrom(AUTO_QUERY, { owners: 'none' }).owners, [])
  assert.deepEqual(profileFrom(AUTO_QUERY, { owners: 'youth,women' }).owners, ['women', 'youth'])
  const both = parseProfile(new URLSearchParams(AUTO_QUERY.replace('owners=none', 'owners=none,women')), reference())
  assert.equal(both.errors[0].field, 'owners')
})

test('missing or unknown answers are plain-English errors per field', () => {
  const noCommunity = parseProfile(new URLSearchParams(AUTO_QUERY.replace('community=grand-falls-windsor&', '')), reference())
  assert.equal(noCommunity.profile, null)
  assert.deepEqual(noCommunity.errors, [{ field: 'community', message: 'Pick your community.' }])

  const bad = parseProfile(
    {
      community: 'atlantis',
      industry: '99',
      structure: 'llc',
      employees: '-3',
      years: 'ages',
      revenue: 'lots',
      purposes: 'fun',
      cost: 'cheap',
      owners: 'aliens',
    },
    reference(),
  )
  assert.deepEqual(
    bad.errors.map((e) => e.field),
    ['community', 'industry', 'structure', 'employees', 'years', 'revenue', 'owners', 'purposes', 'cost'],
  )
  for (const e of bad.errors) assert.match(e.message, /^[A-Z].*\.$/)

  const empty = parseProfile({}, reference())
  assert.deepEqual(
    empty.errors.map((e) => e.field),
    ['community', 'industry', 'structure', 'employees', 'years', 'revenue', 'purposes'],
  )
  assert.ok(
    parseProfile({ ...Object.fromEntries(new URLSearchParams(AUTO_QUERY)), name: 'x'.repeat(81) }, reference()).errors.some(
      (e) => e.field === 'name',
    ),
  )
})

test('option lists are exported with ids, labels and intervals', () => {
  for (const list of [STRUCTURES, YEARS, REVENUE, COST, OWNERS, PURPOSES, FUNDING_TYPES]) {
    assert.ok(list.length > 0)
    for (const o of list) assert.ok(o.id && o.label)
  }
  assert.deepEqual(YEARS.find((y) => y.id === '1to2').interval, { min: 12, max: 24, min_inclusive: true, max_inclusive: false })
  assert.equal(REVENUE.find((r) => r.id === 'unsaid').interval, undefined)
  assert.equal(REVENUE.find((r) => r.id === '100m_plus').interval.max, null)
})
