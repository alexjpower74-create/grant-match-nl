// The profile form: one screen, docs/API.md §2 order and words. Answers live in the URL.
import { api } from './api.js'
import { chrome, esc, link, errorNotice, ICONS, carried } from './render.js'

chrome()

const params = new URLSearchParams(location.search)
const form = document.getElementById('profile-form')
const questions = document.getElementById('questions')
const status = document.getElementById('form-status')

const MESSAGES = {
  community: 'Pick your community.',
  industry: 'Pick your industry.',
  structure: 'Pick how your business is set up.',
  employees: 'Enter how many people work in the business.',
  years: 'Pick how long the business has been operating.',
  revenue: 'Pick your yearly revenue, or “Prefer not to say”.',
  purposes: 'Pick at least one thing the money is for.',
}

function selectQuestion(id, label, options, { hint = '', optional = false, placeholder = 'Choose one' } = {}) {
  const opts = options.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('')
  return `<div class="q glass" data-q="${id}">
    <label class="q-label" for="q-${id}">${esc(label)}${optional ? ' <span class="muted small">(optional)</span>' : ''}</label>
    ${hint ? `<p class="q-hint" id="q-${id}-hint">${hint}</p>` : ''}
    <select class="select" id="q-${id}" name="${id}" ${hint ? `aria-describedby="q-${id}-hint q-${id}-error"` : `aria-describedby="q-${id}-error"`}>
      <option value="">${esc(placeholder)}</option>${opts}
    </select>
    <p class="q-error" id="q-${id}-error" role="alert"></p>
  </div>`
}

function render(options) {
  questions.innerHTML = `
    <div class="q glass q-wide" data-q="name">
      <label class="q-label" for="q-name">Business name <span class="muted small">(optional)</span></label>
      <p class="q-hint" id="q-name-hint">Only printed on the owner's summary. Never stored.</p>
      <input class="input" id="q-name" name="name" maxlength="80" autocomplete="organization" aria-describedby="q-name-hint">
    </div>

    <div class="q glass" data-q="community">
      <label class="q-label" for="q-community">Community</label>
      <p class="q-hint" id="q-community-hint">Start typing the town or place where the business operates.</p>
      <div class="combo">
        <input class="input" id="q-community" type="text" role="combobox" autocomplete="off" spellcheck="false"
          aria-autocomplete="list" aria-expanded="false" aria-controls="community-list"
          aria-describedby="q-community-hint q-community-error" placeholder="For example, Gander">
        <ul class="combo-list" id="community-list" role="listbox" aria-label="Communities" hidden></ul>
      </div>
      <p class="q-error" id="q-community-error" role="alert"></p>
    </div>

    <div class="q glass" data-q="industry">
      <label class="q-label" for="q-industry">Industry</label>
      <p class="q-hint" id="q-industry-hint">Pick the closest one.</p>
      <select class="select" id="q-industry" name="industry" aria-describedby="q-industry-hint q-industry-error">
        <option value="">Choose one</option>
        ${options.industries.map((i) => `<option value="${esc(i.id)}">${esc(i.plain)}</option>`).join('')}
      </select>
      <p class="q-error" id="q-industry-error" role="alert"></p>
    </div>

    ${selectQuestion('structure', 'Business structure', options.structures)}

    <div class="q glass" data-q="employees">
      <label class="q-label" for="q-employees">People working (full-time equivalent, including owners)</label>
      <p class="q-hint" id="q-employees-hint">Two half-time people count as 1.</p>
      <input class="input" id="q-employees" name="employees" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
        aria-describedby="q-employees-hint q-employees-error">
      <p class="q-error" id="q-employees-error" role="alert"></p>
    </div>

    ${selectQuestion('years', 'Years operating', options.years)}
    ${selectQuestion('revenue', 'Yearly revenue', options.revenue)}

    <fieldset class="q glass q-wide" data-q="owners" aria-describedby="q-owners-hint">
      <legend>Owned by <span class="muted small">(optional)</span></legend>
      <p class="q-hint" id="q-owners-hint">Tick any that describe the owners. Some programs are only for these groups.</p>
      <div class="checks">
        ${options.owners.map((o) => `<label class="check"><input type="checkbox" name="owners" value="${esc(o.id)}"><span>${esc(o.label)}</span></label>`).join('')}
        <label class="check"><input type="checkbox" name="owners" value="none"><span>None of these</span></label>
      </div>
    </fieldset>

    <fieldset class="q glass q-wide" data-q="purposes" aria-describedby="q-purposes-hint q-purposes-error">
      <legend id="q-purposes-legend">What the money is for</legend>
      <p class="q-hint" id="q-purposes-hint">Tap every one that applies.</p>
      <div class="chips">
        ${options.purposes.map((p) => `<button type="button" class="chip" aria-pressed="false" data-purpose="${esc(p.id)}">${ICONS.check}<span>${esc(p.label)}</span></button>`).join('')}
      </div>
      <p class="q-error" id="q-purposes-error" role="alert"></p>
    </fieldset>

    ${selectQuestion('cost', 'Project cost', options.cost, { optional: true })}
  `
}

// ---------- community type-to-search ----------

function setupCommunity(communities) {
  const input = document.getElementById('q-community')
  const list = document.getElementById('community-list')
  let chosen = null
  let matches = []
  let active = -1

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'")

  function filter(text) {
    const q = norm(text.trim())
    if (!q) return communities.slice(0, 50)
    const starts = []
    const contains = []
    for (const c of communities) {
      const n = norm(c.name)
      if (n.startsWith(q)) starts.push(c)
      else if (n.includes(q)) contains.push(c)
    }
    return [...starts, ...contains].slice(0, 50)
  }

  function open() {
    matches = filter(chosen && input.value === chosen.name ? '' : input.value)
    active = matches.length ? 0 : -1
    list.innerHTML = matches.length
      ? matches
          .map(
            (c, i) => `<li class="combo-option" role="option" id="community-opt-${i}" data-index="${i}" aria-selected="${i === active}">
              <span>${esc(c.name)}</span><span class="muted">Division ${esc(c.census_division)}</span></li>`,
          )
          .join('')
      : `<li class="combo-empty">No community matches “${esc(input.value)}”.</li>`
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    syncActive()
  }

  function close() {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  function syncActive() {
    list.querySelectorAll('.combo-option').forEach((el, i) => el.setAttribute('aria-selected', String(i === active)))
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `community-opt-${active}`)
      list.querySelector(`#community-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
  }

  function choose(c) {
    chosen = c
    input.value = c ? c.name : ''
    close()
    if (c) clearError('community')
  }

  input.addEventListener('input', () => {
    chosen = null
    open()
  })
  input.addEventListener('focus', () => open())
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (list.hidden) open()
      else if (matches.length) (active = Math.min(active + 1, matches.length - 1)), syncActive()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length) (active = Math.max(active - 1, 0)), syncActive()
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0) {
        e.preventDefault()
        choose(matches[active])
      }
    } else if (e.key === 'Escape') {
      close()
    }
  })
  // pointerdown keeps focus in the input so the tap isn't lost to blur.
  list.addEventListener('pointerdown', (e) => e.preventDefault())
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.combo-option')
    if (li) choose(matches[Number(li.dataset.index)])
  })
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === input) return
      // An exact typed name counts as a pick.
      if (!chosen) {
        const exact = communities.find((c) => norm(c.name) === norm(input.value.trim()))
        if (exact) chosen = exact
      }
      close()
    }, 0)
  })

  return {
    get value() {
      return chosen ? chosen.id : ''
    },
    set(id) {
      choose(communities.find((c) => c.id === id) || null)
    },
    focus() {
      input.focus()
    },
  }
}

// ---------- owners and purposes ----------

function setupOwners() {
  const boxes = [...form.querySelectorAll('input[name="owners"]')]
  const none = boxes.find((b) => b.value === 'none')
  form.addEventListener('change', (e) => {
    const box = e.target
    if (box.name !== 'owners') return
    if (box === none && box.checked) boxes.forEach((b) => b !== none && (b.checked = false))
    else if (box !== none && box.checked) none.checked = false
  })
  return {
    get value() {
      if (none.checked) return 'none'
      return boxes.filter((b) => b.checked && b !== none).map((b) => b.value).join(',')
    },
    set(v) {
      const picked = (v || '').split(',')
      boxes.forEach((b) => (b.checked = picked.includes(b.value)))
    },
  }
}

function setupPurposes() {
  const chips = [...form.querySelectorAll('.chip')]
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'))
      if (chips.some((c) => c.getAttribute('aria-pressed') === 'true')) clearError('purposes')
    }),
  )
  return {
    get value() {
      return chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.purpose).join(',')
    },
    set(v) {
      const picked = (v || '').split(',')
      chips.forEach((c) => c.setAttribute('aria-pressed', String(picked.includes(c.dataset.purpose))))
    },
    focus() {
      chips[0]?.focus()
    },
  }
}

// ---------- errors ----------

function showError(field, message) {
  const q = form.querySelector(`[data-q="${field}"]`)
  q?.setAttribute('data-invalid', '')
  const el = document.getElementById(`q-${field}-error`)
  if (el) el.textContent = message
}

function clearError(field) {
  form.querySelector(`[data-q="${field}"]`)?.removeAttribute('data-invalid')
  const el = document.getElementById(`q-${field}-error`)
  if (el) el.textContent = ''
}

// ---------- boot ----------

async function main() {
  let options
  try {
    options = await (await api()).options()
  } catch (err) {
    errorNotice(status, err.message)
    return
  }
  render(options)
  form.hidden = false

  const community = setupCommunity(options.communities)
  const owners = setupOwners()
  const purposes = setupPurposes()
  const industry = document.getElementById('q-industry')
  const industryHint = document.getElementById('q-industry-hint')
  const byIndustry = Object.fromEntries(options.industries.map((i) => [i.id, i]))
  const syncIndustryHint = () => {
    const i = byIndustry[industry.value]
    industryHint.textContent = i ? `Statistics Canada calls this: ${i.name}` : 'Pick the closest one.'
  }
  industry.addEventListener('change', () => {
    syncIndustryHint()
    if (industry.value) clearError('industry')
  })
  for (const id of ['structure', 'years', 'revenue']) {
    document.getElementById(`q-${id}`).addEventListener('change', (e) => e.target.value && clearError(id))
  }
  document.getElementById('q-employees').addEventListener('input', (e) => e.target.value && clearError('employees'))

  // Pre-fill from the URL ("Change answers" comes back here).
  const field = (id) => document.getElementById(`q-${id}`)
  if (params.has('name')) field('name').value = params.get('name')
  if (params.has('community')) community.set(params.get('community'))
  for (const id of ['industry', 'structure', 'years', 'revenue', 'cost']) {
    if (params.has(id) && [...field(id).options].some((o) => o.value === params.get(id))) field(id).value = params.get(id)
  }
  if (params.has('employees')) field('employees').value = params.get('employees')
  if (params.has('owners')) owners.set(params.get('owners'))
  if (params.has('purposes')) purposes.set(params.get('purposes'))
  syncIndustryHint()

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const values = {
      name: field('name').value.trim(),
      community: community.value,
      industry: industry.value,
      structure: field('structure').value,
      employees: field('employees').value.trim(),
      years: field('years').value,
      revenue: field('revenue').value,
      owners: owners.value,
      purposes: purposes.value,
      cost: field('cost').value,
    }
    const errors = []
    for (const key of ['community', 'industry', 'structure', 'employees', 'years', 'revenue', 'purposes']) {
      clearError(key)
      if (!values[key]) errors.push([key, MESSAGES[key]])
    }
    if (values.employees && !/^\d{1,6}$/.test(values.employees)) {
      errors.push(['employees', 'Enter the number of people as a whole number, 0 or more.'])
    } else if (values.employees && Number(values.employees) > 100000) {
      errors.push(['employees', 'Enter a number of people up to 100,000.'])
    }
    if (errors.length) {
      errors.forEach(([k, m]) => showError(k, m))
      const [first] = errors[0]
      if (first === 'community') community.focus()
      else if (first === 'purposes') purposes.focus()
      else field(first).focus()
      return
    }
    const q = carried(params, ['mock', 'api', 'now', 'data'])
    const extra = {}
    for (const [k, v] of Object.entries(values)) if (v) extra[k] = v
    location.href = link('results.html', extra, q)
  })
}

main()
