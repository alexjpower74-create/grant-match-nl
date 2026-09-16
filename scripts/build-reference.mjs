#!/usr/bin/env node
// Build data/reference/communities.json from the saved Statistics Canada 2021 Census table
// "Population and dwelling counts: Canada and census subdivisions (municipalities)" (98-10-0002-01), saved as
// data/sources/ref-census-2021-population-csd.zip by fetch-source.mjs. Reads only the saved file.
//
//   node scripts/build-reference.mjs [--check]
//
// Every Newfoundland and Labrador census subdivision becomes a community. Unorganized subdivisions
// ("Division No. 6, Subd. D") are folded into one "Somewhere else in Division No. 6" entry per division, type "other".
// The table has no subdivision type column, so named subdivisions get type "subdivision".

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { parseArgs, ROOT } from './lib.mjs'

const { flags } = parseArgs(process.argv.slice(2), ['check'])
const ZIP = path.join(ROOT, 'data/sources/ref-census-2021-population-csd.zip')
const OUT = path.join(ROOT, 'data/reference/communities.json')
const SOURCE = {
  url: 'https://www150.statcan.gc.ca/n1/tbl/csv/98100002-eng.zip',
  title: 'Population and dwelling counts: Canada and census subdivisions (municipalities)',
  publisher: 'Statistics Canada',
  fetched_at: '2026-09-14T05:25:43.180Z',
  file: 'data/sources/ref-census-2021-population-csd.zip',
}

/** Read one file out of a zip using the central directory (stored or deflated entries). */
function unzipEntry(buf, wanted) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip central directory')
    const method = buf.readUInt16LE(p + 10)
    const compressed = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + compressed)
      if (method === 0) return data
      if (method === 8) return zlib.inflateRawSync(data)
      throw new Error(`unsupported zip method ${method}`)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`${wanted} is not in the zip`)
}

/** RFC 4180 CSV rows. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const csv = unzipEntry(fs.readFileSync(ZIP), '98100002.csv').toString('utf8').replace(/^﻿/, '')
const [header, ...rows] = parseCsv(csv)
const col = (label) => {
  const i = header.findIndex((h) => h === label || h.startsWith(label))
  if (i < 0) throw new Error(`column "${label}" not found`)
  return i
}
const GEO = col('GEO')
const DGUID = col('DGUID')
const POP = col('Population and dwelling counts (13): Population, 2021')

const named = []
const elsewhere = new Map() // division → population
for (const r of rows) {
  const dguid = r[DGUID] ?? ''
  // 2021 + A (administrative) + 0005 (census subdivision) + 10 (Newfoundland and Labrador) + 5 more digits.
  const m = dguid.match(/^2021A0005(10\d{5})$/)
  if (!m) continue
  const csdCode = m[1]
  const division = Number(csdCode.slice(2, 4))
  const pop = /^\d+$/.test(r[POP]) ? Number(r[POP]) : null
  const name = r[GEO].trim()
  if (/^Division No\.\s+\d+, Subd\. /.test(name)) {
    elsewhere.set(division, (elsewhere.get(division) ?? 0) + (pop ?? 0))
    continue
  }
  named.push({ name, type: 'subdivision', csd_code: csdCode, census_division: division, population_2021: pop })
}
for (const [division, pop] of elsewhere) {
  named.push({
    name: `Somewhere else in Division No. ${division}`,
    type: 'other',
    csd_code: null,
    census_division: division,
    population_2021: pop,
  })
}

// ids: slug of the name; a name used in more than one division gets its division appended.
const bySlug = new Map()
for (const c of named) bySlug.set(slugify(c.name), (bySlug.get(slugify(c.name)) ?? 0) + 1)
const communities = named
  .map((c) => {
    const base = slugify(c.name)
    const id = bySlug.get(base) > 1 ? `${base}-division-${c.census_division}` : base
    return { id, ...c }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.census_division - b.census_division)

const ids = new Set(communities.map((c) => c.id))
if (ids.size !== communities.length) throw new Error('community ids are not unique')
for (const required of ['grand-falls-windsor', 'gander', 'st-johns']) {
  if (!ids.has(required)) throw new Error(`required community "${required}" is missing`)
}

const json = `${JSON.stringify({ source: SOURCE, communities }, null, 2)}\n`
const dupNames = [...bySlug].filter(([, n]) => n > 1).map(([s]) => s)
const summary =
  `${communities.length} communities (${communities.filter((c) => c.type === 'other').length} "Somewhere else" entries; ` +
  `names in more than one division: ${dupNames.length ? dupNames.join(', ') : 'none'})`
if (flags.check) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === json
  console.log(
    `build-reference --check: ${same ? 'communities.json is up to date' : 'communities.json differs from the saved table'}; ${summary}`,
  )
  process.exit(same ? 0 : 1)
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, json)
console.log(`build-reference: wrote data/reference/communities.json, ${summary}`)
