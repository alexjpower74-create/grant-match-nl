# How Grant Match NL decides a fit

Plain English for reviewers and anyone checking the engine (`core/match.js`). The contract is `docs/API.md` §4–5;
this file explains it with one worked example each. Nothing here uses a model: every decision is a rule you can
follow by hand.

## The three answers for one condition

Every eligibility condition on a program's page (a **criterion**) comes out as one of:

- **Met**: your answers satisfy it for certain.
- **Missed**: your answers can't satisfy it.
- **Unknown**: we can't tell. There are three reasons, and each is shown to the owner:
  - *check this yourself*: the page states something your answers can't settle ("have a business plan");
  - *you didn't answer this*: you skipped the question, chose "Prefer not to say", or chose "Not sure";
  - *your answer is close to the page's limit*: your band sits on both sides of the page's number.

**Unknown is never counted as met.**

## The rule kinds

### location
The page says where the business has to be. Three shapes: the whole province, a list of census divisions, or a
list of communities. Anywhere in Newfoundland and Labrador meets a province rule.

> Page: "for businesses and community groups in Census Divisions 6, 7 and 8". You picked Gander, which the 2021
> Census puts in Division No. 6. **Met.** If you had picked St. John's (Division No. 1): **Missed.**

### industry
The page includes or leaves out NAICS sectors, by name. We only use this when the page names the sector plainly.
"Technology-driven firms" is a *check this yourself* item, never a guessed list.

> Page: "Retail trade and Accommodation and food services businesses are not eligible." Rule: not in 44-45, 72.
> You picked Other services (81). **Met.** A store (44-45): **Missed**, "The page leaves out Retail trade."

### structure
Sole proprietor, partnership, incorporated company, co-operative, non-profit, not registered yet. "Not sure" is
Unknown (you didn't answer).

> Page: "Sole proprietors, partnerships or corporations". You said Incorporated company. **Met.**

### unclear (on structure, industry and purpose rules)
For **purpose**, a match wins: if any purpose you picked is one the page covers, the rule is **Met**. Otherwise, if any
you picked is on the unclear list, it's **Unknown**. Only when neither holds is it **Missed**.

> Green Transition Fund: "the greening of commercial operations". Rule: energy efficiency; unclear equipment, software,
> research, export, hiring, training, starting a business (greening can involve any of them, and the page doesn't
> say which count). Energy efficiency: **Met**. Equipment: **Unknown**, "The page's wording doesn't settle this for
> Equipment."

For structure and industry:
Sometimes the page's wording settles some answers but not others. Those answers go on the rule's `unclear` list
and come out as **Unknown: the page's wording doesn't settle it for your answer**. Never a guessed met or missed.
An answer can't be both on the list and in the rule's own set.

> Page: "Private or not-for-profit sector employers that are incorporated or sole proprietorships." Rule: in
> corporation, sole proprietor; unclear co-operative, non-profit (a co-op or non-profit may or may not be
> incorporated). Incorporated company: **Met**. Partnership: **Missed**. Co-operative: **Unknown**, "The page's
> wording doesn't settle this for Co-operative." Like any Unknown it stops Looks like a fit.

### ownership
The page is for businesses owned by women, Indigenous people, a young person, a newcomer, or francophones. Leaving the
question blank is Unknown. "None of these" means no to every group, so it misses an ownership rule.

> Page: "a loan open to businesses owned by women". You ticked Women. **Met.** You ticked None of these:
> **Missed.** You skipped the question: **Unknown: you didn't answer this or weren't sure.**

Only when the page's definition matches ours. A page that says "youth aged 18 to 29" doesn't match our "18 to 39",
so that condition is *check this yourself*.

### purpose
What the money is for. Met when any of your purposes is one the page covers.

> Page: "Loans can be used to buy equipment for the business." You picked Equipment and Software. **Met.**

### self_check
Everything real on the page that no profile answer can settle: a business plan, good standing, commercial
viability, "a clear benefit to the local community". Always **Unknown: check this yourself**.

### Number rules: employees, years operating, revenue, project cost
The page's own number and wording become bounds: *at least* (≥), *more than* (>), *up to* / *or fewer* (≤),
*fewer than* / *under* / *less than* (<). A rule can have a lower and an upper bound. The number in a rule must be
written in its quote, or the build fails.

### "Normally" limits
Some pages soften a limit: "Eligible applicants must normally: … have fewer than 100 employees and less than $10
million in sales." Such a rule carries `normally`. An answer inside the limit is **Met**, as usual. An answer outside
it is **Unknown: the page's wording doesn't settle it for your answer**, with "The page says this limit applies
normally, so ask the office.", never Missed. A band on both sides of the limit stays *close to the page's limit*.

> Business Investment Program, "must normally … have fewer than 100 employees". 6 people: **Met**. 120 people:
> **Unknown**. Without "normally" on the page, 120 people would be **Missed** and the program Doesn't fit.

## Interval logic: how a band is compared with a limit

Most answers are bands, not exact numbers. Revenue "$500,000 to $1 million" means any value from $500,000 up to (but
not including) $1,000,000. We treat each band as a range of possible values and ask:

- **Met** if *every* value in your band satisfies the page's limit;
- **Missed** if *no* value does;
- **Unknown: your answer is close to the page's limit** otherwise (some values do, some don't).

People working is an exact number, so it's always met or missed.

> **Met.** Page: "annual revenue of less than $10 million". Your band $500,000–$1 million is entirely under $10
> million.
>
> **Straddles.** Page: "yearly sales of up to $5,000,000". Your band $2 million–$10 million includes $3 million
> (fits) and $7 million (doesn't). Unknown: "Your revenue band ($2 million to $10 million) is on both sides of the
> page's limit."
>
> **Edges count.** Page: "operating for 24 months or less". Band "1 to 2 years" is 12 months up to, but not
> including, 24 months. Every value is ≤ 24, so **Met**. Band "2 to 3 years" starts at exactly 24 months (fits) and
> goes to 36 (doesn't), so it **straddles**. A page in years ("2 years or less") is converted to months (× 12) first.

## The fit label for a whole program

Decided in this order. The first one that applies wins. (Round 2, 2026-09-14: DECISIONS #29.)

1. **Doesn't fit, closed.** The page says it's closed, or its deadline has passed. A deadline counts as passed from
   the day after, in Newfoundland time. Closed programs are listed separately.
2. **Doesn't fit.** Any condition is missed.
3. **Not enough to go on.** Nothing matched at all: none of the page's conditions could be checked as met against your
   answers. It sorts below Might fit.
4. **Looks like a fit.** All of these must be true:
   - every condition your answers can check is met (*check this yourself* items don't block this, but they are
     always listed as Unknown);
   - at least one met condition is something other than location;
   - it was verified in the last 60 days;
   - the live re-check hasn't found the page changed.
5. **Might fit.** Everything else: something beyond location matched but an Unknown remains, only your location matched,
   a stale check (more than 60 days), or a changed page.

**When a program takes applications is not a condition.** Open, any time, not open yet, or not stated: it's shown on its
own line ("When it takes applications: the page doesn't say — call the office to confirm") and never moves a program
between labels. Only closed does.

Every label comes with a list of reasons it isn't better.

> **Worked example: SAMPLE Growth Grant for SAMPLE Auto Service.** The business is in Grand Falls-Windsor, is
> incorporated, has 6 people and a $25,000–$50,000 project for equipment and software. Conditions: location (met),
> structure (met), fewer than 100 employees (met), equipment or digital (met), project at least $10,000 (met),
> business plan (*check this yourself*). Last verified 13 days ago. Label: **Looks like a fit**, with "Check 1 thing
> yourself." The card's strongest match is the purpose condition, with its quote.
>
> The same program for SAMPLE Daycare (hiring and training): the purpose condition is missed, so **Doesn't fit**.
>
> **SAMPLE Community Fund** has only a location (Census Divisions 6, 7 and 8) and a *check this yourself* item: your
> location matches, nothing else can, so **Might fit** with "Only your location matches." A program whose only condition
> is a *check this yourself* item matches nothing, so **Not enough to go on**.

## Freshness

- **Last verified** is the last time the page was fetched and every quote was found on it: when we saved it, or a
  newer successful live re-check. A program with several pages uses the oldest.
- **Stale** means more than 60 whole days before now. A stale program can't show Looks like a fit.
- **Needs review** means the latest live re-check that could read one of its pages didn't find every quote, or the
  page now answers "not found" (404) or "gone" (410). A check that fails for any other reason (a timeout, a server
  error, robots.txt saying no) tells us nothing about the page, so it keeps whatever the last real check found
  instead of clearing it. A program that needs review can't show Looks like a fit until someone re-reads the page.
  The owner sees "The page has changed or gone since we checked it. Check the official page."

## Sort order

Open programs: Looks like a fit, then Might fit, then Not enough to go on, then Doesn't fit. Within a label, money you
don't pay back first (non-repayable, then repayable, then wage subsidy and tax credit, then loan, then not stated), then
the most matches, then fewer missed, then fewer Unknown, then by name. So a loan with more matches still sits below a
non-repayable program with the same label. Closed programs come last, by name.

## Counts

`counts.unknown` splits into `unknown_page` (the page's own wording can't settle your answer: reason *unclear*) and
`unknown_ask` (things you can answer: *check this yourself*, a question you skipped or weren't sure about, a band on both
sides of a limit). The card reads "5 match · 0 doesn't · 0 the page doesn't say · 1 we didn't ask you" for the Growth
Grant example above. `counts.self_check` says how many of `unknown_ask` are *check this yourself* items.
