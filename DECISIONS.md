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
