// Shared test fixtures: the SAMPLE programs, their page texts, the real reference lists and the two test profiles.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pageText, blockText } from '../text.js'
import { sha256Hex } from '../hash.js'
import { parseProfile } from '../profile.js'
import { buildBundle } from '../bundle.js'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const FIXTURES = path.join(ROOT, 'core', 'tests', 'fixtures')
export const NOW = '2026-09-14T12:00:00Z'
export const STALE_NOW = '2026-12-01T12:00:00Z'
export const SAMPLE_FETCHED_AT = '2026-09-01T12:00:00.000Z'

export const AUTO_QUERY =
  'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=500k_1m&owners=none&purposes=equipment,digital&cost=25k_50k'
export const DAYCARE_QUERY =
  'name=SAMPLE Daycare&community=gander&industry=62&structure=sole_proprietor&employees=4&years=1to2&revenue=100k_300k&owners=women&purposes=hire,training&cost=10k_25k'

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

export const clone = (v) => structuredClone(v)

export function reference() {
  return {
    communities: readJson(path.join(ROOT, 'data', 'reference', 'communities.json')),
    industries: readJson(path.join(ROOT, 'data', 'reference', 'industries.json')),
  }
}

export function profileFrom(query, overrides = {}) {
  const params = new URLSearchParams(query)
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) params.delete(k)
    else params.set(k, v)
  }
  const { profile, errors } = parseProfile(params, reference())
  if (errors.length) throw new Error(`test profile invalid: ${JSON.stringify(errors)}`)
  return profile
}

export function samplePrograms() {
  const dir = path.join(FIXTURES, 'programs')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(dir, f)))
}

export function sampleProgram(slug) {
  return readJson(path.join(FIXTURES, 'programs', `${slug}.json`))
}

export function sampleHtml(sourceId) {
  return fs.readFileSync(path.join(FIXTURES, 'sources', `${sourceId}.html`), 'utf8')
}

/** { [source id]: { text, sha256, text_sha256 } } for every fixture page. */
export async function samplePageTexts() {
  const dir = path.join(FIXTURES, 'sources')
  const out = {}
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => x.endsWith('.html'))
    .sort()) {
    const bytes = fs.readFileSync(path.join(dir, f))
    const html = bytes.toString('utf8')
    const text = pageText(html)
    out[f.replace(/\.html$/, '')] = {
      text,
      block: blockText(html),
      sha256: await sha256Hex(new Uint8Array(bytes)),
      text_sha256: await sha256Hex(text),
    }
  }
  return out
}

/** The SAMPLE bundle's programs (quotes expanded), as the Worker and app get them. */
export async function sampleBundlePrograms() {
  const { communities, industries } = reference()
  const { bundle, problems } = buildBundle({
    programs: samplePrograms(),
    pageTexts: await samplePageTexts(),
    communities,
    industries,
    data_set: 'sample',
  })
  if (problems.length) throw new Error(`SAMPLE bundle has problems: ${JSON.stringify(problems)}`)
  return bundle.programs
}

export function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString()
}
