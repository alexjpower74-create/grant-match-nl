import { test, expect } from '@playwright/test'
import { PROFILES, NOW, press } from './helpers.mjs'

const start = `/index.html?mock=1&now=${encodeURIComponent(NOW)}`

async function fillAuto(page, testInfo, { community = true } = {}) {
  await page.locator('#q-name').click()
  await page.keyboard.type('SAMPLE Auto Service')
  if (community) {
    await press(page.locator('#q-community'), testInfo)
    await page.keyboard.type('Grand F')
    await press(page.getByRole('option', { name: /Grand Falls-Windsor/ }), testInfo)
    await expect(page.locator('#q-community')).toHaveValue('Grand Falls-Windsor')
  }
  await page.locator('#q-industry').selectOption('81')
  await page.locator('#q-structure').selectOption('corporation')
  await press(page.locator('#q-employees'), testInfo)
  await page.keyboard.type('6')
  await page.locator('#q-years').selectOption('10plus')
  await page.locator('#q-revenue').selectOption('500k_1m')
  await press(page.locator('label.check', { hasText: 'None of these' }), testInfo)
  await press(page.getByRole('button', { name: 'Equipment', exact: true }), testInfo)
  await press(page.getByRole('button', { name: 'Software or digital' }), testInfo)
  await page.locator('#q-cost').selectOption('25k_50k')
}

test('filling the form for SAMPLE Auto Service carries every answer to the results URL', async ({ page }, testInfo) => {
  await page.goto(start)
  await fillAuto(page, testInfo)
  await press(page.getByRole('button', { name: 'Show programs that could fit' }), testInfo)
  await page.waitForURL(/results\.html/)
  const got = new URL(page.url()).searchParams
  for (const [k, v] of new URLSearchParams(PROFILES.auto)) expect(got.get(k), k).toBe(v)
  expect(got.get('mock')).toBe('1')
  expect(got.get('now')).toBe(NOW)
})

test('the community list works by keyboard alone', async ({ page }) => {
  await page.goto(start)
  await page.locator('#q-community').focus()
  await page.keyboard.type('gand')
  await expect(page.getByRole('option').first()).toContainText('Gander')
  await page.keyboard.press('Enter')
  await expect(page.locator('#q-community')).toHaveValue('Gander')
  await expect(page.locator('#community-list')).toBeHidden()
})

test('submitting with no community shows the message and moves focus there', async ({ page }, testInfo) => {
  await page.goto(start)
  await fillAuto(page, testInfo, { community: false })
  await press(page.getByRole('button', { name: 'Show programs that could fit' }), testInfo)
  await expect(page.locator('#q-community-error')).toHaveText('Pick your community.')
  await expect(page.locator('#q-community')).toBeFocused()
  expect(page.url()).toContain('index.html')
})

test('owners: "None of these" clears the others, and the reverse', async ({ page }, testInfo) => {
  await page.goto(start)
  const box = (name) => page.locator('label.check', { hasText: name }).locator('input')
  await press(page.locator('label.check', { hasText: 'Women' }), testInfo)
  await press(page.locator('label.check', { hasText: 'Francophone' }), testInfo)
  await expect(box('Women')).toBeChecked()
  await expect(box('Francophone')).toBeChecked()
  await press(page.locator('label.check', { hasText: 'None of these' }), testInfo)
  await expect(box('None of these')).toBeChecked()
  await expect(box('Women')).not.toBeChecked()
  await expect(box('Francophone')).not.toBeChecked()
  await press(page.locator('label.check', { hasText: 'Indigenous people' }), testInfo)
  await expect(box('Indigenous people')).toBeChecked()
  await expect(box('None of these')).not.toBeChecked()
})

test('purpose chips toggle aria-pressed', async ({ page }, testInfo) => {
  await page.goto(start)
  const chip = page.getByRole('button', { name: 'Training' })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await press(chip, testInfo)
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await press(chip, testInfo)
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
})

test('"Change answers" returns to the form pre-filled', async ({ page }, testInfo) => {
  await page.goto(`/results.html?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(PROFILES.auto)), mock: '1', now: NOW })}`)
  await press(page.locator('#change-answers'), testInfo)
  await page.waitForURL(/index\.html/)
  await expect(page.locator('#q-name')).toHaveValue('SAMPLE Auto Service')
  await expect(page.locator('#q-community')).toHaveValue('Grand Falls-Windsor')
  await expect(page.locator('#q-industry')).toHaveValue('81')
  await expect(page.locator('#q-structure')).toHaveValue('corporation')
  await expect(page.locator('#q-employees')).toHaveValue('6')
  await expect(page.locator('#q-years')).toHaveValue('10plus')
  await expect(page.locator('#q-revenue')).toHaveValue('500k_1m')
  await expect(page.locator('#q-cost')).toHaveValue('25k_50k')
  await expect(page.locator('label.check', { hasText: 'None of these' }).locator('input')).toBeChecked()
  await expect(page.getByRole('button', { name: 'Equipment', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Software or digital' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Training' })).toHaveAttribute('aria-pressed', 'false')
  // And it submits again to the same answers.
  await press(page.getByRole('button', { name: 'Show programs that could fit' }), testInfo)
  await page.waitForURL(/results\.html/)
  const got = new URL(page.url()).searchParams
  for (const [k, v] of new URLSearchParams(PROFILES.auto)) expect(got.get(k), k).toBe(v)
})
