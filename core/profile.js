// Business profile — docs/API.md §2. Pure ESM, no dependencies.
//
// An interval is { min, max, min_inclusive, max_inclusive }; max null means no upper limit.

const iv = (min, max, minInclusive = true, maxInclusive = false) => ({ min, max, min_inclusive: minInclusive, max_inclusive: maxInclusive })

export const STRUCTURES = [
  { id: 'sole_proprietor', label: 'Sole proprietor' },
  { id: 'partnership', label: 'Partnership' },
  { id: 'corporation', label: 'Incorporated company' },
  { id: 'cooperative', label: 'Co-operative' },
  { id: 'nonprofit', label: 'Non-profit or charity' },
  { id: 'not_registered', label: 'Not registered yet' },
  { id: 'unsure', label: 'Not sure' },
]

// Months.
export const YEARS = [
  { id: 'not_started', label: 'Not started yet', interval: iv(0, 0, true, true) },
  { id: 'lt1', label: 'Less than 1 year', interval: iv(0, 12, false, false) },
  { id: '1to2', label: '1 to 2 years', interval: iv(12, 24) },
  { id: '2to3', label: '2 to 3 years', interval: iv(24, 36) },
  { id: '3to5', label: '3 to 5 years', interval: iv(36, 60) },
  { id: '5to10', label: '5 to 10 years', interval: iv(60, 120) },
  { id: '10plus', label: 'More than 10 years', interval: iv(120, null) },
]

// Dollars per year. `unsaid` has no interval (→ unknown).
export const REVENUE = [
  { id: 'none', label: 'No revenue yet', interval: iv(0, 0, true, true) },
  { id: 'lt30k', label: 'Under $30,000', interval: iv(0, 30000, false, false) },
  { id: '30k_100k', label: '$30,000 to $100,000', interval: iv(30000, 100000) },
  { id: '100k_300k', label: '$100,000 to $300,000', interval: iv(100000, 300000) },
  { id: '300k_500k', label: '$300,000 to $500,000', interval: iv(300000, 500000) },
  { id: '500k_1m', label: '$500,000 to $1 million', interval: iv(500000, 1000000) },
  { id: '1m_2m', label: '$1 million to $2 million', interval: iv(1000000, 2000000) },
  { id: '2m_10m', label: '$2 million to $10 million', interval: iv(2000000, 10000000) },
  { id: '10m_100m', label: '$10 million to $100 million', interval: iv(10000000, 100000000) },
  { id: '100m_plus', label: 'More than $100 million', interval: iv(100000000, null) },
  { id: 'unsaid', label: 'Prefer not to say' },
]

// Dollars. `unsure` has no interval (→ unknown).
export const COST = [
  { id: 'lt10k', label: 'Under $10,000', interval: iv(0, 10000, false, false) },
  { id: '10k_25k', label: '$10,000 to $25,000', interval: iv(10000, 25000) },
  { id: '25k_50k', label: '$25,000 to $50,000', interval: iv(25000, 50000) },
  { id: '50k_100k', label: '$50,000 to $100,000', interval: iv(50000, 100000) },
  { id: '100k_250k', label: '$100,000 to $250,000', interval: iv(100000, 250000) },
  { id: '250k_1m', label: '$250,000 to $1 million', interval: iv(250000, 1000000) },
  { id: '1m_plus', label: 'More than $1 million', interval: iv(1000000, null) },
  { id: 'unsure', label: 'Not sure' },
]

export const OWNERS = [
  { id: 'women', label: 'Women' },
  { id: 'indigenous', label: 'Indigenous people' },
  { id: 'youth', label: 'A young person (18 to 39)' },
  { id: 'newcomer', label: 'A newcomer to Canada (arrived in the last 5 years)' },
  { id: 'francophone', label: 'Francophone' },
]

export const PURPOSES = [
  { id: 'hire', label: 'Hire or pay wages' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'digital', label: 'Software or digital' },
  { id: 'export', label: 'Export or new markets' },
  { id: 'training', label: 'Training' },
  { id: 'research', label: 'Research or innovation' },
  { id: 'energy', label: 'Energy efficiency' },
  { id: 'startup', label: 'Starting the business' },
]

export const FUNDING_TYPES = [
  { id: 'non_repayable', label: 'Non-repayable' },
  { id: 'wage_subsidy', label: 'Wage subsidy' },
  { id: 'tax_credit', label: 'Tax credit' },
  { id: 'repayable', label: 'Repayable' },
  { id: 'loan', label: 'Loan' },
]

const ids = (list) => list.map((o) => o.id)
const byId = (list, id) => list.find((o) => o.id === id) ?? null

/** The option (with its interval) for an id in one of the lists above, or null. */
export function option(list, id) {
  return byId(list, id)
}

function listOf(ref, key) {
  if (Array.isArray(ref)) return ref
  if (ref && Array.isArray(ref[key])) return ref[key]
  return []
}

function read(input, key) {
  let v = input instanceof URLSearchParams ? input.get(key) : input?.[key]
  if (v === undefined || v === null) return null
  v = String(v).trim()
  return v === '' ? null : v
}

function splitList(v) {
  return [
    ...new Set(
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
}

/**
 * parseProfile(input, { communities, industries }) → { profile, errors }.
 * `communities`/`industries` may be the reference arrays or the whole reference JSON objects.
 */
export function parseProfile(input, { communities, industries } = {}) {
  const errors = []
  const err = (field, message) => errors.push({ field, message })
  const communityList = listOf(communities, 'communities')
  const industryList = listOf(industries, 'industries')
  input = input ?? {}

  const name = read(input, 'name')
  if (name !== null && name.length > 80) err('name', 'Keep the business name to 80 characters or fewer.')

  let community = null
  const communityId = read(input, 'community')
  if (communityId === null) err('community', 'Pick your community.')
  else {
    const c = communityList.find((x) => x.id === communityId)
    if (!c) err('community', 'We don’t have that community on our list. Pick it from the list.')
    else community = { id: c.id, name: c.name, census_division: c.census_division }
  }

  let industry = null
  const industryId = read(input, 'industry')
  if (industryId === null) err('industry', 'Pick your industry.')
  else {
    const i = industryList.find((x) => x.id === industryId)
    if (!i) err('industry', 'We don’t have that industry on our list. Pick it from the list.')
    else industry = { id: i.id, name: i.name }
  }

  const structure = read(input, 'structure')
  if (structure === null) err('structure', 'Pick how your business is set up.')
  else if (!byId(STRUCTURES, structure)) err('structure', 'Pick how your business is set up from the list.')

  let employees = null
  const employeesRaw = read(input, 'employees')
  if (employeesRaw === null) err('employees', 'Enter how many people work in the business.')
  else if (!/^\d{1,6}$/.test(employeesRaw) || Number(employeesRaw) > 100000) {
    err('employees', 'Enter the number of people as a whole number, 0 or more.')
  } else employees = Number(employeesRaw)

  const years = read(input, 'years')
  if (years === null) err('years', 'Pick how long the business has been operating.')
  else if (!byId(YEARS, years)) err('years', 'Pick how long the business has been operating from the list.')

  const revenue = read(input, 'revenue')
  if (revenue === null) err('revenue', 'Pick your yearly revenue, or “Prefer not to say”.')
  else if (!byId(REVENUE, revenue)) err('revenue', 'Pick your yearly revenue from the list.')

  let owners = null
  const ownersRaw = read(input, 'owners')
  if (ownersRaw !== null) {
    const picked = splitList(ownersRaw)
    if (picked.includes('none')) {
      if (picked.length > 1) err('owners', 'Pick “None of these” or who owns the business, not both.')
      else owners = []
    } else if (picked.some((p) => !byId(OWNERS, p))) {
      err('owners', 'Pick who owns the business from the list.')
    } else {
      owners = ids(OWNERS).filter((id) => picked.includes(id))
    }
  }

  let purposes = []
  const purposesRaw = read(input, 'purposes')
  if (purposesRaw === null) err('purposes', 'Pick at least one thing the money is for.')
  else {
    const picked = splitList(purposesRaw)
    if (picked.length === 0) err('purposes', 'Pick at least one thing the money is for.')
    else if (picked.some((p) => !byId(PURPOSES, p))) err('purposes', 'Pick what the money is for from the list.')
    else purposes = ids(PURPOSES).filter((id) => picked.includes(id))
  }

  const cost = read(input, 'cost')
  if (cost !== null && !byId(COST, cost)) err('cost', 'Pick the project cost from the list.')

  if (errors.length) return { profile: null, errors }
  return {
    profile: { name, community, industry, structure, employees, years, revenue, owners, purposes, cost },
    errors,
  }
}

const enc = (v) => encodeURIComponent(v).replace(/%2C/gi, ',')

/** profileToQuery(profile) → query string (no leading `?`); round-trips through parseProfile. */
export function profileToQuery(profile) {
  const parts = []
  const add = (k, v) => parts.push(`${k}=${enc(v)}`)
  if (profile.name) add('name', profile.name)
  add('community', profile.community.id)
  add('industry', profile.industry.id)
  add('structure', profile.structure)
  add('employees', String(profile.employees))
  add('years', profile.years)
  add('revenue', profile.revenue)
  if (profile.owners !== null && profile.owners !== undefined) {
    add('owners', profile.owners.length ? profile.owners.join(',') : 'none')
  }
  add('purposes', profile.purposes.join(','))
  if (profile.cost !== null && profile.cost !== undefined) add('cost', profile.cost)
  return parts.join('&')
}
