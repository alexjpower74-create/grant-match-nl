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
- gm1: core on main (`match.js`, `checks.js`, `profile.js`, `text.js`) and `data/build/sample.json`. The Worker and
  specs assume the SAMPLE fixtures have a program with a phone contact, one without contacts, a closed one, and a
  Looks like a fit program for SAMPLE Auto Service. All four are in PLAN's gm1 list.
