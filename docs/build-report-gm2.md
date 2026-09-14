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

Items 1–8: **ACCEPTED** by the lead (DECISIONS #15, API §11–12).

### Cross-review of core as a consumer (merge `b3c92af`, core from `1d0fc50`)
Shapes, field names, labels and sort in `match.js`, `profile.js` and `checks.js` match API §2, §5, §6 and §9 as the
Worker and app use them: the Worker deep-equals core's output for both profiles, and the app renders it unchanged.
Where core and the contract (or the app's copy) disagree:
9. **`sourceStatusFrom` is still the old §9.** It has no `page_gone`, and every check sets `missing_quotes` from its
   own `missing` list, even when `ok` is false. So a timeout or robots refusal (`missing: []`) clears the count, and a
   5xx or 404 (runChecks fills `missing` with every quote) raises it. The lead says gm1 does this later. The app
   already uses the new copy ("changed or gone").
10. **Fit `why` repeats the old needs-review sentence.** `match.js` pushes "The page has changed since we checked it.
    Check the official page."; §12 now says "changed or gone". The detail page lists every `why` line and also shows
    the §12 flag, so both sentences appear on one screen.
11. **Stale `why` uses different words from the stale copy.** Core: "Last verified 78 days ago, more than 60 days.
    Check the official page."; §12 copy (the app's flag): "Last verified <date>, more than 60 days ago. Check the
    official page." Same screen, two wordings. Either pin core's sentence in §5 or say the app hides stale/review
    `why` lines. I left the app showing both.
12. **Unknown wording in `why` uses a comma, the reason copy a colon.** Core: "Unknown, your answer is close to the
    page's limit: …"; §12 reason copy: "Unknown: your answer is close to the page's limit". A small thing, but both
    sit on the detail page.
13. **Business structure "Not sure" gets reason `not_answered`.** So the owner who picked "Not sure" reads "Unknown:
    you didn't answer this". §2 only says "(→ unknown)". Suggest the copy "Unknown: you weren't sure" or a reason
    of its own; core's `why` already says "You weren't sure how the business is set up."
14. **`counts.unknown` includes `self_check` items** (`counts.self_check` is a subset). The §6 example (`unknown: 2,
    self_check: 1`) reads that way, so the results card's "N unknown" includes check-it-yourself items. Please pin it
    in §6.
15. **robots.txt 4xx/5xx are not in the contract.** `runChecks` treats a robots.txt 4xx as "no rules, allowed"
    and a 5xx or network error as "don't fetch this host" (error recorded). Both sensible; worth one line in §9.
16. **An unknown `rule.kind` evaluates to Unknown with reason `self_check`**, silently. `validateProgram` should
    already reject it at build time, so this only matters if a bundle skips the build; no change asked.

## Phase 1 — status: DONE
Merged main at `b3c92af` (core from gm1 `1d0fc50`, contract `821774c`). `npm run build:data` from this worktree:
0 real programs, 8 SAMPLE.
- **Worker suite: 15 passed, 0 failed, 1 skipped** (`real.test.mjs`, needs `GM_REAL=1`). `npm --prefix worker test`:
  fresh local D1 in `.wrangler/test-state`, SAMPLE fixture server on 7404, `wrangler dev --local --test-scheduled` on 7402.
- **Playwright: 148 passed, 0 failed, 0 flaky** on chromium-390, chromium-1280, webkit-390 and webkit-1280, every
  test run twice (`--repeat-each=2`). 28 skipped by design: 390-only tap-target and scroll tests on the 1280
  projects, the PDF test off chromium-1280, and `live.spec.mjs` without `GM_API`.
- Removed: the temporary `?mock=fixture` mode, `app/api.fixture.js`, the hand-made JSON in `app/tests/fixtures/`, and
  the `serve.mjs` exception. `?mock=1` runs the real core in the browser on `data/build/sample.json`.
- Needs-review copy changed to §12's "The page has changed or gone since we checked it. Check the official page."

### Bugs the suites found, fixed
- **The community list opened underneath the next question** (all four projects). Each `.glass` card is its own
  stacking context (`backdrop-filter`), so the list's `z-index` couldn't lift it over the next card, and a tap landed
  on the card. Fix: `.q:focus-within { position: relative; z-index: 20 }`.
- **In WebKit a tap never picked a community.** Probed with real taps and logged events: WebKit fires
  pointerdown, touchstart, pointerup and touchend on the option but **no mousedown, mouseup or click**, because
  pointerdown was cancelled (which keeps focus in the input). Chromium sends the click. Fix: pick on `pointerup` when
  it lands on the same option as the pointerdown and the finger moved under 10 px (a drag scrolls the list). `click`
  stays as a fallback for assistive tech. An earlier guess (blur closing the list first) was wrong and was removed.
- **Tests that could measure nothing**, fixed: three specs read the DOM straight after `goto`, before the page had
  fetched and rendered. On a fast run the tap-target test could hit-test a results page with no cards and pass.
  Each page now waits for a selector that only exists once its data has rendered (`#open-list a.card`,
  `#official-link`, `.program`, `tr[data-source]`, `.chip`).
- **Test gaps against the real SAMPLE set**, fixed: no test profile produced `band_straddles` (added one in the
  $2M–$10M revenue band, which straddles a SAMPLE loan's $5,000,000 limit). The about page has no buttons or cards,
  so the header links (`.wordmark`, `.site-nav a`, both ≥ 44 px) are now tap targets too.

### Screenshots (pwshot, chromium, `?mock=1&now=2026-09-14T12:00:00Z`), looked at
`docs/shots/gm2-{form,results,detail,print,about}-{390,1280}.png`. Detail uses `nl-sample-growth-grant` (Looks like a
fit, with a contact) and shows two columns at 1280. The results page shows 3 Looks like a fit, 1 Might fit, 3
Doesn't fit and the closed program with its quote. The print page is a white single sheet with 4 programs. About
lists all 9 SAMPLE sources as "Not checked live yet" (mock mode has no check runs).

## Negative controls
Each one broke a committed file, ran the suite, and was restored with `git checkout`; the restored file was
confirmed clean (`git diff --quiet`) and the suite re-run green. Scripts: `.scratch/worker-controls.sh`,
`.scratch/app-controls.sh` (untracked).

**Worker** (full `tests/api.test.mjs` run each time, SAMPLE data set):
- (a) `sourceStatus` not passed to `matchPrograms` → **red**: exactly 1 failure, "a stored run with one missing
  quote makes that program needs_review, not Looks like a fit". Restored → 15/15.
- (b) both `requireAdmin` calls removed → **red**: exactly 1 failure, "401 with no token or a wrong token".
  Restored → 15/15.
- (c) the Worker swaps `open` and `closed` in `/api/match` → **red**: 4 failures, both deep-equal tests plus "the
  closed SAMPLE program is in closed" and the needs-review test (which looks its program up in `open`). Restored → 15/15.

**App** (the one targeted test, one project each; restored file re-run green, then the full suite twice):
- (a) `<mark>` shifted one character right (first letter moved outside the mark) → **red**: "each rendered <mark>
  equals its API quote exactly", failing on `ca-sample-digital-adoption-grant` ("<mark>he grant gave small
  businesses…</mark> is an API quote with its context"). Restored → passes.
- (b) "Call this office" rendered for a program with no contacts → **red**: "shows only on a program with a
  contact", `a[href^="tel:"]` expected 0, received 1. Restored → passes.
- (c) the first purpose chip shrunk to 30 px → **red** at chromium-390: "form #12 Hire or pay wages height, Expected
  >= 44, Received 30". Restored → passes.
- (d) `print.css` link removed from `print.html`. **First run was VOID for the page count:** the SAMPLE Auto
  Service printout has only 4 programs and fits one Letter page even unstyled. The test went red only on
  "Print button hidden", and it asserted that *before* counting pages. Fixed: page count asserted first, and the
  one-page test also runs on the fullest printout the SAMPLE set can make. I found it by searching answer
  combinations with core: `years=lt1`, `revenue=unsaid`, five purposes, no owners and no cost gives 7 could-fit
  programs, so the sheet prints 6 plus "and 1 more on the results page". Measured directly: 1 page with
  `print.css`, 2 pages without. Re-run → **red** on the one-page check itself: "printed pages, Expected: 1, Received:
  2" (the short printout: red on the hidden button). Restored → both pass.

## Round 9 (final) — block-bounded context, one-block CanExport quotes, last real-data look: DONE
Every step gated on its exit code (a non-zero exit stopped the step).
1. **Merged main at `44d19fc`** (merge `aa0556c`, exit 0; DECISIONS #26).
2. **CanExport quotes inside one block each (`137d1c9`).** I used gm1's `blockText` from `rig/gm1` (read with `git show` into `.scratch/`,
   not merged early) to print the saved pages' blocks. It found **four** CanExport quotes joining blocks, not two:
   - intake: blocks 21 + 22, "Applications are not being accepted at this time" + "The application intake period ended…";
   - location: blocks 77–79, "…must:" + "be established in Canada" + "be for-profit";
   - structure: blocks 79 + 80, "be for-profit" + the incorporated/LLP/co-op line;
   - contact: blocks 449 + 450, "For general program questions:" + "Please contact canexportsmes@…".

   Now: intake quotes "Applications are not being accepted at this time". The August 31, 2026 end is the intake **deadline** with its
   own one-block quote ("The application intake period ended at 12:00 p.m. (ET) on August 31, 2026."), which the schema allows on a
   closed intake. Location quotes "be established in Canada". "be for-profit" is its own structure criterion (`not_in: [nonprofit]`),
   so that fact keeps its quote, and structure (`not_in: [sole_proprietor, not_registered]`, `unclear: [partnership]`) quotes the one
   line. The contact quotes "Please contact canexportsmes@international.gc.ca.".
   **Gates:** `check:data` exit 0 ("every quote verified (27 real programs, 10 SAMPLE)"); `git diff` shows 0 `sha256`/`text_sha256`
   lines; a re-scan finds 13 CanExport quotes, 0 not inside a single block.
   **Found, not changed (programs outside this round's brief):** the same scan over all 60 `ca-*` quotes finds three more list quotes
   whose lead-in and items are separate blocks: REGI `use-of-funds` (5 blocks, "You can use this funding to:" + four items), Canada
   Summer Jobs `cost_share` (2, "…eligible to receive funding for:" + "up to 50%…"), NRC IRAP `structure` (4, "NRC IRAP does not
   support:" + three items). Each would split the way CanExport did; the lead decides whether to do that.
3. **Merged `rig/gm1` at `697aa25`** (merge `871c163`, exit 0), once `git log rig/gm1` showed the commit dropping "(one of 15 CBDCs in
   the province)". I watched for it with a background `git log -p` loop, no prompts. `build:data` exit 0, `check:data` exit 0. On
   the built bundle: 53 contact labels, 0 contain "15 CBDCs"; 288 real quotes, 251 with empty context; 0 contacts with context.
4. **Last real-data look** on `?mock=1&data=real&now=2026-09-14T12:00:00Z`. All old `docs/shots/gm2-real-*.png` removed (including
   round 5's Daycare results, not in this list) and replaced by 12 fresh shots:
   `gm2-real-{results-apco,results-auto,detail-business-growth,detail-canexport,detail-cbdc-general-business-loan,print-apco}-{390,1280}.png`.
   I looked at each.
   - **Business Growth:** "The program's pages list these offices. Call the one nearest you." sits above six contacts. Each office's
     quote is its own line only ("Central: 709.256.1480", "Western: 709.637.2628"), with no context. **R1 is fixed:** no office shows
     another office's number next to its call button.
   - **CanExport (closed):** "Closed. Not taking applications right now." with the one-block quote and no context, then "Deadline: Aug 31,
     2026" with its own quote. **R2 is fixed:** no breadcrumb, no JSON, no run-on anywhere on the page. The for-profit and structure
     items show separately; the revenue quote's context is the rest of its own list item ("(or during the last 12 months for monthly
     and quarterly filers)").
   - **CBDC General Business Loan:** labels "CBDC Central, Grand Falls-Windsor", "CBDC Gander Area, Gander", "CBDC Emerald, Baie Verte",
     "Emerald’s satellite office, Springdale", under the multi-contact line. Office quotes stay long (address, "View on Google Maps",
     phone), as DECISIONS #26 says, because they carry the town.
   - **APCO printout:** one Letter page, six programs in core's new evidence-tier order (CBDC Innovation Loan first), every phone whole
     on its line, "and 8 more on the results page".
   - **R5, page length:** Business Growth at 390 is **7,677 CSS px (screenshot 780×15,354 at 2x)**, against round 5's 780×16,348
     (about 8,174 CSS px): **about 6% shorter**, not the big cut DECISIONS #24 hoped for. The shots show why. The remaining length is
     the quotes themselves, not context: the ~400-character eligibility paragraph is quoted in full by two criteria (structure and
     commercial viability), the 200-character amount sentence is quoted twice (amount and cost share), and there are six contact
     blocks. Shortening further means shorter quotes in gm1's data (one block or sentence per fact, as done for CanExport) or a
     collapsed quote in the app. The lead decides.
5. **Suites on the merged tree** (exit codes checked):
   - Worker, SAMPLE: **exit 0, 15 passed, 0 failed, 1 skipped**.
   - Worker, `GM_REAL=1`: **exit 0, 1 passed, 0 failed** on 27 programs, 154 criteria, 53 sources.
   - Playwright: **exit 0, 200 passed, 0 failed**, every test run twice on chromium and webkit at 390 and 1280; 32 skipped by design.

## Round 8 — one line above more than one contact: DONE
Merged main at `ebb66a2` (merge `a6b3441`; API §12 and DECISIONS #25: contact labels carry office and town only, and a neutral line
above multiple contacts). `build:data`: 27 real programs, 10 SAMPLE.
- **Change:** when a program has more than one contact, the "Talk to someone" section shows one muted line above them:
  "The program's pages list these offices. Call the one nearest you." (`[data-contacts-note]`). A single contact, or none, gets no
  line.
- **Where it shows on real data today:** Business Growth (6 contacts), Business Investment (7), the six CBDC loans (4, Newcomer 5)
  and both ACOA programs (2). The other 11 real programs with contacts have one.
- **Test:** "more than one contact gets the 'call the one nearest you' line; one contact or none does not". No SAMPLE program has
  two contacts (SAMPLE Growth Grant and Women Entrepreneur Loan have one each), so the many-contact case is the real Business
  Growth Program via `data=real`: exactly one line, exact copy, in the contacts section and before the contacts. Then SAMPLE
  Growth Grant (one contact) and a SAMPLE program with no contacts: no line, and the text isn't on the page. Passes on chromium and
  webkit at 390 and 1280.
- **Negative control (l):** line shown for `contacts.length >= 1` → **red** ("nl-sample-growth-grant (1 contact), Expected: 0, Received:
  1"). Restored from a byte copy (the change was uncommitted) → passes; no backups left.
- **Playwright on the merged tree: 200 passed, 0 failed**, every test run twice on chromium and webkit at 390 and 1280; 32 skipped
  by design. Worker code and data rules are unchanged since round 7 (15/0/1 SAMPLE, 1/0 real).

Waiting: gm1's block-edge quote context (API §1) and the office labels without "15 CBDCs". Then the last real-data look (Business
Growth contacts, CanExport's closed quote, one CBDC loan) with fresh `gm2-real` screenshots.

## Round 7 — unclear rendered for real, check-yourself items without their why: DONE
1. **Merged `rig/gm1` at `c551391`** (merge `20b3032`). It brings the SAMPLE fixtures that use `unclear` and `normally` (`28c8866`), the
   evidence sort tier (`6f0d5fc`) and gm1's K3 office labels. `build:data`: 27 real programs, 10 SAMPLE (new: SAMPLE Green Upgrade
   Grant with structure `unclear: [cooperative, nonprofit]` and purpose `any: [energy], unclear: [equipment]`; SAMPLE Expansion Loan
   with `years_operating gte 3 years, normally: true`). Probed with core: SAMPLE Auto Service gets `unclear` on the Green Upgrade
   Grant's purpose; SAMPLE Daycare gets it on the Expansion Loan's years rule; a co-op or non-profit answer gets it on the
   structure rule.
   **Reason test (`5cacd6b`):** the round-2 gap branch and its annotation are gone. The test now requires every reason in the copy
   table, `self_check`, `not_answered`, `band_straddles` **and `unclear`**, to be seen on a rendered program page with its exact
   copy. Passes on chromium and webkit at 390 and 1280.
   **Negative control (j):** `unclear` copy changed to "Unknown: unclear" → **red** ("Expected: Unknown: the page's wording doesn't
   settle it for your answer, Received: Unknown: unclear"). Restored with `git checkout` → passes.
2. **Check-yourself items show the reason copy only (DECISIONS #24 R4, API §12).** `program.js` no longer renders a criterion's
   `why` when `unknown_reason` is `self_check`; every other criterion keeps its `why`. **Test:** "a check-yourself criterion shows
   its reason copy only, not its why line". It uses the SAMPLE Auto Service program with the most check-yourself items and at
   least one other criterion with a `why`: each check-yourself item has "Unknown: check this yourself", no `.criterion-why` and not
   its `why` text; every other criterion with a `why` still shows it exactly, so the test can't pass by hiding all of them.
   Passes on all four projects.
   **Negative control (k):** `why` rendered again for check-yourself items → **red** ("business-plan: no why line, Expected: 0,
   Received: 1"). Restored from a byte copy (the file carried the uncommitted change) → passes.
3. **Suites on the merged tree:**
   - Worker, SAMPLE: **15 passed, 0 failed, 1 skipped**.
   - Worker, `GM_REAL=1`: **1 passed, 0 failed** on 27 programs, 153 criteria, 53 sources.
   - Playwright: **192 passed, 0 failed**, every test run twice on chromium and webkit at 390 and 1280; 32 skipped by design.

Waiting: gm1's `blockText` context change (API §1, contact quotes without context). After it lands, the lead asks for one more
real-data look at the Business Growth contacts and CanExport's closed quote.

## Round 6 — re-hash after gm1's attribute-safe pageText: DONE
1. **Merged `rig/gm1` at its tip `c1c1d5b`** (merge `b344865`). That is newer than the `637bb44` / `380dee7` / `dd09fb3` named in the
   brief and contains them, plus gm1's purpose `unclear`.
2. **`node scripts/build-data.mjs --check` named exactly two sources, both mine:** `ca-canexport-smes` `sources[0]` (`--main`) and
   `sources[1]` (`--guide`), "text_sha256: does not match the saved file's page text". No `nl-*`, no `ref-*`, no other `ca-*`.
   Nothing else was reported, so every quote still verified before the re-hash.
3. **Re-hashed with `node scripts/hash-source.mjs --update data/programs/ca-canexport-smes.json`.** `git diff` shows exactly 4
   changed lines, the two `text_sha256` values: `--main` `a8481624…` → `61848cf7…`, `--guide` `cf81173e…` → `62dde999…`.
   The `sha256` values are unchanged (same saved bytes), no quote was touched, and no other program file changed. `check:data` after:
   "every quote verified (27 real programs, 8 SAMPLE)". **No quote stopped verifying**, so there is no before/after text to report.
4. **CanExport contexts, printed from the rebuilt `data/build/programs.json`** (and through `evaluateProgram` for the intake, as
   the app gets it). **Attribute/JSON junk (`\r\n`, `&nbsp;`, `"}}" id="text-…" class="cmp-text">`) is in 0 of 10 CanExport
   quotes**, down from 6 in round 3 and 2 just before this re-hash. But not every one is a clean sentence:
   - **summary:** before `\n"}}" id="text-33addbb30a" class="cmp-text"> `, now empty context. **Clean.**
   - **contact:** before `\r\n Please contact nrc.canexport-help-aide-canexport.cnrc@nrc-cnrc.gc.ca \r\n"}}" id="text-f28600fe40"
     class="cmp-text"> `, now `Contact us ` (the section heading). No junk; a heading, not a sentence.
   - **location:** now `Who can apply 1.1 Eligible companies ` (section headings).
   - **structure:** now `be established in Canada `; **CRA business number:** now `be established in Canada be for-profit be an
     incorporated legal entity, limited liability partnership (LLP), or cooperative in Canada `. Earlier items of the same
     eligibility list: real page text, and relevant, but no sentence boundary.
   - **intake:** now `Canada.ca Trade Commissioner Service Our solutions Funding and financing for international business CanExport
     SMEs `. **Still the breadcrumb menu** (round 5's R2): no junk, but menu text in front of the closed quote.
   - max_amount, cost_share, employees, revenue, purpose: empty context. Clean.
   So the attribute fix did what it should. What's left is `contextFor`: headings, list items and breadcrumbs have no
   sentence punctuation, so the "sentence" reaches back into them. That is R1/R2 from round 5 (gm1 / lead), not the re-hash.
5. **Suites on the merged, re-hashed tree:**
   - Worker, SAMPLE: **15 passed, 0 failed, 1 skipped**.
   - Worker, `GM_REAL=1`: **1 passed, 0 failed** on 27 programs, 147 criteria, 53 sources.
   - Playwright: **184 passed, 0 failed**, every test run twice on chromium and webkit at 390 and 1280; 32 skipped by design.

## Round 5 — real-data pass over the app: DONE
Merged main at `1f6bc41` (gm1's sentence-bounded context and "Unknown:" wording, evidence tier in the sort, DECISIONS
#23). `build:data`: 27 real programs, 8 SAMPLE. Run on `?mock=1&data=real&now=2026-09-14T12:00:00Z` for APCO Software Tools
(DECISIONS #14), SAMPLE Auto Service and SAMPLE Daycare.

### How I looked
- **A measured audit (Playwright, chromium, observe only)** of every real program page at 390, with and without a profile
  (54 pages), plus the three results pages and About. It checked: horizontal scroll; any element in `main` whose right edge
  passes the viewport (outside the About table's scroll box); buttons, cards, chips, checkbox labels, selects and call
  links under 44 px; page errors; each profile's printout as a Letter PDF.
  **Result: clean.** No overflow, no small targets, no page errors, all three printouts one page with 6 programs and
  "and 7/8 more on the results page". Real content doesn't break the layout; the problems are in what it *says*.
- **Screenshots** (pwshot, chromium, 390 and 1280) of results for all three profiles, the Business Growth Program page
  (six contacts), CanExport (closed, unclear partnership, long quotes), the CBDC General Business Loan (four offices), and
  the APCO printout. I looked at each before fixing, and again after.

### Broken by real content, fixed, with a test each
- **The printout split a phone number across two lines.** "Phone 1-888-576-444 / 4" at 1280 and "Ph / one 1-888-576-4444"
  at 390. The URL and phone shared one `<p class="url">` with `word-break: break-all`, and ACOA's URLs are long. Fix:
  the URL and phone are separate spans; only the URL may break (`overflow-wrap: anywhere`, so it prefers hyphens), and the
  phone is `white-space: nowrap`. **Test:** "real data: printout phone numbers never split across lines". For the real
  APCO printout, screen and print media, every `[data-phone]` has exactly one client rect.
- **Cards said "The page doesn't say" with no subject.** 22 of 27 real programs have intake unknown, so nearly every card
  had a line that didn't say *what* the page doesn't say, under "Amount: the page doesn't say". Fix: `intakeText` returns
  "When it takes applications: the page doesn't say" for unknown intake. The printout uses the same text. **Test:** "a card
  says what the page leaves unsaid: intake and funding type have their subject". On SAMPLE's unknown-intake program the card
  has the full sentence, and no card line is the bare phrase.
- **Cards for programs with no stated funding type said nothing about type.** No pill, no line, for NRC IRAP, the
  Innovation and Business Development Fund, the Job Grant, CanExport and CDAP. The printout already said so. Fix: those
  cards get "Type of funding: the page doesn't say". **Test:** "real data: a card for a program with no stated funding
  type says so", over every open real program with `funding_types: []` (read from `data/build/programs.json`, skipped if
  there are none).

**Suites:** Playwright **184 passed, 0 failed**, every test run twice on chromium and webkit at 390 and 1280 (32 skipped by
design). Worker: 15 pass, 1 skip (SAMPLE); real mode 1 pass on 27 programs (round 4, no Worker change since).

**Negative controls** (restored from byte copies, since the files carried uncommitted fixes; targeted test re-run green; no
backups left):
- (g) unknown intake back to the bare phrase → **red**: "Expected substring … When it takes applications: the page
  doesn't say".
- (h) the type line removed → **red**: "element(s) not found" for `[data-type-unknown]`.
- (i) the phone allowed to wrap (`nowrap` removed, `break-all` back on the line) → **red** at chromium-390:
  `screen: "Phone 1-888-576-4444" is on one line, Expected: 1, Received: 2`.

**Screenshots committed:** `docs/shots/gm2-real-{results-apco,results-auto,results-daycare,detail-business-growth,detail-canexport,detail-cbdc-general-business-loan,print-apco}-{390,1280}.png`,
taken after the fixes and looked at.

### Found in real content, not app bugs: for the lead and gm1
- **R1 — contact quote context shows another office's phone number (most important).** On the Business Growth page each
  regional office's quote context runs into its neighbours: under "Call this office: 709.256.1480" the context reads
  "709.637.2628 Central: 709.256.1480 Eastern:", under Western "709.896.2400 Western: 709.637.2628 Central:". The page lists
  offices with no sentence boundaries, so sentence-bounded `contextFor` keeps up to 160 characters of the list. An owner can
  read the wrong number next to a call button. Same shape on the CBDC pages: every office's context is the Atlantic
  Association of CBDCs' footer address ("459 Murray Street PO Box 40 Mulgrave, Nova Scotia…"), next to a Grand
  Falls-Windsor or Baie Verte office. Suggest, for gm1 or the contract: contact quotes get no context (the label and quote
  say it all), or `contextFor` also stops at a phone number or a line of the saved page's list.
- **R2 — breadcrumb menu in front of a closed quote.** CanExport's closed card and intake quote begin "Canada.ca Trade
  Commissioner Service Our solutions Funding and financing for international business CanExport SMEs", the page's
  breadcrumb, which has no sentence boundary before the heading. That is the menu problem DECISIONS #20 set out to stop,
  in a case the sentence rule doesn't catch.
- **R3 — CanExport's JSON context is still there** ("\n"}}" id="text-33addbb30a" class="cmp-text">" before the summary, and
  in the contact quote), as expected until gm1's attribute-safe `pageText` lands and the `ca-*` sources are re-hashed
  (step 3).
- **R4 — each check-yourself item says the same thing twice.** Core's `why` ("Check this yourself. Your answers can't settle
  it.") sits directly above the reason copy "Unknown: check this yourself"; Business Growth shows it on five items. The
  brief asks for each criterion's `why`, so I left both. Suggest the app hides `why` when `unknown_reason` is `self_check`
  (the reason copy says it), or core drops that `why`. The lead decides.
- **R5 — real pages are long at 390.** Business Growth's program page is about 16,000 px tall at 390, because several of its
  check-yourself quotes are 300–400 characters and share one long eligibility paragraph, repeated in each block. Nothing
  breaks. If it matters, a collapsed context ("show the sentence around it") is an app change I can make once the lead
  wants it.

## Round 4 — real-data Worker run, CanExport unclear, cross-review of gm1's programs 4–13 and the CBDC loans
Merged main at `2ec7790` (gm1's programs 4–13, the six CBDC loan programs, DECISIONS #20–22). The tree now has **27 real
programs** (not 24): 3 original NL + 10 NL (4–13) + 6 CBDC + 8 federal. Main's `core/` does not have `normally` or
`unclear` on purpose rules yet (DECISIONS #21, #22 are contract only so far).

### Step 2: real-data mode for the Worker suite: DONE
- **Bug (found by the lead):** `worker/tests/run.mjs` always started wrangler with `DATA_SET:sample`, so `GM_REAL=1` ran
  `real.test.mjs` against the SAMPLE bundle and failed on `'sample' !== 'real'`. My phase-1 report listed `real.test.mjs`
  as written but never ran it in real mode, so it had never been shown to pass or fail. That's the gap this fixes.
- **Now:** `GM_REAL=1 npm --prefix worker test` starts wrangler with `DATA_SET:real`, skips the SAMPLE fixture server and
  runs only `tests/real.test.mjs`; the runner prints `worker tests: DATA_SET=real, files tests/real.test.mjs`.
- **Numbers:** bundle `data_set: real`, **27 programs, 147 criteria, 53 sources**; stated-closed programs: CDAP, Canada Summer
  Jobs, CanExport SMEs, Canada-NL Job Grant. `real.test.mjs`: **1 test, 1 pass, 0 fail** (every program's detail answers 200,
  none is SAMPLE, every criterion has a quote of ≥ 12 characters, context and source_url, and CDAP's intake is closed with
  its quote). SAMPLE mode unchanged: **15 pass, 0 fail, 1 skipped**.
- **How it could fail:** the first run, against the tree before main's CBDC merge, passed on 21 programs; that run doesn't
  count. The numbers above are from the full merged tree. The test's own red was the lead's: `'sample' !== 'real'`.

### Step 3: CanExport partnership is `unclear`: DONE
`ca-canexport-smes` structure rule is now `{ not_in: [sole_proprietor, nonprofit, not_registered], unclear: [partnership] }`,
and the separate `llp-only` check-yourself item is gone (the criterion text says a partnership counts only if it is an LLP).
A "Partnership" answer is now Unknown with the unclear copy, instead of met with a check-yourself item. `check:data`: every
quote verified (27 real programs, 8 SAMPLE). The research notes say why.

### Step 4: cross-review of gm1's programs 4–13 and the six CBDC loans: DONE
Read each program file on main (`2ec7790`) against `node scripts/show-text.mjs <source-id>` for the saved pages, checking the
claims that decide a label. Every quote I spot-checked is in its page text. Findings, most important first.

**Over-claims (a label better than the page supports)**
- **K1 — CBDC Innovation Loan: `research` is in the purpose rule, but the page never mentions research.** Rule
  `purpose any [equipment, digital, research]`. The page covers "the purchase of equipment, software, processes, licenses,
  and other items that are clearly identifiable as “new” technology". "research" is not in the page text at all, so an R&D
  project shows met. Suggest `any: [equipment, digital]`. Now that #22 allows it, `unclear: [training]`: the page says
  "The loan could also be used for financing for new products or services and training" and "we can assist with the
  costs of training staff who will be working directly with the new technology".
- **K2 — Employment Enhancement Program: the industry rule shows met for businesses the page leaves out.** Rule
  `industry in [11, 31-33]`. The page: "supports employers in the forestry, aquaculture, agriculture, and fishing sectors,
  who are engaged in value-added secondary processing". Any manufacturer (a sign shop, a boat builder) and any farm or
  fishing enterprise that doesn't process both get the industry item as met. Only the separate check-yourself item
  holds it back. Neither sector answer settles it, so suggest `not_in: [every other sector]`, `unclear: [11, 31-33]`:
  other sectors miss, and 11 and 31-33 are Unknown with the unclear copy instead of met.
- **K3 — CBDC contacts: three Central Newfoundland offices are "Call this office" for every community in the province.**
  All six CBDC programs list CBDC Central (Grand Falls-Windsor), CBDC Gander Area and CBDC Emerald (Baie Verte and
  Springdale) with `census_divisions: null`. None of the three office pages names a service area (no "area",
  "serving" or community list in the Central or Emerald page text), and the Gander page says "In rural Newfoundland and
  Labrador there are 15 Corporations". An owner in Corner Brook or St. Anthony is told to call Gander. Suggest labels that
  say where the offices are ("CBDC Central, Grand Falls-Windsor: one of 15 CBDCs in the province"), which the office
  pages support, or show them only with the "Your local CBDC" item. The Newcomer loan's Metro Business Opportunities line
  for St. John's and Mount Pearl is right and should stay.
- **K4 — two programs show "Might fit" to nearly everyone for reasons the page contradicts.**
  - **Investment Attraction Fund:** the page says it "is designed to attract large-scale businesses and foreign direct
    investment ("FDI") to the Province". Location is its only checkable rule, so a six-person auto shop or a daycare gets
    Might fit. The `inward-investment` check-yourself item quotes the definition but not "large-scale businesses and
    foreign direct investment". At the least, quote that sentence in the item's text.
  - **Innovation and Business Development Fund:** its only criterion is a check-yourself item (energy supply and
    service), so every profile gets Might fit.
  - This is a product question for the lead: should a program with no checkable rule except location sort with real
    Might fits, or sit lower or apart?

**Text that claims more than its quote**
- **K5 — CBDC Newcomer `residency` item.** Text: "A newcomer who can't get other support because of residency status (the
  page says non-permanent residents)". Its quote ("…ineligible to receive support because of their residency status")
  doesn't contain "non-permanent residents". That phrase is in the page's opening line ("Designed for non-permanent
  residents in Newfoundland & Labrador"). Quote that line, or drop the parenthesis.
- **K6 — Harvester Enterprise Loan `industry`.** Text: "In fishing (the Agriculture, forestry, fishing and hunting sector)".
  The quote is "will expand supports for independent fish harvesters positioning the sector for future success", which
  names no sector. The mapping (fish harvester → NAICS 11) is mechanical and fine; the separate "independent fish
  harvester" check-yourself item keeps farms and forestry honest. No change asked; noting that the rule, not the quote,
  carries "NAICS 11".

**Waiting on core (DECISIONS #21, #22 are not in main's `core/` yet)**
- **K7 — Green Transition Fund:** #22 says `purpose any [energy]` with the other purposes `unclear`. The file still has no purpose
  rule, and `core/schema.js` rejects `unclear` on purpose. So today a corporation with any purpose gets the green-focus
  item only as check-yourself.
- **K8 — `normally: true`:** none of programs 4–13 needs it on a bounds rule. The "normally" wording on Green Transition
  ("will not normally exceed 40 per cent") and Research and Innovation ("normally provides up to 50 percent") is on
  cost share, not eligibility. Business Investment (I2) is still the only case.

**Agreed as researched (checked, no change)**
- **Canada-NL Job Grant:** closed on the newer suspension notice over the older "Continuous intake" line. `nonprofit` and
  `cooperative` unclear is right: the list names not-for-profit organizations and then says "Be incorporated or a sole
  proprietor.)", which applies to all.
- **Summer Employment Program for Students:** open with the February 19, 2026 deadline, closed by core; private-sector
  amount shown, not-for-profit amount in notes.
- **Job Accelerator and Growth:** `not_in [41, 44-45]` with `unclear [53, 56]` for real estate and call centres is a careful
  reading; non-repayable type from "non-repayable contribution"; no location rule because it invites outside companies.
- **Apprenticeship Wage Subsidy, Research and Innovation:** structure and unclear lists match the pages. AWS's footer
  phone is labelled as the department line.
- **Harvester Enterprise Loan:** only the down payment loan recorded as a type; the guarantee and rebates are left in notes
  so a loan program doesn't sort above grants.
- **CBDC First Time Entrepreneur, Youth, Social Enterprise, General Business:**
  - structure lists match "sole proprietors, limited companies and partnerships", and "non-profits, including charities,
    cooperatives or societies";
  - "rural" and "your local CBDC" are check-yourself per #22;
  - the Youth Loan's $150,000 is quoted from CBDC Central's page ("The CBDC Youth Loan offers up to $150,000 in financing
    for rural Atlantic Canadian entrepreneurs aged 18–34");
  - age 18–34 is check-yourself because the profile's youth band is 18–39.

**For gm1:** K1, K2, K3, K5 (data), K4's `inward-investment` wording, and K7 once core has purpose `unclear`.
**For the lead:** K4 (programs with no checkable rule besides location or none at all) and K3's label choice.

## Phase 2 research: 8 federal programs, DONE
Researched with gm1's tools (`fetch-source.mjs` per host with its own state file, one page at a time per host; `show-text.mjs`;
`check:data` green before every commit: "every quote verified (11 real programs, 8 SAMPLE)"). 16 official pages saved.
No BDC, Futurpreneur or Ulnooweg page is used anywhere. No Crawl-delay 20 host was needed: search.open.canada.ca has
no robots.txt (404), and open.canada.ca and www.ic.gc.ca were not fetched.
- **`ca-acoa-business-development-program`** (`bfe0bd1`): sources `main`, `contacts`; type repayable; intake **unknown**; criteria 3 (1 checkable / 2 check-yourself); contacts 2. Left out: the 75% "interest-free contribution" (page doesn't say if repaid), the non-profit stream, any dollar maximum (none stated).
- **`ca-acoa-regi`** (`717fcf1`): sources `main`, `contacts`; type repayable; intake **unknown**; criteria 4 (1 checkable / 3 check-yourself); contacts 2. Left out: the Regional Innovation Ecosystems stream (non-profits only), the Indigenous "extra support" line (not a rule).
- **`ca-nrc-irap`** (`643ef9c`): sources `main`; type Unknown; intake **unknown**; criteria 7 (4 checkable / 3 check-yourself); contacts 1. Left out: funding type (the page says "funding", never repayable or not), amount, intake.
- **`ca-canexport-smes`** (`32feb57`): sources `main`, `guide`; type Unknown; intake **closed**; criteria 7 (5 checkable / 2 check-yourself); contacts 1. Left out: funding type (guide never says non-repayable), a partnership rule (profile can't tell an LLP from other partnerships: check-yourself until `unclear`).
- **`ca-canada-summer-jobs`** (`2f999db`): sources `who-can-apply`, `apply`, `about`; type wage_subsidy; intake **closed**; criteria 3 (1 checkable / 2 check-yourself); contacts 0. Left out: an employees rule (the 50 limit is private-sector only: check-yourself), not-for-profits' 100% rate (notes), location (national).
- **`ca-canada-digital-adoption-program`** (`f8e02f4`): sources `qp-note`, `pia`; type Unknown; intake **closed**; criteria 2 (1 checkable / 1 check-yourself); contacts 0. Left out: funding type (the note says "grants" but not non-repayable), BDC's closure page (terms), Grow Your Business Online "remains open" as of Jun 20, 2024 (notes).
- **`ca-canada-small-business-financing-program`** (`e6e6bca`): sources `loans`, `faq`; type loan; intake **unknown**; criteria 4 (2 checkable / 2 check-yourself); contacts 0. Left out: a structure rule (every structure and start-ups eligible), a NAICS 11 rule (farming is narrower: check-yourself), sub-limits (amount text).
- **`ca-sred-investment-tax-credit`** (`7b916f8`): sources `main`; type tax_credit; intake **unknown**; criteria 3 (1 checkable / 2 check-yourself); contacts 0. Left out: the 35% rate as a rule (needs a CCPC: check-yourself), what work qualifies (separate CRA page, not saved), intake.

Choices made the same way throughout: intake `unknown` unless a page states it; funding type empty unless a page names
it; a rule only when the page's wording maps mechanically to a profile answer; otherwise a check-yourself item with its
own quote. Where `unclear` would be the right answer (CanExport partnerships, CSBFP "Not registered yet"), I used
check-yourself or no rule, because schema and core don't accept `unclear` yet; each file's notes say so.

### Contract question 17 — `pageText` leaks quoted attribute values (found researching CanExport)
The CanExport guide wraps each text block in `<div data-cmp-data-layer="{…&quot;xdm:text&quot;:&quot;<p>To be eligible…</p>…">`:
HTML-escaped JSON whose string still contains raw `<p>`, `<ul>`, `<li>` (26 `>` before that div's `id`). `core/text.js` ends a tag
at the first `>`, even inside a quoted attribute. The rest of the attribute becomes page text, so sentences appear twice,
once with literal `\r\n` and `&nbsp;`, and fragments like `"}}" id="text-060c0434fa" class="cmp-text">` sit in the text.
Minimal cases through `pageText`: `<div data-x="a > b">Hello world</div>` → `"b\">Hello world"`, and
`<div data-cmp="{&quot;text&quot;:&quot;<p>Hi</p>&quot;}" id="t">Clean text</div>` → `"Hi \"}\" id=\"t\">Clean text"`.
- **Effect today:** every CanExport quote verifies and every fact is right, but a scan of the built bundle finds **6 of 61
  ca-* quotes with garbled context**, all CanExport (summary, intake, 3 criteria, the contact). The program page would show
  that junk as the muted text around the quote. No other ca-* program is affected.
- **Ask:** API §1 step 2 should skip quoted attribute values when finding a tag's end (gm1 in `core/text.js`, with a
  fixture test). That changes `text_sha256` for any saved page with `>` inside an attribute, so the build would ask for
  those sources to be re-hashed (`scripts/hash-source.mjs` exists). I did not work around it in the data.

### Still needed
- **gm1:** `unclear` in schema, matcher and one SAMPLE program (the reason test records the gap); the `pageText` fix above;
  cross-review findings G1–G5, I1–I5, J1–J5.
- **Lead:** decide question 17; QA with `GM_REAL=1` (`worker/tests/real.test.mjs` checks every program answers and CDAP is
  closed, now that it exists) and `live.spec.mjs`.

## Cross-review of gm1 programs
Read each program file on main (merge `d117d59`) against `node scripts/show-text.mjs <source-id>` for its saved page.
Every quote I spot-checked is in the page text. All three keep intake `unknown` (no page says when applications are
taken), which DECISIONS #18 accepts, so none can show Looks like a fit. Findings, most important first.

### `nl-business-growth-program` (source `--main`)
- **G1 — "Not registered yet" is a hard Doesn't fit; DECISIONS #18 wants it Unknown.** The rule is
  `structure in [sole_proprietor, partnership, corporation, cooperative, nonprofit]` with no `unclear`, so an owner
  who picks "Not registered yet" gets Doesn't fit. The page offers help to "assist businesses start". DECISIONS #18
  says this should be `unclear: [not_registered]`, but neither the file nor `core/match.js` has `unclear` yet.
  Pending gm1.
- **G2 — the structure criterion folds in two different sentences.** The quote covers both "sole proprietors,
  partnerships or corporations … that demonstrate commercial viability" and "Co-operatives or non-profit
  organizations". Fine as a set, and the extra conditions are rightly split into the `commercial-viability`
  self_check. No change asked.
- **G3 — the location quote names only three structures.** "sole proprietors, partnerships or corporations
  operating within Newfoundland and Labrador". Co-ops and non-profits also need to be "operating within
  Newfoundland and Labrador" (second sentence), so `province: NL` holds for everyone. Wording only; no change.
- **G4 — left out, reasonably:** "Sector organizations participating in Department-led projects … may be considered
  eligible applicants" (not a business answer); the $750,000 Development and Commercialization ceiling (in notes, as
  #18 agreed); no purpose rule (the priorities don't map mechanically). Agreed.
- **G5 — contacts.** Five regional office phones plus the email, all on the page, `census_divisions` null (the page
  doesn't say which office covers where). "Call this office" will therefore list all five for every community. The
  head-office line on the page ("Tel: 1.709.729.2480") is the department footer and was rightly not used here.

### `nl-business-investment-program` (source `--main`)
- **I1 — over-claim: "strategic sector" is written as a requirement, but the page gives an alternative.** The summary
  says "The fund is also available to businesses which have export potential and require assistance to enter or
  expand in external markets." The `strategic-sector` self_check text ("Operates in a strategic sector as defined by
  JGRD") makes a strategic sector sound mandatory. Suggest the criterion text add "(or has export potential and needs
  help entering or expanding in external markets)", with the quote kept or a second self_check quoting the export
  sentence. It's a self_check so the fit label doesn't change, but the owner reads a stricter rule than the page's.
- **I2 — "must normally" softens every eligibility line.** The list opens "Eligible applicants must normally:". The
  hard `employees lt 100` and `revenue lt 10000000` rules make a 120-person business a plain Doesn't fit, while the
  page allows exceptions. Keeping the page's own numbers is right. I'd add "normally" to the two criterion texts
  ("Normally fewer than 100 employees") so the owner sees the page's softness. The lead decides whether a "normally"
  limit should be `missed` at all.
- **I3 — contact.** "Call this office" will show the department's general line (`1.709.729.2480`), quoted from the
  **site footer** ("Contact Jobs, Growth and Rural Development P.O. Box 8700 … Tel: 1.709.729.2480"). It's an
  official number on the page, but it isn't this program's office. The page itself says "Please consult with the JGRD
  office near you", and the regional numbers are on the Business Growth page, which #18 allows as a second source.
  Suggest the regional offices, or label the footer line "Department switchboard".
- **I4 — funding type `loan`, agreed.** "repayable term loans at an interest rate equal to the Bank of Canada rate +
  0.5%" is a loan (not ACOA-style `repayable` interest-free contributions). No amount or cost share on the page:
  correctly null.
- **I5 — `demonstrated-need` quotes the summary, not the eligibility list.** "Funds are provided to complement
  funding from conventional sources, where a need has been demonstrated". Reasonable as a self_check; no change.

### `nl-jobsnl-wage-subsidy` (source `--main`)
- **J1 — over-claim: co-ops and non-profits show as met.** The page says "Private or not-for-profit sector employers
  that are incorporated or sole proprietorships"; the rule puts `cooperative` and `nonprofit` in `in`. An
  unincorporated non-profit would be told it matches. DECISIONS #18 and API §4 give exactly this sentence as the
  `unclear: [cooperative, nonprofit]` example, but the file and core don't have it yet. Pending gm1. Until then,
  moving them out of `in` would make them a wrong *missed*, so leaving it until `unclear` lands is the lesser harm.
- **J2 — the participant criterion's text claims more than its quote.** Text: "The person hired is unemployed or
  underemployed (and meets the page's other rules for participants)". The quote only has the unemployed/underemployed
  sentence. The other rules ("Must reside in Newfoundland and Labrador", "Must be a Canadian citizen or permanent
  resident in Newfoundland and Labrador", "Must not be receiving federal or provincial pensions, Workplace NL
  benefits, or other benefits") are on the page but not quoted. API §0: every fact shown has a quote. Suggest one
  self_check per rule, each with its own quote. The temporary-resident and recent-graduate lines are exceptions and
  can stay in notes.
- **J3 — `cost_share.percent: 80` with an hourly cap.** "80% subsidy, up to $12/hour" is a share of wages capped per
  hour, so for most wages the real share is lower. The text says "60% to 80% of wages … up to $12 an hour", which is
  honest, and #18 accepted it. No change; noting that a card showing "80%" alone would over-state it (the app shows
  the text, not the number).
- **J4 — left out, reasonably:** the exclusion of government departments, crown agencies, municipalities and political
  parties (not a profile answer, and no business owner is one); the LaMPSS password line (support, not the program);
  process timelines ("notified of the decision within 20 business days", "hire an individual within 30 business
  days"). Agreed.
- **J5 — purpose `hire`, wage_subsidy type, program phone/email:** all on the page and mechanical. Agreed.

### Summary for the lead
- Waiting on gm1 (`unclear` in schema, core and data): G1, J1.
- Wording/over-claim fixes in gm1's files, no rule change: I1, I2, J2.
- Contact choice: I3.
- Everything else: agreed as researched.

## Round 2 — app copy, flags, left-out programs: DONE
Merged main at `d117d59` (gm1's first three NL programs, `page_gone`, `scan.mjs`; contract `6130db3`). `build:data`:
3 real programs, 8 SAMPLE.
- **Copy (API §12):** `not_answered` → "Unknown: you didn't answer this or weren't sure"; new `unclear` → "Unknown: the
  page's wording doesn't settle it for your answer". Both are in `render.js` and on About's "What Unknown means" list.
- **Program page flags (DECISIONS #19, Q11):** with a profile, stale/needs-review wording comes only from `fit.why` as
  core writes it; the separate flag shows only when there is no profile. Results cards keep the short flag.
- **About: "Programs we left out, and why"** (static): BDC loans (link to BDC's legal notice), Futurpreneur (link to
  its terms and conditions), Ulnooweg Development Group (no terms page, so the link goes to its website and says so),
  each with one plain reason, plus "Grant Match only uses pages it is allowed to quote."
- **Tests:** reason copy now covers `unclear`; new "with a profile the stale wording comes from fit.why only; with no
  profile the flag shows"; new "about lists the programs we left out, each with its terms link and reason" (also
  asserts no bundle source is on bdc.ca, futurpreneur.ca or ulnooweg).
- **Gap, stated plainly: nothing produces `unknown_reason: "unclear"` yet.** `core/match.js` and `core/schema.js` on
  main have no `unclear`, and no SAMPLE or real rule uses it (JobsNL and Business Growth still list co-ops,
  non-profits and "Not registered yet" as plain `in`/missed). The reason test tries structure answers a rule's
  `unclear` list would name. It checks the rendered copy as soon as core produces it; until then it records a "gap"
  annotation and checks the exact copy in `render.js` and on About. **Needs from gm1:** `unclear` in schema and
  matcher, plus one SAMPLE program with an `unclear` list, so the page-level check stops being a copy check.
- **Suites:** Worker 15 passed, 1 skipped. Playwright **164 passed, 0 failed**, every test run twice on chromium and
  webkit at 390 and 1280; 28 skipped by design.
- **Negative controls:**
  - (e) the flag rendered even with a profile → **red**: `[data-flag]` expected 0, received 1. Restored → passes.
  - (f) the BDC terms link removed from the left-out section → **red**: "element(s) not found" for the link with
    href `https://www.bdc.ca/en/legal-notice`. Restored → passes. (The first break pattern didn't match the file,
    because it has a plain apostrophe, not `&#39;`, and printed "BREAK FAILED". The fallback pattern made the break;
    the diff shown before the run confirms the link was gone.)
  Both edited files were restored from byte copies (they carried uncommitted round-2 edits); no backup files left.
- Screenshots: `docs/shots/gm2-about-{390,1280}.png` retaken with the new section.

## Phase 2 groundwork (2026-09-14, reading only: no sources saved, no program JSON)
Read by hand with our User-Agent, one host at a time, ≥ 1.5 s between requests (11 s on futurpreneur.ca, 61 s on
the Ulnooweg sites). Copies used for reading sit in the untracked `.scratch/`; nothing is in `data/`.
Two slips, recorded here: on `www.ic.gc.ca` and `open.canada.ca` (both `Crawl-delay: 20`) I left only 2 s between
robots.txt and one page, and on `search.open.canada.ca` I read the page before its robots.txt (which is a 404,
so no rule was broken). No host was asked for more than one page after that.

### Stop-and-decide items for the lead
1. **BDC terms forbid our use.** https://www.bdc.ca/en/legal-notice §2.2.2: "You must get our authorization in
   writing before using any content from our website for: Modification Copy Distribution Republication
   Transmission Storage, whatever the medium". PLAN research step 2 says don't use such a site. So **no
   `ca-bdc-small-business-loan`**, and BDC cannot be CDAP's closed source either (see 8).
2. **Futurpreneur terms forbid our use.** https://futurpreneur.ca/en/terms-conditions/: "You may not: … Copy,
   modify, distribute, transmit, display, reproduce, or create derivative works from the Website; Use any automated
   system or software to extract data from the Website". So **no `ca-futurpreneur-startup`** unless Futurpreneur
   gives permission.
3. **CanExport SMEs is closed right now.** Main page (modified 2026-09-09): "Applications are not being accepted at
   this time The application intake period ended at 12:00 p.m. (ET) on August 31, 2026." It would be `closed`.
4. **Canada Summer Jobs 2026 intake is over.** "The application period was from November 4, 2025, to December 11,
   2025". No 2027 dates yet, so it would be `closed`, and would need re-checking when the 2027 intake is posted.
5. **Government of Canada pages allow non-commercial reproduction only.** canada.ca, nrc.canada.ca and
   ised-isde.canada.ca terms: non-commercial reproduction is fine with attribution; "you may not reproduce materials
   on this site, in whole or in part, for the purposes of commercial redistribution without prior written
   permission". This feeds DECISIONS #12 (APCO is commercial). Only the Open Government Licence (open.canada.ca)
   allows commercial use, with attribution.

### Per program: official URLs and where the facts are
1. **`ca-acoa-business-development-program`** (ACOA)
   - Main: https://www.canada.ca/en/atlantic-canada-opportunities/services/business-development-program.html
     (modified 2024-11-28). Type: "Our repayable funding is interest-free and unsecured" (businesses) and
     "interest-free contribution to cover up to 75% of the costs" for training, marketing and so on. Cost share:
     "up to 50% of the capital". No dollar maximum, no intake wording (→ `unknown`), no eligibility list beyond
     business/non-profit. Phone on the page: ACOA Business Information Services 1-888-576-4444 (Atlantic-wide).
   - Contacts: https://www.canada.ca/en/atlantic-canada-opportunities/corporate/contact-us.html
     ("Newfoundland and Labrador : 1-800-668-1010").
   - How to apply (form page, not a fact source): …/services/application-for-financial-assistance.html
2. **`ca-acoa-regi`** (ACOA)
   - Main: https://www.canada.ca/en/atlantic-canada-opportunities/services/regional-economic-growth-through-innovation.html
     (modified 2024-11-28). Business Scale-up and Productivity: "Our repayment contributions are unsecured and
     interest-free"; who can apply lists "sole proprietorships partnerships social enterprises incorporated companies
     corporations or co-operatives Indigenous-owned businesses". The ecosystem stream (non-repayable) is for
     non-profits only, so left out. No amount, no cost share, no intake wording. Same two phones as BDP.
3. **`ca-nrc-irap`** (NRC)
   - Main: https://nrc.canada.ca/en/support-technology-innovation/financial-support-technology-innovation
     (modified 2026-01-08). Everything is here: "be incorporated, for-profit, and operating in Canada", "employ up
     to 500 people (full-time equivalent)", "develop and commercialize innovative, technology-driven products or
     services" (self_check), excludes "sole proprietorships or partnerships cooperatives", phone "1-877-994-4727".
     Funding is "in some cases, funding": no amount, no cost share, no intake. Type likely non-repayable, but this page
     doesn't say "non-repayable", so it is Unknown unless another NRC page says it.
4. **`ca-canexport-smes`** (Trade Commissioner Service)
   - Main (intake): https://www.tradecommissioner.gc.ca/en/our-solutions/funding-financing-international-business/canexport-smes.html
     closed since August 31, 2026 (above); "may receive up to $50,000".
   - Rules: …/canexport-smes/applicants-guide-2026-27.html (modified 2026-08-31) §1.1: "have between 3 and 500
     full-time employees", "have between $300,000 and $100 million in annual revenue", "incorporated legal entity,
     limited liability partnership (LLP), or cooperative". §3.1: "between $10,000 and $50,000", "up to 50% of
     eligible costs", project value "$20,000 and $100,000". Emails only (canexportsmes@international.gc.ca), no phone.
   - Checklist: …/canexport-smes/find-out-qualify.html agrees (3 to 500 FTE, revenue floor $300,000).
   - Watch-out: the guide's HTML carries a JSON copy of each text block, so `pageText` may contain every sentence
     twice. That's harmless for substring quotes, but `contextFor` will pick the first copy.
5. **`ca-canada-summer-jobs`** (ESDC)
   - Who can apply: https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs/applicant-guide/who-can-apply.html
     (modified 2026-08-21): "Private sector employers must have 50 or fewer full-time employees across Canada at the
     time of application", youth "between 15 and 30".
   - Intake: https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs/applicant-guide/apply.html
     (the main page the brief names, …/canada-summer-jobs.html, has no intake wording).
   - Funding: …/applicant-guide/about.html: "Public and private sector: Up to 50% of the minimum wage" (wage subsidy;
     not-for-profits up to 100%). Purpose `hire`. Contact page …/canada-summer-jobs/contact.html not read yet.
6. **`ca-futurpreneur-startup`**: **not usable** (terms, item 2). For the record, the pages are
   https://futurpreneur.ca/en/eligibility/ ("ages 18-39", "24 months or less") and
   https://futurpreneur.ca/en/offering/core-startup/ ("loan up to $75,000"). The 18–39 wording matches the
   profile's `youth` label, and the St. John's phone is on /en/contact/.
7. **`ca-bdc-small-business-loan`**: **not usable** (terms, item 1). For the record, https://www.bdc.ca/en/financing/small-business-loan
   has two tiers: up to $100K needs "At least $100K in annual revenue", "In business for at least 24 months"; over
   $100K up to $350K needs "At least $250K in annual revenue".
8. **`ca-canada-digital-adoption-program`** (ISED) — closed
   - ISED's CDAP site now redirects to the ISED home page: `…/site/canada-digital-adoption-program/en`,
     `…/en/boost-your-business-technology-grant` and `…/en/how-find-digital-advisor` all land on
     https://ised-isde.canada.ca/site/ised/. The old https://www.ic.gc.ca/eic/site/152.nsf/eng/home is a 404.
     This goes in `research.notes`.
   - **Government of Canada page stating the closure:** Question Period note, ISED, "How is the Canada Digital
     Adoption Program helping small businesses?": https://search.open.canada.ca/qpnotes/record/ic,MSB-2024-QP-00014 —
     "Due to overwhelming demand, the Boost Your Business Technology grant’s intake for new applications has closed."
     and "The Canada Digital Adoption Program's (CDAP) Boost Your Business Technology grant is fully subscribed and is
     not accepting new applications at this time." Caveat: the same note (early 2024) says Grow Your Business Online
     "remains open".
   - ISED Privacy Impact Assessment, evergreen update May 2024 (page modified 2026-01-22):
     https://ised-isde.canada.ca/site/atip-services/en/references/privacy-impact-assessment-canada-digital-adoption-program-evergreen-update-may-2024
     — "The CDAP is presently intended to operate for four years (2021-22 through 2024-2025). At the time of this
     evergreen PIA, there is no stated commitment to extend the program beyond its originally planned, four-year life."
   - I found **no** Government of Canada page that says in so many words that the whole program (including Grow Your
     Business Online) ended. My proposal: record `closed` quoting the QP note for Boost Your Business Technology, add
     the PIA's four-year life as a second source, put the ISED redirect in `research.notes`, and make `summary`/`why`
     say "Boost Your Business Technology closed; the program's own site is gone". The lead decides whether that is
     enough.
9. **`ca-canada-small-business-financing-program`** (ISED)
   - Main: https://ised-isde.canada.ca/site/canada-small-business-financing-program/en (modified 2026-06-25) is only
     an overview.
   - Facts: …/en/canada-small-business-financing-program/find-loan-your-small-business/helping-small-businesses-get-loans
     (modified 2026-06-22): "gross annual revenues of $10 million or less", "not eligible … farming businesses", "The
     maximum loan amount for a borrower is $1.15 million", "a maximum of $1,000,000 for term loans".
   - FAQ: …/en/frequently-asked-questions-small-businesses (modified 2026-07-09): "Such businesses can be corporations,
     sole proprietors, partnerships or cooperatives" (plus for-profit, not-for-profit and charitable). Lenders deliver
     it, so no ISED phone as "the office"; intake is continuous only if a page says so, which none does yet.
10. **`ca-sred-investment-tax-credit`** (CRA)
    - Main: https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program/sred-claim/investment-tax-credit.html
      (modified 2026-04-01): "The basic ITC rate is 15%", "Most Canadian-controlled private corporations (CCPCs) … may
      earn a refundable ITC at the enhanced rate of 35%". Type `tax_credit`, purpose `research`. A CCPC isn't a profile
      answer (self_check). Eligible work is on …/sred-eligibility.html; contact on …/contact-sred.html (not read yet).
      Intake: a claim with a tax return, so no intake wording (`unknown` unless a page says otherwise).
11. **Ulnooweg Development Group** (non-profit, Atlantic Canada)
    - robots.txt on ulnooweg.ca and ulnoowegdevelopmentgroup.ca: `disallow:` (nothing) with `crawl-delay: 60`.
    - Terms: no terms, privacy or legal page is linked on either site (`/privacy-policy/` is a 404). The footers only
      say "© 2026 Ulnooweg Development Group" / "© Ulnooweg – 2021. All rights reserved." That means no stated
      licence to copy. I'd treat it like a strict site and ask the lead before saving pages.
    - Facts: https://ulnoowegdevelopmentgroup.ca/entrepreneurship/business-funding/ — Micro Lending "up to $5,000";
      Women & Youth Lending "up to $25,000"; General Lending "up to $750,000 for Individuals"; and the **Aboriginal
      Business Financing Program** "offers non-repayable business contributions to individual Indigenous
      entrepreneurs and community owned businesses". Every program says "Contact us for eligibility and further
      details", so the criteria would be mostly Unknown. Phone on every page: 1-888-766-2376. Ownership `indigenous`.

### Terms per host (one line each)
| Host | Terms page | What it says about reproduction | Usable |
|---|---|---|---|
| www.canada.ca (ACOA, ESDC, CRA; also used by tradecommissioner.gc.ca) | https://www.canada.ca/en/transparency/terms.html | Non-commercial reproduction free with attribution; commercial redistribution needs written permission | Yes (research use); commercial use → DECISIONS #12 |
| www.tradecommissioner.gc.ca | links to canada.ca terms above | same | Yes, same caveat |
| nrc.canada.ca | https://nrc.canada.ca/en/corporate/transparency/terms-conditions | Same Crown copyright wording as canada.ca | Yes, same caveat |
| ised-isde.canada.ca | https://ised-isde.canada.ca/site/ised/en/terms-and-conditions | Same; commercial permission via ISED Citizen Services Centre | Yes, same caveat |
| search.open.canada.ca / open.canada.ca | https://open.canada.ca/en/open-government-licence-canada | OGL-Canada 2.0: copy, publish, adapt "including for commercial purposes", with attribution | Yes |
| www.bdc.ca | https://www.bdc.ca/en/legal-notice | Written authorization needed to copy, store or republish any content | **No** |
| futurpreneur.ca | https://futurpreneur.ca/en/terms-conditions/ | No copying or reproducing; no automated extraction | **No** |
| ulnooweg.ca, ulnoowegdevelopmentgroup.ca | none published | "All rights reserved" footer only | Ask the lead |

## Needs from other slices
- **gm1:** `sourceStatusFrom` per the new API §9 (`page_gone`, failed checks keep `missing_quotes`), and the fit
  `why` sentence for needs review ("changed or gone"). The Worker needs no change for either: it folds stored runs with
  core's `sourceStatusFrom` and passes the result through.
- **Lead:** answers on Contract questions 9–16 (core wording vs §12 copy, "Not sure" structure reason, whether
  `counts.unknown` includes self_check), and on the phase-2 stop-and-decide items (BDC and Futurpreneur terms, the CDAP
  closure source, Ulnooweg with no terms page, CanExport and Canada Summer Jobs currently closed).
- **Lead QA:** `worker/tests/real.test.mjs` (`GM_REAL=1`, `DATA_SET=real`) and `app/tests/live.spec.mjs` (`GM_API`) are
  written but only skip here: there are no real programs yet and no running Worker for the app suite to point at.
