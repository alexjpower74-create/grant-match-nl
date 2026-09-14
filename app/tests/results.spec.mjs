import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PROFILES, STALE_NOW, qs, coreMatch, press } from './helpers.mjs'

test('results order and labels equal what core returns for SAMPLE Auto Service', async ({ page }) => {
  const want = coreMatch(PROFILES.auto)
  await page.goto(`/results.html?${qs(PROFILES.auto)}`)
  await expect(page.locator('#summary-line')).toBeVisible()
  const cards = page.locator('#open-list a.card')
  await expect(cards).toHaveCount(want.open.length)
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.slug))).toEqual(want.open.map((r) => r.slug))
  const labels = await page.locator('#open-list a.card [data-fit]').evaluateAll((els) => els.map((e) => e.dataset.fit))
  expect(labels).toEqual(want.open.map((r) => r.fit.label))
  const couldFit = want.counts.looks + want.counts.might
  await expect(page.locator('#summary-line')).toContainText(`${couldFit} program${couldFit === 1 ? '' : 's'} could fit`)
  await expect(page.locator('#summary-counts')).toContainText(`${want.counts.looks} Looks like a fit`)
  await expect(page.locator('#summary-counts')).toContainText(`${want.counts.might} Might fit`)
  await expect(page.locator('#summary-counts')).toContainText(`${want.counts.doesnt} Doesn't fit`)
  await expect(page.locator('#summary-counts')).toContainText(`${want.counts.closed} Closed`)
  await expect(page.locator('#sample-banner')).toBeVisible()
  for (const r of want.open) {
    const card = page.locator(`#open-list a.card[data-slug="${r.slug}"]`)
    await expect(card).toContainText(`${r.counts.met} match · ${r.counts.missed} doesn't · ${r.counts.unknown} unknown`)
    await expect(card).toContainText(r.max_amount ? r.max_amount.text : "Amount: the page doesn't say")
  }
})

test('the closed SAMPLE program sits under "Closed programs" with its closed quote', async ({ page }) => {
  const want = coreMatch(PROFILES.auto)
  expect(want.closed.length).toBeGreaterThan(0)
  await page.goto(`/results.html?${qs(PROFILES.auto)}`)
  await expect(page.locator('#closed-heading')).toHaveText('Closed programs')
  const closed = page.locator('#closed-list a.card')
  await expect(closed).toHaveCount(want.closed.length)
  for (const r of want.closed) {
    const card = page.locator(`#closed-list a.card[data-slug="${r.slug}"]`)
    await expect(card).toContainText('Closed. Not taking applications right now.')
    if (r.intake.quote) await expect(card.locator('mark')).toHaveText(r.intake.quote.quote)
    await expect(page.locator(`#open-list a.card[data-slug="${r.slug}"]`)).toHaveCount(0)
  }
  // Closed comes after the open list on the page.
  const order = await page.locator('#open-heading, #closed-heading').evaluateAll((els) => els.map((e) => e.id))
  expect(order).toEqual(['open-heading', 'closed-heading'])
})

test('tapping a card opens its detail', async ({ page }, testInfo) => {
  const want = coreMatch(PROFILES.auto)
  await page.goto(`/results.html?${qs(PROFILES.auto)}`)
  const first = want.open[0]
  await press(page.locator(`#open-list a.card[data-slug="${first.slug}"]`), testInfo)
  await page.waitForURL(/program\.html/)
  expect(new URL(page.url()).searchParams.get('slug')).toBe(first.slug)
  await expect(page.locator('h1')).toHaveText(first.name)
  // The profile travels with it.
  expect(new URL(page.url()).searchParams.get('community')).toBe('grand-falls-windsor')
})

test('now=2026-12-01: stale message and no Looks like a fit', async ({ page }) => {
  const want = coreMatch(PROFILES.auto, STALE_NOW)
  await page.goto(`/results.html?${qs(PROFILES.auto, { now: STALE_NOW })}`)
  await expect(page.locator('#summary-line')).toBeVisible()
  await expect(page.locator('[data-fit="Looks like a fit"]')).toHaveCount(0)
  const flags = page.locator('#open-list [data-flag="stale"]')
  await expect(flags).toHaveCount(want.open.length)
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  const v = want.open[0].verification
  const [y, m, d] = v.last_verified.split('-').map(Number)
  await expect(flags.first()).toHaveText(`Last verified ${date.format(Date.UTC(y, m - 1, d))}, more than 60 days ago. Check the official page.`)
})

test('a card says what the page leaves unsaid: intake and funding type have their subject', async ({ page }) => {
  const want = coreMatch(PROFILES.auto)
  const unknownIntake = want.open.find((r) => r.intake.status === 'unknown')
  expect(unknownIntake, 'a SAMPLE program with unknown intake').toBeTruthy()
  await page.goto(`/results.html?${qs(PROFILES.auto)}`)
  const card = page.locator(`#open-list a.card[data-slug="${unknownIntake.slug}"]`)
  await expect(card).toContainText("When it takes applications: the page doesn't say")
  // The bare phrase never stands alone as a line.
  const lines = await card.locator('.card-facts > span').allTextContents()
  expect(lines.map((l) => l.trim())).not.toContain("The page doesn't say")
  for (const r of want.open.filter((x) => x.funding_types.length)) {
    await expect(page.locator(`#open-list a.card[data-slug="${r.slug}"] [data-type-unknown]`)).toHaveCount(0)
  }
})

test('real data: a card for a program with no stated funding type says so', async ({ page }) => {
  const real = JSON.parse(readFileSync(new URL('../../data/build/programs.json', import.meta.url), 'utf8'))
  const untyped = real.programs.filter((p) => p.funding_types.length === 0 && p.intake.status !== 'closed')
  test.skip(untyped.length === 0, 'no open real program without a funding type')
  await page.goto(`/results.html?${qs(PROFILES.auto, { data: 'real' })}`)
  await expect(page.locator('#summary-line')).toBeVisible()
  for (const p of untyped) {
    await expect(page.locator(`#open-list a.card[data-slug="${p.slug}"] [data-type-unknown]`)).toHaveText("Type of funding: the page doesn't say")
  }
})
