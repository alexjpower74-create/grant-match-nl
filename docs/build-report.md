# Build report — Grant Match NL (overnight, 2026-09-14)

Lead: Onyx (Opus 5, xhigh). Slices: gm1 engine + NL programs, gm2 Worker + app + federal
programs (Opus 5, medium), each in its own worktree on its own ports. Every number here comes from a QA worktree
pinned to a sha (`rig qa`), never from a shared tree. Per-slice detail: `docs/build-report-gm1.md`, `-gm2.md`.

## Round 2 — Onyx's review (lead only, no slices)

Onyx reviewed the real APCO Software Tools results and asked for five changes (DECISIONS #29): sort as stated (fit, then
funding type, then matches), intake timing out of the fit label and onto its own line, Unknown split into "the page
doesn't say" and "we didn't ask you", a "Not enough to go on" tier for 0 matches, and each card's strongest quoted match.

**Real APCO Software Tools profile, same 27 programs, same live data:** before, 0 Looks like a fit, 14 Might fit, 8 Doesn't
fit, 5 closed; after, 1 Looks like a fit (CBDC Innovation Loan), 12 Might fit, 1 Not enough to go on (Innovation and
Business Development Fund), 8 Doesn't fit, 5 closed. The Might fit list now opens with the non-repayable programs
(Green Transition Fund, Business Growth Program), then repayable (ACOA), then loans.

**A judgement call, reversed on evidence:** the lead first put location-only programs in "Not enough to go on" too. On the
real APCO profile that made 12 of 22 open programs "Not enough to go on", mostly because the profile left structure and
revenue unanswered, so it went back to Onyx's rule: 0 matches.

**Negative controls, round 2** (`scratchpad/r2-controls.py`: break a committed file, run the targeted test, restore byte
for byte, confirm git-clean, re-run green; a run with no tests counts as a failure):

| # | Break | Result |
|---|---|---|
| N1 | Sort by more matches before funding type (Onyx's control) | red: "funding type outranks matches: a loan with more matches sits below a non-repayable program" |
| N2 | Intake timing counted in the fit label again | red: "when a program takes applications never changes its label" |
| N3 | A program with 0 matches allowed to be Might fit | red: "Not enough to go on: 0 matches is never Might fit" |
| N4 | Core's Unknown split with `unclear` counted as we-didn't-ask-you | red: "Unknown splits into what the page doesn't say and what we didn't ask you" |
| N5 | `top_match` allowed to pick location | red: "top_match: the strongest short quoted match beyond location" |
| N6 | Card quote shows the criterion text instead of the quote | red: "each card shows its strongest quoted match, exactly as core picked it" |
| N7 | App's Unknown groups swapped | **first VOID**: the test compared counts, and the SAMPLE program has one of each kind, so a swap kept both counts at 1. Test fixed to compare criterion ids per group (0e09a1a); then red |
| N8 | Intake line without "call the office to confirm" | red: "a card says what the page leaves unsaid" |

## Final QA

Pinned QA worktree at **`549414b`** (round 2 final), QA ports 7406–7409, run by the lead's `final-qa.sh`:

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `build-data` (every quote on its saved page) | 27 real + 10 SAMPLE programs | all verified | 0 | — |
| Core (`node --test core/tests`) | 77 | 77 | 0 | 0 |
| Worker on SAMPLE data (own `wrangler dev --local`, fixture server, `--test-scheduled`) | 16 | 15 | 0 | 1 (real-data test) |
| Worker on real data (`GM_REAL=1`) | 1 | 1 | 0 | 0 |
| App, Playwright: chromium-390, chromium-1280, webkit-390, webkit-1280 | 132 | 116 | 0 | 16 by design |
| App against a real local Worker, SAMPLE data | 4 | 4 | 0 | 0 |
| App against a real local Worker, real data (27 programs) | 4 | 4 | 0 | 0 |

**Why 16 skips:** 390-only tap-target and horizontal-scroll checks don't run in the 1280 projects, the one-page PDF check
runs in chromium only, and `live.spec.mjs` is run separately with `GM_API` (the two live rows). None hides a failure.

## QA history (each merge QA'd first)

| When | Sha | What | Result |
|---|---|---|---|
| 03:10 | `1d0fc50` gm1 phase 1 | core tests · `build-data` | 52 pass / 0 fail / 0 skip · exit 0 (8 SAMPLE) |
| 03:20 | `d0f2561` gm1 first 3 NL programs, page_gone, scan.mjs | core tests · `build-data` | 56 / 0 / 0 · exit 0 (3 real, 8 SAMPLE) |
| 03:40 | `62f0578` gm2 phase 1 | Worker suite (own `wrangler dev --local`, ports 7409/7406) · Playwright chromium+webkit, 390+1280 (app 7408) | Worker 15 pass / 0 fail / 1 skip (real-data test needs `GM_REAL=1`) · app 74 pass / 0 fail / 14 skip by design |
| 03:47 | `d4b8a42` gm1 `unclear`, NL programs 4–13 | core tests · `build-data` (second QA worktree `qa-gm1`) | 58 / 0 / 0 · exit 0 (13 real) |
| 03:48 | `8c92764` gm2 round 2 + 8 federal programs | `build-data` · core · Worker · Playwright | 11 real · core 56/0/0 · Worker 15 pass / 0 fail / 1 skip · app 82 pass / 0 fail / 14 skip. Worker `GM_REAL=1`: 1 fail, `'sample' !== 'real'`: the runner always started `DATA_SET=sample`, so real mode was untestable (gm2 fixing) |
| 03:50 | `dd4f9d4` gm1 six CBDC loans | core tests · `build-data` | 58 / 0 / 0 · 19 real on the branch |
| 03:58 | `b0bb1ad` gm1 sentence context, 'Unknown:' wording, URL de-dup | core tests · `build-data` | 59 / 0 / 0 · exit 0 (19 real on the branch) · gm1's live `scan --dry`: 38 sources, 22 URLs, every quote found |
| 04:02 | `8593d85` gm2 real-data Worker mode, CanExport `unclear` | `build-data` · core · Worker SAMPLE · Worker `GM_REAL=1` · Playwright | 27 real · 58/0/0 · 15 pass / 0 fail / 1 skip · **1 / 1 pass** (27 programs, 147 criteria, 53 sources) · 82 pass / 0 fail / 14 skip |
| 04:08 | `8593d85` live | `live.spec.mjs` with `GM_API` → a real `wrangler dev --local` (DATA_SET=sample, migrated D1) on 7409, app on 7408 | 4 pass / 0 fail (chromium + webkit, 390 + 1280): the app rendered exactly the Worker's open and closed lists |
| 04:14 | `04e3e18` gm2 real-data pass (phone never splits on the printout, unknown lines name their subject, no-type cards say so) | `build-data` · core · Worker SAMPLE · Worker `GM_REAL=1` · Playwright | 27 real · 59/0/0 · 15/0/1 · 1/1 · 92 pass / 0 fail / 16 skip |
| 04:22 | `c1b9f83` gm1 attribute-safe `pageText`, `normally`, purpose `unclear` + gm2 CanExport re-hash | `build-data` · core · Worker SAMPLE · Worker `GM_REAL=1` · Playwright | exit 0, 27 real · 64/0/0 · 15/0/1 · 1/1 · 92 pass / 0 fail / 16 skip. The tag fix changed text hashes of exactly two saved pages (CanExport main + guide); no quote stopped verifying; JSON junk in CanExport contexts 6 → 0 |
| 04:30 | `119c393` data fixes from both cross-reviews, SAMPLE `unclear`/`normally` fixtures, sort tier, self_check copy | `build-data` · core · Worker SAMPLE · Worker `GM_REAL=1` · Playwright | exit 0, 27 real + 10 SAMPLE · 66/0/0 · 15/0/1 · 1/1 · 96 pass / 0 fail / 16 skip. gm1's live dry scan on the same data (CanExport re-hashed in a throwaway copy): 53 sources, 36 unique URLs, 287/287 quotes found |
| 04:34 | `44a54f0` gm1 `blockText`, block-bounded context, no context on contacts | `build-data --check` · core tests · data diff vs main | exit 0 (27 real, 10 SAMPLE) · 73/0/0 · no program or source file changed |
| 04:40 | `44d19fc` main (before blockText) | the lead's `final-qa.sh`: `build-data` · core · Worker SAMPLE · Worker `GM_REAL=1` · Playwright · `live.spec.mjs` against a real `wrangler dev --local` on SAMPLE **and on real data** | exit 0, 27 real + 10 SAMPLE · 66/0/0 · 15/0/1 · 1/1 · 96 pass / 0 fail / 16 skip · live SAMPLE 4/4 · **live real 4/4** (Worker health: data_set real, 27 programs) |
| 04:46 | `952c679` **final** | `final-qa.sh`: build · core · Worker SAMPLE · Worker real · Playwright · live SAMPLE · live real | exit 0, 27 real + 10 SAMPLE · 73/0/0 · 15/0/1 · 1/1 · 100 pass / 0 fail / 16 skip · 4/4 · 4/4 |
| 04:43 | main checkout, **real scan** | `npm run scan` (Node, same `runChecks` as the Worker cron) into the local Worker on 7402 (DATA_SET=real) | 53 of 53 official pages fetched, 0 quotes missing, 0 pages changed since saved; stored as check run 1 in local D1 (finished 07:12:53Z). App on 7401 and Worker on 7402 left running |
| 05:32 | `621c726` round 2 engine + app | `final-qa.sh` | exit 0, 27 real + 10 SAMPLE · core 77/0/0 · Worker 15/0/1 · real 1/1 · Playwright 116 pass / 0 fail / 16 skip · live 4/4 SAMPLE, 4/4 real |
| 05:48 | `549414b` **round 2 final** (N7 test fix, shots, docs) | `final-qa.sh` | exit 0, 27 real + 10 SAMPLE · core 77/0/0 · Worker 15/0/1 · real 1/1 · Playwright 116 pass / 0 fail / 16 skip · live 4/4 SAMPLE, 4/4 real |
| 04:51 | `995aa02` lead copy fix (results line states the real sort order, DECISIONS #28) | Playwright `results` specs, chromium + webkit, 390 + 1280, pinned worktree | 24 pass / 0 fail |

Merges on main: `1d3bc7c` (gm1 phase 1), `e94f4af` (gm1 programs 1–3), `dd42ee6` (gm2 phase 1), `2c4b783` (gm1 at d4b8a42), `7825c3b` (gm2 at 8c92764), then gm1 at dd4f9d4.

## Negative controls

Every row below was made red on purpose, restored byte for byte, and re-run green. Full tables: the slice reports.

**Lead**, on the brief's own gate, QA worktree at `1d0fc50`: one character changed in a SAMPLE criterion quote
(`nl-sample-growth-grant.json` criteria[1], "partnerships" → "partnxrships") → `node scripts/build-data.mjs --check`
exit 1: "criteria[1].quote: this quote is not in the page text of nl-sample-growth-grant--main (it matches up to
character 23 …)", "1 problem; nothing written". File restored → exit 0.

**gm1** (docs/build-report-gm1.md): verifier accepts everything → planted-quote build test red; self_check / not-answered
counted as met → "all-unknown program is never Looks like a fit" red; straddling band treated as met → band test red;
robots.txt ignored → robots test red; stale ignored → stale test red; Crawl-delay ignored → gap test red; a failed check
resets the missing count / page_gone ignored / 404 treated like any failure → each matching test red; scan without the
Authorization header → "POSTed with the Bearer token" red.

**gm2** (docs/build-report-gm2.md): Worker (a) `sourceStatus` not passed → needs-review test red, (b) auth removed → 401
test red, (c) open/closed swapped → both deep-equal tests red. App (a) `<mark>` shifted one character → quote test red,
(b) contact button always shown → absent-contact test red, (c) chip at 30 px → tap-target test red, (d) print CSS removed
→ first VOID (the short printout fit one page unstyled), test fixed to count pages first on the fullest SAMPLE printout,
then red "printed pages, Expected 1, Received 2".

**gm1, later rounds:** (k) `unclear` treated as met → "an unclear answer is never Looks like a fit"; (l) a `Crawl-delay` placed
before any `User-agent` ignored → the cbdc.ca-shaped robots test; (m) no URL de-dup → "a URL shared by several sources is
fetched once per run"; (n) context falling back to a raw window → "never menu text"; (o) a tag ending at any `>` → the
attribute test; (p) scan refusing on another set's problems → "--sample scans even when the real data has a problem";
(q) `normally` ignored → "a program whose only miss is a normally limit is Might fit"; (r) purpose `unclear` treated as
missed; (s) evidence tier removed → the sort test; (t) a fixture without `normally` → the SAMPLE `unclear` test;
(u) context allowed across block edges → CanExport's breadcrumb came back; (v) contacts keeping context → red at
`ca-nrc-irap`; (w) `<br>` not marking an edge → the page-wide `blockText` invariant failed on a real saved page.

**gm2, later rounds:** (e) verification flag shown with a profile; (f) BDC terms link removed from "left out"; (g) unknown
intake back to a bare "The page doesn't say"; (h) the no-type line removed; (i) a phone number allowed to wrap on the
printout (red at chromium-390, "Received: 2" lines); plus the round 7–8 controls in `docs/build-report-gm2.md` (why shown
again for check-yourself items, multi-contact line shown for a single contact).

## Cross-reviews that found real defects
- Lead on gm1's engine: a failed live check cleared "the page has changed", and a 404 flagged nothing → `page_gone`,
  failed checks keep the count (DECISIONS #16–17).
- Lead on gm1's first three programs: structure lists that can't settle a co-op / non-profit / not-registered answer
  → `unclear` (DECISIONS #18).
- gm2 on core: copy mismatches between core's `why` lines and the app's flags; "Not sure" read as "didn't answer"
  (DECISIONS #19).
- gm2's phase-2 groundwork on terms: BDC, Futurpreneur, Ulnooweg not usable; CanExport and Canada Summer Jobs closed now
  (DECISIONS #19).
- Lead on gm2's screens: quote context opened with navigation text → sentence-bounded context (DECISIONS #20).
- gm2's own suites: community list under the next card (stacking context), WebKit taps never picking a community, and
  three specs that could hit-test an empty page.

## Screenshots
Lead, real data through the running Worker (APCO Software Tools profile): `docs/shots/lead-real-{form-390,results-390,results-1280,detail-1280,closed-390,print-1280,about-1280}.png`, looked at. gm2's SAMPLE and real-data shots: `docs/shots/gm2-*.png`.

## Known gaps
- Most provincial pages don't say when applications are taken, so most real results are Might fit (by design, #18).
- Facts that exist only in PDFs (fact sheets, guidelines, application guides) weren't read and show as Unknown.
- CBDC contacts list the Central Newfoundland offices the research covered (Grand Falls-Windsor, Gander, Baie Verte,
  Springdale); other regions' CBDCs aren't listed.
- Readability leftovers (#27): long pages at 390 where long quotes repeat; three federal list quotes join a lead-in with
  its items.
- Left out by their terms: BDC, Futurpreneur, Ulnooweg, takeCHARGE. NLOWE unreachable from this machine.
- Deploy-time items (docs/DEPLOY.md): the admin scan runs inside the request (move to `waitUntil`), D1 status folds the
  newest 50 runs, and #12 (Government of Canada reproduction terms) must be decided before a public deploy.
