import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.GM_APP_PORT || 7401)
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true }
const desktop = { viewport: { width: 1280, height: 800 } }

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs$/,
  fullyParallel: false,
  workers: 2,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-390', use: { ...devices['Desktop Chrome'], ...phone, isMobile: true } },
    { name: 'chromium-1280', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'webkit-390', use: { ...devices['Desktop Safari'], ...phone } },
    { name: 'webkit-1280', use: { ...devices['Desktop Safari'], ...desktop } },
  ],
  webServer: {
    command: `node serve.mjs --port ${port}`,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
})
