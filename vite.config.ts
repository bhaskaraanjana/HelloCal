/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Per-file `// @vitest-environment jsdom` opts component tests into a DOM;
    // service tests run on the faster default node env.
    // Only unit/component tests under src/ — Playwright specs live in e2e/.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/hooks/**'],
      exclude: ['**/*.test.*'],
      reporter: ['text-summary'],
    },
  },
})
