import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hellocal_profile', JSON.stringify({ onboardingComplete: true }));
    localStorage.setItem('hellocal_schema_version', '3');
    // Seed a meal so the dashboard has data and a stable default panel order.
    localStorage.setItem('hellocal_logs', JSON.stringify([
      { id: 'm1', timestamp: Date.now(), mealType: 'lunch', items: [{ id: 'i1', name: 'Soup', quantity: '1', calories: 320, protein: 12, carbs: 30, fat: 10, confidence: 'high' }] },
    ]));
    // NOTE: do not clear hellocal_dashboard_* here — addInitScript reruns on reload,
    // which would wipe the very state the persistence test verifies. Fresh Playwright
    // contexts already start with empty localStorage.
  });
});

test('panels render with drag handles and settings cogs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-panel-key="calorieHalo"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Drag .* panel/ })).toHaveCount(6);
});

test('collapsing a panel persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse Macronutrients' }).click();
  // Persisted to localStorage.
  await expect.poll(async () => {
    return await page.evaluate(() => localStorage.getItem('hellocal_dashboard_collapsed') || '');
  }).toContain('macros');
  await page.reload();
  // After reload the macros panel shows the Expand affordance (still collapsed).
  await expect(page.getByRole('button', { name: 'Expand Macronutrients' })).toBeVisible();
});

test('per-panel settings drawer opens and exposes config', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Macronutrients settings' }).click();
  await expect(page.getByRole('dialog', { name: /Macronutrients settings/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Apply targets/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hide this panel/i })).toBeVisible();
});

test('micros panel is ultra-customisable: add a custom micronutrient', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Micronutrients settings' }).click();
  await expect(page.getByRole('dialog', { name: /Micronutrients settings/i })).toBeVisible();
  await page.getByLabel('New micronutrient name').fill('Iron');
  await page.getByRole('button', { name: 'Add micronutrient' }).click();
  // Persisted into appSettings.customMicros with a data-backed fieldKey.
  await expect.poll(async () => {
    return await page.evaluate(() => localStorage.getItem('hellocal_app_settings') || '');
  }).toContain('"fieldKey":"iron"');
});

test('drag handle reorders panels (pointer events — works on touch too)', async ({ page }) => {
  await page.goto('/');
  const handle = page.getByRole('button', { name: 'Drag Daily Halo panel' });
  const macros = page.locator('[data-panel-key="macros"]');
  const hb = await handle.boundingBox();
  const mb = await macros.boundingBox();
  expect(hb && mb).toBeTruthy();
  await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200); // arm the long-press
  await page.mouse.move(mb!.x + mb!.width / 2, mb!.y + mb!.height / 2, { steps: 12 });
  await page.waitForTimeout(280); // clear the swap throttle
  await page.mouse.up();
  // Order changed and calorieHalo is no longer first.
  await expect.poll(async () => {
    return await page.evaluate(() => localStorage.getItem('hellocal_dashboard_order') || '');
  }).not.toContain('["calorieHalo"');
});
