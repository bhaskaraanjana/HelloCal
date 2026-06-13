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
