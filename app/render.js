// Shared renderers. Every string that came from data goes through esc().

export const FOOTER_LINE = "Grant Match NL shows what each program's own page says. It never applies for you and can't promise you qualify."

export const UNKNOWN_REASON = {
  self_check: 'Unknown: check this yourself',
  not_answered: "Unknown: you didn't answer this or weren't sure",
  band_straddles: "Unknown: your answer is close to the page's limit",
  unclear: "Unknown: the page's wording doesn't settle it for your answer",
  page_silent: "Unknown: the page doesn't say",
}

// Round 2 (API §6, §12): which Unknowns the page leaves open, and which the owner can answer. Mirrors core's
// UNKNOWN_GROUP; the app tests compare these groups with core's counts, so the two can't drift silently.
export const UNKNOWN_GROUP = { unclear: 'page', self_check: 'ask', not_answered: 'ask', band_straddles: 'ask' }
export const UNKNOWN_GROUP_TITLE = { page: "The page doesn't say", ask: "We didn't ask you" }

export const FIT_CLASS = { 'Looks like a fit': 'looks', 'Might fit': 'might', 'Not enough to go on': 'notenough', "Doesn't fit": 'doesnt' }

// Carried across every internal link (docs/API.md §12).
export const CARRY = [
  'name',
  'community',
  'industry',
  'structure',
  'employees',
  'years',
  'revenue',
  'owners',
  'purposes',
  'cost',
  'mock',
  'api',
  'now',
  'data',
]
export const PROFILE_KEYS = CARRY.slice(0, 10)

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function carried(params = new URLSearchParams(location.search), keys = CARRY) {
  const out = new URLSearchParams()
  for (const k of keys) if (params.has(k)) out.set(k, params.get(k))
  return out
}

export function link(page, extra = {}, params) {
  const q = carried(params)
  for (const [k, v] of Object.entries(extra)) q.set(k, v)
  const s = q.toString().replace(/%2C/gi, ',')
  return s ? `${page}?${s}` : page
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/St_Johns', month: 'short', day: 'numeric', year: 'numeric' })

// "Sep 14, 2026". A bare YYYY-MM-DD is a calendar date already in Newfoundland time.
export function formatDate(value) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(
      Date.UTC(y, m - 1, d),
    )
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d)
}

export const ICONS = {
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  question:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.2h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/></svg>',
  external:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
  print:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
}

export function fitBadge(fit) {
  if (!fit) return ''
  const cls = FIT_CLASS[fit.label] || 'might'
  const icon = cls === 'looks' ? ICONS.check : cls === 'doesnt' ? ICONS.cross : cls === 'notenough' ? ICONS.dash : ICONS.question
  return `<span class="badge badge-${cls}" data-fit="${esc(fit.label)}">${icon}${esc(fit.label)}</span>`
}

export function closedBadge() {
  return `<span class="badge badge-closed">Closed</span>`
}

export function typePills(types) {
  if (!types?.length) return ''
  const seen = new Set()
  const pills = types
    .filter((t) => !seen.has(t.type) && seen.add(t.type))
    .map((t) => `<span class="pill pill-${esc(t.type)}">${esc(t.label)}</span>`)
  return `<span class="pills">${pills.join('')}</span>`
}

// On its own line an unknown intake needs its subject: "The page doesn't say" alone doesn't say what. Round 2: intake
// timing is not part of the fit label, so the line also says what to do about it.
export function intakeText(intake, contacts = []) {
  if (!intake) return ''
  if (intake.status === 'unknown') {
    return `When it takes applications: the page doesn't say — ${contacts.length ? 'call the office to confirm' : 'check the official page to confirm'}`
  }
  let text = intake.label
  if (intake.status === 'open' && intake.deadline?.date) text += ` until ${formatDate(intake.deadline.date)}`
  return text
}

export const TYPE_UNKNOWN_TEXT = "Type of funding: the page doesn't say"

export function amountText(result) {
  return result.max_amount ? result.max_amount.text : "Amount: the page doesn't say"
}

// Round 2: the Unknowns split into what the page doesn't say and what the form didn't ask the owner.
export function countsText(counts) {
  return `${counts.met} match · ${counts.missed} doesn't · ${counts.unknown_page ?? 0} the page doesn't say · ${counts.unknown_ask ?? 0} we didn't ask you`
}

// Round 2: a card's single strongest quoted match (core's top_match), so the list says why without opening the program.
export function topMatchLine(r) {
  const m = r.top_match
  if (!m) return ''
  return `<p class="card-match" data-top-match="${esc(m.id)}">${ICONS.check}<span class="card-match-body"><span class="card-match-text">${esc(m.text)}</span><q class="card-match-quote">${esc(m.quote)}</q></span></p>`
}

export function staleText(v) {
  return `Last verified ${formatDate(v.last_verified)}, more than 60 days ago. Check the official page.`
}

export const NEEDS_REVIEW_TEXT = 'The page has changed or gone since we checked it. Check the official page.'

export function verificationFlags(v) {
  if (!v) return ''
  const out = []
  if (v.stale) out.push(`<p class="flag" data-flag="stale">${ICONS.warn}<span>${esc(staleText(v))}</span></p>`)
  if (v.needs_review) out.push(`<p class="flag" data-flag="needs-review">${ICONS.warn}<span>${esc(NEEDS_REVIEW_TEXT)}</span></p>`)
  return out.join('')
}

// A Quote as a blockquote: muted context, the quote itself in <mark>, then its page.
export function quoteBlock(q, sourcesById = {}) {
  if (!q || !q.quote) return ''
  const title = sourcesById[q.source]?.title || q.source_url || 'the official page'
  // core's contextFor keeps the neighbouring whitespace, so before + quote + after is exact page text: join as is.
  const before = esc(q.context?.before ?? '')
  const after = esc(q.context?.after ?? '')
  return `<blockquote class="quote" data-source="${esc(q.source)}">
    <p>${before}<mark>${esc(q.quote)}</mark>${after}</p>
    <footer>From <a href="${esc(q.source_url)}" target="_blank" rel="noopener">${esc(title)}</a></footer>
  </blockquote>`
}

export function sourcesIndex(result) {
  return Object.fromEntries((result.sources || []).map((s) => [s.id, s]))
}

export function hasSample(results) {
  return results.some((r) => r && r.sample === true)
}

export function sampleBanner(show) {
  const el = document.getElementById('sample-banner')
  if (el) el.hidden = !show
}

export function chrome() {
  const header = document.getElementById('site-header')
  if (header) {
    header.innerHTML = `<div class="wrap">
      <a class="wordmark" href="${esc(link('index.html', {}, carried(undefined, ['mock', 'api', 'now', 'data'])))}">Grant Match NL</a>
      <nav class="site-nav" aria-label="Site"><a href="${esc(link('about.html', {}, carried(undefined, ['mock', 'api', 'now', 'data'])))}">How it works</a></nav>
    </div>
    <div class="wrap"><p id="sample-banner" class="sample-banner" hidden>SAMPLE data: these programs are made up for testing. They are not real.</p></div>`
  }
  const footer = document.getElementById('site-footer')
  if (footer) footer.innerHTML = `<div class="wrap"><p>${esc(FOOTER_LINE)}</p></div>`
}

export function errorNotice(el, message) {
  el.innerHTML = `<div class="notice notice-error" role="alert">${esc(message)}</div>`
}
