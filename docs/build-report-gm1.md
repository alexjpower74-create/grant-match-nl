# Build report — gm1 (engine, reference data, NL programs)

## Contract questions

Each one is how I read the contract; I carried on with that reading. The lead decides.

1. **`verifyProgram(record, pageTexts)` input and output.** API.md §3 wants hash checks, but core has no file
   system. `pageTexts[id]` is either the page text string, or `{ text, sha256, text_sha256 }` computed from the saved
   file by the caller (`build-data.mjs` does this). A missing id means the file is missing. It returns the same
   shape as `validateProgram`: strings `"<json path>: <reason>"`. `buildBundle` returns problems as
   `{ slug, path, reason }`.
2. **Bundle `communities` / `industries`** are the whole reference objects (`{ source, communities }` and
   `{ source, industries }`), so the Worker's `/api/options` can serve `sources` from them. `parseProfile` accepts
   either the object or the bare array.
3. **`counts.unknown` includes self_check items**, and `counts.self_check` is the subset. So the card line
   "5 match · 0 doesn't · 1 unknown" counts the business-plan item as unknown.
4. **Community `type`.** Statistics Canada's 2021 population table (98-10-0002-01) has no subdivision-type column.
   The official file that does (the Geographic Attribute File, 92-151-X) is block-level data for all of Canada, far
   too big to commit as evidence. So `type` is `"subdivision"` for every named census subdivision and `"other"` for
   the 11 "Somewhere else in Division No. N" entries. Those entries fold in the unorganized "Division No. N,
   Subd. X" rows, with their population summed. If you want town / city / Indigenous community labels, say which
   source to use.
5. **Interval shape** on `YEARS` / `REVENUE` / `COST` options: `{ min, max, min_inclusive, max_inclusive }`, with
   `max: null` meaning no upper limit. `unsaid` and `unsure` have no interval.
6. **Live check of a page that answers but isn't 200** (for example 404): `ok: false`, and **every quote of that
   source is listed in `missing`**, so the program goes to needs_review. A page that is gone can't vouch for its
   quotes. A robots.txt that errors (5xx or no connection) or a network failure: `ok: false` with an `error`,
   `missing: []`, and the page is not fetched. That is not a needs_review, because it says nothing about the page.
7. **Dates.** `verification.last_verified` is the date in America/St_Johns. A deadline counts as passed from the day
   after its date in America/St_Johns (a check at 22:30 NDT on the deadline day is still open).
8. **Schema is a little stricter than §3:** `sources[].http_status` must be 200; a `robots` value containing
   "disallow" is rejected; a deadline isn't allowed on a `continuous` or `unknown` intake; unknown keys anywhere are
   errors (this catches typos); a SAMPLE program's URLs must be on `https://sample.invalid/` and a real program's
   must not.
9. **Profile edge cases:** `owners=none,women` is an error ("Pick “None of these” or who owns the business, not
   both."); a name over 80 characters is an error, not silently cut; `owners=` (empty) means not answered.
   `profileToQuery` keeps commas unescaped and spaces as `%20`.
10. **`.gitignore` (lead's file):** please add `scripts/.state/`, where fetch-source remembers the last request time
    per host so politeness holds across runs, and `core/tests/.tmp/`, where the build test makes temporary copies
    and removes them. Neither is committed; I commit explicit paths.
11. **`rig-harness` is not installed** on this machine (`rig` is). Negative controls were run by a script that
    checks each targeted test is green with the code intact, red with the break, and green again after a byte-for-byte
    restore (table below).
12. ~~This report file isn't in gm1's owned list in the brief.~~ Resolved: `rig guard --agent gm1` counts
    `docs/build-report-gm1.md` as inside the slice.

## Phase 1 — the engine · DONE

Commit: `1d0fc50` on `rig/gm1` (44 files; `rig guard --staged` ok).

### What was built
- `core/text.js` — `pageText` exactly per §1 (removed elements, inline-tag list, entity set, invisible characters),
  `numbersIn`, `contextFor`.
- `core/hash.js` — `sha256Hex` via `crypto.subtle`.
- `core/profile.js` — `parseProfile`, `profileToQuery`, and the option lists `STRUCTURES`, `YEARS`, `REVENUE`, `COST`,
  `OWNERS`, `PURPOSES`, `FUNDING_TYPES`.
- `core/schema.js` — `validateProgram` (every key, enum, id pattern and rule shape in §3–4).
- `core/verify.js` — `verifyProgram` and `quotesOf`. When a quote isn't on the page, it says how far it matched.
- `core/match.js` — `evaluateCriterion`, `evaluateProgram`, `matchPrograms`, plus `compareInterval` and `localDate`.
- `core/bundle.js` — `buildBundle`: sorted by slug, quotes expanded with `source_url` and `context`, no wall-clock
  values.
- `core/checks.js` — `runChecks`, `robotsAllows`, `robotsCrawlDelay`, `sourceStatusFrom`, `USER_AGENT`.
- `scripts/build-data.mjs` (`--check`, `--data`, `--fixtures`, `--out`), `scripts/fetch-source.mjs`,
  `scripts/show-text.mjs` (`--grep`, `--around`), `scripts/hash-source.mjs` (fills `sha256`/`text_sha256` from
  saved files), `scripts/build-reference.mjs` (communities from the saved census zip), `scripts/lib.mjs`.
- `docs/RULES.md` — rule kinds, interval logic, fit labels, freshness, sort order, each with a worked example.
- `docs/spend.md` — CA$0, no model calls.

### Reference lists
- `data/reference/communities.json` — **291 communities**: 280 named census subdivisions plus 11 "Somewhere else in
  Division No. N". All 11 divisions are present, and population totals 510,550, matching the table's Newfoundland
  and Labrador row. `grand-falls-windsor` (Division 6), `gander` (6), `st-johns` (1). No name repeats across
  divisions, so every id is the plain slug.
  Source: https://www150.statcan.gc.ca/n1/tbl/csv/98100002-eng.zip, saved as
  `data/sources/ref-census-2021-population-csd.zip`, fetched 2026-09-14T05:25:43Z. www150's robots.txt allows `.zip`
  (Crawl-delay 2, obeyed). It disallows `*.csv` on both www12 and www150, so I didn't use the direct CSV download.
  A request I made to a guessed www12 index URL was redirected by the server to its 404 page under `/srvmsg/`,
  which that host's robots.txt disallows. I didn't request it on purpose, didn't save it, and fetch-source now
  refuses redirects unless told otherwise.
- `data/reference/industries.json` — the 20 NAICS Canada 2022 v1.0 sectors. Every `name` is checked word for word
  against the saved page text, from https://www23.statcan.gc.ca/imdb/p3VD.pl?Function=getVD&TVD=1369825 saved as
  `data/sources/ref-naics-2022-sectors.html` (Crawl-delay 10, obeyed). `plain` labels are mine.

### SAMPLE fixtures (8 programs, 9 hand-written pages)
All on `https://sample.invalid/`, fetched `2026-09-01T12:00:00.000Z`, messy on purpose (nav menus, `&rsquo;`,
`<strong>`/`<em>` inside sentences, `&nbsp;`, `&#37;`, non-breaking hyphens, `<template>`, `<noscript>`, comments).

| Slug | Type | Intake | Covers | Auto Service | Daycare |
|---|---|---|---|---|---|
| nl-sample-growth-grant | non-repayable | continuous | location+structure+employees lt 100+purpose+project_cost+self_check; contact with phone on a 2nd page | Looks like a fit | Doesn't fit |
| nl-sample-wage-subsidy | wage subsidy | open, deadline 2026-10-15 | employees lte 50, purpose hire; no contact | Doesn't fit | Looks like a fit |
| nl-sample-equipment-loan | loan | continuous | revenue lt 10,000,000 (met for 500k_1m) | Looks like a fit | Doesn't fit |
| ca-sample-small-lender-loan | loan | continuous | revenue lte 5,000,000 (straddles 2m_10m), industry not_in, self_check | Looks like a fit | Looks like a fit |
| nl-sample-community-fund | non-repayable | unknown | location (Divisions 6–8) + self_check only | Might fit | Might fit |
| ca-sample-digital-adoption-grant | non-repayable | closed | "no longer accepting applications" | Closed | Closed |
| nl-sample-women-entrepreneur-loan | loan | continuous | ownership women; contact with phone + email | Doesn't fit | Looks like a fit |
| nl-sample-startup-support | repayable | continuous | years_operating lte 24 months | Doesn't fit | Looks like a fit |

### What was verified, and how it could have failed
`node --test 'core/tests/**/*.test.mjs'` → **52 tests, 52 pass** (text, profile, verify, match, checks, build).
`npm run check:data` → every quote verified (0 real programs, 8 SAMPLE). `rig guard --agent gm1` → all inside slice.

The checks against the fixture server run on `GM_FIXTURE_PORT` (default 7403) through `originMap`, with a fake
clock, so the gap between two requests is exactly the sleep the code asked for.

**Negative controls** (each: targeted test green with the code intact → red with the break → file restored
byte for byte → full suite green again):

| # | Break | Test that went red |
|---|---|---|
| a | verifier accepts every quote (`if (!text.includes(quote))` → `if (false)`) | build-data --check on a copy with one planted quote exits 1 and names the program |
| b1 | self_check counted as met | an all-unknown program is never Looks like a fit |
| b2 | unknown (not answered) counted as met (`allMet = true`) | an all-unknown program is never Looks like a fit |
| c | straddling band treated as met | a straddling revenue band makes the lender loan Might fit |
| d | robots.txt ignored | …robots.txt disallow is respected ("the disallowed URL is never requested") |
| e | stale ignored (`stale: false`) | now + 61 days → stale and no Looks like a fit |
| f | Crawl-delay ignored | Crawl-delay is obeyed when it is longer than 1 s ("requested gap 1000 ms") |

**What these tests don't cover yet:** real program pages (phase 2), and running core inside workerd (gm2's Worker
tests do that). Also `scripts/fetch-source.mjs` has no automated test: it was exercised live twice, on the census zip
and the NAICS page, and both waited the host's Crawl-delay and saved raw bytes whose hashes `build-data` re-checks.

### For gm2
- Import `core/match.js` `matchPrograms` / `evaluateProgram` with bundle programs (`data/build/*.json` `programs`).
  `evaluateProgram` also accepts raw records; then `context` is null.
- `now` accepts a `Date` or an ISO string. `sourceStatus` comes from `sourceStatusFrom(runs)` with runs oldest first.
- `runChecks({ ..., trigger: 'cron' | 'manual' })` sets `trigger`; the default is `'node'`.
- The option lists for `/api/options` are exported from `core/profile.js`.

## Phase 2 — NL programs · not started

## Phase 3 — `scripts/scan.mjs` · not started
