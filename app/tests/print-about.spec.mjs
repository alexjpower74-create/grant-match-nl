import { test, expect } from '@playwright/test'
import { bundle, PROFILES, qs, coreMatch } from './helpers.mjs'

test('print page is exactly one Letter page in print media and names SAMPLE Auto Service', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'page.pdf is chromium only')
  test.skip(testInfo.project.name !== 'chromium-1280', 'one PDF is enough')
  const want = coreMatch(PROFILES.auto)
  await page.goto(`/print.html?${qs(PROFILES.auto)}`)
  await expect(page.locator('h1')).toHaveText('Funding programs that could fit SAMPLE Auto Service')
  const picks = want.open.filter((r) => r.fit.label !== "Doesn't fit").slice(0, 6)
  await expect(page.locator('.program')).toHaveCount(picks.length)
  for (const r of want.closed) await expect(page.getByText(r.name)).toHaveCount(0)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#print-button')).toBeHidden()
  const pdf = await page.pdf({ format: 'Letter', printBackground: false })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length
  expect(pages).toBe(1)
  expect(pdf.toString('latin1').length).toBeGreaterThan(1000)
})

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
