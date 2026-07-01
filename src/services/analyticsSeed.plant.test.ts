import { it, expect } from 'vitest';
import { analyticsSeedLocalStorage } from './analyticsSeed';

/** Run: npm run seed:analytics */
it('prints a browser console snippet to plant demo data', () => {
  const seed = analyticsSeedLocalStorage();
  const lines = [
    '// Paste into DevTools console on HelloCal, then reload:',
    '(() => {',
    ...Object.entries(seed).map(
      ([key, value]) => `  localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`
    ),
    '  location.reload();',
    '})();',
  ];
  const snippet = '\n' + lines.join('\n') + '\n';
  // eslint-disable-next-line no-console
  console.log(snippet);
  expect(snippet.length).toBeGreaterThan(500);
});
