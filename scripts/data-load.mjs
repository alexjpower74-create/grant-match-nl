// Load programs, saved pages and reference lists from disk and build the bundles in memory.
// Shared by build-data.mjs (writes the bundles; any problem stops it) and scan.mjs (re-checks the live pages of one
// set, so it only needs that set and the reference lists to verify).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, rel } from './lib.mjs'
import { buildBundle } from '../core/bundle.js'
import { pageText, blockText } from '../core/text.js'
import { sha256Hex } from '../core/hash.js'

/**
 * loadData({ dataDir, fixturesDir }) → { bundles: { real, sample }, counts: { real, sample }, problems }
 * problems: [{ file, path, reason, set }] with file relative to the repo root and set 'real' | 'sample' | 'reference'.
 * A set's bundle is null when that set or the reference lists have a problem.
 */
export async function loadData({ dataDir = path.join(ROOT, 'data'), fixturesDir = path.join(ROOT, 'core/tests/fixtures') } = {}) {
  const problems = []
  const problem = (set, file, jsonPath, reason) => problems.push({ file: rel(file), path: jsonPath, reason, set })

  function loadReference(name, key, requiredIds = []) {
    const file = path.join(dataDir, 'reference', `${name}.json`)
    if (!fs.existsSync(file)) {
      problem('reference', file, '$', 'the reference list is missing')
      return null
    }
    let ref
    try {
      ref = readJson(file)
    } catch (e) {
      problem('reference', file, '$', `not valid JSON (${e.message})`)
      return null
    }
    const list = ref?.[key]
    if (!Array.isArray(list) || list.length === 0) {
      problem('reference', file, key, 'must be a non-empty array')
      return null
    }
    const seen = new Set()
    list.forEach((item, i) => {
      if (typeof item?.id !== 'string' || !item.id) problem('reference', file, `${key}[${i}].id`, 'must be a non-empty string')
      else if (seen.has(item.id)) problem('reference', file, `${key}[${i}].id`, `duplicate id "${item.id}"`)
      seen.add(item.id)
      if (typeof item?.name !== 'string' || !item.name) problem('reference', file, `${key}[${i}].name`, 'must be a non-empty string')
    })
    for (const id of requiredIds) if (!seen.has(id)) problem('reference', file, key, `must include "${id}"`)
    if (ref.source?.file && !fs.existsSync(path.join(dataDir, 'sources', path.basename(ref.source.file)))) {
      problem('reference', file, 'source.file', `the raw reference file ${ref.source.file} is missing`)
    }
    return ref
  }

  async function loadSet(label, programsDir, sourcesDir) {
    const programs = []
    const pageTexts = {}
    const fileOf = {}
    const files = fs.existsSync(programsDir)
      ? fs
          .readdirSync(programsDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
      : []
    for (const f of files) {
      const file = path.join(programsDir, f)
      let record
      try {
        record = readJson(file)
      } catch (e) {
        problem(label, file, '$', `not valid JSON (${e.message})`)
        continue
      }
      const expected = f.replace(/\.json$/, '')
      if (record?.slug !== expected) problem(label, file, 'slug', `must equal the file name "${expected}"`)
      fileOf[record?.slug ?? expected] = file
      programs.push(record)
      for (const s of Array.isArray(record?.sources) ? record.sources : []) {
        if (typeof s?.id !== 'string' || pageTexts[s.id]) continue
        const src = path.join(sourcesDir, `${path.basename(s.id)}.html`)
        if (!fs.existsSync(src)) continue // verifyProgram reports the missing file
        const bytes = fs.readFileSync(src)
        const html = bytes.toString('utf8')
        const text = pageText(html)
        // block: the same text with block edges as \n, used only for quote context (API §1, DECISIONS #24).
        pageTexts[s.id] = {
          text,
          block: blockText(html),
          sha256: await sha256Hex(new Uint8Array(bytes)),
          text_sha256: await sha256Hex(text),
        }
      }
    }
    return { programs, pageTexts, fileOf }
  }

  const communities = loadReference('communities', 'communities', ['grand-falls-windsor', 'gander', 'st-johns'])
  const industries = loadReference('industries', 'industries')
  const sets = {
    real: await loadSet('real', path.join(dataDir, 'programs'), path.join(dataDir, 'sources')),
    sample: await loadSet('sample', path.join(fixturesDir, 'programs'), path.join(fixturesDir, 'sources')),
  }

  const built = {}
  for (const [label, set] of Object.entries(sets)) {
    const { bundle, problems: found } = buildBundle({
      programs: set.programs,
      pageTexts: set.pageTexts,
      communities,
      industries,
      data_set: label,
    })
    for (const p of found) problem(label, set.fileOf[p.slug] ?? p.slug, p.path, p.reason)
    built[label] = bundle
  }

  const blocked = (label) => problems.some((p) => p.set === label || p.set === 'reference')
  return {
    bundles: { real: blocked('real') ? null : built.real, sample: blocked('sample') ? null : built.sample },
    counts: { real: sets.real.programs.length, sample: sets.sample.programs.length },
    problems,
  }
}
