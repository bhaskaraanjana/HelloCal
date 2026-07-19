import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Load TypeScript seed via dynamic import of a small compiled inline seed.
// Re-implement a compact seed matching production storage keys (schema v4).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../.github/assets');
const BASE = process.env.HELLOCAL_URL || 'https://cal.infinitemind.space';

const MS_DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function meal(dayOffset, hour, mealType, items) {
  const ts = startOfDay(now) + dayOffset * MS_DAY + hour * 3600_000;
  return {
    id: `seed-${dayOffset}-${mealType}`,
    timestamp: ts,
    mealType,
    items: items.map((it, i) => ({
      id: `seed-item-${dayOffset}-${mealType}-${i}`,
      quantity: '1 serving',
      confidence: 'high',
      ...it,
    })),
  };
}

const logs = [];
const waterLogs = [];
for (let offset = -13; offset <= 0; offset++) {
  const isWeekend = [0, 6].includes(new Date(startOfDay(now) + offset * MS_DAY).getDay());
  const base = isWeekend ? 2450 : 1980;
  const jitter = (offset * 37) % 280;
  const cal = base + jitter - (offset === -3 ? 400 : 0);
  const protein = isWeekend ? 95 : offset % 4 === 0 ? 110 : 145;
  const b = Math.round(cal * 0.2);
  const l = Math.round(cal * 0.42);
  const d = Math.round(cal * 0.38);
  const p = protein / 3;
  logs.push(
    meal(offset, 8, 'breakfast', [
      { name: 'Oatmeal & berries', calories: b, protein: p, carbs: Math.round(b * 0.55), fat: Math.round(b * 0.15), fiber: 8 },
    ]),
    meal(offset, 13, 'lunch', [
      { name: 'Grilled chicken salad', calories: l, protein: p * 1.2, carbs: Math.round(l * 0.25), fat: Math.round(l * 0.3) },
    ]),
    meal(offset, 19, 'dinner', [
      { name: 'Salmon rice bowl', calories: d, protein: p, carbs: Math.round(d * 0.4), fat: Math.round(d * 0.28) },
    ]),
  );
  if (offset % 2 === 0) {
    logs.push(
      meal(offset, 16, 'snack', [
        { name: 'Protein shake', calories: 150, protein: 25, carbs: 6, fat: 2 },
      ]),
    );
  }
  const waterTarget = isWeekend ? 1600 : 2100 + (Math.abs(offset) % 3) * 150;
  let remaining = waterTarget;
  let slot = 9;
  while (remaining > 0) {
    const sip = Math.min(remaining, remaining > 700 ? 500 : remaining > 300 ? 350 : remaining);
    waterLogs.push({
      id: `w-${offset}-${slot}`,
      timestamp: startOfDay(now) + offset * MS_DAY + slot * 3600_000,
      milliliters: sip,
    });
    remaining -= sip;
    slot += 2;
  }
}

const seed = {
  hellocal_profile: JSON.stringify({ onboardingComplete: true }),
  hellocal_schema_version: '4',
  hellocal_logs: JSON.stringify(logs),
  hellocal_water: JSON.stringify(waterLogs),
  hellocal_supplements: JSON.stringify([
    { id: 's1', name: 'Vitamin D', dose: '2000 IU', frequency: 'daily', takenToday: true, lastTakenAt: now - 3600_000 },
    { id: 's2', name: 'Omega-3', dose: '1g', frequency: 'daily', takenToday: false },
    { id: 's3', name: 'Magnesium', dose: '200mg', frequency: 'daily', takenToday: true, lastTakenAt: now - 7200_000 },
  ]),
  hellocal_goals: JSON.stringify({
    calories: 2200,
    protein: 160,
    carbs: 220,
    fat: 70,
    hydration: 2500,
    fiber: 28,
    sodium: 2300,
    addedSugar: 30,
  }),
  hellocal_workouts: '[]',
  hellocal_hydration: '[]',
  hellocal_recipes: JSON.stringify([
    {
      id: 'r1',
      name: 'Power breakfast bowl',
      servings: 1,
      items: [
        { id: 'ri1', name: 'Greek yogurt', quantity: '200g', calories: 130, protein: 20, carbs: 8, fat: 2, confidence: 'high' },
        { id: 'ri2', name: 'Granola', quantity: '40g', calories: 180, protein: 4, carbs: 28, fat: 6, confidence: 'high' },
      ],
      notes: 'Demo recipe for README screenshots',
    },
  ]),
};

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  serviceWorkers: 'block',
});

await context.addInitScript((entries) => {
  for (const [k, v] of Object.entries(entries)) {
    localStorage.setItem(k, v);
  }
}, seed);

const page = await context.newPage();
page.setDefaultTimeout(30000);

console.log('Opening', BASE);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const check = await page.evaluate(() => ({
  logs: JSON.parse(localStorage.getItem('hellocal_logs') || '[]').length,
  water: JSON.parse(localStorage.getItem('hellocal_water') || '[]').length,
  version: localStorage.getItem('hellocal_schema_version'),
  profile: localStorage.getItem('hellocal_profile'),
}));
console.log('seed check', check);

// Wait for main UI
await page.locator('.logo-text, text=HelloCal').first().waitFor({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);

await page.screenshot({ path: path.join(outDir, 'dashboard.png'), fullPage: false });
console.log('wrote dashboard.png');

await page.evaluate(() => window.scrollBy(0, 480));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'dashboard-panels.png'), fullPage: false });
console.log('wrote dashboard-panels.png');

await page.getByRole('tab', { name: /Timeline/i }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, 'timeline.png'), fullPage: false });
console.log('wrote timeline.png');

await page.getByRole('tab', { name: /Analytics/i }).click();
await page.waitForTimeout(2800);
await page.screenshot({ path: path.join(outDir, 'analytics.png'), fullPage: false });
console.log('wrote analytics.png');

await page.getByRole('tab', { name: /Recipes/i }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, 'recipes.png'), fullPage: false });
console.log('wrote recipes.png');

await page.getByRole('tab', { name: /Settings/i }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(outDir, 'settings.png'), fullPage: false });
console.log('wrote settings.png');

await page.getByRole('tab', { name: /Dashboard/i }).click();
await page.waitForTimeout(600);
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'dashboard-mobile.png'), fullPage: false });
console.log('wrote dashboard-mobile.png');

await page.getByRole('tab', { name: /Analytics/i }).click();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, 'analytics-mobile.png'), fullPage: false });
console.log('wrote analytics-mobile.png');

await browser.close();
console.log('Done →', outDir);
