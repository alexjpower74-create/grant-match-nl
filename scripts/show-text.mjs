#!/usr/bin/env node
// Print the page text of a saved source — the only text quotes may be copied from.
//
//   node scripts/show-text.mjs <source-id | file> [--grep word] [--around 200] [--data <dir>]
//
// --grep (case-insensitive) prints each hit with 200 characters either side.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, ROOT } from './lib.mjs'
import { pageText } from '../core/text.js'

const { flags, positionals } = parseArgs(process.argv.slice(2))
const arg = positionals[0]
if (!arg) {
  console.error('usage: node scripts/show-text.mjs <source-id | file> [--grep word] [--around 200]')
  process.exit(1)
}

const sourcesDir = path.resolve(ROOT, flags.data ?? 'data', 'sources')
const candidates = [arg, path.join(sourcesDir, `${arg}.html`), path.join(ROOT, 'core/tests/fixtures/sources', `${arg}.html`)]
const file = candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile())
if (!file) {
  console.error(`show-text: no saved page for "${arg}" (looked in ${path.relative(ROOT, sourcesDir)} and the SAMPLE fixtures)`)
  process.exit(1)
}

const text = pageText(fs.readFileSync(file, 'utf8'))

if (flags.grep === undefined || flags.grep === true) {
  process.stdout.write(`${text}\n`)
} else {
  const around = Number(flags.around ?? 200)
  const needle = String(flags.grep).toLowerCase()
  const lower = text.toLowerCase()
  let i = lower.indexOf(needle)
  let hits = 0
  while (i >= 0) {
    hits += 1
    const start = Math.max(0, i - around)
    const end = Math.min(text.length, i + needle.length + around)
    process.stdout.write(
      `--- hit ${hits} at character ${i}\n${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}\n`,
    )
    i = lower.indexOf(needle, i + needle.length)
  }
  if (hits === 0) {
    console.error(`show-text: "${flags.grep}" is not in the page text`)
    process.exit(1)
  }
}
