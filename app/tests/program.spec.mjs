import { test, expect } from '@playwright/test'
import { bundle, PROFILES, qs, coreMatch, coreProgram, quotesOf } from './helpers.mjs'

const REASON_COPY = {
  self_check: 'Unknown: check this yourself',
  not_answered: "Unknown: you didn't answer this",
  band_straddles: "Unknown: your answer is close to the page's limit",
}

test('each rendered <mark> equals its API quote exactly and sits inside its context', async ({ page }) => {
  for (const program of bundle.programs) {
    const want = coreProgram(program.slug, PROFILES.auto)
    const expected = quotesOf(want)
    await page.goto(`/program.html?${qs(PROFILES.auto, { slug: program.slug })}`)
    await expect(page.locator('h1')).toHaveText(want.name)
    const rendered = await page.locator('blockquote.quote').evaluateAll((els) =>
      els.map((b) => {
        const p = b.querySelector('p')
        const mark = p.querySelector('mark')
        let before = ''
        for (const n of p.childNodes) {
          if (n === mark) break
          before += n.textContent
        }
        return { mark: mark.textContent, whole: p.textContent, before, source: b.dataset.source }
      }),
    )
    expect(rendered.length, `${program.slug}: one blockquote per quote`).toBe(expected.length)
    for (const r of rendered) {
      const match = expected.find((q) => q.quote === r.mark && q.source === r.source && q.context.before === r.before)
      expect(match, `${program.slug}: <mark>${r.mark}</mark> is an API quote with its context`).toBeTruthy()
      expect(r.whole).toBe(match.context.before + match.quote + match.context.after)
    }
  }
})

test('Unknown reason copy per reason', async ({ page }) => {
  const seen = new Set()
  for (const profile of [PROFILES.auto, PROFILES.daycare, PROFILES.autoUnanswered, PROFILES.autoStraddle]) {
    const want = coreMatch(profile)
    for (const r of [...want.open, ...want.closed]) {
      const unknown = r.criteria.filter((c) => c.status === 'unknown' && !seen.has(c.unknown_reason))
      if (!unknown.length) continue
      await page.goto(`/program.html?${qs(profile, { slug: r.slug })}`)
      for (const c of unknown) {
        const reason = page.locator(`[data-group="unknown"] [data-criterion="${c.id}"] .reason`)
        await expect(reason).toHaveText(REASON_COPY[c.unknown_reason])
        seen.add(c.unknown_reason)
      }
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(REASON_COPY).sort())

  // A program fact the pages don't state.
  const silent = bundle.programs.map((p) => coreProgram(p.slug, PROFILES.auto)).find((r) => r.unknown_facts.length)
  expect(silent, 'a SAMPLE program leaves a fact unstated').toBeTruthy()
  await page.goto(`/program.html?${qs(PROFILES.auto, { slug: silent.slug })}`)
  await expect(page.locator('#unknown-facts li')).toHaveCount(silent.unknown_facts.length)
  await expect(page.locator('#unknown-facts [data-reason="page_silent"]').first()).toHaveText("Unknown: the page doesn't say")
})

test('the official link opens a new tab with rel="noopener"', async ({ page }) => {
  const r = coreMatch(PROFILES.auto).open[0]
  await page.goto(`/program.html?${qs(PROFILES.auto, { slug: r.slug })}`)
  const official = page.locator('#official-link')
  await expect(official).toHaveText('Open the official page')
  await expect(official).toHaveAttribute('href', r.url)
  await expect(official).toHaveAttribute('target', '_blank')
  await expect(official).toHaveAttribute('rel', /(^|\s)noopener(\s|$)/)
})

test('"Call this office" shows only on a program with a contact', async ({ page }) => {
  const withContact = bundle.programs.find((p) => p.contacts.some((c) => c.phone))
  const without = bundle.programs.find((p) => p.contacts.length === 0)
  expect(withContact && without).toBeTruthy()

  await page.goto(`/program.html?${qs(PROFILES.auto, { slug: withContact.slug })}`)
  const call = page.locator('a[data-call]')
  await expect(call).toHaveCount(withContact.contacts.filter((c) => c.phone).length)
  await expect(call.first()).toContainText('Call this office')
  await expect(call.first()).toHaveAttribute('href', `tel:${withContact.contacts.find((c) => c.phone).phone.replace(/[^\d+]/g, '')}`)

  await page.goto(`/program.html?${qs(PROFILES.auto, { slug: without.slug })}`)
  await expect(page.locator('h1')).toHaveText(without.name)
  await expect(page.getByText('Call this office')).toHaveCount(0)
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
})

test('criteria sit in the three groups the way core evaluated them', async ({ page }) => {
  const r = coreMatch(PROFILES.auto).open[0]
  await page.goto(`/program.html?${qs(PROFILES.auto, { slug: r.slug })}`)
  await expect(page.locator('h1')).toHaveText(r.name)
  for (const [group, status] of [['matches', 'met'], ['doesnt-match', 'missed'], ['unknown', 'unknown']]) {
    const ids = r.criteria.filter((c) => c.status === status).map((c) => c.id)
    const shown = await page.locator(`[data-group="${group}"] [data-criterion]`).evaluateAll((els) => els.map((e) => e.dataset.criterion))
    expect(shown, group).toEqual(ids)
  }
  await expect(page.locator('#fit-why li')).toHaveCount(r.fit.why.length)
})
