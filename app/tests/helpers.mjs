// Shared test helpers. Expected answers come from the real core run in Node on data/build/sample.json.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseProfile } from '../../core/profile.js'
import { matchPrograms, evaluateProgram } from '../../core/match.js'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const bundle = JSON.parse(readFileSync(resolve(repo, 'data/build/sample.json'), 'utf8'))

export const NOW = '2026-09-14T12:00:00Z'
export const STALE_NOW = '2026-12-01T12:00:00Z'

export const PROFILES = {
  auto: 'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=500k_1m&owners=none&purposes=equipment,digital&cost=25k_50k',
  daycare:
    'name=SAMPLE Daycare&community=gander&industry=62&structure=sole_proprietor&employees=4&years=1to2&revenue=100k_300k&owners=women&purposes=hire,training&cost=10k_25k',
  // SAMPLE Auto Service with owners and cost left unanswered, so not_answered shows up.
  autoUnanswered:
    'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=500k_1m&purposes=equipment,digital',
  // SAMPLE Auto Service in the $2M–$10M revenue band, which sits on both sides of a SAMPLE loan's $5,000,000 limit.
  autoStraddle:
    'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=2m_10m&owners=none&purposes=equipment,digital&cost=25k_50k',
  // The printout's worst case on the SAMPLE set: 7 programs could fit, so it prints 6 and "and 1 more". Found by
  // searching answer combinations with core; unstyled, this printout runs to 2 pages.
  printWorst:
    'name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=lt1&revenue=unsaid&purposes=hire,equipment,digital,startup,training',
}

export const qs = (profile, extra = {}) => {
  const p = new URLSearchParams(profile)
  p.set('mock', '1')
  if (!('now' in extra)) p.set('now', NOW)
  for (const [k, v] of Object.entries(extra)) p.set(k, v)
  return p.toString()
}

export function profileOf(query) {
  const { profile, errors } = parseProfile(new URLSearchParams(query), { communities: bundle.communities, industries: bundle.industries })
  if (errors.length) throw new Error(JSON.stringify(errors))
  return profile
}

export const coreMatch = (query, now = NOW) => matchPrograms(bundle.programs, profileOf(query), { now: new Date(now), sourceStatus: {} })
export const coreProgram = (slug, query, now = NOW) =>
  evaluateProgram(
    bundle.programs.find((p) => p.slug === slug),
    query ? profileOf(query) : null,
    { now: new Date(now), sourceStatus: {} },
  )

export const isPhone = (testInfo) => testInfo.project.name.endsWith('-390')

// Real input: a tap on the phone projects, a mouse click on desktop.
export async function press(locator, testInfo) {
  await locator.scrollIntoViewIfNeeded()
  if (isPhone(testInfo)) await locator.tap()
  else await locator.click()
}

// Every Quote a ProgramResult carries, in no particular order.
export function quotesOf(r) {
  const out = [r.summary, ...r.funding_types, r.intake.quote, r.intake.deadline, r.max_amount, r.cost_share, ...r.contacts, ...r.criteria]
  return out.filter((q) => q && q.quote)
}
