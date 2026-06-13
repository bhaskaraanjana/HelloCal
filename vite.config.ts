/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * Rewrites the built dist/sw.js with (1) a content-hashed CACHE_NAME so every
 * content deploy ships a byte-changed service worker (the trigger that makes open
 * tabs detect the update and auto-reload), and (2) a precache manifest expanded to
 * include the actual emitted hashed JS/CSS bundles — so the activate-time purge of
 * the previous build's cache can never strand a tab without the bundles its shell
 * references. Keeps the hand-rolled SW design instead of pulling in Workbox.
 */
function hellocalServiceWorker(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let assetUrls: string[] = []
  const STATIC = [
    '/', '/index.html', '/offline.html', '/manifest.json',
    '/favicon.svg', '/favicon.png', '/icon-192.png', '/icon-512.png',
    '/icons.svg', '/apple-touch-icon.png', '/logo.svg',
  ]
  return {
    name: 'hellocal-sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      root = config.root
    },
    generateBundle(_options, bundle) {
      assetUrls = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/i.test(f))
        .map((f) => '/' + f.split(path.sep).join('/'))
    },
    closeBundle() {
      const swPath = path.resolve(root, outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const precache = Array.from(new Set([...STATIC, ...assetUrls]))
      const hash = crypto.createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 10)
      let sw = fs.readFileSync(swPath, 'utf8')
      sw = sw
        .replace(/const CACHE_NAME = '[^']*';.*$/m, `const CACHE_NAME = 'hellocal-cache-${hash}';`)
        .replace(/const ASSETS_TO_CACHE = \[[\s\S]*?\];.*$/m, `const ASSETS_TO_CACHE = ${JSON.stringify(precache)};`)
      fs.writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), hellocalServiceWorker()],
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
