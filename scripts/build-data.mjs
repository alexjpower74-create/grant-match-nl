#!/usr/bin/env node
// Verify every program against its saved pages and write data/build/{programs,sample}.json — docs/API.md §8.
//
//   node scripts/build-data.mjs            verify, then write both bundles
//   node scripts/build-data.mjs --check    verify only
//   --data <dir>                           read programs/, sources/, reference/ from <dir> instead of data/
//   --fixtures <dir>                       SAMPLE programs/ and sources/ (default core/tests/fixtures)
//   --out <dir>                            where to write the bundles (default data/build)
//
// Any problem: print "<file>: <json path>: <reason>" for each, exit 1, write nothing.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, ROOT, rel } from './lib.mjs'
import { loadData } from './data-load.mjs'

const { flags } = parseArgs(process.argv.slice(2), ['check'])
const { bundles, counts, problems } = await loadData({
  dataDir: path.resolve(ROOT, flags.data ?? 'data'),
  fixturesDir: path.resolve(ROOT, flags.fixtures ?? 'core/tests/fixtures'),
})

if (problems.length) {
  for (const p of problems) console.error(`${p.file}: ${p.path}: ${p.reason}`)
  console.error(`build-data: ${problems.length} problem${problems.length === 1 ? '' : 's'}; nothing written`)
  process.exit(1)
}

const summary = `${counts.real} real program${counts.real === 1 ? '' : 's'}, ${counts.sample} SAMPLE`
if (flags.check) {
  console.log(`build-data --check: every quote verified (${summary})`)
} else {
  const outDir = path.resolve(ROOT, flags.out ?? 'data/build')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'programs.json'), `${JSON.stringify(bundles.real, null, 2)}\n`)
  fs.writeFileSync(path.join(outDir, 'sample.json'), `${JSON.stringify(bundles.sample, null, 2)}\n`)
  console.log(`build-data: wrote ${rel(outDir)}/programs.json and ${rel(outDir)}/sample.json (${summary})`)
}
