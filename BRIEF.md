# Grant Match NL — brief (Onyx, 2026-09-14)

**Prefix** `gm` · **Ports** app 7401, worker 7402, QA 7409 · **Repo** `grant-match-nl` (private) · **Lead effort** xhigh

## What
A small business in Newfoundland and Labrador answers a short profile and gets the public funding programs that
could fit, with **every eligibility fact quoted from the program's own page**. Alexander sells custom software
to NL small businesses (APCO Software Tools); "here's the program that could pay for part of it" is the opener.
It never applies for anyone and never promises eligibility — it says what the page says and "Unknown" where the
page doesn't say.

## Profile (one screen, plain English)
Community (NL list), industry (NAICS 2-digit, plain names), employees, years operating, annual revenue band,
ownership (women-, Indigenous-, youth-, newcomer-, francophone-owned: optional), what the money is for (hire /
wages, equipment, software or digital, export, training, research/innovation, energy efficiency, start-up),
project cost band.

## Programs (research is the job — verify each one live)
Provincial: Department of Industry, Energy and Technology programs (the Business Growth Program / JGRD Central
office context: 709-256-1480), JobsNL / wage subsidies, NL Innovation or digital programs, Business Investment
Corporation-type loans. Federal/regional: ACOA (Business Development Program, Regional Economic Growth through
Innovation), NRC IRAP, CanExport SMEs, Canada Summer Jobs, Futurpreneur, BDC (loans), Community Business
Development Corporations in Central NL, Canada Digital Adoption Program (**closed** — show it as closed with the
source, never as open). Add others you find on official pages.

Store per program in `data/programs/<slug>.json`: official URL, fetched date, raw page saved in
`data/sources/`, type (**non-repayable / repayable / loan / tax credit / wage subsidy**, quoted), intake status and
deadline (quoted or Unknown), max amount and cost share (quoted or Unknown), and each eligibility criterion as a
structured rule + the verbatim quote it came from. A quote that isn't an exact substring of the saved page fails
the build (negative control: plant one, prove the build goes red).

## Matching
Rules only — no model deciding eligibility. Each program shows: **Looks like a fit / Might fit / Doesn't fit**,
the criteria met, missed, and **Unknown** (never counted as met), each with its quote. "Last verified" date;
older than 60 days is flagged. Sort by fit, then non-repayable first. Model use allowed only to help draft the
structured rules during research, with quotes verified; spend cap CA$2.

## Screens
Profile → results → program detail (quotes highlighted, link to the page, "call this office" contact only if on
the official page) → "print for the owner" one-page summary. 390 + 1280. Profiles in tests are SAMPLE
("SAMPLE Auto Service", "SAMPLE Daycare"); one real profile allowed: APCO Software Tools itself.
