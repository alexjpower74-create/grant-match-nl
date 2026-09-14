// scripts/build-data.mjs as a whole: exit codes, messages, and writing nothing on a problem.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';

// Temp copies stay inside gm1's own slice (core/**) and are removed afterwards; never committed.
fs.mkdirSync(path.join(ROOT, 'core', 'tests', '.tmp'), { recursive: true });
const SCRATCH = fs.mkdtempSync(path.join(ROOT, 'core', 'tests', '.tmp', 'build-test-'));
after(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

const run = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/build-data.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' });

function copyTree() {
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'copy-'));
  fs.cpSync(path.join(ROOT, 'data'), path.join(dir, 'data'), { recursive: true, filter: (src) => !src.includes(`${path.sep}build`) && !src.includes(`${path.sep}scans`) });
  fs.cpSync(path.join(ROOT, 'core/tests/fixtures'), path.join(dir, 'fixtures'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data', 'programs'), { recursive: true });
  return dir;
}

/** Change one character of the first criterion quote of one program; prefer a real program when there is one. */
function plantQuote(dir) {
  const candidates = [path.join(dir, 'data', 'programs'), path.join(dir, 'fixtures', 'programs')];
  for (const programs of candidates) {
    const files = fs.readdirSync(programs).filter((f) => f.endsWith('.json')).sort();
    const file = files.find((f) => JSON.parse(fs.readFileSync(path.join(programs, f), 'utf8')).criteria.length > 0);
    if (!file) continue;
    const full = path.join(programs, file);
    const record = JSON.parse(fs.readFileSync(full, 'utf8'));
    const q = record.criteria[0].quote;
    const i = Math.floor(q.length / 2);
    record.criteria[0].quote = `${q.slice(0, i)}${q[i] === 'x' ? 'y' : 'x'}${q.slice(i + 1)}`;
    fs.writeFileSync(full, JSON.stringify(record, null, 2));
    return { slug: record.slug, file };
  }
  throw new Error('no program to plant a quote in');
}

test('build-data --check exits 0 on the real data/ and SAMPLE fixtures', () => {
  const r = run('--check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /every quote verified/);
});

test('build-data --check on a copy with one planted quote exits 1 and names the program, the path and the reason', () => {
  const dir = copyTree();
  const { slug, file } = plantQuote(dir);
  const r = run('--check', '--data', path.join(dir, 'data'), '--fixtures', path.join(dir, 'fixtures'));
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stderr.includes(`${file}: criteria[0].quote: this quote is not in the page text of ${slug}--`), r.stderr);
  assert.match(r.stderr, /1 problem; nothing written/);
});

test('build-data writes both bundles when clean, and nothing when there is a problem', () => {
  const dir = copyTree();
  const out = path.join(dir, 'out');
  const ok = run('--data', path.join(dir, 'data'), '--fixtures', path.join(dir, 'fixtures'), '--out', out);
  assert.equal(ok.status, 0, ok.stderr);
  const sample = JSON.parse(fs.readFileSync(path.join(out, 'sample.json'), 'utf8'));
  assert.equal(sample.data_set, 'sample');
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'programs.json'), 'utf8')).data_set, 'real');
  // Same inputs, same bytes.
  const again = path.join(dir, 'out2');
  run('--data', path.join(dir, 'data'), '--fixtures', path.join(dir, 'fixtures'), '--out', again);
  assert.equal(fs.readFileSync(path.join(again, 'sample.json'), 'utf8'), fs.readFileSync(path.join(out, 'sample.json'), 'utf8'));

  plantQuote(dir);
  const failedOut = path.join(dir, 'out-failed');
  const bad = run('--data', path.join(dir, 'data'), '--fixtures', path.join(dir, 'fixtures'), '--out', failedOut);
  assert.equal(bad.status, 1);
  assert.equal(fs.existsSync(failedOut), false, 'nothing written');
});

test('a slug that does not match its file name, bad JSON, and a missing reference list are problems', () => {
  const dir = copyTree();
  const fixtures = path.join(dir, 'fixtures', 'programs');
  fs.renameSync(path.join(fixtures, 'nl-sample-community-fund.json'), path.join(fixtures, 'nl-sample-renamed.json'));
  fs.writeFileSync(path.join(fixtures, 'nl-sample-broken.json'), '{ not json');
  fs.rmSync(path.join(dir, 'data', 'reference', 'industries.json'));
  const r = run('--check', '--data', path.join(dir, 'data'), '--fixtures', path.join(dir, 'fixtures'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /nl-sample-renamed\.json: slug: must equal the file name "nl-sample-renamed"/);
  assert.match(r.stderr, /nl-sample-broken\.json: \$: not valid JSON/);
  assert.match(r.stderr, /industries\.json: \$: the reference list is missing/);
});
