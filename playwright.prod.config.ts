import { defineConfig, devices } from '@playwright/test';

/** E2E against the live production site (no local webServer). */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/account-settings.prod.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://hellocal.infinitemind.space',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
