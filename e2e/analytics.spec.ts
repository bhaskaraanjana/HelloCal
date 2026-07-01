import { test, expect, type Page } from '@playwright/test';
import { analyticsSeedLocalStorage } from '../src/services/analyticsSeed';

async function openAnalytics(page: Page) {
  await page.goto('/');
  const exitLive = page.getByRole('button', { name: /Exit live mode/i });
  if (await exitLive.isVisible().catch(() => false)) {
    await exitLive.click();
  }
  await page.getByRole('tab', { name: /Analytics/ }).click({ force: true });
  await expect(page.getByRole('tab', { name: /Analytics/ })).toHaveAttribute('aria-selected', 'true');
  const loading = page.getByText(/Loading analytics/i);
  if (await loading.isVisible().catch(() => false)) {
    await expect(loading).toBeHidden({ timeout: 45_000 });
  }
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 20_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  const seed = analyticsSeedLocalStorage();
  await page.addInitScript((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  }, seed);
});

test('analytics renders seeded KPIs, insights, and charts', async ({ page }) => {
  await openAnalytics(page);

  await expect(page.getByText('Avg calories')).toBeVisible();
  await expect(page.getByText('On target')).toBeVisible();
  await expect(page.getByText('Hydration', { exact: true })).toBeVisible();
  await expect(page.locator('.analytics-insights')).toBeVisible();
  await expect(page.locator('.analytics-heatmap-cell').first()).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();

  await page.getByRole('button', { name: '14D', exact: true }).click();
  await expect(page.getByRole('button', { name: '14D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.analytics-range-label')).toContainText('14 days');
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('compare prior toggle and heatmap drill-down to timeline', async ({ page }) => {
  await openAnalytics(page);

  const compareBtn = page.getByRole('button', { name: /vs prior period/i });
  await expect(compareBtn).toBeVisible();
  await compareBtn.click();
  await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');

  const cell = page.locator('.analytics-heatmap-cell:not(.analytics-heatmap-cell--0)').first();
  await expect(cell).toBeVisible();
  await cell.click();

  await expect(page.getByRole('tab', { name: /Timeline/ })).toHaveAttribute('aria-selected', 'true');
});

test('seeded water totals match storage', async ({ page }) => {
  await page.goto('/');
  const totalMl = await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('hellocal_water') || '[]') as { milliliters: number }[];
    return w.reduce((s, e) => s + e.milliliters, 0);
  });
  expect(totalMl).toBeGreaterThan(20_000);

  await openAnalytics(page);
  await expect(page.getByText('Hydration', { exact: true })).toBeVisible();
});
