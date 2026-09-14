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

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT, readJson, rel } from './lib.mjs';
import { buildBundle } from '../core/bundle.js';
import { pageText } from '../core/text.js';
import { sha256Hex } from '../core/hash.js';

const { flags } = parseArgs(process.argv.slice(2), ['check']);
const dataDir = path.resolve(ROOT, flags.data ?? 'data');
const fixturesDir = path.resolve(ROOT, flags.fixtures ?? 'core/tests/fixtures');
const problems = [];
const problem = (file, jsonPath, reason) => problems.push({ file: rel(file), path: jsonPath, reason });

function loadReference(name, key, requiredIds = []) {
  const file = path.join(dataDir, 'reference', `${name}.json`);
  if (!fs.existsSync(file)) {
    problem(file, '$', 'the reference list is missing');
    return null;
  }
  let ref;
  try { ref = readJson(file); } catch (e) { problem(file, '$', `not valid JSON (${e.message})`); return null; }
  const list = ref?.[key];
  if (!Array.isArray(list) || list.length === 0) {
    problem(file, key, 'must be a non-empty array');
    return null;
  }
  const seen = new Set();
  list.forEach((item, i) => {
    if (typeof item?.id !== 'string' || !item.id) problem(file, `${key}[${i}].id`, 'must be a non-empty string');
    else if (seen.has(item.id)) problem(file, `${key}[${i}].id`, `duplicate id "${item.id}"`);
    seen.add(item.id);
    if (typeof item?.name !== 'string' || !item.name) problem(file, `${key}[${i}].name`, 'must be a non-empty string');
  });
  for (const id of requiredIds) if (!seen.has(id)) problem(file, key, `must include "${id}"`);
  if (ref.source?.file && !fs.existsSync(path.join(dataDir, 'sources', path.basename(ref.source.file)))) {
    problem(file, 'source.file', `the raw reference file ${ref.source.file} is missing`);
  }
  return ref;
}

async function loadSet(programsDir, sourcesDir, label) {
  const programs = [];
  const pageTexts = {};
  const files = fs.existsSync(programsDir) ? fs.readdirSync(programsDir).filter((f) => f.endsWith('.json')).sort() : [];
  const fileOf = {};
  for (const f of files) {
    const file = path.join(programsDir, f);
    let record;
    try { record = readJson(file); } catch (e) { problem(file, '$', `not valid JSON (${e.message})`); continue; }
    const expected = f.replace(/\.json$/, '');
    if (record?.slug !== expected) problem(file, 'slug', `must equal the file name "${expected}"`);
    fileOf[record?.slug ?? expected] = file;
    programs.push(record);
    for (const s of Array.isArray(record?.sources) ? record.sources : []) {
      if (typeof s?.id !== 'string' || pageTexts[s.id]) continue;
      const src = path.join(sourcesDir, `${path.basename(s.id)}.html`);
      if (!fs.existsSync(src)) continue; // verifyProgram reports the missing file
      const bytes = fs.readFileSync(src);
      const text = pageText(bytes.toString('utf8'));
      pageTexts[s.id] = { text, sha256: await sha256Hex(new Uint8Array(bytes)), text_sha256: await sha256Hex(text) };
    }
  }
  return { programs, pageTexts, fileOf, label };
}

const communities = loadReference('communities', 'communities', ['grand-falls-windsor', 'gander', 'st-johns']);
const industries = loadReference('industries', 'industries');

const real = await loadSet(path.join(dataDir, 'programs'), path.join(dataDir, 'sources'), 'real');
const sample = await loadSet(path.join(fixturesDir, 'programs'), path.join(fixturesDir, 'sources'), 'sample');

const bundles = {};
for (const set of [real, sample]) {
  const { bundle, problems: found } = buildBundle({
    programs: set.programs, pageTexts: set.pageTexts, communities, industries, data_set: set.label,
  });
  for (const p of found) problem(set.fileOf[p.slug] ?? p.slug, p.path, p.reason);
  bundles[set.label] = bundle;
}

if (problems.length) {
  for (const p of problems) console.error(`${p.file}: ${p.path}: ${p.reason}`);
  console.error(`build-data: ${problems.length} problem${problems.length === 1 ? '' : 's'}; nothing written`);
  process.exit(1);
}

const summary = `${real.programs.length} real program${real.programs.length === 1 ? '' : 's'}, ${sample.programs.length} SAMPLE`;
if (flags.check) {
  console.log(`build-data --check: every quote verified (${summary})`);
} else {
  const outDir = path.resolve(ROOT, flags.out ?? 'data/build');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'programs.json'), `${JSON.stringify(bundles.real, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'sample.json'), `${JSON.stringify(bundles.sample, null, 2)}\n`);
  console.log(`build-data: wrote ${rel(outDir)}/programs.json and ${rel(outDir)}/sample.json (${summary})`);
}
