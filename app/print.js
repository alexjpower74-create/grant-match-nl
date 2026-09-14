import { api } from './api.js'
import { esc, link, FOOTER_LINE, formatDate, intakeText, amountText } from './render.js'

const params = new URLSearchParams(location.search)
const sheet = document.getElementById('sheet')
const MAX_PROGRAMS = 6

document.getElementById('back-link').href = link('results.html', {}, params)
document.getElementById('print-button').addEventListener('click', () => window.print())

const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? id

function answersLine(p, o) {
  const parts = [
    p.community.name,
    o.industries.find((i) => i.id === p.industry.id)?.plain || p.industry.name,
    labelOf(o.structures, p.structure),
    `${p.employees} ${p.employees === 1 ? 'person' : 'people'}`,
    `operating ${labelOf(o.years, p.years).toLowerCase()}`,
    `revenue ${labelOf(o.revenue, p.revenue).toLowerCase()}`,
  ]
  if (p.owners === null) parts.push('owners not answered')
  else if (p.owners.length) parts.push(`owned by ${p.owners.map((id) => labelOf(o.owners, id).toLowerCase()).join(', ')}`)
  parts.push(`for ${p.purposes.map((id) => labelOf(o.purposes, id).toLowerCase()).join(', ')}`)
  if (p.cost) parts.push(`project cost ${labelOf(o.cost, p.cost).toLowerCase()}`)
  return parts.join(' · ')
}

async function main() {
  let data, options
  try {
    const client = await api()
    ;[data, options] = await Promise.all([client.match(params), client.options()])
  } catch (err) {
    sheet.innerHTML = `<p>${esc(err.message)}</p>`
    return
  }
  const p = data.profile
  // "Could fit" means Looks like a fit or Might fit; open is already sorted with Looks like a fit first.
  const picks = data.open.filter((r) => r.fit && r.fit.label !== "Doesn't fit").slice(0, MAX_PROGRAMS)
  const more = data.open.filter((r) => r.fit && r.fit.label !== "Doesn't fit").length - picks.length
  const sample = picks.some((r) => r.sample)

  sheet.innerHTML = `
    <h1>Funding programs that could fit ${esc(p.name || 'your business')}</h1>
    <p class="meta">${esc(formatDate(data.evaluated_at))} · Prepared with Grant Match NL</p>
    ${sample ? '<p class="sample" id="sample-banner">SAMPLE data: these programs are made up for testing. They are not real.</p>' : ''}
    <p class="answers">${esc(answersLine(p, options))}</p>
    ${picks.length ? `<ol class="programs">${picks.map((r) => `<li class="program" data-slug="${esc(r.slug)}">
      <h2>${esc(r.name)} <span class="fit">· ${esc(r.fit.label)}</span></h2>
      <p>${esc(r.provider)}</p>
      <p>${esc(r.funding_types.map((t) => t.label).filter((v, i, a) => a.indexOf(v) === i).join(', ') || "Type: the page doesn't say")} · ${esc(amountText(r))} · ${esc(intakeText(r.intake))}</p>
      <p class="url">${esc(r.url)}${r.contacts.find((c) => c.phone) ? ` · Phone ${esc(r.contacts.find((c) => c.phone).phone)}` : ''}</p>
    </li>`).join('')}</ol>` : '<p class="empty">No open programs could fit these answers right now.</p>'}
    ${more > 0 ? `<p class="meta">and ${more} more on the results page</p>` : ''}
    <p class="foot">${esc(FOOTER_LINE)} Check each official page before you apply.</p>`
  document.title = `Funding programs that could fit ${p.name || 'your business'}`
}

main()
