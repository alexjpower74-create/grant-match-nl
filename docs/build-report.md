# Build report — Grant Match NL (overnight, 2026-09-14)

**DRAFT, in progress.** Lead: Onyx (Opus 5, xhigh). Slices: gm1 engine + NL programs, gm2 Worker + app + federal
programs (Opus 5, medium), each in its own worktree on its own ports. Every number here comes from a QA worktree
pinned to a sha (`rig qa`), never from a shared tree. Per-slice detail: `docs/build-report-gm1.md`, `-gm2.md`.

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

Merges on main: `1d3bc7c` (gm1 phase 1), `e94f4af` (gm1 programs 1–3), `dd42ee6` (gm2 phase 1), `2c4b783` (gm1 at d4b8a42), `7825c3b` (gm2 at 8c92764), then gm1 at dd4f9d4.

## Negative controls

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

## Still to do
Programs 4–15 (gm1) and the federal programs (gm2) · gm2's cross-review of gm1's programs and gm1's of gm2's · final QA
on main (core, Worker incl. `GM_REAL=1`, app incl. `live.spec.mjs` against a real local Worker) · real `npm run scan`
into the local Worker · README, private repo, status file.
