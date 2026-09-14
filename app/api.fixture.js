// TEMPORARY (until core is on main): ?mock=fixture serves hand-made SAMPLE ProgramResult JSON from
// app/tests/fixtures/. Deleted once api.mock.js can run the real core.
import { ApiError } from './api.js'

export async function createFixtureApi() {
  const load = async (name) => (await fetch(`/tests/fixtures/${name}`)).json()
  const [options, match] = await Promise.all([load('options.json'), load('match-sample-auto-service.json')])
  const all = [...match.open, ...match.closed]
  return {
    mode: 'fixture',
    options: async () => options,
    match: async (p) => {
      if (!p.get('community')) throw new ApiError(400, { error: 'Some answers are missing.', errors: [{ field: 'community', message: 'Pick your community.' }] })
      return match
    },
    programs: async () => ({ programs: [...all].sort((a, b) => a.name.localeCompare(b.name, 'en')) }),
    program: async (slug) => {
      const result = all.find((r) => r.slug === slug)
      if (!result) throw new ApiError(404, { error: 'No program has that name.' })
      return { profile: match.profile, result }
    },
    checks: async () => ({ runs: [] }),
  }
}
