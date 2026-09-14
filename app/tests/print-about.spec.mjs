import { test, expect } from '@playwright/test'
import { bundle, PROFILES, qs, coreMatch } from './helpers.mjs'

// SAMPLE Auto Service, and the fullest printout the SAMPLE set can produce (6 programs plus "and N more"): a
// short printout fits one page even with no print stylesheet, so only the full one proves the one-page rule.
for (const [label, profile] of [['SAMPLE Auto Service', PROFILES.auto], ['the fullest printout', PROFILES.printWorst]]) {
  test(`print page is exactly one Letter page in print media and names SAMPLE Auto Service: ${label}`, async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'page.pdf is chromium only')
    test.skip(testInfo.project.name !== 'chromium-1280', 'one PDF is enough')
    const want = coreMatch(profile)
    const couldFit = want.open.filter((r) => r.fit.label !== "Doesn't fit")
    const picks = couldFit.slice(0, 6)
    await page.goto(`/print.html?${qs(profile)}`)
    await expect(page.locator('h1')).toHaveText('Funding programs that could fit SAMPLE Auto Service')
    await expect(page.locator('.program')).toHaveCount(picks.length)
    if (couldFit.length > 6) await expect(page.getByText(`and ${couldFit.length - 6} more on the results page`)).toBeVisible()
    for (const r of want.closed) await expect(page.getByText(r.name)).toHaveCount(0)
    await page.emulateMedia({ media: 'print' })
    // Page count first, so a broken print stylesheet is caught by the one-page check itself.
    const pdf = await page.pdf({ format: 'Letter', printBackground: false })
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length
    expect(pages, 'printed pages').toBe(1)
    expect(pdf.toString('latin1').length).toBeGreaterThan(1000)
    await expect(page.locator('#print-button')).toBeHidden()
  })
}

test('print page lists open programs Looks like a fit first, with URL text and no navigation', async ({ page }) => {
  const want = coreMatch(PROFILES.auto)
  await page.goto(`/print.html?${qs(PROFILES.auto)}`)
  const picks = want.open.filter((r) => r.fit.label !== "Doesn't fit").slice(0, 6)
  await expect(page.locator('.program')).toHaveCount(picks.length)
  const slugs = await page.locator('.program').evaluateAll((els) => els.map((e) => e.dataset.slug))
  expect(slugs).toEqual(picks.map((r) => r.slug))
  for (const r of picks) await expect(page.locator(`.program[data-slug="${r.slug}"] .url`)).toContainText(r.url)
  await expect(page.locator('.sheet nav, .sheet a')).toHaveCount(0)
  await expect(page.getByText("Grant Match NL shows what each program's own page says.")).toBeVisible()
})

test('about lists every SAMPLE source', async ({ page }) => {
  await page.goto(`/about.html?mock=1`)
  const sources = bundle.programs.flatMap((p) => p.sources.map((s) => ({ ...s, program: p.name })))
  await expect(page.locator('tr[data-source]')).toHaveCount(sources.length)
  for (const s of sources) {
    const row = page.locator(`tr[data-source="${s.id}"]`)
    await expect(row).toContainText(s.program)
    await expect(row).toContainText(s.title)
    await expect(row).toContainText(s.publisher)
    await expect(row).toContainText('Not checked live yet')
  }
  await expect(page.getByRole('heading', { name: 'Grant Match never applies for you' })).toBeVisible()
  await expect(page.locator('#sample-banner')).toBeVisible()
})

test('about lists the programs we left out, each with its terms link and reason', async ({ page }) => {
  await page.goto(`/about.html?mock=1`)
  const section = page.locator('#left-out')
  await expect(section.getByRole('heading', { name: 'Programs we left out, and why' })).toBeVisible()
  await expect(section).toContainText('Grant Match only uses pages it is allowed to quote.')
  const expected = [
    ['bdc', 'BDC loans', 'https://www.bdc.ca/en/legal-notice'],
    ['futurpreneur', 'Futurpreneur', 'https://futurpreneur.ca/en/terms-conditions/'],
    ['ulnooweg', 'Ulnooweg Development Group', 'https://ulnoowegdevelopmentgroup.ca/'],
  ]
  await expect(section.locator('[data-left-out]')).toHaveCount(expected.length)
  for (const [id, name, href] of expected) {
    const item = section.locator(`[data-left-out="${id}"]`)
    await expect(item).toContainText(name)
    const a = item.locator('a')
    await expect(a).toHaveAttribute('href', href)
    await expect(a).toHaveAttribute('target', '_blank')
    await expect(a).toHaveAttribute('rel', /(^|\s)noopener(\s|$)/)
  }
  // None of them is quoted as a source anywhere.
  for (const p of bundle.programs) for (const s of p.sources) expect(s.url).not.toMatch(/bdc\.ca|futurpreneur\.ca|ulnooweg/)
})

test('real data: printout phone numbers never split across lines', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium'), 'print layout checked in chromium')
  // APCO Software Tools (DECISIONS #14): its printout lists ACOA programs with long URLs and a phone.
  const apco = 'name=APCO Software Tools&community=grand-falls-windsor&industry=54&structure=unsure&employees=1&years=lt1&revenue=unsaid&purposes=digital&cost=unsure'
  for (const media of ['screen', 'print']) {
    await page.emulateMedia({ media })
    await page.goto(`/print.html?${qs(apco, { data: 'real' })}`)
    await expect(page.locator('.program').first()).toBeVisible()
    const phones = page.locator('[data-phone]')
    expect(await phones.count(), 'the real printout has phones').toBeGreaterThan(0)
    const lines = await phones.evaluateAll((els) => els.map((e) => ({ text: e.textContent, rects: e.getClientRects().length })))
    for (const l of lines) expect(l.rects, `${media}: "${l.text}" is on one line`).toBe(1)
  }
})
