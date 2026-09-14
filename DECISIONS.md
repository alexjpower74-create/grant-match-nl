# Decisions — Grant Match NL

Made by the overnight lead on 2026-09-14 while Alexander was asleep. Each one says what, why, and what would change
it. Newest at the bottom.

## 1. Architecture
Shared pure-JS `core/` (page text, quote checks, profile, rules matching, live re-checks) used by the build script,
the Node scan, the Worker and the app's mock mode. Programs are researched by hand into `data/programs/*.json`, built
into a bundle the Worker imports; D1 holds only live-check runs. The app is static and calls the Worker. Chosen so
the matcher, the build gate and the scheduled re-check can never drift apart, and so the Worker stores no profiles.

## 2. The evidence is the saved page
Every source page is saved byte-for-byte in `data/sources/` and committed (a few MB of HTML in a private repo).
Quotes are checked against `pageText(html)`, a fixed, documented extraction (docs/API.md §1), so quotes read like
the page and are still mechanically checkable from the raw bytes. Numbers in rules, amounts, percentages, deadlines
and phone numbers must also appear inside their own quote, which catches a researcher typing 50 for 500.

## 3. Starting program list, checked live (02:30–02:45 NDT)
Every URL in PLAN.md answered HTTP 200 to our User-Agent, and each host's robots.txt allows those paths
(gov.nl.ca, canada.ca, nrc.canada.ca, tradecommissioner.gc.ca, bdc.ca HTML pages; cbdc.ca and futurpreneur.ca ask
`Crawl-delay: 10`; www150.statcan.gc.ca asks `Crawl-delay: 2`). The provincial business programs now sit under
**Jobs, Growth and Rural Development** (`gov.nl.ca/jgrd/`); the `/iet/` and `/em/` program URLs in search results
are 404. Aggregator sites (grantcompass, hellodarwin, atlanticcanadabusinessgrants, granthub) were used only to
find names; they are never a source.

## 4. Canada Digital Adoption Program
ISED's own CDAP site now redirects to the ISED home page. BDC's CDAP page (BDC delivered the program's loans) still
says "The Canada Digital Adoption Program (CDAP) is no longer accepting new applications for the Boost Your Business
Technology stream." It is recorded as `closed` with that quote; gm2 looks for a Government of Canada page stating the
whole program ended.

## 5. Profile: two additions to the brief
- **Business structure** (sole proprietor, partnership, incorporated, co-op, non-profit, not registered, not sure):
  the most common hard rule on real pages (IRAP: incorporated only; JobsNL: incorporated or sole proprietorship).
- **Business name**, optional, only printed on the owner's summary. Never stored.
- Ownership: not answering = Unknown; "None of these" = no to every flag; ticking any flag answers the question.
- Bands are cut at thresholds seen on the real pages ($30K, $100K, $300K, $500K, $10M, $100M revenue; 12/24/36
  months), so fewer answers land on both sides of a limit.

## 6. Fit labels
- Doesn't fit: any criterion missed, or the program is closed (closed programs get their own section).
- Looks like a fit: every criterion a profile can answer is met (at least one besides location), intake is open or
  continuous, and the data is fresh and unchanged.
- Might fit: everything else.
- "Check this yourself" items (business plan, good standing, commercial viability) are listed as Unknown and never
  counted as met, but they don't stop Looks like a fit; otherwise no program could ever look like a fit and the
  label would mean nothing. What would change it: if Alexander wants the stricter reading, `core/match.js` rule 3
  adds "and no self_check".
- Stale (verified more than 60 days ago) or changed pages can't show Looks like a fit.

## 7. Research split and cross-review
gm1 researches provincial and NL organisations (`nl-*`), gm2 federal and national (`ca-*`). Each reviews the other's
first three programs against the saved page text before bulk research, because rule interpretation is where this
product can mislead an owner.

## 8. No AI
Nothing needs a model. CA$0 planned of the CA$2 cap.

## 9. Design
Screen uses the approved portfolio look (showpiece). The print page is white with black type (his printer rule:
ink only in type and thin rules).

## 10. Weekly live check
Program pages change rarely; the Worker cron re-checks every source Monday 07:45 NDT (`15 10 * * 1`), politely.
`npm run scan` runs the same code locally.

## 11. Rig on herdr with two-letter slice ids
Rig finds slice tabs with `/^[a-z]\d+$/i`, so `gm1`/`gm2` are invisible to `rig status` and `rig down` (same as
Tender Watch, DECISIONS #7 there). The lead tracks slices with `herdr agent get` and closes its own two tabs by id.

## 12. Copyright and terms — for Alexander before any public deploy
We store copies of official pages in a private repo as evidence and show short quotes with a link to the page, which
is research and review use. Government of Canada and Newfoundland and Labrador sites allow reading and have
reproduction terms; each slice records each host's terms in the source entry. Before this is deployed publicly (a
commercial site), Alexander should decide whether quoting is fine as is or whether to ask the publishers.

## 13. Printout branding
The owner's printout says "Prepared with Grant Match NL" and nothing with Alexander's name or contact details.
Adding APCO Software Tools branding is his call.

## 14. The one real profile: APCO Software Tools
Used only for the lead's real-data QA and screenshots, never in automated tests. Only facts on record: Alexander is in
Springdale / Grand Falls-Windsor and the company was named on 2026-09-10; he builds custom software. So:
`name=APCO Software Tools&community=grand-falls-windsor&industry=54&structure=unsure&employees=1&years=lt1&revenue=unsaid&purposes=digital&cost=unsure`
(owners not answered). Grand Falls-Windsor, the structure and the purpose are the lead's reading, not his answers.
Change them in the URL.

## 15. Answers to gm2's contract questions (03:05)
All eight readings accepted and written into docs/API.md §11–12: the printout lists only Looks like a fit and Might
fit (up to 6, then "and N more"); the results headline counts Looks + Might; admin bodies over 1 MB get 413; `?now=` is
ignored unless `ALLOW_NOW=1` (then a bad value is 400); the Worker folds the newest 50 check runs; the admin scan runs
inside the request (locally fine; a deploy wants `waitUntil` + 202, noted in DEPLOY.md); Playwright `selectOption`
counts as real input for native selects, which can't be tapped headless; `serve.mjs` refuses its own test files.

## 16. A page that disappears, or a check that fails (03:20)
Reviewing gm1's engine: a failed live check (timeout, 5xx, robots refusal) used to reset a source's missing-quote
count to 0, silently clearing "the page has changed"; and a page that now answers 404/410 flagged nothing. Contract
§9 now: only a check that read the page updates the missing count, and 404/410 sets `page_gone`, which also makes the
program "needs review" (so it can't show Looks like a fit). Lead's own negative control on the build gate at 1d0fc50:
one character changed in a SAMPLE criterion quote → `build-data --check` exit 1 naming the file, path and where the
quote stops matching; restored → exit 0.

## 17. Answers to gm1's contract questions (03:25)
Accepted as built: verifyProgram takes page texts or `{ text, sha256, text_sha256 }` from the caller (core has no file
system); bundle reference lists are whole files; `counts.unknown` includes "check this yourself" items; community
`type` is `subdivision`/`other` (the 2021 population table has no type column, and the file that does is too big to
keep as evidence); interval shape; St. John's dates (a deadline passes the day after its date); the stricter schema
(unknown keys are errors, source status must be 200, no deadline on continuous/unknown intake); profile edge cases.
Changed: a live check of a page answering 404/410 lists every quote missing and marks the page gone; any other
non-2xx or network failure says nothing about the page and changes no flags (API §9). gm1 wanted every non-200 to
count as missing, which would flag programs for review on a passing server error. `.gitignore` gains gm1's two
scratch folders.

## 18. Lead review of the first three NL programs (03:35)
Business Growth Program, Business Investment Program, JobsNL Wage Subsidy, read against their saved pages.
- **Intake unknown stays unknown**, and so none of the three can show Looks like a fit. None of the pages says when
  applications are taken; "Looks like a fit" should mean the page says you can apply. The card still shows the
  program as Might fit with "The page doesn't say whether it is taking applications."
- **New `unclear` list on structure and industry rules** (API §4–5): JobsNL's "incorporated or sole proprietorships"
  can't settle a co-op or non-profit, and Business Growth's list can't settle "Not registered yet" for a program that
  helps businesses "start". Those answers are Unknown with their own reason instead of a guessed met or missed.
- Agreed as researched: regional office phones with no census divisions (the page doesn't name them, nothing
  inferred); "less than $10 million in sales" read as yearly revenue; JobsNL's 60–80% shown as text with 80 as the
  top rate; the $750,000 Development and Commercialization ceiling left in notes, since "normally up to $200,000"
  is the program's stated maximum. Business Investment may quote the Business Growth page for the department's
  regional office phones (same department, official page).

## 19. gm2's second round: copy, terms, closed programs (03:45)
- Core/copy (gm2 Q9–16): Q9–10 already fixed by gm1 (page_gone, "changed or gone"). Q11 the program page shows fit
  `why` lines as core writes them and shows the separate stale/review flag only when there is no profile. Q12 core's
  "Unknown, …" becomes "Unknown: …" (gm1). Q13 the not-answered copy reads "you didn't answer this or weren't sure".
  Q14 `counts.unknown` includes check-it-yourself items (pinned in §6). Q15 robots.txt 4xx = no rules, 5xx = skip
  the host (pinned in §9). Q16 no change.
- **Not used, by their terms:** BDC ("You must get our authorization in writing before using any content from our
  website for: … Copy … Storage"), Futurpreneur ("You may not: … Copy, modify, distribute … Use any automated system
  or software to extract data"), Ulnooweg Development Group (no terms page at all, "All rights reserved" footer, so no
  licence to copy). The About page lists them with the reason. This costs the youth (Futurpreneur) and Indigenous
  (Ulnooweg) programs; asking them for permission is on Alexander's list.
- **Closed right now, included as closed with the quote:** CanExport SMEs ("Applications are not being accepted at
  this time"), Canada Summer Jobs 2026 ("The application period was from November 4, 2025, to December 11, 2025").
  The weekly live check flags the page when either changes.
- **CDAP:** closed, quoting the Government of Canada Question Period note on search.open.canada.ca (Open Government
  Licence) that the Boost Your Business Technology grant "is not accepting new applications", with ISED's privacy
  assessment (four-year life to 2024-25) as a second source, and the ISED site's redirect to its home page in the
  research notes. BDC's page can't be the source (terms above).
- **DECISIONS #12 sharpened:** canada.ca, nrc.canada.ca and ised-isde.canada.ca allow non-commercial reproduction with
  attribution; "commercial redistribution" needs written permission. Tonight's use is private research. Before a public
  deploy on a commercial site Alexander decides: quote as review/research, ask the publishers, or prefer Open
  Government Licence pages where they exist.

## 20. Quote context is the sentence, not the menu (03:50)
Looking at gm2's screens: a quote's grey context began "Home Funding Contact us SAMPLE Growth Grant…", because the
context was a 160-character window and the saved page text includes navigation. Real gov.nl.ca pages carry long
menus, so every provincial quote would have opened with a list of links. Contract §1 now cuts context at sentence
boundaries and leaves it empty when there is none nearby. gm1 changes `contextFor` when it next stops; the app needs
no change (it renders `before` + `<mark>quote</mark>` + `after`).

## 21. Two engine rules from gm2's reviews (04:00)
- **Attributes are not page text** (gm2 Q17). `pageText` ended a tag at the first `>`, even inside a quoted attribute;
  CanExport's page stores escaped HTML in `data-cmp-data-layer`, so JSON fragments and duplicate sentences became page
  text and garbled 6 quote contexts. Every quote still verified, but an owner would read junk around them. §1 now ends a
  tag at the first `>` outside quotes. It changes `text_sha256` for any saved page with `>` in an attribute: gm1 fixes
  core and re-hashes `nl-*`, gm2 re-hashes `ca-*`, and the lead merges both before QA so main's build never sees a mix.
- **"Must normally" limits** (gm2 I2). The Business Investment Program says applicants "must normally" have fewer than
  100 employees and less than $10 million in sales. A 120-person business being told Doesn't fit claims more than the
  page. New `normally: true` on bounds rules: outside the limit is Unknown (reason `unclear`), inside is met.
- Also from gm2's cross-review of gm1's first three, for gm1: Business Investment's strategic-sector item mentions the
  export-potential alternative the page gives; its department footer phone is labelled as the department switchboard
  (or dropped, now the regional offices are there); JobsNL's participant rules become one quoted check-it-yourself item
  each, because the combined item claimed more than its quote.

## 22. gm1's programs 4–13, and what was left out (04:10)
- **Answers:** A, `unclear` is allowed on purpose rules too (the Green Transition Fund's "greening" projects cut across
  our purposes; `energy` met, the others Unknown rather than a guess). B, CBDC place-name lists don't become location
  rules (about 40 names aren't census subdivisions and name matching misfires, e.g. Victoria Cove vs Victoria);
  "your local CBDC offers this" is a check-it-yourself item.
- **Left out:** takeCHARGE Business Efficiency Program, its Terms of Use allow "personal, non-commercial transitory
  viewing only" and forbid copying (pages deleted, not committed; asking Newfoundland Power / NL Hydro is on
  Alexander's list). NLOWE, nlowe.org refused connections on port 443 three times (06:03–06:15Z), so nothing was read;
  women-owned coverage is a gap. Horizon TNL (formerly RDÉE TNL) advises and points to Futurpreneur's loan; it doesn't
  fund. Regional Development Fund and Community Capacity Building Program are for non-profit organizations only.
- **Programs whose own pages put them in `closed`:** Canada-NL Job Grant (intake "suspended", which beats the page's
  older "Continuous intake" line) and the Summer Employment Program for Students (deadline 2026-02-19 passed).
- **gm1's own slip, fixed:** cbdc.ca's `Crawl-delay: 10` sits before any `User-agent` line; the parser ignored it, so
  three requests went about 1 s apart before the fix. The fix is in `core/checks.js`, so the Worker's cron obeys it too.

## 23. gm2's cross-review of NL programs 4–13 and the CBDC loans (04:05)
- **Data fixes for gm1:** CBDC Innovation Loan purpose loses `research` (the page never says it) and gains `unclear:
  [training]`; Employment Enhancement Program industry becomes `not_in` every other sector with `unclear: [11, 31-33]`
  (the page wants forestry, aquaculture, agriculture and fishing employers doing value-added secondary processing, which
  no sector answer settles); CBDC Newcomer's residency item quotes the "non-permanent residents" line it paraphrases;
  Investment Attraction Fund's item quotes "large-scale businesses and foreign direct investment"; Green Transition Fund
  gets its purpose rule once core allows `unclear` on purposes.
- **CBDC contacts (K3):** kept, because they are on official CBDC pages, but labelled with their town and "one of 15 CBDCs
  in the province", so an owner in Corner Brook doesn't read Gander as their office.
- **Programs only your location can be checked against (K4):** within the same fit label they now sort after programs
  with a real match beyond location, and only then by funding type (API §5). "Sort by fit, then non-repayable first"
  still holds between programs with evidence; a location-only non-repayable program no longer outranks a checked loan.
- Agreed as researched: the Job Grant's suspension beating its older "Continuous intake" line, Job Accelerator's
  `unclear` on real estate and call centres, the harvester loan's industry mapping, the youth loan's 18–34 as
  check-it-yourself.

## 24. Real content on screen: gm2's round 5 (04:12)
- gm2 audited all 54 real program pages at 390 with and without a profile: no overflow, no small targets, no errors,
  every printout one page. Three real-content bugs fixed with tests: a phone number split across lines on the
  printout, cards saying "The page doesn't say" with no subject, no line for a program with no stated funding type.
- **R1, the serious one:** a regional office's quote context ran into the next office's phone number, right beside
  "Call this office". **R2:** CanExport's breadcrumb still sat in front of its closed quote. Both are lists with no
  sentence boundary. Decision (API §1): core also builds `blockText` (page text with block edges as newlines, provably
  identical to `pageText` otherwise, so no quote or hash changes) and context stops at block edges too. Contact quotes
  get no context at all.
- **R4:** a check-it-yourself item shows its reason copy only, not the identical `why` line (API §12).
- **R5 (long pages at 390):** left as is; block-bounded context should shorten them a lot. Revisit after the change.

## 25. Contact labels carry no unquoted facts (04:25)
gm1 labelled the CBDC offices "CBDC Central, Grand Falls-Windsor (one of 15 CBDCs in the province)" (K3), and flagged
that the "15" sits elsewhere on the office page, not in the contact's quote. Every fact on screen needs its quote, so
labels keep the office and town only. The point K3 was after, that Gander isn't everyone's office, is made by the app's
own neutral line above multiple contacts: "The program's pages list these offices. Call the one nearest you." (API §12).
gm1's round 3 also confirmed the data end to end: a live dry scan on a copy with CanExport re-hashed read 53 sources
(36 unique URLs) and found 287 of 287 quotes.

## 26. Quote context after block edges (04:35)
gm1's round 4 (QA 44a54f0: core 73/73, every quote verified, no program or saved page touched): across the real
bundle, 249 of 286 quotes now have empty context, contacts have none by rule, no context contains a newline, the
Business Growth offices no longer show each other's numbers, and CanExport's closed quote has no breadcrumb. The
invariant `blockText(html).replace(/\n/g, ' ') === pageText(html)` holds on all 65 saved pages (a check that went red
when `<br>` stopped marking an edge). Remaining readability nit: a few quotes join two blocks into one run-on
("…at this time The application intake period…"); CanExport's intake and location quotes get shortened to one block each
(same saved page, so no hash changes). The CBDC office quotes stay long because they carry the town the label needs (#25).
