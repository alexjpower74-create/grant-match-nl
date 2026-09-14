# Grant Match NL

A Newfoundland and Labrador small business answers one short profile and gets the public funding programs that could
fit, with every eligibility fact quoted word for word from the program's own page. It never applies for anyone and
never promises eligibility: it says what the page says, and "Unknown" where the page doesn't settle it.

Built overnight on 2026-09-14 for APCO Software Tools. **Local only: nothing is deployed, nothing is sent.**

## Run it locally

```sh
npm install                                   # Playwright for the tests (wrangler must be on PATH)
cp worker/.dev.vars.example worker/.dev.vars  # ADMIN_TOKEN=local-dev-token, ALLOW_NOW=1
npm --prefix worker run migrate:local         # local D1 tables (live-check runs only; profiles are never stored)
npm run dev:worker                            # verifies every quote, builds data/build/, API on http://127.0.0.1:7402
npm run dev:app                               # app on http://127.0.0.1:7401
npm run scan                                  # re-reads every official page politely and records the check in the local Worker
```

Open **http://127.0.0.1:7401**. `?mock=1` runs the same matching engine in the browser on SAMPLE programs;
`?mock=1&data=real` runs it on the real programs with no Worker. `npm run check:data` verifies every quote without
writing anything; `npm run scan -- --dry` re-reads the pages without touching the Worker.

## What is real and what is SAMPLE

- **Real:** the 27 programs below, researched from official pages only. Each page is saved byte for byte in
  `data/sources/` (the evidence) with its URL, fetch time and hash. Every fact shown (funding type, intake, amount,
  cost share, each eligibility rule, each phone number) carries a quote that must be an exact substring of that
  saved page's text; `npm run check:data` fails the build otherwise. Numbers in a rule must also be written inside
  its own quote. Anything a page doesn't say is **Unknown**, and Unknown is never counted as met.
- **SAMPLE:** 10 made-up programs in `core/tests/fixtures/` (names start `SAMPLE `, pages on `sample.invalid`) for
  tests and `?mock=1`, and the test profiles "SAMPLE Auto Service" and "SAMPLE Daycare". A banner says so on screen.
- **The one real profile:** APCO Software Tools (DECISIONS.md #14), used for real-data screenshots; its structure,
  purpose and community are the lead's reading, not Alexander's answers.

## The programs

Checked against their live pages on 2026-09-14. The weekly live check (Worker cron, or `npm run scan`) flags a
program when its page changes or disappears, and anything verified more than 60 days ago is flagged on screen.
27 programs, 154 eligibility criteria, 53 saved official pages, 288 quotes.

**Newfoundland and Labrador (19)**

| Program | Provider | Type | Intake (as the page says) | Most you can get | File |
|---|---|---|---|---|---|
| Apprenticeship Wage Subsidy (AWS) | Government of Newfoundland and Labrador, Department of Education and Early Childhood Development, Apprenticeship and Trades Certification Division | Wage subsidy | Page doesn't say | — | `nl-apprenticeship-wage-subsidy` |
| Business Growth Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Non-repayable | Page doesn't say | Normally up to $200,000 over 24 months ($100,000 per year) per project, per company | `nl-business-growth-program` |
| Business Investment Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Loan | Page doesn't say | — | `nl-business-investment-program` |
| Canada-Newfoundland and Labrador Job Grant | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Page doesn't say | Closed | Up to $10,000 a year to train an existing employee, or up to $15,000 to train an unemployed participant | `nl-canada-nl-job-grant` |
| CBDC First Time Entrepreneur Loan | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $150,000 (more in some cases) | `nl-cbdc-first-time-entrepreneur-loan` |
| CBDC General Business Loan | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $150,000 (more in some cases) | `nl-cbdc-general-business-loan` |
| CBDC Innovation Loan | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $150,000 per borrower (more in some cases) | `nl-cbdc-innovation-loan` |
| CBDC Newcomer Loan Program | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $20,000 | `nl-cbdc-newcomer-loan-program` |
| CBDC Social Enterprise Loan | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $150,000 per applicant (more in some cases) | `nl-cbdc-social-enterprise-loan` |
| CBDC Youth Loan Program | Community Business Development Corporations (CBDCs), Newfoundland and Labrador offices | Loan | Page doesn't say | Up to $150,000 (as the CBDC office pages describe it) | `nl-cbdc-youth-loan-program` |
| Employment Enhancement Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Wage subsidy | Page doesn't say | — | `nl-employment-enhancement-program` |
| Green Transition Fund Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Non-repayable | Any time | Requests of $75,000 to $3 million (Indigenous and rural projects have no minimum) | `nl-green-transition-fund` |
| Harvester Enterprise Loan Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Loan | Page doesn't say | Down payment loans of up to 15% of costs, to a maximum of $450,000 | `nl-harvester-enterprise-loan-program` |
| Innovation and Business Development Fund | Government of Newfoundland and Labrador, Department of Energy and Mines | Page doesn't say | Page doesn't say | — | `nl-innovation-and-business-development-fund` |
| Investment Attraction Fund | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Loan | Page doesn't say | — | `nl-investment-attraction-fund` |
| Job Accelerator and Growth Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Non-repayable | Page doesn't say | — | `nl-job-accelerator-and-growth-program` |
| JobsNL Wage Subsidy | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Wage subsidy | Page doesn't say | — | `nl-jobsnl-wage-subsidy` |
| Research and Innovation Program | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Non-repayable | Page doesn't say | — | `nl-research-and-innovation-program` |
| Summer Employment Program for Students | Government of Newfoundland and Labrador, Department of Jobs, Growth and Rural Development | Wage subsidy | Taking applications (deadline 2026-02-19) | Private sector employers: up to $4,032 per full-time equivalent approval | `nl-summer-employment-program-for-students` |

**Federal and national (8)**

| Program | Provider | Type | Intake (as the page says) | Most you can get | File |
|---|---|---|---|---|---|
| Business Development Program | Atlantic Canada Opportunities Agency | Repayable | Page doesn't say | — | `ca-acoa-business-development-program` |
| Regional Economic Growth through Innovation: Business Scale-up and Productivity | Atlantic Canada Opportunities Agency | Repayable | Page doesn't say | — | `ca-acoa-regi` |
| Canada Digital Adoption Program (CDAP) | Innovation, Science and Economic Development Canada | Page doesn't say | Closed | — | `ca-canada-digital-adoption-program` |
| Canada Small Business Financing Program (CSBFP) | Innovation, Science and Economic Development Canada | Loan | Page doesn't say | Up to $1.15 million per borrower (up to $1,000,000 in term loans and $150,000 in lines of credit) | `ca-canada-small-business-financing-program` |
| Canada Summer Jobs | Employment and Social Development Canada | Wage subsidy | Closed | — | `ca-canada-summer-jobs` |
| CanExport SMEs | Trade Commissioner Service, Global Affairs Canada | Page doesn't say | Closed (deadline 2026-08-31) | Up to $50,000 per project | `ca-canexport-smes` |
| NRC Industrial Research Assistance Program (NRC IRAP) | National Research Council Canada | Page doesn't say | Page doesn't say | — | `ca-nrc-irap` |
| Scientific Research and Experimental Development (SR&ED) investment tax credit | Canada Revenue Agency | Tax credit | Page doesn't say | — | `ca-sred-investment-tax-credit` |

**Left out, and why** (also on the About page):
- **BDC loans, Futurpreneur:** their terms forbid copying or storing their pages. **Ulnooweg Development Group:** no terms
  published, "All rights reserved". **takeCHARGE Business Efficiency Program:** terms allow personal, non-commercial
  viewing only. Each needs written permission before it can be added.
- **NLOWE (women entrepreneurs' loan):** nlowe.org refused connections from this machine all night; not researched.
- **Regional Development Fund, Community Capacity Building:** for non-profit organizations only.
  **Horizon TNL (formerly RDÉE TNL):** gives advice and points to Futurpreneur; it doesn't fund.

## How matching works

Rules only, no model. Each criterion is a structured rule plus the quote it came from, evaluated against the profile
as met, missed or Unknown (the page's wording can't settle it, the answer's band sits on both sides of a limit, you
didn't answer, or it's something to check yourself). **Doesn't fit** = something is missed or the program is closed.
**Looks like a fit** = everything your answers can check matches, at least one thing beyond location, the page says
it's taking applications, and the page is fresh and unchanged. **Might fit** = everything else. Sorted by fit, then
programs with a real match before location-only ones, then money you don't pay back first. Most provincial pages don't
say when applications are taken, so most real results are Might fit: that's the pages, not a bug. Worked examples:
`docs/RULES.md`; every judgement call: `DECISIONS.md`.

## Tests

Final QA in a worktree pinned to **`952c679`** (main after the last merge), QA ports 7406–7409:

| Suite | Command | Result |
|---|---|---|
| Every quote on its saved page | `npm run check:data` | 27 real + 10 SAMPLE programs, every quote verified |
| Core: page text, quote checks, profile, matching, live checks, scan | `npm run test:core` | 73 pass, 0 fail |
| Worker API on SAMPLE data (own `wrangler dev --local`, fixture server, cron trigger) | `npm run test:worker` | 15 pass, 0 fail, 1 skipped (the real-data test, run next) |
| Worker API on the real data | `npm run build:data && GM_REAL=1 npm --prefix worker test` | 1 / 1 (27 programs answer, every criterion quoted, CDAP closed) |
| App, Playwright: chromium + webkit, phone 390 + desktop 1280, real taps and typing | `npm run test:app` | 100 pass, 0 fail, 16 skipped by design |
| App against a real local Worker | `GM_API=http://127.0.0.1:7402 npx playwright test -c app/playwright.config.mjs live` | 4 / 4 on SAMPLE data, 4 / 4 on real data |

The skips are by design: 390-only tap-target and scroll checks don't run at 1280, the one-page PDF check runs in
chromium only, and the live spec needs `GM_API`. Every important check was made to fail once on purpose (a planted
quote turns the build red, Unknown counted as met turns the fit test red, a 30 px chip turns the tap-target test red,
and about forty more); `docs/build-report.md` lists them.

## What deploying needs

`docs/DEPLOY.md`: D1 database `grant-match-nl` (+ `worker/migrations`, applied remotely), secret `ADMIN_TOKEN`, Worker
`grant-match-nl` with cron `15 10 * * 1` (Mondays 07:45 NDT), the static `app/` with `api-base` pointed at the
Worker, a domain such as `grants.apcosoftwaretools.ca`. **Before any public deploy, decide DECISIONS.md #12**:
canada.ca, nrc.canada.ca and ised-isde.canada.ca allow non-commercial reproduction only.

## Where to pick this up

1. **Decide DECISIONS.md #12** (quoting Government of Canada pages on a commercial site): quote as review, ask the
   publishers, or prefer Open Government Licence pages.
2. **Permissions** that would add programs: BDC, Futurpreneur (youth), Ulnooweg (Indigenous), takeCHARGE (energy);
   check NLOWE (women) from another network.
3. **Readability** (DECISIONS #27): some program pages are long at phone width because long quotes repeat; three
   federal list quotes still join a lead-in with its items. One quote per fact in the data, or a collapsed quote in the
   app, fixes both.
4. **Re-research** a program when the live check flags it, and every two months regardless: `PLAN.md`, "How to research
   a program". Canada Summer Jobs, the Summer Employment Program for Students and CanExport SMEs need new records when
   their next intakes are posted.
5. **Deploy** with `docs/DEPLOY.md` when you say so.

## Map

`core/` matching engine, quote checks, live checks (pure JS, runs in Node and the Worker) · `data/programs/` one file
per program · `data/sources/` saved official pages · `data/reference/` communities (Statistics Canada 2021) and
industries (NAICS 2022) · `scripts/` build, fetch, show-text, scan · `worker/` API + D1 · `app/` the pages ·
`docs/API.md` the contract · `PLAN.md` how it was built · `docs/build-report.md` tests and negative controls.
