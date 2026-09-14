import { api } from './api.js'
import {
  chrome, esc, link, fitBadge, closedBadge, typePills, intakeText, amountText, countsText, TYPE_UNKNOWN_TEXT,
  verificationFlags, quoteBlock, sourcesIndex, hasSample, sampleBanner, errorNotice, ICONS, PROFILE_KEYS,
} from './render.js'

chrome()
const params = new URLSearchParams(location.search)
const root = document.getElementById('results')

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function card(r) {
  const href = link('program.html', { slug: r.slug }, params)
  return `<li>
    <a class="card glass" href="${esc(href)}" data-slug="${esc(r.slug)}">
      <div class="card-top">${fitBadge(r.fit)}${typePills(r.funding_types)}</div>
      <h3 class="card-name">${esc(r.name)}</h3>
      <p class="card-provider">${esc(r.provider)}</p>
      <div class="card-facts">
        ${r.funding_types.length ? '' : `<span data-type-unknown>${esc(TYPE_UNKNOWN_TEXT)}</span>`}
        <span>${esc(amountText(r))}</span>
        <span>${esc(intakeText(r.intake))}</span>
        <span class="card-counts">${esc(countsText(r.counts))}</span>
      </div>
      ${verificationFlags(r.verification)}
    </a>
  </li>`
}

// A closed card is one link too, so its quote carries no inner link (no nested anchors).
function closedCard(r) {
  const href = link('program.html', { slug: r.slug }, params)
  const q = r.intake.quote ? { ...r.intake.quote } : null
  const title = q ? sourcesIndex(r)[q.source]?.title || 'the official page' : ''
  return `<li>
    <a class="card glass" href="${esc(href)}" data-slug="${esc(r.slug)}">
      <div class="card-top">${closedBadge()}${typePills(r.funding_types)}</div>
      <h3 class="card-name">${esc(r.name)}</h3>
      <p class="card-provider">${esc(r.provider)}</p>
      <p class="card-facts">Closed. Not taking applications right now.${r.intake.note ? ` ${esc(r.intake.note)}` : ''}</p>
      ${q ? quoteBlock(q).replace(/<footer>[\s\S]*<\/footer>/, `<footer>From ${esc(title)}</footer>`) : ''}
    </a>
  </li>`
}

async function main() {
  const change = link('index.html', {}, params)
  const hasAnswers = PROFILE_KEYS.some((k) => params.has(k))
  if (!hasAnswers) {
    root.innerHTML = `<p>Answer the questions first.</p><div class="actions"><a class="btn btn-primary" href="${esc(change)}">Answer the questions</a></div>`
    return
  }
  let data
  try {
    data = await (await api()).match(params)
  } catch (err) {
    const list = err.body?.errors?.length ? `<ul>${err.body.errors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>` : ''
    errorNotice(root, err.message)
    root.insertAdjacentHTML('beforeend', `${list}<div class="actions"><a class="btn" href="${esc(change)}">${ICONS.back}Change answers</a></div>`)
    return
  }
  const { open, closed, counts } = data
  sampleBanner(hasSample([...open, ...closed]))
  const couldFit = counts.looks + counts.might
  const who = data.profile.name ? ` for ${esc(data.profile.name)}` : ''

  root.innerHTML = `
    <p class="summary-line" id="summary-line">${esc(plural(couldFit, 'program could fit', 'programs could fit'))}${who}</p>
    <p class="summary-counts" id="summary-counts">
      <span class="badge badge-looks">${counts.looks} Looks like a fit</span>
      <span class="badge badge-might">${counts.might} Might fit</span>
      <span class="badge badge-doesnt">${counts.doesnt} Doesn't fit</span>
      <span class="badge badge-closed">${counts.closed} Closed</span>
    </p>
    <p class="muted small">Sorted by fit, then programs that match more than your location, then money you don't pay back first. Unknown is never counted as a match.</p>
    <div class="actions">
      <a class="btn" href="${esc(change)}" id="change-answers">${ICONS.back}Change answers</a>
      <a class="btn" href="${esc(link('print.html', {}, params))}" id="print-link">${ICONS.print}Print for the owner</a>
    </div>
    <section aria-labelledby="open-heading">
      <h2 id="open-heading">Open programs</h2>
      ${open.length ? `<ul class="cards" id="open-list">${open.map(card).join('')}</ul>` : '<p class="muted">No open programs to show.</p>'}
    </section>
    ${closed.length ? `<section class="closed-section" aria-labelledby="closed-heading">
      <h2 id="closed-heading">Closed programs</h2>
      <ul class="cards" id="closed-list">${closed.map(closedCard).join('')}</ul>
    </section>` : ''}
  `
}

main()
