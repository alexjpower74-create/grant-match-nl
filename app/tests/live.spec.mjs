// Against a running Worker. Skipped unless GM_API is set (the lead runs it in QA).
import { test, expect } from '@playwright/test'
import { PROFILES, NOW } from './helpers.mjs'

const API = process.env.GM_API

test('SAMPLE Auto Service against ?api= renders exactly the API open and closed lists', async ({ page }) => {
  test.skip(!API, 'set GM_API')
  const query = new URLSearchParams(PROFILES.auto)
  query.set('now', NOW)
  const body = await (await fetch(`${API.replace(/\/+$/, '')}/api/match?${query}`)).json()
  query.set('api', API)
  await page.goto(`/results.html?${query}`)
  await expect(page.locator('#summary-line')).toBeVisible()
  const open = await page.locator('#open-list a.card').evaluateAll((els) => els.map((e) => e.dataset.slug))
  const closed = await page.locator('#closed-list a.card').evaluateAll((els) => els.map((e) => e.dataset.slug))
  expect(open).toEqual(body.open.map((r) => r.slug))
  expect(closed).toEqual(body.closed.map((r) => r.slug))
  const labels = await page.locator('#open-list a.card [data-fit]').evaluateAll((els) => els.map((e) => e.dataset.fit))
  expect(labels).toEqual(body.open.map((r) => r.fit.label))
})
