import { defineConfig, devices } from '@playwright/test';

// E2E runs against the PRODUCTION build via `vite preview` so we test the real
// bundles (incl. lazy chunks + Chart.js canvas that jsdom can't render).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:51731',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Unique port + no reuse: avoid colliding with other local dev servers.
    command: 'npm run build && npm run preview -- --port 51731 --strictPort',
    url: 'http://localhost:51731',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
