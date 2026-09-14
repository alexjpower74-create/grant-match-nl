import { api } from './api.js'
import { chrome, esc, formatDate, hasSample, sampleBanner, errorNotice } from './render.js'

chrome()
const root = document.getElementById('sources')

// Newest run that looked at this source.
function lastCheck(runs, sourceId) {
  for (const run of runs) {
    const s = run.sources.find((x) => x.source_id === sourceId)
    if (s) {
      if (!s.ok) return `${formatDate(s.fetched_at || run.started_at)}: couldn't read the page`
      if (s.missing.length) return `${formatDate(s.fetched_at)}: ${s.missing.length} quote${s.missing.length === 1 ? '' : 's'} not found`
      return `${formatDate(s.fetched_at)}: every quote found`
    }
  }
  return 'Not checked live yet'
}

async function main() {
  let programs, runs
  try {
    const client = await api()
    ;[{ programs }, { runs }] = await Promise.all([client.programs(), client.checks()])
  } catch (err) {
    errorNotice(root, err.message)
    return
  }
  sampleBanner(hasSample(programs))
  const rows = programs.flatMap((p) =>
    p.sources.map((s) => `<tr data-source="${esc(s.id)}">
      <td>${esc(p.name)}</td>
      <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></td>
      <td>${esc(s.publisher)}</td>
      <td>${esc(formatDate(s.fetched_at))}</td>
      <td>${esc(lastCheck(runs, s.id))}</td>
    </tr>`),
  )
  root.innerHTML = `<p class="muted">${programs.length} programs, ${rows.length} official pages.</p>
    <div class="table-scroll glass"><table class="data">
      <thead><tr><th scope="col">Program</th><th scope="col">Page</th><th scope="col">Publisher</th><th scope="col">Saved</th><th scope="col">Last live check</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`
}

main()
