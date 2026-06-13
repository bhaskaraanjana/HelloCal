import { test, expect } from '@playwright/test';

// Bypass first-run onboarding so the dashboard renders immediately, and prove
// there is NO login gate (cloud sync is optional).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hellocal_profile', JSON.stringify({ onboardingComplete: true }));
    localStorage.setItem('hellocal_schema_version', '3');
  });
});

test('loads as HelloCal with no auth gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.logo-text')).toContainText('HelloCal');
  // Primary nav present (no sign-in wall).
  await expect(page.getByRole('tab', { name: /Dashboard/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Analytics/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Recipes/ })).toBeVisible();
});

test('logs a meal offline via text (no API key) and updates the day', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/type what you ate/i);
  await input.fill('banana');
  await input.press('Enter'); // submit the form (robust across viewports)
  // Instant-log path shows a confirmation toast.
  await expect(page.locator('.toast')).toContainText(/Logged/i, { timeout: 10_000 });
});

test('backfill: log a meal to a past date via the When control', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/type what you ate/i);
  await input.fill('2 eggs'); // guess confidence -> opens the review modal (not instant-log)
  await input.press('Enter');
  const when = page.getByLabel(/Log date and time/i);
  await expect(when).toBeVisible({ timeout: 10_000 });
  await when.fill('2025-01-15T09:30');
  await page.getByRole('button', { name: /Log Meal/i }).click();
  // The saved log carries the backdated timestamp (well before "now").
  const backdated = await page.evaluate(() => {
    const logs = JSON.parse(localStorage.getItem('hellocal_logs') || '[]');
    const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
    return logs.some((l: { timestamp: number }) => l.timestamp < cutoff);
  });
  expect(backdated).toBe(true);
});

test('instant-logged item can be backfilled to a past date via Edit', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/type what you ate/i);
  await input.fill('banana'); // high-confidence single item -> instant log
  await input.press('Enter');
  // Toast offers an Edit affordance.
  await page.getByRole('button', { name: /^Edit$/ }).click();
  // The When control is now available in edit mode (was hidden before).
  const when = page.getByLabel(/Log date and time/i);
  await expect(when).toBeVisible({ timeout: 10_000 });
  await when.fill('2025-02-10T08:15');
  await page.getByRole('button', { name: /Save Changes|Log Meal/i }).click();
  const backdated = await page.evaluate(() => {
    const logs = JSON.parse(localStorage.getItem('hellocal_logs') || '[]');
    const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
    return logs.some((l: { timestamp: number }) => l.timestamp < cutoff);
  });
  expect(backdated).toBe(true);
});

test('Analytics tab renders the period selector + charts (the fixed feature)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Analytics/ }).click();
  // Upstream period-aware Analytics: 7/14/30-day selector buttons.
  await expect(page.getByRole('button', { name: '7 Days', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '30 Days', exact: true })).toBeVisible();
  // A chart canvas actually mounts (validates Chart.js works in a real browser).
  await expect(page.locator('canvas').first()).toBeVisible();
  // Switching period keeps charts mounted (no crash).
  await page.getByRole('button', { name: '30 Days', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('Recipes tab loads the recipe builder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Recipes/ }).click();
  await expect(page.getByText(/recipe/i).first()).toBeVisible({ timeout: 15_000 });
});

test('hydration: logging water fills the beaker and persists', async ({ page }) => {
  await page.goto('/');
  // The animated hydration beaker is present with quick-add buttons.
  const add250 = page.getByRole('button', { name: '250ml' });
  await expect(add250).toBeVisible({ timeout: 10_000 });
  await add250.click();
  await add250.click(); // 500ml total
  // Consumed total reflects the two logs.
  await expect(page.getByText(/500 \/ \d+ ml/)).toBeVisible();
  // Persisted to the canonical water store.
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem('hellocal_water') || '[]');
      return w.reduce((s: number, e: { milliliters: number }) => s + e.milliliters, 0);
    });
  }).toBe(500);
});

test('adds a supplement and toggles taken (offline)', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Supplement name');
  await expect(input).toBeVisible();
  await input.fill('Vitamin D3');
  await page.getByRole('button', { name: 'Add supplement' }).click();
  // Appears in the list with a taken toggle.
  const toggle = page.getByRole('button', { name: /Mark Vitamin D3 taken/i });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.click();
  await expect(page.getByRole('button', { name: /Mark Vitamin D3 not taken/i })).toBeVisible();
});
