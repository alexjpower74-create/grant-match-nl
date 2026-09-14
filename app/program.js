import { api } from './api.js'
import {
  chrome, esc, link, fitBadge, closedBadge, typePills, intakeText, formatDate, verificationFlags,
  quoteBlock, sourcesIndex, hasSample, sampleBanner, errorNotice, ICONS, UNKNOWN_REASON, UNKNOWN_GROUP, UNKNOWN_GROUP_TITLE, PROFILE_KEYS,
} from './render.js'

chrome()
const params = new URLSearchParams(location.search)
const root = document.getElementById('program')

const FACT_NAMES = {
  funding_types: 'Type of funding',
  max_amount: 'How much',
  cost_share: 'Share of costs covered',
  intake: 'When it takes applications',
}

// API §12 / DECISIONS #25: one neutral line above more than one contact, so no office reads as everyone's office.
const MANY_CONTACTS_TEXT = "The program's pages list these offices. Call the one nearest you."

const pageSilent = `<p class="reason" data-reason="page_silent">${esc(UNKNOWN_REASON.page_silent)}</p>`

function criterion(c, src) {
  const icon = c.status === 'met' ? ICONS.check : c.status === 'missed' ? ICONS.cross : ICONS.question
  const reason = c.status === 'unknown' && c.unknown_reason
    ? `<p class="reason" data-reason="${esc(c.unknown_reason)}">${esc(UNKNOWN_REASON[c.unknown_reason] || 'Unknown')}</p>`
    : ''
  return `<li class="criterion glass criterion-${esc(c.status || 'none')}" data-criterion="${esc(c.id)}">
    <div class="criterion-head">${c.status ? icon : ''}
      <div>
        <p class="criterion-text">${esc(c.text)}</p>
        ${c.why && c.unknown_reason !== 'self_check' ? `<p class="criterion-why">${esc(c.why)}</p>` : ''}
        ${reason}
      </div>
    </div>
    ${quoteBlock(c, src)}
  </li>`
}

function group(id, title, items, src) {
  return `<section aria-labelledby="${id}">
    <h2 id="${id}">${title} <span class="muted">(${items.length})</span></h2>
    ${items.length ? `<ul class="criteria" data-group="${id}">${items.map((c) => criterion(c, src)).join('')}</ul>` : '<p class="group-empty">None.</p>'}
  </section>`
}

// Round 2: Unknown split in two, so an owner sees which ones they can answer themselves.
function unknownGroup(items, src) {
  const part = (key, note) => {
    const list = items.filter((c) => (UNKNOWN_GROUP[c.unknown_reason] || 'ask') === key)
    return `<h3 id="unknown-${key}">${UNKNOWN_GROUP_TITLE[key]} <span class="muted">(${list.length})</span></h3>
      ${note ? `<p class="muted small">${note}</p>` : ''}
      ${list.length ? `<ul class="criteria" data-group="unknown-${key}">${list.map((c) => criterion(c, src)).join('')}</ul>` : '<p class="group-empty">None.</p>'}`
  }
  return `<section aria-labelledby="unknown">
    <h2 id="unknown">Unknown <span class="muted">(${items.length})</span></h2>
    <div data-group="unknown">
      ${part('page', "The page's own wording can't settle these for your answers.")}
      ${part('ask', 'You can answer these yourself, or ask the office.')}
    </div>
  </section>`
}

function facts(r, src) {
  const types = r.funding_types.length
    ? r.funding_types.map((t) => `<p class="fact-value"><span class="pill pill-${esc(t.type)}">${esc(t.label)}</span>${t.applies_to ? ` <span class="muted">${esc(t.applies_to)}</span>` : ''}</p>${quoteBlock(t, src)}`).join('')
    : pageSilent
  const amount = r.max_amount ? `<p class="fact-value">${esc(r.max_amount.text)}</p>${quoteBlock(r.max_amount, src)}` : pageSilent
  const share = r.cost_share ? `<p class="fact-value">${esc(r.cost_share.text)}</p>${quoteBlock(r.cost_share, src)}` : pageSilent

  let intake
  if (r.intake.status === 'closed') {
    intake = `<p class="fact-value" data-closed>Closed. Not taking applications right now.</p>${r.intake.note ? `<p class="muted">${esc(r.intake.note)}</p>` : ''}${quoteBlock(r.intake.quote, src)}`
  } else if (r.intake.status === 'unknown') {
    intake = `<p class="fact-value" data-reason="page_silent">${esc(intakeText(r.intake, r.contacts))}</p>`
  } else {
    intake = `<p class="fact-value">${esc(intakeText(r.intake))}</p>${quoteBlock(r.intake.quote, src)}`
  }
  if (r.intake.deadline) {
    intake += `<p class="fact-value">Deadline: ${esc(formatDate(r.intake.deadline.date))}</p>${quoteBlock(r.intake.deadline, src)}`
  }

  return `
    <div class="fact"><h3>${FACT_NAMES.funding_types}</h3>${types}</div>
    <div class="fact"><h3>${FACT_NAMES.max_amount}</h3>${amount}</div>
    <div class="fact"><h3>${FACT_NAMES.cost_share}</h3>${share}</div>
    <div class="fact"><h3>${FACT_NAMES.intake}</h3>${intake}</div>`
}

function contacts(r, src) {
  if (!r.contacts.length) return ''
  return `<section class="panel glass" aria-labelledby="contacts-heading">
    <h2 id="contacts-heading">Talk to someone</h2>
    ${r.contacts.length > 1 ? `<p class="muted" data-contacts-note>${esc(MANY_CONTACTS_TEXT)}</p>` : ''}
    <div class="contacts">
      ${r.contacts.map((c) => `<div>
        <p class="fact-value">${esc(c.label)}</p>
        ${c.phone ? `<a class="btn" data-call href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${ICONS.phone}Call this office: ${esc(c.phone)}</a>` : ''}
        ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}
        ${quoteBlock(c, src)}
      </div>`).join('')}
    </div>
  </section>`
}

async function main() {
  const slug = params.get('slug')
  const hasAnswers = PROFILE_KEYS.some((k) => params.has(k))
  const back = hasAnswers ? link('results.html', {}, params) : link('index.html', {}, params)
  if (!slug) {
    errorNotice(root, 'No program was picked.')
    return
  }
  let data
  try {
    data = await (await api()).program(slug, params)
  } catch (err) {
    errorNotice(root, err.status === 404 ? 'We have no program by that name.' : err.message)
    root.insertAdjacentHTML('beforeend', `<div class="actions"><a class="btn" href="${esc(back)}">${ICONS.back}Back</a></div>`)
    return
  }
  const r = data.result
  const src = sourcesIndex(r)
  document.title = `${r.name} — Grant Match NL`
  sampleBanner(hasSample([r]))

  const byStatus = (s) => r.criteria.filter((c) => c.status === s)
  const criteriaHtml = r.fit || r.criteria.some((c) => c.status)
    ? group('matches', 'What matches', byStatus('met'), src) +
      group('doesnt-match', "What doesn't match", byStatus('missed'), src) +
      unknownGroup(byStatus('unknown'), src)
    : `<section aria-labelledby="asks"><h2 id="asks">What the page asks for</h2>
        <p class="muted">Answer the questions to see which of these match your business.</p>
        <ul class="criteria">${r.criteria.map((c) => criterion(c, src)).join('')}</ul></section>`

  const silent = r.unknown_facts.length
    ? `<section class="panel glass" aria-labelledby="silent-heading">
        <h2 id="silent-heading">What the pages don't say</h2>
        <ul class="why-list" id="unknown-facts">${r.unknown_facts.map((f) => `<li>${esc(FACT_NAMES[f] || f)}: <span data-reason="page_silent">${esc(UNKNOWN_REASON.page_silent)}</span></li>`).join('')}</ul>
      </section>`
    : ''

  root.innerHTML = `
    <div class="actions">
      <a class="btn" href="${esc(back)}">${ICONS.back}${hasAnswers ? 'Back to results' : 'Answer the questions'}</a>
      ${hasAnswers ? `<a class="btn" href="${esc(link('index.html', {}, params))}">Change answers</a>` : ''}
    </div>
    <div class="card-top">${r.intake.status === 'closed' ? closedBadge() : ''}${fitBadge(r.fit)}${typePills(r.funding_types)}</div>
    <h1>${esc(r.name)}</h1>
    <p class="lede">${esc(r.provider)}</p>
    ${r.fit ? `<ul class="why-list" id="fit-why">${r.fit.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    ${r.intake.status !== 'closed' ? `<p class="intake-line" id="intake-line">${esc(intakeText(r.intake, r.contacts))}</p>` : ''}
    <div class="detail-grid">
      <div class="detail-main">
        ${quoteBlock(r.summary, src)}
        ${criteriaHtml}
        ${silent}
      </div>
      <aside class="detail-side">
        <section class="panel glass" aria-label="Program facts">${facts(r, src)}</section>
        <div class="actions">
          <a class="btn btn-primary" id="official-link" href="${esc(r.url)}" target="_blank" rel="noopener">${ICONS.external}Open the official page</a>
        </div>
        ${contacts(r, src)}
        <section class="panel glass" aria-labelledby="verified-heading">
          <h2 id="verified-heading">Last verified ${esc(formatDate(r.verification.last_verified))}</h2>
          ${r.fit ? '' : verificationFlags(r.verification)}
          <ol class="sources">
            ${r.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="muted small">${esc(s.publisher)} · saved ${esc(formatDate(s.fetched_at))}</span></li>`).join('')}
          </ol>
        </section>
      </aside>
    </div>`
}

main()
