# Grant Match NL — rulebook

**What it is.** A small business in Newfoundland and Labrador answers one short profile screen and gets the
public funding programs that could fit, with **every eligibility fact quoted word for word from the program's own
page**. Rules only, no model deciding eligibility. It never applies for anyone and never promises eligibility: it
says what the page says, and **Unknown** where the page (or the profile) doesn't settle it. Built for APCO Software
Tools as an opener ("here's a program that could pay for part of it").

**Stack.**
- `core/` — pure ESM, zero dependencies, runs in Node and workerd: page-text extraction, quote verification,
  profile parsing, rules matching, live re-checks of the source pages.
- `data/programs/<slug>.json` — one researched program per file. `data/sources/<source-id>.html` — the official
  page exactly as fetched (committed: it is the evidence). `data/reference/` — communities, industries.
- `scripts/` — `build-data.mjs` (verify every quote, write `data/build/`), `fetch-source.mjs`, `show-text.mjs`,
  `scan.mjs` (re-check the live pages, same code as the Worker's cron).
- `worker/` — Cloudflare Worker + D1 (`grant-match-nl`, binding `DB`). Dev: `wrangler dev --local`. Live since
  2026-09-15 (`docs/DEPLOY.md`); the app is a static-assets Worker on `grants.apcosoftwaretools.ca` (`scripts/deploy-app.sh`).
- `app/` — static HTML/CSS/JS, no build step, served by `node app/serve.mjs`.
- Contract: `docs/API.md`. Build plan: `PLAN.md`. Judgement calls: `DECISIONS.md`.

**Ports.** app 7401 · worker 7402 · gm1 fixture server 7403 · gm2 fixture server 7404 ·
QA: app 7408, worker 7409, fixtures 7407 / 7406.

## Standing rules
- `AGENTS.md` is the rulebook; `CLAUDE.md` is a symlink to it. `PLAN.md` is the build contract; read it first.
- Own your slice's paths only; commit with `git commit -- <paths>`. Verify → commit → report.
- Numbers come from a QA worktree pinned to a sha (`rig qa <sha>`), never the shared tree.
- A check that cannot fail measured nothing: every important check has a negative control (break it, watch it go
  red, restore), recorded in the build report.
- Browser tests: Playwright, chromium + webkit, phone 390 and desktop 1280, real input (click/tap/type), tap
  targets hit-tested with `document.elementFromPoint`. Screenshots with `pwshot` into `docs/shots/`.
- **Every fact shown has a quote.** A quote is an exact substring of the saved page's text (`core/text.js`
  `pageText`). A quote that isn't fails `npm run check:data`, and so the build. Anything the page doesn't say is
  **Unknown**, never a guess. Unknown is never counted as met.
- **Official pages only** (the program owner's site, or the partner that delivers it). Never aggregator sites
  (grantcompass, hellodarwin, atlanticcanadabusinessgrants, granthub…) as a source, not even for a hint you then
  quote from elsewhere without re-reading the official page.
- **No invented programs, businesses or people.** SAMPLE programs exist only in test fixtures and the SAMPLE data
  set (`sample: true`, names start `SAMPLE `). Test profiles are SAMPLE ("SAMPLE Auto Service", "SAMPLE Daycare");
  the one real profile allowed is APCO Software Tools itself.
- Fetching: public pages only, robots.txt obeyed, ≥ 1 s between requests to a host (more if its robots.txt sets
  `Crawl-delay`), User-Agent `APCO-Software-Tools-research/1.0 (+https://apcosoftwaretools.ca)`, no logins, no forms.
- AI: none by default. A paid model call is allowed only to help draft rules during research, every quote still
  verified, logged in `docs/spend.md`; hard cap CA$2 for this project. Never echo or commit a key.
- **Deploys only when Alexander says so** (he did on 2026-09-15; the build sprint before that was local-only). Nothing
  is ever sent, submitted or applied for. Public repo: no secrets, no home paths, run `check-no-personal-data` before
  pushing. Never touch another project's folder.
- Plain English for Newfoundland and Labrador business owners. No emoji as icons. No devils or demons imagery.
