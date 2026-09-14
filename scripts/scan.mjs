#!/usr/bin/env node
// Re-check every program's source pages live, with the same code as the Worker's weekly cron (core/checks.js).
//
//   npm run scan                         check, then POST the result to the local Worker
//   npm run scan -- --dry                check only; write data/scans/latest.json, no POST
//   npm run scan -- --only slug,slug     only these programs
//
// Raw page bodies are cached in data/scans/<UTC stamp>/<source-id>.html (gitignored).
// The admin token comes from GM_ADMIN_TOKEN, else ADMIN_TOKEN in worker/.dev.vars. It is never printed.
//
// For tests: --sample (SAMPLE fixtures instead of real data), --scans <dir>, --worker <origin>,
// --dev-vars <file>, and GM_SCAN_ORIGIN_MAP='{"https://sample.invalid":"http://127.0.0.1:7403"}'.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT, rel, sleep } from './lib.mjs';
import { loadData } from './data-load.mjs';
import { runChecks } from '../core/checks.js';

const { flags } = parseArgs(process.argv.slice(2), ['dry', 'sample']);
const fail = (msg) => { console.error(`scan: ${msg}`); process.exit(1); };

const { bundles, problems } = await loadData({
  dataDir: path.resolve(ROOT, flags.data ?? 'data'),
  fixturesDir: path.resolve(ROOT, flags.fixtures ?? 'core/tests/fixtures'),
});
if (problems.length) {
  for (const p of problems) console.error(`${p.file}: ${p.path}: ${p.reason}`);
  fail('the data doesn’t verify, so there is nothing trustworthy to re-check (run npm run check:data)');
}
const bundle = flags.sample ? bundles.sample : bundles.real;

const only = typeof flags.only === 'string' ? flags.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
if (only) {
  const known = new Set(bundle.programs.map((p) => p.slug));
  const unknown = only.filter((s) => !known.has(s));
  if (unknown.length) fail(`no program named ${unknown.join(', ')}`);
}

let originMap = null;
if (process.env.GM_SCAN_ORIGIN_MAP) {
  try { originMap = JSON.parse(process.env.GM_SCAN_ORIGIN_MAP); } catch { fail('GM_SCAN_ORIGIN_MAP is not valid JSON'); }
}

// Resolve the token before fetching anything, so a missing token doesn't waste a polite scan.
let token = null;
if (!flags.dry) {
  token = process.env.GM_ADMIN_TOKEN || null;
  const devVars = path.resolve(ROOT, flags['dev-vars'] ?? 'worker/.dev.vars');
  if (!token && fs.existsSync(devVars)) {
    const line = fs.readFileSync(devVars, 'utf8').split(/\r?\n/).find((l) => /^\s*ADMIN_TOKEN\s*=/.test(l));
    if (line) token = line.replace(/^\s*ADMIN_TOKEN\s*=\s*/, '').replace(/^["']|["']$/g, '').trim() || null;
  }
  if (!token) fail(`no admin token: set GM_ADMIN_TOKEN or ADMIN_TOKEN in ${rel(devVars)} (or use --dry)`);
}

const scansDir = path.resolve(ROOT, flags.scans ?? 'data/scans');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const rawDir = path.join(scansDir, stamp);

const result = await runChecks({
  programs: bundle.programs,
  fetch: (url, init) => fetch(url, init),
  sleep,
  only,
  originMap,
  trigger: 'node',
  log: (line) => console.error(`scan: ${line}`),
  onRaw: async ({ source_id, body }) => {
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `${source_id}.html`), body);
  },
});

fs.mkdirSync(scansDir, { recursive: true });
fs.writeFileSync(path.join(scansDir, 'latest.json'), `${JSON.stringify(result, null, 2)}\n`);

// Plain summary.
const total = result.sources.length;
const okCount = result.sources.filter((s) => s.ok).length;
const lines = [`Checked ${total} source page${total === 1 ? '' : 's'}: ${okCount} fetched fine, ${total - okCount} not.`];
for (const s of result.sources.filter((x) => !x.ok)) lines.push(`  Not checked or not found: ${s.source_id} (${s.error})`);
const byProgram = new Map();
for (const s of result.sources) {
  if (!s.missing.length) continue;
  byProgram.set(s.program_slug, [...(byProgram.get(s.program_slug) ?? []), ...s.missing.map((m) => `${s.source_id} ${m.path}`)]);
}
if (byProgram.size === 0) lines.push('Quotes missing: none.');
for (const [slug, missing] of byProgram) {
  lines.push(`Quotes missing for ${slug}: ${missing.length}`);
  for (const m of missing) lines.push(`  ${m}`);
}
const changed = result.sources.filter((s) => s.changed).map((s) => s.source_id);
lines.push(changed.length ? `Page text changed since it was saved: ${changed.join(', ')}` : 'Page text changed since it was saved: none.');
lines.push(`Raw pages: ${fs.existsSync(rawDir) ? rel(rawDir) : '(none fetched)'} · result: ${rel(path.join(scansDir, 'latest.json'))}`);

if (flags.dry) {
  lines.push('Dry run: nothing sent to the Worker.');
  console.log(lines.join('\n'));
} else {
  const worker = (flags.worker ?? `http://127.0.0.1:${process.env.GM_WORKER_PORT || 7402}`).replace(/\/$/, '');
  let res;
  try {
    res = await fetch(`${worker}/api/admin/checks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(result),
    });
  } catch (e) {
    console.log(lines.join('\n'));
    fail(`could not reach the Worker at ${worker} (${e.message}); the result is saved in ${rel(path.join(scansDir, 'latest.json'))}`);
  }
  const text = await res.text();
  if (!res.ok) {
    console.log(lines.join('\n'));
    fail(`the Worker answered HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  let stored = null;
  try { stored = JSON.parse(text).stored; } catch { /* keep null */ }
  lines.push(`Sent to the Worker at ${worker}: stored run ${stored ?? '(no id in the answer)'}.`);
  console.log(lines.join('\n'));
}
