import { test, expect } from '@playwright/test'
import { PROFILES, qs, coreMatch } from './helpers.mjs'

const TARGETS = 'button, a.btn, a.card, .chip, label.check, select, .tool, a.wordmark, .site-nav a'

function pages() {
  const r = coreMatch(PROFILES.auto)
  return [
    // [name, url, a selector that exists only once the page's data has rendered]
    ['form', `/index.html?mock=1`, '.chip'],
    ['results', `/results.html?${qs(PROFILES.auto)}`, '#open-list a.card'],
    ['detail', `/program.html?${qs(PROFILES.auto, { slug: r.open[0].slug })}`, '#official-link'],
    ['print', `/print.html?${qs(PROFILES.auto)}`, '.program'],
    ['about', `/about.html?mock=1`, 'tr[data-source]'],
  ]
}

test('every button, card, chip, checkbox label and select is hit at its centre and at least 44 px tall at 390', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('-390'), 'phone width only')
  for (const [name, url, ready] of pages()) {
    await page.goto(url)
    await page.locator(ready).first().waitFor()
    const targets = page.locator(TARGETS)
    const n = await targets.count()
    expect(n, `${name} has targets`).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const el = targets.nth(i)
      if (!(await el.isVisible())) continue
      await el.scrollIntoViewIfNeeded()
      const box = await el.boundingBox()
      const label = `${name} #${i} ${(await el.textContent())?.trim().slice(0, 40)}`
      expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44)
      const hit = await el.evaluate((node, [x, y]) => {
        const top = document.elementFromPoint(x, y)
        return !!top && (top === node || node.contains(top))
      }, [box.x + box.width / 2, box.y + box.height / 2])
      expect(hit, `${label} is what a finger at its centre hits`).toBe(true)
    }
  }
})

test('no horizontal scroll at 390', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('-390'), 'phone width only')
  for (const [name, url, ready] of pages()) {
    await page.goto(url)
    await page.locator(ready).first().waitFor()
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(scroll, `${name} scrollWidth`).toBeLessThanOrEqual(client)
  }
})
