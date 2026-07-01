/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** Remove impeccable live dev inject so production builds never load localhost:8400. */
function stripImpeccableLiveInject(): Plugin {
  return {
    name: 'strip-impeccable-live-inject',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        /<!--\s*impeccable-live-start\s*-->[\s\S]*?<!--\s*impeccable-live-end\s*-->/gi,
        '',
      );
    },
  };
}

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
  let bundleDigest = ''
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
      // Hash the emitted BYTES (not just filenames) so the cache name reflects actual
      // content. Vite hashes bundle filenames, but capturing content also covers cases
      // where a filename is stable.
      const h = crypto.createHash('sha256')
      for (const f of Object.keys(bundle).sort()) {
        const item = bundle[f]
        h.update(f)
        if (item.type === 'chunk') h.update(item.code)
        else h.update(Buffer.isBuffer(item.source) ? item.source : String(item.source))
      }
      bundleDigest = h.digest('hex')
    },
    closeBundle() {
      const swPath = path.resolve(root, outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const precache = Array.from(new Set([...STATIC, ...assetUrls]))
      // Fold in the on-disk content of the static shell/icons AND the service worker's
      // own source. This is what guarantees a CONTENT-ONLY deploy (editing index.html,
      // manifest.json, offline.html, an icon, or sw.js's own fetch/caching logic)
      // produces a different CACHE_NAME and thus a byte-changed sw.js — the trigger
      // that makes open tabs detect the update and reload. A filename-only hash would
      // miss all of these (no JS/CSS bundle gets renamed).
      const h = crypto.createHash('sha256').update(bundleDigest)
      const seen = new Set<string>()
      for (const rel of [...STATIC, '/sw.js']) {
        const fileRel = rel === '/' ? 'index.html' : rel.replace(/^\//, '')
        const p = path.resolve(root, outDir, fileRel)
        if (seen.has(p)) continue
        seen.add(p)
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) h.update(fs.readFileSync(p))
        } catch { /* ignore unreadable optional asset */ }
      }
      const hash = h.digest('hex').slice(0, 12)
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
  plugins: [react(), stripImpeccableLiveInject(), hellocalServiceWorker()],
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
