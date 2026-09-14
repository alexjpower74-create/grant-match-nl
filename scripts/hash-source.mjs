#!/usr/bin/env node
// Hashes of saved source pages.
//
//   node scripts/hash-source.mjs <file>                      print { sha256, text_sha256 } of one saved page
//   node scripts/hash-source.mjs --update <program.json>     set every sources[].sha256 / text_sha256 from the saved
//                                                            files next to it (data/sources, or --sources <dir>)
//
// Only use --update right after fetching: it records what is on disk, it does not verify anything.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT, readJson, rel } from './lib.mjs';
import { pageText } from '../core/text.js';
import { sha256Hex } from '../core/hash.js';

const { flags, positionals } = parseArgs(process.argv.slice(2));

async function hashes(file) {
  const bytes = fs.readFileSync(file);
  return { sha256: await sha256Hex(new Uint8Array(bytes)), text_sha256: await sha256Hex(pageText(bytes.toString('utf8'))) };
}

if (typeof flags.update === 'string') {
  const programFile = path.resolve(flags.update);
  const record = readJson(programFile);
  const sourcesDir = flags.sources
    ? path.resolve(flags.sources)
    : path.resolve(path.dirname(programFile), '..', 'sources');
  for (const s of record.sources) {
    const file = path.join(sourcesDir, `${s.id}.html`);
    if (!fs.existsSync(file)) {
      console.error(`hash-source: ${rel(file)} is missing`);
      process.exit(1);
    }
    Object.assign(s, await hashes(file));
    console.log(`${s.id}: ${s.sha256.slice(0, 12)}… text ${s.text_sha256.slice(0, 12)}…`);
  }
  fs.writeFileSync(programFile, `${JSON.stringify(record, null, 2)}\n`);
} else if (positionals[0]) {
  console.log(JSON.stringify(await hashes(path.resolve(ROOT, positionals[0])), null, 2));
} else {
  console.error('usage: node scripts/hash-source.mjs <file> | --update <program.json> [--sources <dir>]');
  process.exit(1);
}
