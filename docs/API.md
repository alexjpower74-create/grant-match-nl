# Grant Match NL — data and API contract

Owner: the lead (main). Slices build against this file. If it is wrong or missing something, write it at the top
of your report under **Contract questions**, carry on with the most sensible reading, and the lead updates it.
Never quietly diverge.

## 0. Words that matter

- **Program** — one public funding program, researched into `data/programs/<slug>.json`.
- **Source** — one official web page a program's facts are quoted from, saved byte-for-byte as
  `data/sources/<source-id>.html` (committed; it is the evidence). A program has one or more sources.
- **Page text** — `pageText(html)` from `core/text.js`, computed from the saved source. Deterministic (§1).
- **Quote** — a string that is an **exact, case-sensitive substring of the page text** of the source it names.
  12–700 characters, no leading or trailing whitespace. No normalisation beyond `pageText`. Copy quotes from
  `node scripts/show-text.mjs <source-id>`, never from a browser (the browser's text differs).
- **Criterion** — one eligibility condition: plain-English `text`, a structured `rule` (§4), and the quote it came
  from. Evaluated against a profile to `met`, `missed` or `unknown`.
- **Unknown** — the page doesn't say, the profile didn't answer, the answer's band sits on both sides of the
  page's limit, or the criterion can't be answered from a profile at all ("check this yourself"). **Unknown is
  never counted as met.**
- **SAMPLE** — test/demo programs only: `"sample": true`, `name` starts `SAMPLE `, provider starts `SAMPLE `,
  source URLs on `https://sample.invalid/`. They live in `core/tests/fixtures/` and build into
  `data/build/sample.json`, never into the real bundle.

## 1. Page text — `pageText(html) → string` (`core/text.js`)

Exactly these steps, in order:
1. Remove HTML comments, and whole elements (tag and contents) `head`, `script`, `style`, `noscript`,
   `template`, `svg` (case-insensitive).
2. Remove these inline tags **without** adding a space (the text inside stays): `a abbr b bdi bdo cite code data
   dfn em font i kbd mark q s samp small span strong sub sup time u var wbr`. Every other tag becomes one space.
3. Decode entities: numeric (`&#8217;` `&#x2019;`) and the named set `amp lt gt quot apos nbsp ndash mdash lsquo
   rsquo ldquo rdquo sbquo bdquo hellip laquo raquo copy reg trade bull middot deg times cent pound euro frac12
   frac14 frac34 shy eacute Eacute egrave Egrave agrave Agrave acirc ecirc icirc ocirc ucirc ccedil Ccedil euml
   iuml ouml uuml`. `&shy;` decodes to nothing. Any other named entity stays as written.
4. U+00A0, U+2007, U+202F → space; U+200B, U+FEFF → removed. Collapse every whitespace run to one space; trim.

Curly quotes, dashes, case and punctuation are kept. `numbersIn(text) → number[]` (same file): every number
written in the text — `$1,500,000` → 1500000, `50 per cent`/`50%` → 50, `24 months` → 24, `2.5` → 2.5, and
`$1.5 million` → both 1.5 and 1500000 (`thousand`, `million`, `billion` multiply the number before them). Only
comma thousands separators. `contextFor(text, quote, n = 160) → { before, after } | null`: up to `n` characters
either side of the first occurrence, cut back to a word boundary, with `…` where it was cut.

## 2. Profile — `core/profile.js`

One screen. IDs are the API/URL values; labels are the on-screen words (the app may shorten, never change the
meaning). Numbers in bands are **intervals** used by the matcher (§5).

| Field | Query param | Required | Values |
|---|---|---|---|
| Business name | `name` | no | free text ≤ 80 chars, only printed on the owner's summary; never stored |
| Community | `community` | yes | an id from `data/reference/communities.json` |
| Industry | `industry` | yes | a NAICS sector id from `data/reference/industries.json` (`11`, `21`, `22`, `23`, `31-33`, `41`, `44-45`, `48-49`, `51`…`56`, `61`, `62`, `71`, `72`, `81`, `91`) |
| Business structure | `structure` | yes | `sole_proprietor` Sole proprietor · `partnership` Partnership · `corporation` Incorporated company · `cooperative` Co-operative · `nonprofit` Non-profit or charity · `not_registered` Not registered yet · `unsure` Not sure (→ unknown) |
| People working (full-time equivalent, including owners) | `employees` | yes | integer 0–100000 → interval [n, n] |
| Years operating | `years` | yes | `not_started` Not started yet [0,0] months · `lt1` Less than 1 year (0,12) · `1to2` 1 to 2 years [12,24) · `2to3` 2 to 3 years [24,36) · `3to5` 3 to 5 years [36,60) · `5to10` 5 to 10 years [60,120) · `10plus` More than 10 years [120,∞) |
| Yearly revenue | `revenue` | yes | `none` No revenue yet [0,0] · `lt30k` Under $30,000 (0,30000) · `30k_100k` [30000,100000) · `100k_300k` [100000,300000) · `300k_500k` [300000,500000) · `500k_1m` [500000,1000000) · `1m_2m` [1000000,2000000) · `2m_10m` [2000000,10000000) · `10m_100m` [10000000,100000000) · `100m_plus` [100000000,∞) · `unsaid` Prefer not to say (→ unknown) |
| Owned by | `owners` | no | absent = not answered (→ unknown) · `none` = None of these · comma list of `women` Women · `indigenous` Indigenous people · `youth` A young person (18 to 39) · `newcomer` A newcomer to Canada (arrived in the last 5 years) · `francophone` Francophone. Once answered, every flag not listed is **no**. |
| What the money is for | `purposes` | yes, ≥ 1 | comma list of `hire` Hire or pay wages · `equipment` Equipment · `digital` Software or digital · `export` Export or new markets · `training` Training · `research` Research or innovation · `energy` Energy efficiency · `startup` Starting the business |
| Project cost | `cost` | no | `lt10k` Under $10,000 (0,10000) · `10k_25k` [10000,25000) · `25k_50k` [25000,50000) · `50k_100k` [50000,100000) · `100k_250k` [100000,250000) · `250k_1m` [250000,1000000) · `1m_plus` [1000000,∞) · `unsure` Not sure (→ unknown). Absent = unknown. |

`parseProfile(input, { communities, industries }) → { profile, errors }` — `input` is a `URLSearchParams` or a plain
object of strings; `communities`/`industries` may be the arrays or the whole reference files. `errors` is `[{ field, message }]` in plain English ("Pick your community.") — empty = valid.
Unknown ids are errors; so are `owners=none,women` and a name over 80 characters (`owners=` empty = not answered).
Option intervals are `{ min, max, min_inclusive, max_inclusive }` with `max: null` for no upper limit; `unsaid`/`unsure` have none. `profile` is normalised: `{ name, community: { id, name, census_division }, industry: { id,
name }, structure, employees, years, revenue, owners: null | [] | ['women', …], purposes: [...], cost }`.
`profileToQuery(profile) → string` round-trips (`parseProfile(profileToQuery(p))` equals `p`).

## 3. ProgramRecord — `data/programs/<slug>.json`

```jsonc
{
  "slug": "nl-business-growth-program",        // ^(nl|ca)-[a-z0-9-]{3,80}$, equals the file name
  "sample": false,
  "name": "Business Growth Program",            // as the page names it
  "provider": "Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development",
  "level": "provincial",                        // provincial | federal | regional | nonprofit | crown
  "url": "https://www.gov.nl.ca/jgrd/funding/business-growth-program/",   // the page a person should open
  "summary": { "quote": "…", "source": "nl-business-growth-program--main" },
  "sources": [{
    "id": "nl-business-growth-program--main",   // ^<slug>--[a-z0-9-]{1,40}$ ; file data/sources/<id>.html
    "url": "https://…", "title": "…",           // title as fetched
    "publisher": "Government of Newfoundland and Labrador",
    "fetched_at": "2026-09-14T06:12:00.000Z",   // strict UTC ISO
    "http_status": 200,
    "sha256": "…",                               // of the raw bytes saved
    "text_sha256": "…",                          // of pageText(raw)
    "robots": "allowed",                         // what robots.txt said for this URL and our User-Agent
    "terms_note": "…" , "terms_url": "…"         // plain English + link, or null when the site has no terms page
  }],
  "funding_types": [                             // [] = Unknown. Several allowed (e.g. non-repayable for non-profits, repayable for businesses)
    { "type": "non_repayable", "applies_to": null, "quote": "…", "source": "…" }
  ],                                             // type: non_repayable | repayable | loan | tax_credit | wage_subsidy ; applies_to: plain English or null
  "intake": {
    "status": "continuous",                      // open | continuous | upcoming | closed | unknown
    "quote": "…", "source": "…",                  // null + null only when status is unknown
    "deadline": null                             // or { "date": "2026-10-15", "quote": "…", "source": "…" }
  },
  "max_amount": null,                            // or { "amount": 200000, "text": "Up to $200,000 over 24 months per project", "quote": "…", "source": "…" }
  "cost_share": null,                            // or { "percent": 50, "text": "Up to 50% of eligible costs", "quote": "…", "source": "…" }
  "criteria": [
    { "id": "location", "text": "The business operates in Newfoundland and Labrador",
      "rule": { "kind": "location", "province": "NL" }, "quote": "…", "source": "…" }
  ],
  "contacts": [                                  // [] when no official page gives one. Never a number from anywhere else.
    { "label": "Central Regional Office", "phone": "709-256-1480", "email": null, "census_divisions": [6, 7, 8],
      "quote": "…", "source": "…" }
  ],
  "research": { "by": "gm1", "notes": "plain-English interpretation notes for reviewers (not shown to users)" }
}
```

Build-time checks (`core/verify.js`, run by `npm run check:data`; any problem = exit 1 naming the file, the JSON
path and the reason):
- the record passes `validateProgram` (`core/schema.js`): required keys, enums, id patterns, `criteria[].id` unique,
  every `source` names an entry in `sources`, every source file exists;
- every quote (summary, funding types, intake, deadline, amount, cost share, criteria, contacts) is valid (§0) in
  the named source's page text;
- every number in a criterion's bounds, `max_amount.amount`, `cost_share.percent` is in `numbersIn(quote)`;
- `deadline.date`'s day-of-month and English month name (full or 3-letter) both appear in its quote, or the ISO date does;
- a contact's phone digits appear as a run in the quote's digits, its email as a substring;
- `sha256`/`text_sha256` match the saved file.

## 4. Criterion rules

| `rule.kind` | Shape | Profile field |
|---|---|---|
| `location` | `{ province: "NL" }` or `{ census_divisions: [1…11] }` or `{ communities: [ids] }` | community |
| `industry` | `{ in: [sector ids] }` or `{ not_in: [sector ids] }`, optional `unclear: [ids]` | industry |
| `structure` | `{ in: [structure ids] }` or `{ not_in: [...] }`, optional `unclear: [ids]` | structure |
| `employees` | bounds | employees |
| `years_operating` | bounds + `unit: "months" \| "years"` (years × 12 to compare) | years |
| `revenue` | bounds | revenue |
| `project_cost` | bounds | cost |
| `ownership` | `{ any: [owner ids] }` | owners |
| `purpose` | `{ any: [purpose ids] }` | purposes |
| `self_check` | `{}` — the page states it but no profile answer can settle it ("have a business plan", "be in good standing") | — |

**Bounds** use the page's own number and wording: `gte` (at least), `gt` (more than), `lte` (up to / or fewer / or
less), `lt` (fewer than / less than / under). At least one; `gte`/`gt` and `lte`/`lt` may combine. "Between $300,000
and $100 million" → `{ gte: 300000, lte: 100000000 }` (inclusive unless the page says otherwise).

**Map words to ids only when the mapping is mechanical.** "Sole proprietors, partnerships or corporations" →
`structure in [sole_proprietor, partnership, corporation]`. "Technology-driven firms", "strategic sectors",
"commercially viable", "good standing" are **`self_check`**, never a guessed industry list. Age or newcomer
definitions that differ from the profile's (§2) are `self_check` too.

**`unclear`** (structure and industry only): answers the page's wording can't settle either way. "Private or
not-for-profit employers that are incorporated or sole proprietorships" → `{ in: [corporation, sole_proprietor],
unclear: [cooperative, nonprofit] }` (a co-op or non-profit may or may not be incorporated). An id may not be in both
`unclear` and `in`/`not_in`. Prefer `unclear` over guessing in either direction.

## 5. Matching — `core/match.js`

`evaluateCriterion(criterion, profile) → { status, unknown_reason, why }`
- `self_check` → `unknown`, reason `self_check`.
- A profile value listed in the rule's `unclear` → `unknown`, reason `unclear`, why "The page's wording doesn't settle
  this for <label>."
- Profile field not answered (`owners` absent, `revenue: unsaid`, `cost` absent/`unsure`) → `unknown`, reason `not_answered`.
- Sets (`location`, `industry`, `structure`, `ownership`, `purpose`): `met` if the profile value is in (or, for `any`,
  overlaps) the rule's set; `not_in` inverts; otherwise `missed`. `location.province: "NL"` is met by every community.
- Bounds against the profile interval: `met` if **every** value in the interval satisfies all bounds, `missed` if
  **no** value does, otherwise `unknown` with reason `band_straddles`. (Employees are an exact interval [n, n].)
- `why`: one plain sentence built from the profile answer and the rule, e.g. "You said 3 people. The page says up
  to 500." / "You picked Retail. The page leaves out Retail." / "Your revenue band ($2M–$10M) is on both sides of
  the page's limit."

`evaluateProgram(program, profile | null, { now, sourceStatus = {} }) → ProgramResult`
- **Intake status (computed):** the stated status, except `open` with a `deadline.date` before today's date in
  America/St_Johns → `closed` with note "The deadline on the page has passed."
- **Verification:** per source, `last_verified` = `sourceStatus[id].last_verified_at` if present, else the source's
  `fetched_at`; `needs_review` = the latest live check of any source found fewer quotes than the record has;
  program `last_verified` = the oldest of its sources'; `age_days` = whole days from it to `now`; `stale` = `age_days > 60`.
- **Fit** (only when a profile is given):
  1. intake `closed` → **Doesn't fit**, `why` starts "Not taking applications right now."
  2. any criterion `missed` → **Doesn't fit**.
  3. every non-`self_check` criterion is `met`, at least one of them is not `location`, intake is `open` or
     `continuous`, and not `stale` and not `needs_review` → **Looks like a fit**.
  4. otherwise → **Might fit**.
  `self_check` items never make a program Doesn't fit and don't stop Looks like a fit, but they are always listed as
  Unknown ("Check this yourself"). `why` lists every reason the label isn't better, in plain English.
- `rank`: Looks like a fit 0, Might fit 1, Doesn't fit 2.

`matchPrograms(programs, profile, { now, sourceStatus }) → { open: ProgramResult[], closed: ProgramResult[], counts }`
- `closed` = computed intake `closed`; everything else is `open`.
- Sort `open` by: fit rank ↑, best funding type ↑ (`non_repayable` 0, `wage_subsidy` 1, `tax_credit` 2, `repayable` 3,
  `loan` 4, none 5; a program's best type is its lowest), missed count ↑, unknown count ↑, name (`localeCompare 'en'`).
  Sort `closed` by name.
- `counts = { looks, might, doesnt, closed }` (a closed program counts only in `closed`).

## 6. Output shapes (core builds them; the Worker returns them unchanged)

**Quote** (everywhere a quote is shown): `{ quote, source, source_url, context: { before, after } }`.

**ProgramResult**
```jsonc
{
  "slug": "…", "sample": false, "name": "…", "provider": "…", "level": "provincial", "url": "…",
  "summary": Quote,
  "funding_types": [{ "type": "non_repayable", "label": "Non-repayable", "applies_to": null, ...Quote }],
  "best_type": "non_repayable",                  // or null
  "intake": { "status": "continuous", "stated_status": "continuous", "label": "Takes applications any time",
              "note": null, "quote": Quote|null, "deadline": null | { "date": "2026-10-15", ...Quote } },
  "max_amount": null | { "amount": 200000, "text": "…", ...Quote },
  "cost_share": null | { "percent": 50, "text": "…", ...Quote },
  "contacts": [{ "label": "…", "phone": "…", "email": null, "census_divisions": [6], ...Quote }],
  "criteria": [{ "id": "…", "text": "…", "kind": "employees", "rule": {…},
                 "status": "met" | "missed" | "unknown" | null,          // null when no profile
                 "unknown_reason": "not_answered" | "band_straddles" | "unclear" | "self_check" | null,
                 "why": "…" | null, ...Quote }],
  "counts": { "met": 3, "missed": 0, "unknown": 2, "self_check": 1 },   // zeros when no profile
  "fit": null | { "label": "Looks like a fit" | "Might fit" | "Doesn't fit", "rank": 0, "why": ["…"] },
  "verification": { "last_verified": "2026-09-14", "age_days": 0, "stale": false, "needs_review": false,
                    "missing_quotes": 0, "last_checked_at": null },
  "unknown_facts": ["intake", "max_amount", "cost_share", "funding_types"],   // which program facts the pages don't state
  "sources": [{ "id": "…", "url": "…", "title": "…", "publisher": "…", "fetched_at": "…" }]
}
```
Intake labels: open "Taking applications" (+ " until <date>" in the app), continuous "Takes applications any time",
upcoming "Not open yet", closed "Closed", unknown "The page doesn't say".
Funding type labels: Non-repayable, Repayable, Loan, Tax credit, Wage subsidy.

## 7. Reference data — `data/reference/`

- `communities.json`: `{ source: { url, title, publisher, fetched_at, file }, communities: [{ id, name, type,
  csd_code, census_division, population_2021 }] }` — every census subdivision in NL from Statistics Canada's 2021
  Census (towns, cities, Indigenous communities, and one "Somewhere else in Division No. N" entry per census
  division for unincorporated places, `type: "other"`). That table has no subdivision-type column, so every named
  subdivision is `type: "subdivision"`; the "Somewhere else" entries fold in the unorganized "Division No. N, Subd. X" rows. `id` = slug of the name, unique. Sorted by name.
- `industries.json`: `{ source: {…}, industries: [{ id: "44-45", name: "Retail trade", plain: "Stores and retail" }] }`
  — the 20 NAICS Canada 2022 sectors; `name` verbatim from Statistics Canada, `plain` a short everyday label.
- Raw reference sources are saved as `data/sources/ref-<name>.<ext>`.

## 8. Bundles — `scripts/build-data.mjs` → `data/build/` (gitignored, always regenerated)

`buildBundle({ programs, pageTexts, communities, industries }) → { bundle, problems }` in `core/bundle.js`.
`bundle = { data_set: "real" | "sample", built_from: "<newest source fetched_at>", programs: [ProgramRecord with every
quote expanded to Quote], communities, industries }`, where `communities` and `industries` are the **whole reference files** as
loaded (`bundle.communities.communities`, `bundle.communities.source`; same for industries). No wall-clock values, so the same inputs give the same bytes.
- `node scripts/build-data.mjs` → verifies, writes `data/build/programs.json` (real, from `data/`) and
  `data/build/sample.json` (from `core/tests/fixtures/programs/` + `core/tests/fixtures/sources/`, with the real
  reference lists). Exit 1 and write nothing if there is any problem.
- `--check` verifies only. `--data <dir>` reads programs/sources/reference from another directory (tests).

## 9. Live re-checks — `core/checks.js`

`runChecks({ programs, fetch, sleep, now = () => new Date(), only, onRaw, log, originMap }) → ChecksResult`
- For every source of every program (or `only`: program slugs): read the host's `robots.txt` once per run and obey
  it for our User-Agent (`robotsAllows(txt, ua, path)`; `User-agent` groups, `Disallow`/`Allow` longest match, `*`
  and `$`); a disallowed URL is not fetched and is reported `ok: false, error: "robots.txt disallows"`.
- Politeness inside: ≥ 1 s between requests to one host, or the host's `Crawl-delay` seconds if larger;
  `User-Agent: APCO-Software-Tools-research/1.0 (+https://apcosoftwaretools.ca)`; GET only; 20 s timeout.
- `originMap` (tests only): `{ "https://sample.invalid": "http://127.0.0.1:7403" }` rewrites origins before fetching.
- `onRaw({ source_id, url, fetched_at, http_status, body })` is awaited after each fetch.
- A page answering **404 or 410**: `ok: false`, every quote of that source in `missing` (a gone page can't vouch for
  them). **Any other non-2xx, a network error, or robots.txt refusing/unreachable**: `ok: false`, `error` set,
  `missing: []`; it says nothing about the page.

```jsonc
{ "started_at": "ISO", "finished_at": "ISO", "trigger": "node" | "cron" | "manual",
  "sources": [{ "source_id": "…", "program_slug": "…", "url": "…", "ok": true, "error": null, "http_status": 200,
                "fetched_at": "ISO", "sha256": "…", "text_sha256": "…", "changed": false,   // text_sha256 differs from the saved snapshot
                "quotes_total": 9, "quotes_found": 9, "missing": [{ "path": "criteria[2].quote", "quote": "…" }] }] }
```
`sourceStatusFrom(runs) → { [source_id]: { last_checked_at, last_ok, last_verified_at, missing_quotes, page_gone } }`
folds stored runs (newest last) into the map `evaluateProgram` takes: `last_verified_at` = newest `fetched_at` with `ok`
and `missing` empty; `missing_quotes` = the missing count of the newest check that read the page (`ok`) or found it gone (404/410),
so a timeout, a 5xx or a robots refusal **keeps** the previous count instead of clearing it; `page_gone` = the newest
check answered HTTP 404 or 410. In `evaluateProgram`, `needs_review` = any source with `missing_quotes > 0` **or**
`page_gone`; the app's needs-review copy then reads "The page has changed or gone since we checked it. Check the
official page."

## 10. Core modules (gm1 owns; Worker, scripts and the app's mock import them)

Pure ESM, no Node built-ins, no dependencies (`crypto.subtle` for hashes; it exists in Node and workerd).
`core/text.js` §1 · `core/profile.js` §2 (+ exported option lists `STRUCTURES`, `YEARS`, `REVENUE`, `COST`, `OWNERS`,
`PURPOSES`, `FUNDING_TYPES`, each `[{ id, label, interval? }]`) · `core/schema.js` `validateProgram(record) → string[]` ·
`core/verify.js` `verifyProgram(record, pageTexts) → problems[]` · `core/match.js` §5 · `core/bundle.js` §8 ·
`core/checks.js` §9 · `core/hash.js` `sha256Hex(stringOrBytes) → Promise<string>`.

## 11. HTTP API (gm2 owns `worker/`)

Base `http://127.0.0.1:7402`. JSON. `Access-Control-Allow-Origin: *` on every response; `OPTIONS` answered.
Errors: `{ "error": "plain message" }` (+ `"errors": [{field, message}]` for profile problems).
Vars: `DATA_SET` = `real` (default) | `sample` picks `data/build/programs.json` or `sample.json` (both imported);
`ALLOW_NOW` = `1` lets `?now=<ISO>` set the clock (tests and dev only); `ADMIN_TOKEN`; `SOURCE_ORIGIN_MAP` (JSON,
tests only). D1 binding `DB` holds check runs only. **No profile is ever stored or logged.**

| Method + path | Answer |
|---|---|
| `GET /api/health` | `{ ok: true, data_set, programs: N, built_from }` |
| `GET /api/options` | `{ communities, industries, structures, years, revenue, cost, owners, purposes, sources: { communities: {…}, industries: {…} } }` |
| `GET /api/match?<profile>` | 200 `{ profile, evaluated_at, open: ProgramResult[], closed: ProgramResult[], counts }` · 400 `{ error: "Some answers are missing.", errors }` |
| `GET /api/programs` | `{ programs: [ProgramResult with no profile] }` sorted by name |
| `GET /api/programs/:slug?<profile>` | 200 `{ profile: … \| null, result: ProgramResult }` (evaluated when the profile is valid, unevaluated when absent; 400 if present but invalid) · 404 |
| `GET /api/checks?limit=20` | `{ runs: [{ id, trigger, started_at, finished_at, sources_total, sources_ok, quotes_missing, sources: [...] }] }` newest first |
| `POST /api/admin/checks` | Bearer `ADMIN_TOKEN`; body ChecksResult → `{ stored: run_id }` · 401 · 400 · 413 over 1 MB |
| `POST /api/admin/scan` | Bearer; runs `runChecks` now, inside the request (trigger `manual`), and stores it → the stored run. Synchronous is fine locally; a deploy would want `ctx.waitUntil` + 202. |
| `scheduled()` | cron `15 10 * * 1` (Mondays 07:45 NDT): `runChecks` (trigger `cron`), store |

Clock: `?now=` is silently ignored unless `ALLOW_NOW=1`; with `ALLOW_NOW=1` an unparseable `now` is a 400.
Source status: the Worker folds the newest 50 stored runs with `sourceStatusFrom` (one run a week ≈ a year).

## 12. App (gm2 owns `app/`)

`<meta name="api-base" content="http://127.0.0.1:7402">`, `?api=<origin>` overrides. `?mock=1` → `app/api.mock.js`,
which imports `/core/*.js` and runs the **real core** in the browser on `/data/build/sample.json` (`&data=real` →
`programs.json`); `app/serve.mjs` serves `app/` at `/`, `core/` at `/core/`, `data/build/` at `/data/build/`,
GET/HEAD only, nothing else (it also refuses `app/serve.mjs`, `app/tests/…` and Playwright files: they are not the
site). `?now=<ISO>` is carried to the API/mock. Results headline: "N programs could fit" with N = `counts.looks +
counts.might`. Printout: only Looks like a fit and Might fit programs (Looks like a fit first), up to 6, then "and N
more on the results page" when there are more. Profile params, `mock`, `api`, `now`, `data`
are carried across every internal link.

Pages: `index.html` profile form → `results.html?<profile>` → `program.html?slug=<slug>&<profile>` →
`print.html?<profile>` (one printed page for the owner) · `about.html` (how it works, every source with fetched
date and last live check, what "Unknown" means).

Copy that must stay true:
- Everywhere (footer): "Grant Match NL shows what each program's own page says. It never applies for you and can't
  promise you qualify."
- Unknown reasons: `self_check` "Unknown: check this yourself" · `not_answered` "Unknown: you didn't answer this" ·
  `band_straddles` "Unknown: your answer is close to the page's limit" · `unclear` "Unknown: the page's
  wording doesn't settle it for your answer" · a program fact the pages don't state
  "Unknown: the page doesn't say".
- Stale: "Last verified <date>, more than 60 days ago. Check the official page." · needs review: "The page has
  changed or gone since we checked it. Check the official page."
- Closed: "Closed. Not taking applications right now." with its quote.
- "Call this office" only when `contacts` is non-empty (every contact came from an official page).
