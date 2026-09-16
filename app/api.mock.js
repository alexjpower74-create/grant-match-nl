// ?mock=1 — the real core running in the browser on /data/build/sample.json (&data=real → programs.json).
// Same answers as the Worker, with no live-check runs (sourceStatus is empty, /api/checks has no runs).
import { ApiError } from './api.js'
import { PROFILE_KEYS } from './render.js'

export async function createMockApi(params) {
  const [profileMod, matchMod] = await Promise.all([import('/core/profile.js'), import('/core/match.js')])
  const { parseProfile, STRUCTURES, YEARS, REVENUE, COST, OWNERS, PURPOSES } = profileMod
  const { evaluateProgram, matchPrograms } = matchMod

  const file = params.get('data') === 'real' ? 'programs.json' : 'sample.json'
  const res = await fetch(`/data/build/${file}`)
  if (!res.ok) throw new ApiError(res.status, { error: `The ${file} bundle is missing. Run npm run build:data.` })
  const bundle = await res.json()

  const clock = () => {
    const raw = params.get('now')
    const d = raw ? new Date(raw) : new Date()
    if (Number.isNaN(d.getTime())) throw new ApiError(400, { error: 'The now parameter is not a valid date.' })
    return d
  }
  const opts = () => ({ now: clock(), sourceStatus: {} })
  const refs = { communities: bundle.communities, industries: bundle.industries }
  const profileParams = (p) => {
    const q = new URLSearchParams()
    for (const k of PROFILE_KEYS) if (p.has(k)) q.set(k, p.get(k))
    return q
  }
  // Round-trip through JSON so the pages see exactly what the Worker would send.
  const wire = (v) => JSON.parse(JSON.stringify(v))

  return {
    mode: 'mock',
    async options() {
      return wire({
        communities: bundle.communities.communities,
        industries: bundle.industries.industries,
        structures: STRUCTURES,
        years: YEARS,
        revenue: REVENUE,
        cost: COST,
        owners: OWNERS,
        purposes: PURPOSES,
        sources: { communities: bundle.communities.source, industries: bundle.industries.source },
      })
    },
    async match(p) {
      const { profile, errors } = parseProfile(profileParams(p), refs)
      if (errors.length) throw new ApiError(400, { error: 'Some answers are missing.', errors })
      const o = opts()
      return wire({ profile, evaluated_at: o.now.toISOString(), ...matchPrograms(bundle.programs, profile, o) })
    },
    async programs() {
      const o = opts()
      const programs = bundle.programs.map((pr) => evaluateProgram(pr, null, o)).sort((a, b) => a.name.localeCompare(b.name, 'en'))
      return wire({ programs })
    },
    async program(slug, p) {
      const program = bundle.programs.find((pr) => pr.slug === slug)
      if (!program) throw new ApiError(404, { error: 'No program has that name.' })
      const q = profileParams(p)
      let profile = null
      if ([...q.keys()].length) {
        const parsed = parseProfile(q, refs)
        if (parsed.errors.length) throw new ApiError(400, { error: 'Some answers are missing.', errors: parsed.errors })
        profile = parsed.profile
      }
      return wire({ profile, result: evaluateProgram(program, profile, opts()) })
    },
    async checks() {
      return { runs: [] }
    },
  }
}
