# Grant Match NL — build contract

One plan file. It is the contract, at the repo root, and every agent reads the same copy.
Read `AGENTS.md` (rules), `docs/API.md` (the data + HTTP contract between slices) and `DECISIONS.md` first.

## The brief (Onyx for Alexander, 2026-09-14)
A small business in Newfoundland and Labrador answers a short profile and gets the public funding programs that
could fit, with **every eligibility fact quoted from the program's own page**. Alexander sells custom software to NL
small businesses (APCO Software Tools); "here's the program that could pay for part of it" is the opener. It never
applies for anyone and never promises eligibility: it says what the page says and "Unknown" where the page doesn't
say. Rules only, no model deciding eligibility. Each program shows **Looks like a fit / Might fit / Doesn't fit**,
the criteria met, missed and Unknown (never counted as met), each with its quote; a "Last verified" date, flagged
when older than 60 days; sorted by fit, then non-repayable first. Screens: profile → results → program detail (quotes
highlighted, link to the page, "call this office" only if the number is on the official page) → "print for the
owner" one-page summary. Phone 390 and desktop 1280. **Research is the job: every program verified live.**

**Design.** Screen: the approved portfolio look (Shop Board calm pass). Dark navy/slate base, glass surfaces with
hairline borders, soft shadows, a faint aurora at ~0.2 opacity, gradient wordmark "Grant Match NL". Colour goes on
data, not backdrops: Looks like a fit = emerald, Might fit = amber, Doesn't fit = rose, Closed = slate; funding-type
pills (Non-repayable teal, Wage subsidy sky, Tax credit violet, Repayable and Loan neutral). Quotes sit on a lighter
surface as a blockquote: muted context, the quote itself in `<mark>` with a soft amber tint, then "From <page
title>" linking to the page. System font stack, tabular numbers, inline SVG icons, no emoji. Large readable type
(owners are not all young). Phone-first; program detail is two columns at 1280. **Print page:** white ground, black
type, thin rules, no backgrounds or aurora, exactly one US Letter page.

**Stack.** `core/` pure ESM zero-dep (Node + workerd) · `data/` programs, saved sources, reference lists ·
`scripts/` Node runners · `worker/` Cloudflare Worker + D1, **local only** · `app/` static HTML/CSS/JS served by
`node app/serve.mjs`. Root `package.json` (lead) has `build:data`, `check:data`, `scan`, `dev:worker`, `dev:app`,
`test:core`, `test:worker`, `test:app`, `test`. Root `node_modules` (only `@playwright/test`) is symlinked into each
worktree by the lead. `wrangler` is on PATH.
Ports: app 7401 (gm2) · worker 7402 (gm2) · core check-test fixture server 7403 (gm1) · worker fixture server 7404
(gm2) · QA: app 7408, worker 7409, fixtures 7407 / 7406.

## Rules
- You own the files under your id and nothing else; `rig guard` enforces it. Commit only your own paths
  (`git commit -- <paths>`). Verify → commit → report in `docs/build-report-<id>.md` (committed).
- If the contract is wrong or missing something, write it at the top of your report under **Contract questions**
  and carry on with the most sensible reading. The lead reads reports and updates the contract.
- Never grade the shared tree. No visible Chrome. Playwright only, `pwshot` for screenshots.
- A check that cannot fail measured nothing: for each important check say what would make it red, make it red once,
  restore, and record it in your report.
- **No invented programs.** SAMPLE programs only in fixtures (`sample: true`, `SAMPLE ` names). Test profiles:
  "SAMPLE Auto Service", "SAMPLE Daycare" (below).
- **Forbidden:** any deploy, `wrangler secret put`, `wrangler d1 create`, anything `--remote`; sending anything;
  touching other projects; creating herdr workspaces or tabs; aggregator sites as sources. Keep scratch files inside
  your worktree.
- AI: none planned. If you use a model to help draft rules, log it in `docs/spend.md` (project cap CA$2) and verify
  every quote anyway.

### How to research a program (gm1 and gm2 both)
1. Find the program owner's own page (or the official partner that delivers it). Search engines are fine for
   finding URLs; aggregator sites are never a source and never a substitute for reading the official page.
2. Read the site's terms/copyright page once per host and write a one-line `terms_note` (+ `terms_url`). If the terms
   forbid copying or automated reading, don't use that site: note it in your report and move on.
3. `node scripts/fetch-source.mjs --id <slug>--<name> --url <url>` (checks robots.txt, waits politely, saves
   `data/sources/<id>.html`, prints the `sources[]` entry). Fetch the eligibility, funding and how-to-apply pages
   the program page links to when the facts are there. HTML pages only; a fact that only exists in a PDF is Unknown
   (say so in `research.notes`).
4. `node scripts/show-text.mjs <source-id> [--grep word]` and copy quotes from that output only.
5. Write `data/programs/<slug>.json` per API.md §3–4. Facts only from quotes. Null/`unknown` when the page doesn't
   say. Rules use the page's own numbers and operators. Anything that isn't a mechanical mapping is `self_check`.
   Intake: `continuous` only when the page says so ("ongoing", "accepted year-round", "no deadline"); a page that
   is silent is `unknown`. A program page that is gone (404 or redirect away) is not a program: note it.
6. `npm run check:data` green, then commit that program and its sources on their own
   (`git commit -- data/programs/<slug>.json data/sources/<slug>--*`).
7. In your report, one line per program: slug, sources, type, intake, criteria count (met-able / self_check), and
   anything you chose to leave out and why.

### Test profiles (tests and QA use these; query strings per API.md §2)
- **SAMPLE Auto Service** — `name=SAMPLE Auto Service&community=grand-falls-windsor&industry=81&structure=corporation&employees=6&years=10plus&revenue=500k_1m&owners=none&purposes=equipment,digital&cost=25k_50k`
- **SAMPLE Daycare** — `name=SAMPLE Daycare&community=gander&industry=62&structure=sole_proprietor&employees=4&years=1to2&revenue=100k_300k&owners=women&purposes=hire,training&cost=10k_25k`
- Real data only (lead's QA and screenshots): **APCO Software Tools**, per `DECISIONS.md` #14.
- Default test clock: `now=2026-09-14T12:00:00Z`. SAMPLE sources are fetched `2026-09-01T12:00:00.000Z`, so
  `now=2026-12-01T12:00:00Z` makes them stale.

## Agents

### gm1 — Engine, reference data, Newfoundland and Labrador programs
Owns:
- core/**
- scripts/**
- data/reference/**
- data/programs/nl-*
- data/sources/nl-*
- data/sources/ref-*
- docs/RULES.md
- docs/spend.md

Report: docs/build-report-gm1.md

Task:
**Phase 1 — the engine. Commit it as soon as it is green; gm2 is waiting on it.**
1. `core/` exactly per `docs/API.md` §1–10: `text.js`, `hash.js`, `profile.js`, `schema.js`, `verify.js`, `match.js`,
   `bundle.js`, `checks.js`. `docs/RULES.md` explains the rule kinds, interval logic and fit labels in plain English
   with one worked example each.
2. `scripts/build-data.mjs` (`--check`, `--data <dir>`; exit 1 naming file + JSON path + reason; writes nothing on a
   problem), `scripts/fetch-source.mjs` (robots.txt, per-host politeness incl. Crawl-delay, our User-Agent, saves raw
   bytes, prints the `sources[]` JSON with both hashes, refuses to overwrite an existing file without `--force`),
   `scripts/show-text.mjs` (`--grep` prints each hit with 200 characters around it).
3. Reference lists (API.md §7): NL census subdivisions from Statistics Canada's 2021 Census population and dwelling
   counts (find the official CSV/table download; robots Crawl-delay 2) → `data/reference/communities.json`, ids
   `grand-falls-windsor`, `gander`, `st-johns` must exist; NAICS Canada 2022 sectors from Statistics Canada →
   `data/reference/industries.json`. Raw files saved as `data/sources/ref-*`.
4. SAMPLE fixtures: `core/tests/fixtures/sources/*.html` (hand-written SAMPLE pages, messy on purpose: nav menus,
   `&rsquo;`, `<strong>` inside sentences, `&nbsp;`) and `core/tests/fixtures/programs/*.json`, at least these 8:
   a non-repayable continuous program that is **Looks like a fit** for SAMPLE Auto Service (location + structure +
   employees + purpose + one self_check); a wage subsidy with `employees lte 50` and purpose `hire`; a loan with
   `revenue lt 10000000` (met for `500k_1m`) and a loan with `revenue lte 5000000` (straddles for `2m_10m`); a program with only location + self_check (→ Might fit); a **closed** program ("no longer
   accepting applications"); an `open` program with deadline 2026-10-15; a program with a contact (phone on its
   page) and one without; a women-owned ownership rule; an `industry not_in` rule; a `years_operating lte 24
   months` rule. Every SAMPLE source URL is on `https://sample.invalid/`.

Tests `core/tests/*.test.mjs` (run `node --test 'core/tests/**/*.test.mjs'`): pageText on the messy fixtures
(inline tags join, block tags space, entities, nbsp, script/style/head gone); numbersIn cases (`$1,500,000`,
`$1.5 million`, `50 per cent`, `fewer than 100`, `24 months`); verify flags a one-character-changed quote, a bound
number not in its quote, a wrong amount, a missing source, a bad hash, a deadline date not in its quote; each rule
kind met/missed/unknown incl. `band_straddles` and `not_answered`; `owners` absent vs `none` vs list; fit labels for
every SAMPLE program and both test profiles; closed and deadline-passed go to `closed` as Doesn't fit; `now` + 61
days → stale and no Looks like a fit; `sourceStatus` with missing quotes → needs_review; sort order (fit, then
non-repayable before loan); `parseProfile(profileToQuery(p))` round-trips; buildBundle is byte-identical across two
runs; **`build-data.mjs --check --data <tmp copy with one planted quote>` exits 1 and names the program**, and exits
0 on the real `data/`; runChecks against a fixture HTTP server on `GM_FIXTURE_PORT` (default 7403) via `originMap`:
User-Agent header, robots.txt disallow respected (URL never requested), ≥ 1 s requested sleep between same-host
requests and ≥ the Crawl-delay when set, a page with one quote removed → `missing` names it, `changed` true.
Negative controls (red once each, restore, record): (a) verifier accepts everything → planted-quote build test red;
(b) `self_check`/unknown counted as met → "all-unknown program is never Looks like a fit" red; (c) straddling band
treated as met → band test red; (d) robots ignored → robots test red; (e) stale ignored → stale test red.

**Phase 2 — Newfoundland and Labrador programs** (starting list checked by the lead, 02:45: every URL answered 200
to our User-Agent and robots.txt allows it; add others you find on official pages):
1. `nl-business-growth-program` — https://www.gov.nl.ca/jgrd/funding/business-growth-program/ (the old `/iet/` and
   `/em/` URLs are 404; the department is now Jobs, Growth and Rural Development)
2. `nl-business-investment-program` — https://www.gov.nl.ca/jgrd/funding/business-investment-program/
3. `nl-jobsnl-wage-subsidy` — https://www.gov.nl.ca/jgrd/empservices/jobsnl/
4. `nl-research-and-innovation-program` — https://www.gov.nl.ca/jgrd/funding/research-and-innovation-program/
5. `nl-innovation-and-business-development-fund` — https://www.gov.nl.ca/jgrd/funding/innovation-and-business-development-fund/
6. `nl-green-transition-fund` — https://www.gov.nl.ca/jgrd/funding/green-transition-fund-program/
7. `nl-job-accelerator-and-growth-program` — https://www.gov.nl.ca/jgrd/funding/job-accelerator-and-growth-program/
8. `nl-harvester-enterprise-loan-program` — https://www.gov.nl.ca/jgrd/funding/harvester-enterprise-loan-program/
9. The rest of https://www.gov.nl.ca/jgrd/funding/ (Regional Development Fund, Community Capacity Building,
   Investment Attraction Fund): include only if a business can apply; otherwise "checked, not for businesses".
10. `nl-apprenticeship-wage-subsidy` — https://www.gov.nl.ca/atcd/apprentices-youth/financial-supports/aws/
11. The employer wage-subsidy programs listed under JGRD "Employment (Wage Subsidy) Programs" (e.g. student summer
    employment) and the Canada-Newfoundland and Labrador Job Grant (training) — official gov.nl.ca pages.
12. CBDCs serving Central Newfoundland on cbdc.ca (Crawl-delay 10): https://cbdc.ca/locations/cbdc-gander-area/, CBDC
    Central Newfoundland (Grand Falls-Windsor) and any other whose stated area includes Census Divisions 6, 7 or 8;
    plus the CBDC loan programs pages (e.g. the Newcomer Loan) from `https://cbdc.ca/loan_program-sitemap.xml`.
    Location rules only from the area the page names.
13. Newfoundland and Labrador Organization of Women Entrepreneurs loan (nlowe.org) — ownership `women`.
14. takeCHARGE Business Efficiency Program (takechargenl.ca) — purpose `energy`.
15. RDÉE TNL (francophone): include only if it offers funding a business applies for; otherwise note it.
Contacts: the brief mentions the JGRD Central office, 709-256-1480. Use it only if an official gov.nl.ca page
shows it (e.g. JGRD's contact/regional offices page as a second source, with `census_divisions` for its region).
After your first **three** programs are committed, stop and report; the lead has gm2 cross-review their
interpretation before you do the rest.

**Phase 3 — `scripts/scan.mjs`** (`npm run scan`): builds the real bundle in memory, runs `runChecks` with Node's
fetch, caches raw bodies in `data/scans/<UTC stamp>/<source-id>.html` (gitignored), POSTs the result to
`http://127.0.0.1:${GM_WORKER_PORT||7402}/api/admin/checks` with the token from `GM_ADMIN_TOKEN` or
`worker/.dev.vars`, prints a plain summary (sources ok, quotes missing per program). `--dry` = no POST, writes
`data/scans/latest.json`. `--only <slug,…>`. Finish with one real `--dry` run and put its summary in your report.

### gm2 — Worker API + D1, the app, federal and national programs
Owns:
- worker/**
- app/**
- docs/shots/**
- data/programs/ca-*
- data/sources/ca-*

Report: docs/build-report-gm2.md

Task:
**Phase 1 — app and Worker.** gm1 is building `core/` in parallel. Until the lead tells you core is on main, build
the pages against hand-made SAMPLE ProgramResult JSON in `app/tests/fixtures/` that follows API.md §6 exactly; once
core lands, `git merge main`, switch the mock to the real core and delete anything the core now produces.

Worker (`worker/`): `wrangler.toml` name `grant-match-nl`, `main = "src/index.js"`, `compatibility_date = "2026-09-01"`,
D1 binding `DB` (`database_name = "grant-match-nl"`, `database_id = "LOCAL-ONLY-set-at-deploy"`,
`migrations_dir = "migrations"`), `[triggers] crons = ["15 10 * * 1"]`, `[vars] DATA_SET = "real"`, `ALLOW_NOW = "0"`,
`SOURCE_ORIGIN_MAP = ""`. `worker/.dev.vars.example`: `ADMIN_TOKEN=local-dev-token` and `ALLOW_NOW=1`; make your own
`.dev.vars`. `worker/package.json` scripts: `dev` = `wrangler dev --local --port 7402`, `migrate:local`, `test` =
`node tests/run.mjs`, which picks `GM_WORKER_PORT` (default 7402), wipes and uses `--persist-to .wrangler/test-state`,
applies migrations `--local` there, starts a SAMPLE fixture server on `GM_FIXTURE_PORT` (default 7404), starts
`wrangler dev --local --test-scheduled` with `--var DATA_SET:sample --var ALLOW_NOW:1 --var ADMIN_TOKEN:test-admin-token`
and `SOURCE_ORIGIN_MAP` pointing `https://sample.invalid` at the fixture server, waits for `/api/health`, runs
`node --test tests/`, and always stops what it started. Imports `../../core/*.js` and
`../../data/build/{programs,sample}.json`. Everything per API.md §11: routes, CORS, constant-time token compare,
body size guard, D1 migrations for check runs, `sourceStatusFrom` over stored runs, no profile ever written anywhere.

Tests `worker/tests/*.test.mjs` (SAMPLE data set): health says `sample`; options lists and their sources; 400 +
`errors` when community is missing; for both test profiles `/api/match` deep-equals `matchPrograms` from core run in
the test on `data/build/sample.json` with the same `now` (the Worker must not reshape results); the closed SAMPLE
program is in `closed` as Doesn't fit; detail 200 / 404 / 400, and with no profile every `status` and `fit` is null;
`now` +78 days → `stale` true and no Looks like a fit; 401 with no/wrong token; POSTing a ChecksResult with one missing
quote for a SAMPLE source → that program `needs_review` and not Looks like a fit, `/api/checks` lists the run;
`POST /api/admin/scan` against the fixture server (one SAMPLE page with a quote removed, a robots.txt disallowing one
SAMPLE path) → stored run shows the missing quote and the robots error; `/__scheduled?cron=15+10+*+*+1` stores a run
with trigger `cron`; CORS on a 404; after matching with `name=SAMPLE Auto Service`, no D1 table contains that string.
Plus `worker/tests/real.test.mjs`, skipped unless `GM_REAL=1` (the lead runs it in QA with `DATA_SET=real`): every
program answers, every criterion has a quote with context, `ca-canada-digital-adoption-program` (once it exists) is
closed. Negative controls (red once each, restore, record): (a) `sourceStatus` not passed → needs_review test red;
(b) auth check removed → 401 test red; (c) Worker reverses `closed` or drops a field → deep-equal test red.

App (`app/`): `serve.mjs` per API.md §12 (zero-dep, `--port`, content types, 404 page, no directory listing, path
traversal refused, serves only `app/`, `core/`, `data/build/`). Pages `index.html`, `results.html`, `program.html`,
`print.html`, `about.html`; shared `app.css`, `api.js` (base from `<meta name="api-base">`, `?api=`, `?mock=1` →
`api.mock.js`), `api.mock.js` (real core in the browser, `&data=real` option), `profile-form.js`, `render.js`
(quote blockquote with `<mark>`, badges, pills, dates in America/St_Johns "Sep 14, 2026"). Every page shows the
footer line from API.md §12 and a "SAMPLE data" banner whenever any program on screen has `sample: true`.
- Profile form, one screen, the questions in API.md §2 order and words: community is a type-to-search list (keyboard
  and tap), industry uses the `plain` label with the NAICS name as hint, owners is checkboxes plus "None of these"
  (ticking it clears the others, and the reverse), purposes are toggle chips with `aria-pressed`. Missing answers →
  a plain message under the question and focus moves there. Values live in the URL; "Change answers" returns here
  pre-filled.
- Results: "N programs could fit" line with counts by label; cards (whole card one link, ≥ 44 px): fit badge, name,
  provider, funding-type pills, amount text or "Amount: the page doesn't say", intake label (+ "until <date>"),
  "3 match · 1 doesn't · 2 unknown", verification flag when stale / needs review. "Closed programs" section last,
  muted, each with its closed quote. Buttons "Change answers" and "Print for the owner".
- Program detail: fit badge + every `why`; funding types, amount, cost share, intake/deadline each with its quote;
  criteria in three groups "What matches", "What doesn't match", "Unknown" (with the reason copy from API.md §12),
  each criterion's `why` and quote; "What the pages don't say" from `unknown_facts`; "Open the official page"
  (new tab, `rel="noopener"`); "Call this office" (`tel:`) per contact **only** when contacts exist; "Last verified
  <date>" + flags; sources list. 1280: two columns.
- Print: one US Letter page, white, "Funding programs that could fit <name or 'your business'>", date, one line of
  the answers, up to 6 open programs (Looks like a fit first) with type, amount, intake, the official URL printed as
  text and a phone if any, the footer line. No closed programs, no navigation. A "Print" button hidden in print media.
- About: how matching works (the three labels, what Unknown means), every source (program, page title, publisher,
  fetched date, last live check from `/api/checks`), and "Grant Match never applies for you".

Tests `app/tests/*.spec.mjs` + `app/playwright.config.mjs` (projects chromium-390, chromium-1280, webkit-390,
webkit-1280; webServer `node app/serve.mjs --port ${GM_APP_PORT||7401}`), run `npx playwright test -c
app/playwright.config.mjs`, against `?mock=1&now=2026-09-14T12:00:00Z`, **real input only** (tap/click/type/keyboard,
never set state with evaluate): fill the form for SAMPLE Auto Service by typing and tapping → results URL carries
every answer; submitting with no community shows the message and focuses it; results order and labels equal what
core returns for that profile; the closed SAMPLE program sits under "Closed programs"; tapping a card opens its detail;
each rendered `<mark>` text equals its API quote exactly and sits inside the context; Unknown reason copy per reason;
official link has `target="_blank"` + `rel="noopener"`; "Call this office" present on the SAMPLE program with a contact
and absent on one without; `now=2026-12-01T12:00:00Z` → stale message and no Looks like a fit; print page in print
media (chromium `page.pdf`, Letter) is exactly 1 page and names SAMPLE Auto Service; "Change answers" restores the
form; owners "None of these" clears the others; about lists every SAMPLE source; every button, card, chip, checkbox
label and select hit-tested with `elementFromPoint` at its centre and ≥ 44 px tall at 390; no horizontal scroll at 390.
Plus `app/tests/live.spec.mjs`, skipped unless `GM_API` is set: SAMPLE Auto Service against `?api=$GM_API` renders
exactly the API's open/closed lists (the lead runs it in QA). Negative controls (red once each, restore, record):
(a) `<mark>` shifted by one character → quote test red; (b) contact button always shown → absent-contact test red;
(c) one chip shrunk to 30 px → tap-target test red; (d) print CSS removed → one-page test red. Screenshots with
`pwshot` (phone + desktop, chromium, mock mode) of form, results, detail, print, about →
`docs/shots/gm2-<page>-<390|1280>.png`. Look at them before you report.

**Phase 2 — federal and national programs** (after the app and Worker are green and committed; same research rules;
starting list checked by the lead, 02:45: every URL answered 200 to our User-Agent and robots.txt allows it):
1. `ca-acoa-business-development-program` — https://www.canada.ca/en/atlantic-canada-opportunities/services/business-development-program.html
2. `ca-acoa-regi` — https://www.canada.ca/en/atlantic-canada-opportunities/services/regional-economic-growth-through-innovation.html
   (the Business Scale-up and Productivity stream is for businesses; the ecosystem stream is not)
3. `ca-nrc-irap` — https://nrc.canada.ca/en/support-technology-innovation/financial-support-technology-innovation
4. `ca-canexport-smes` — https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes/find-out-qualify.html
   and …/canexport-smes/applicants-guide-2026-27.html (2026-27 rules changed: check the revenue and employee minimums)
5. `ca-canada-summer-jobs` — https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs/applicant-guide/who-can-apply.html
   and https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs.html (intake)
6. ~~`ca-futurpreneur-startup`~~ NOT USED, terms forbid copying (DECISIONS #19) — https://futurpreneur.ca/en/eligibility/ and https://futurpreneur.ca/en/offering/core-startup/ (Crawl-delay 10)
7. ~~`ca-bdc-small-business-loan`~~ NOT USED, terms forbid copying (DECISIONS #19) — https://www.bdc.ca/en/financing/small-business-loan
8. `ca-canada-digital-adoption-program` — **closed; must show as closed with its source, never open.**
   https://www.bdc.ca/en/canada-digital-adoption-program says "The Canada Digital Adoption Program (CDAP) is no longer
   accepting new applications for the Boost Your Business Technology stream." ISED's own CDAP site
   (ised-isde.canada.ca/site/canada-digital-adoption-program/en) now redirects to the ISED home page: record that in
   `research.notes`. Look for an official Government of Canada page that states the whole program closed.
9. `ca-canada-small-business-financing-program` — https://ised-isde.canada.ca/site/canada-small-business-financing-program/en
10. `ca-sred-investment-tax-credit` — https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program/sred-claim/investment-tax-credit.html
11. ~~Ulnooweg Indigenous business financing~~ NOT USED, no published terms, all rights reserved (DECISIONS #19): (ulnooweg.ca / ulnoowegdevelopmentgroup.ca) — ownership `indigenous`; read its terms and robots first.
After your first **three** programs are committed, stop and report; the lead has gm1 cross-review them.

## Cross-review (lead schedules it; every real defect crosses a slice boundary)
- gm1's phase-1 engine commit → gm2 reviews the shapes and signatures it consumes; the lead reviews the rule and fit semantics.
- gm2's first Worker commit → the lead diffs its JSON against core's output for both profiles.
- gm1's first three NL programs → gm2 reviews each interpretation against the saved page text.
- gm2's first three federal programs → gm1 reviews them the same way.
- gm2's program page and Unknown copy → gm1 checks it matches core's semantics.

## Main (lead, not a slice)
Owns `PLAN.md`, `AGENTS.md`, `DECISIONS.md`, `docs/API.md`, `package.json`, `package-lock.json`, `.gitignore`,
`.rig/config.json`, `README.md`, `docs/DEPLOY.md`, `docs/build-report.md`. Merges slices after reading each diff, reads
every program file against its saved page, runs QA from `rig qa <sha>` on the QA ports, runs the real scan into the
local Worker, pushes the private repo, writes the status file.
