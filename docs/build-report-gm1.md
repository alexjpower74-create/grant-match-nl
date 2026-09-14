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

## Phase 2 — NL programs · first three DONE, **stopped for cross-review** (per the brief)

gov.nl.ca terms, read once at https://www.gov.nl.ca/disclaimer/: the province owns the copyright and "grants
permission for the information of this web site to be used by the public and non-government organizations". It says
nothing against automated reading. Reproducing third-party multimedia is not permitted; we quote text only.
robots.txt allowed all three URLs. Requests to the host were spaced at least 1 s apart.

`npm run check:data` → every quote verified (3 real programs, 8 SAMPLE). Core tests 52/52 green, with the planted-quote
build test now planting into a real program.

| Slug | Sources | Type | Intake | Criteria (met-able / self_check) | Contacts |
|---|---|---|---|---|---|
| nl-business-growth-program | `--main` | non-repayable, max $200,000, 50% | unknown | 2 / 5 | email + 5 regional office phones incl. Central 709.256.1480 |
| nl-business-investment-program | `--main` | loan (term loan, Bank of Canada rate + 0.5%) | unknown | 3 / 5 | email + department line 1.709.729.2480 |
| nl-jobsnl-wage-subsidy | `--main` | wage subsidy, 60–80% up to $12/hour | unknown | 3 / 4 | Employment programs 1-800-563-6600 + email |

### Questions for gm2's cross-review (interpretation, against the saved page text)
1. **Intake unknown on all three.** None of the pages says when applications are taken, so none can show Looks like a
   fit. Is that the reading we want, or should an application form linked "Use either of the forms below to apply"
   count as open? I think not: the contract says `continuous` only when the page says so.
2. **Business Growth, structure.** The page lists sole proprietors, partnerships, corporations, co-operatives and
   non-profit organizations, so "Not registered yet" is **missed**. Too strict for a business that is just
   starting ("assist businesses start")?
3. **Business Growth, contacts.** The page itself shows the five regional office numbers, so they're quoted from the
   program page. `census_divisions` is null because the page doesn't say which divisions each office serves. The
   brief suggests JGRD's contact page as a second source for Central = Divisions 6, 7, 8. I haven't added it: I didn't
   find a gov.nl.ca page that names the divisions, and I won't infer them.
4. **Business Investment, revenue.** "less than $10 million in sales" is read as yearly revenue `lt 10000000`, and
   "fewer than 100 employees" as `lt 100`. The page says applicants "must normally" meet the list.
5. **Business Investment, export potential.** The page says the fund "is also available to businesses which have
   export potential", but the eligibility list requires "Operate in a strategic sector as defined by JGRD". Both
   kept only as a self_check on the strategic-sector line, plus a note; no rule.
6. **JobsNL, structure.** "Private or not-for-profit sector employers that are incorporated or sole proprietorships"
   is mapped to sole proprietor, corporation, co-operative and non-profit. The last two are there because they are
   incorporated bodies, so an unincorporated non-profit would wrongly show met. Partnership and "Not registered yet"
   are missed. Alternative: drop co-operative and non-profit from `in` (then an incorporated non-profit wrongly
   misses). I chose the reading that never wrongly says Doesn't fit.
7. **JobsNL, cost share.** `percent: 80` (the highest rate, third 14 weeks of JobsNL-42), with text "60% to 80% of
   wages depending on the option and period, up to $12 an hour". No `max_amount`: the page gives an hourly cap, not
   a total.

### Dry evaluation (now 2026-09-14T12:00Z, core `matchPrograms` on the three records)
- SAMPLE Auto Service: Business Growth **Might fit** (location + structure met; intake not stated; 5 to check);
  Business Investment **Might fit** (location, 6 < 100 employees, revenue band $500K–$1M under $10M all met);
  JobsNL **Doesn't fit** (purpose: equipment/software, not hiring).
- SAMPLE Daycare: all three **Might fit**, with JobsNL's purpose met (hire).
- APCO Software Tools (lead's profile, DECISIONS #14): Business Growth and Business Investment **Might fit**, with
  structure "Not sure" and revenue "Prefer not to say" shown as *Unknown: you didn't answer this or weren't sure*. JobsNL
  **Doesn't fit** (purpose).

### Remaining phase 2 list, waiting on the review
Programs 4–15 in the brief (Research and Innovation, Innovation and Business Development Fund, Green Transition
Fund, Job Accelerator and Growth, Harvester Enterprise Loan, the rest of /jgrd/funding/, Apprenticeship Wage
Subsidy, JGRD wage-subsidy programs and the Job Grant, CBDCs, NLOWE, takeCHARGE, RDÉE TNL): not started.

## Contract changes applied (main 821774c, 632c206, 1ee9aa9) · DONE
Merged main into `rig/gm1` (11bca50). The lead accepted questions 1–5 and 7–12 as built. Question 6 changed (API §9,
DECISIONS #16–17), and I applied it:
- `runChecks`: a page answering **404 or 410** → `ok: false`, every quote of that source in `missing`, error "the page
  is gone (HTTP 404)". **Any other non-2xx** or network failure → `ok: false`, `error` set, `missing: []`.
- `sourceStatusFrom` adds **`page_gone`**. `missing_quotes` and `page_gone` change only on a check that read the page
  (`ok`) or found it gone (404/410); a timeout, 5xx or robots refusal **keeps** the previous values.
  My reading of "page_gone = the newest check answered 404/410": `page_gone` also survives a later failed check.
  Otherwise a timeout after a 404 would clear it, which is exactly what #16 set out to stop. Tell me if you want the
  literal version.
- `evaluateProgram`: `needs_review` = any source with `missing_quotes > 0` **or** `page_gone`; the why line reads
  "The page has changed or gone since we checked it. Check the official page." `docs/RULES.md` updated to match.

| # | Break | Test that went red |
|---|---|---|
| g | a failed check resets the missing count | sourceStatusFrom … a failed check keeps the missing count and page_gone |
| h | `page_gone` ignored by needs_review | sourceStatus with missing quotes → needs_review, not Looks like a fit |
| i | 404/410 treated like any other failure | 404/410 count every quote missing and mark the page gone… ("HTTP 404") |

## Phase 3 — `scripts/scan.mjs` · DONE
Built while phase 2 waits for cross-review. It doesn't depend on how programs are interpreted.

- `npm run scan` builds the real bundle in memory, using `scripts/data-load.mjs`, now shared with
  `build-data.mjs`, so the scan re-checks exactly what the build verified. A data problem stops it before any fetch.
- Runs `runChecks` with Node's `fetch` and real sleeps (same politeness code as the Worker's cron). Caches each
  raw body in `data/scans/<UTC stamp>/<source-id>.html` (gitignored), then POSTs the ChecksResult to
  `http://127.0.0.1:${GM_WORKER_PORT||7402}/api/admin/checks` with `Authorization: Bearer <token>`. The token comes
  from `GM_ADMIN_TOKEN` or `ADMIN_TOKEN` in `worker/.dev.vars`; it's resolved before any fetch and never printed.
  Exit 1 on no token, an unreachable Worker or a non-2xx answer. Either way the result is kept in
  `data/scans/latest.json`.
- `--dry`: no POST. `--only slug,slug`: unknown slugs are refused.
- For tests only: `--sample`, `--scans <dir>`, `--worker <origin>`, `--dev-vars <file>`, `GM_SCAN_ORIGIN_MAP`.
- `core/tests/scan.test.mjs` (4 tests) runs the script against a local server on a random port that plays both the
  SAMPLE site and the Worker. It checks the dry-run summary naming the missing quote and the changed page, that
  `latest.json` is written, that raw bytes are cached exactly as served, that nothing is POSTed on `--dry`, the POST
  with its Bearer token and stored id, a token read from a `.dev.vars` file, that a missing token stops before any
  fetch, a 401 exiting 1, and an unknown `--only`.
- Control (j): removed the Authorization header → "POSTed with the Bearer token" red; restored.
- `worker/.dev.vars` doesn't exist in the gm1 worktree (gm2's is in theirs), so the non-dry run against a live
  Worker is for the lead's QA: `GM_ADMIN_TOKEN=… npm run scan`.

**Real `--dry` run** (2026-09-14T05:48:39Z → 05:48:44Z, 5.3 s including robots.txt and ≥ 1 s between requests):

```
scan: nl-business-growth-program--main: 17/17 quotes found
scan: nl-business-investment-program--main: 12/12 quotes found
scan: nl-jobsnl-wage-subsidy--main: 11/11 quotes found
Checked 3 source pages: 3 fetched fine, 0 not.
Quotes missing: none.
Page text changed since it was saved: none.
Raw pages: data/scans/2026-09-14T05-48-39-634Z · result: data/scans/latest.json
Dry run: nothing sent to the Worker.
```

Core tests after all of this: **56/56**; `npm run check:data` exit 0 (3 real programs, 8 SAMPLE).

## Lead review answers applied (DECISIONS #18) · DONE
- **`unclear` on structure and industry rules**, in core. `schema.js` accepts optional `unclear` ids (known, non-empty,
  not also in `in`/`not_in`). `match.js` returns `unknown`, reason `unclear`, why "The page's wording doesn't settle
  this for <label>.", and the fit why line (worded per DECISIONS #19) "Unknown: the page's wording doesn't settle it for your answer. …".
  RULES.md has a section with a worked example. Tests: structure and industry unclear, "an unclear answer is never
  Looks like a fit", and schema cases. **Control (k):** unclear treated as met → that test red; restored.
- JobsNL structure: in [corporation, sole_proprietor], unclear [cooperative, nonprofit]. Business Growth: unclear
  [not_registered]. Business Investment: the Business Growth page saved again as a second source
  (`--regional-offices`), with the five JGRD regional office phones labelled "(listed on the Business Growth Program
  page)".
- Q1 intake unknown kept; Q3 no divisions inferred; Q4, Q5, Q7 as researched; page_gone reading confirmed.

## Phase 2 — programs 4–15 · DONE (19 real NL programs; NLOWE blocked, takeCHARGE rejected on its terms)

### Committed programs (one commit each; `check:data` green after every one)
| Slug | Sources | Type | Intake | Criteria (met-able / self_check) | Notes |
|---|---|---|---|---|---|
| nl-research-and-innovation-program | `--main` | non-repayable, 50% | unknown | 2 / 2 | For non-commercial applicants only: structure in [nonprofit], unclear [cooperative]; businesses miss. Purpose research. |
| nl-green-transition-fund | `--main` | non-repayable, $75K–$3M, businesses 40% | **continuous** ("continual intake process") | 2 / 3 | Structure in [corporation], unclear [cooperative, nonprofit]. The green focus is self_check, so a corporation with any purpose can show Looks like a fit (see contract question A). |
| nl-job-accelerator-and-growth-program | `--main` | non-repayable payroll rebate, 10% | unknown ("assessed on a rolling basis" isn't intake) | 2 / 7 | Industry not_in [41, 44-45], unclear [53, 56]; purpose hire; 20 jobs / $50K salary / commitment are self_check; no location rule (companies from outside the province may apply). |
| nl-harvester-enterprise-loan-program | `--main` | loan (down payment), max $450,000 | unknown | 2 / 3 | Industry in [11] plus self_check "independent fish harvester". Guarantee and interest rebates in notes only. No contact on the page. |
| nl-investment-attraction-fund | `--main` | loan (loans and advances) | unknown | 1 / 7 | Inward investment only (self_check). "Registered company or commit to become one" settles no structure answer, so self_check. |
| nl-innovation-and-business-development-fund | `--main` | Unknown (only in PDFs) | unknown | 0 / 1 | Administered by Energy and Mines; everything beyond the summary is in PDFs, so Unknown. |
| nl-apprenticeship-wage-subsidy | `--main` | wage subsidy, 75% up to $14/h | unknown | 3 / 4 | Structure in [corporation, sole_proprietor], unclear [cooperative, nonprofit]; contact is the department's general line (the page has no program officer number). |
| nl-canada-nl-job-grant | `--main` | Unknown (not stated), max $15,000 | **closed** ("suspended… not being accepted") | 3 / 5 | The lower part of the page still says "Continuous intake"; the suspension notice wins. |
| nl-employment-enhancement-program | `--main` | wage subsidy, 75% up to $15/h | unknown | 4 / 4 | Industry in [11, 31-33] plus self_check value-added secondary processing; purpose hire or training. |
| nl-summer-employment-program-for-students | `--main` | wage subsidy, max $4,032 per FTE (private sector) | open, deadline 2026-02-19 → **closed by core** | 3 / 3 | Fetched at its final URL (the old one redirects on the same host). |
| nl-cbdc-general-business-loan | `--main`, `--office-central`, `--office-gander-area`, `--office-emerald` | loan, up to $150,000 | unknown | 1 / 4 | Location (rural Atlantic Canada → province); rural, viability, employment and "your local CBDC offers it" are self_check. |
| nl-cbdc-first-time-entrepreneur-loan | same four | loan, up to $150,000 | unknown | 2 / 3 | Structure in [sole_proprietor, corporation, partnership], unclear [not_registered]. "New, first time entrepreneur" is self_check, not a years rule (buying an existing business also qualifies). |
| nl-cbdc-innovation-loan | same four | loan, up to $150,000 | unknown | 2 / 4 | Purpose any [equipment, digital, research], plus self_check "clearly new technology". |
| nl-cbdc-newcomer-loan-program | same four | loan, up to $20,000 | unknown | 1 / 4 | For non-permanent residents; the profile's "newcomer" differs, so self_check (API §4). The page's "Non-permanent residents or citizens of Canada" is ambiguous and quoted as is. Extra contact: Metro Business Opportunities, for St. John's and Mount Pearl. |
| nl-cbdc-social-enterprise-loan | same four | loan, up to $150,000 | unknown | 2 / 4 | Structure in [nonprofit, cooperative]. |
| nl-cbdc-youth-loan-program | same four | loan, up to $150,000 (quoted from the CBDC Central office page; the loan page states no maximum) | unknown | 2 / 3 | Age 18–34 differs from the profile's 18–39, so self_check; structure as First Time Entrepreneur. |

Updated earlier programs: nl-jobsnl-wage-subsidy, nl-business-growth-program, nl-business-investment-program
(above).

### Checked, not added
- **Regional Development Fund:** only non-profit organizations may apply ("Eligible applicants are non-profit
  organizations"; co-operatives included, must be incorporated). Not for businesses.
- **Community Capacity Building Program:** "not-for-profit economic development organizations". Not for businesses.
- **takeCHARGE Business Efficiency Program (takechargenl.ca): REJECTED on terms.** The site's Terms of Use give a
  licence for "personal, non-commercial transitory viewing only" and say you may not "copy the information on the
  website" or "transfer, publish or disseminate the information". PLAN says not to use such a site. The three pages
  I fetched were deleted, not committed. The lead or Alexander could ask Newfoundland Power / NL Hydro for
  permission.
- **RDÉE TNL, now Horizon TNL (horizontnl.ca):** advice and help preparing applications; it "can orient you to a
  start-up loan of up to $75,000, offered in partnership with Futurpreneur Canada". It is not a funder itself, so not
  added. Futurpreneur isn't used either (its terms forbid copying; DECISIONS #19).
- **NLOWE (nlowe.org): BLOCKED.** The host resolves (35.208.104.81) but refuses connections on port 443 from this
  machine (three tries: 06:02, 06:03 and 06:13Z). Nothing fetched; no NLOWE record. Search results say NLOWE is a loan fund partner
  for the WEOC National Loan Program, but that can't be used without reading the official page.

### Things I got wrong, and fixed
- **cbdc.ca politeness.** cbdc.ca's robots.txt puts `Crawl-delay: 10` before any `User-agent` line. My parser ignored
  directives outside a group, so my first three cbdc.ca requests (two sitemaps and the Gander Area page,
  06:00–06:01Z) were about 1 s apart instead of 10 s. Fixed in `core/checks.js` (a Crawl-delay before any group
  applies to every agent). There is a test with cbdc.ca's exact shape, and **control (l)** ignoring it → red. Every
  cbdc.ca request since waited 10 s. The same code is in the Worker's cron, so the fix matters there too.
- **A test run I didn't gate.** One chain ran `npm run test:core | grep | head`, so 7 failing build and scan tests
  didn't stop the commits after it (2a54ea1, 2cc52a0, 515558e). The cause: two new program files still had
  placeholder hashes while the tests ran, which the build and scan tests correctly refused. Re-run with an explicit
  exit-code gate at 74baa60: **58/58 pass**, `check:data` exit 0 (13 real programs). Later chains gate on the exit code.

### Contract questions (new)
A. **`unclear` on purpose rules?** The Green Transition Fund is for "greening" projects, which cut across our
   purposes (equipment, research, market development). Without a way to say "unclear", it has no purpose rule, and a
   corporation in NL with any purpose can show Looks like a fit, with the green focus as a check-this-yourself item.
B. **Location from a list of place names.** CBDC office pages name the places they serve ("Gander Glenwood Appleton
   Benton Gambo…"), not census divisions. About 40 of Gander Area's names aren't census subdivisions (Benton, Ladle
   Cove, Herring Neck…), and name matching mistakes "Victoria Cove" for Victoria (Division 1). A `communities` rule
   would wrongly miss people in unincorporated places. My reading: no location rule from those lists, and "your
   local CBDC offers this" is a check-this-yourself item. Would `unclear` on location (for example, a division's
   "Somewhere else" entry) be wanted?

### CBDCs (item 12)
- **Terms:** cbdc.ca's Terms of Use (Atlantic Association of CBDCs) cover content users post, liability and spam.
  Nothing restricts reading or quoting the site's own information, so cbdc.ca is used. robots.txt allows everything,
  with Crawl-delay 10, obeyed on every request after the fix below.
- **Model:** one record per CBDC loan program: General Business, First Time Entrepreneur, Innovation, Newcomer,
  Social Enterprise, Youth. Each is quoted from its own cbdc.ca loan page. All three Central-NL office pages list all
  six loans.
- **Offices:**
  - CBDC Central (Grand Falls-Windsor, the brief's "Central Newfoundland"), CBDC Gander Area, and CBDC Emerald
    (Baie Verte, with a Springdale satellite office) are contacts on every loan record. Each office page is saved as
    a source of each record (same bytes, no extra requests) and quoted with its address and phone.
  - CBDC Cabot serves the northeast Avalon (Division 1), so it's out of scope.
  - Other NL CBDCs (Humber, Long Range, Nortip, Gateway, Labrador, Eastern, Trinity-Conception, Burin, Avalon West,
    South Coast, Coastal Business) were not added as contacts.
- **Location:** only the Gander Area page names the places it serves, and it names places, not census divisions. No
  location rule beyond the province was made from it (contract question B), and `census_divisions` is null for
  every office.
- **Not added:** cbdc.ca's other loans (Small Loan, Start-up Income Support, Future Entrepreneur, Impact, Immigrant
  pilot) aren't listed on the Central-NL office pages.

### Engine changes during phase 2
| # | Change | Break → test that went red |
|---|---|---|
| k | `unclear` on structure and industry rules (DECISIONS #18) | unclear treated as met → "an unclear answer is never Looks like a fit" |
| l | A robots.txt `Crawl-delay` before any `User-agent` line applies to every agent (cbdc.ca) | ignore it → "robotsAllows and robotsCrawlDelay" |
| m | `runChecks` fetches a URL shared by several sources once per run. Each CBDC office page is a source of six records, so without this the weekly check would fetch the same three cbdc.ca pages 18 times at 10 s each | no de-dup → "a URL shared by several sources is fetched once per run" |
| n | Quote context is the surrounding sentence (API §1, DECISIONS #20). My reading where the spec is silent: a quote that ends with a boundary character gets `after: ""`. | fall back to the raw window when no boundary is near → "contextFor gives the rest of the sentence, never menu text" ("a menu has no boundary, so no before") |
| — | Fit why lines read "Unknown: …", with "you didn't answer this or weren't sure" (DECISIONS #19, Q12–13); RULES.md copy to match | covered by the unclear test's exact string |

API §9's "robots.txt 4xx = no rules, 5xx = skip the host" and §6's counts note were already how core behaves.

### Real dry scan (all 19 programs, after the de-dup)
`npm run scan -- --dry`, 2026-09-14T06:20:54Z → 06:22:47Z (114 s):
```
Checked 38 source pages: 38 fetched fine, 0 not.
Quotes missing: none.
Page text changed since it was saved: none.
Raw pages: data/scans/2026-09-14T06-20-54-121Z · result: data/scans/latest.json
Dry run: nothing sent to the Worker.
```
38 sources, but only 22 unique URLs fetched (www.gov.nl.ca 13, cbdc.ca 9). Every source reported all its quotes found,
e.g. nl-business-growth-program--main 17/17 and nl-cbdc-innovation-loan--main 9/9.

### Dry evaluation, all 19 real programs (now 2026-09-14T12:00Z)
- **SAMPLE Auto Service:** 1 Looks like a fit, 9 Might fit, 7 Doesn't fit, 2 closed. The one Looks like a fit is the
  **Green Transition Fund**: incorporated, in NL, continuous intake. Its green focus is only a check-this-yourself
  item, so an equipment-and-software business shows Looks like a fit. That is contract question A in practice.
- **SAMPLE Daycare:** 0 Looks like a fit, 11 Might fit, 6 Doesn't fit, 2 closed.
- **APCO Software Tools:** 0 Looks like a fit, 11 Might fit, 6 Doesn't fit, 2 closed. The unanswered structure and
  revenue show as Unknown, never met. The CBDC Innovation Loan is Might fit with purpose (software) met.
- **Why so few Looks like a fit:** 17 of the 19 pages don't say when applications are taken. Only the Green
  Transition Fund states continuous intake. The Job Grant is suspended, and the student summer program's deadline
  has passed, so both are closed.

### Phase 2 commits
Programs, one commit each: 2f33a65, 7e1e1ac, 6e1db8d (first three) · 97b8227, 466c837, 47af709 (DECISIONS #18
updates) · ae061b2, 25f9399, d29a86c, 71211de, 32fb573, 3684794, 5955995, 2cc52a0, 515558e, 74baa60 · d668b2f,
ac44e56, b53b327, 7e4fae1, 2697f03, d55aa0f (CBDC).
Engine: 73d5531 (unclear), 2a54ea1 (Crawl-delay), 8809eb7 (URL de-dup), d4598c9 (sentence context, "Unknown:" wording).
Merges of main: 11bca50,  (DECISIONS #18), dd4f9d4.

## Left undone, and what I need
- **NLOWE:** nlowe.org is unreachable from this machine (connection refused on 443). Someone on another network should
  check it before researching the NLOWE loan (ownership `women`).
- **takeCHARGE:** rejected on its terms. It needs written permission from Newfoundland Power / NL Hydro, which is
  Alexander's call.
- **Contract questions A and B** (above): `unclear` on purpose, and location from place-name lists.
- **Records to watch:** the Summer Employment Program for Students will need a new record when the page announces the
  2027 intake. The Job Grant stays closed until its suspension notice changes (the weekly check flags a change).
- gm2's cross-review of the NL programs will come through the lead. Nothing outside gm1's slice was edited.
