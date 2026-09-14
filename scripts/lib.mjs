// Shared helpers for the Node scripts (not part of core: these use the file system).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal flag parser: --flag value, --flag (boolean), and positionals. */
export function parseArgs(argv, booleans = []) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (booleans.includes(a.slice(2))) flags[a.slice(2)] = true;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else positionals.push(a);
  }
  return { flags, positionals };
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const rel = (p) => path.relative(ROOT, p) || '.';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
