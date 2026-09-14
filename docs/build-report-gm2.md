# Build report — gm2 (Worker API + D1, app, federal and national programs)

## Contract questions
Each is the reading I built on; the lead decides.
1. **Print page, "up to 6 open programs".** `open` includes Doesn't fit programs. The heading says "could fit", so
   the printout lists only Looks like a fit and Might fit (Looks like a fit first), up to 6, and says how many more.
2. **Results "N programs could fit".** N = `counts.looks + counts.might`; the four counts follow as badges.
3. **Oversized admin body.** API §11 names 400/401 only; the Worker answers **413** over 1 MB (declared or streamed).
4. **`?now=` when `ALLOW_NOW` is not `1`.** Silently ignored (the real clock is used), not an error. An invalid
   `now` with `ALLOW_NOW=1` is a 400.
5. **`sourceStatusFrom` window.** The Worker folds the newest 50 stored runs. Older runs cannot change
   `last_verified_at` for a source that has been checked since, and one run per week gives about a year.
6. **`POST /api/admin/scan` is synchronous.** It runs `runChecks` inside the request (≥ 1 s between requests to a
   host, more with Crawl-delay), so on the real set it takes as long as the scan does. Fine locally; a deployed
   version would want a queue or `ctx.waitUntil` and a 202.
7. **Selects in the Playwright specs** use `selectOption` (Playwright's own input path, not `evaluate`); a native
   picker can't be tapped in a headless browser. Everything else is tap/click/type/keyboard.
8. **`serve.mjs`** also refuses `/serve.mjs`, `/tests/…` and `/playwright…` under `app/`: they are not the site.

## Phase 1 — status
- WIP committed (`5e9c263`, `4cf4b5b`): Worker (`wrangler.toml`, migration, `src/index.js`, `tests/run.mjs`,
  `tests/fixture-server.mjs`, `tests/api.test.mjs`, `tests/real.test.mjs`), app (5 pages, `app.css`, `print.css`,
  `api.js`, `api.mock.js`, `profile-form.js`, `render.js`, `serve.mjs`), Playwright config and specs.
- **Not run yet: core is not on main.** Waiting for it. Until then the pages were checked by eye in a temporary
  `?mock=fixture` mode (hand-made SAMPLE ProgramResult JSON in `app/tests/fixtures/`, `app/api.fixture.js`, and a
  one-regex exception in `serve.mjs`). All three are deleted when core lands.
- `serve.mjs` smoke-checked by hand: `/`→index, `/../PLAN.md`, `/%2e%2e/PLAN.md`, `/core/..%2fPLAN.md`, `/core/`,
  `/data/build/`, `/serve.mjs`, `/tests/…` → 404; POST → 405; `.css` → `text/css`.
- Found by looking at fixture-mode screenshots and fixed: a stray space before the `<mark>` in every quote. core's
  `contextFor` keeps the neighbouring whitespace, so the renderer now joins `before + quote + after` exactly. The
  `<mark>` spec checks that the joined text equals the context exactly.
- Removed `overflow-x: hidden` from `body`: it would have hidden the very horizontal scroll the 390 test measures.

## Negative controls
To do once the suites can run: Worker (a) sourceStatus not passed, (b) auth removed, (c) closed reversed /
field dropped; app (a) `<mark>` shifted, (b) contact always shown, (c) chip 30 px, (d) print CSS removed.

## Needs from other slices
- gm1: core on main (`match.js`, `checks.js`, `profile.js`, `text.js`) and `data/build/sample.json`. The Worker and
  specs assume the SAMPLE fixtures have a program with a phone contact, one without contacts, a closed one, and a
  Looks like a fit program for SAMPLE Auto Service. All four are in PLAN's gm1 list.
