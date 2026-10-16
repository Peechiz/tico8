import { join } from 'node:path'
import { defineConfig } from 'tsdown'

/**
 * The packed build: `dist/` mirrors `src/`, one JavaScript module and one
 * `.d.ts` per source file, so `project.js` stays a module of its own and
 * the dev tool can serve the project config in its place.
 */
export default defineConfig({
  entry: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/testing.ts',
    '!src/export/fixtures/**',
  ],
  root: 'src',
  outDir: 'dist',
  unbundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2023',
  fixedExtension: false,
  hash: false,
  minify: false,
  tsconfig: '../../tsconfig.json',
  dts: true,
  deps: {
    neverBundle: [
      /^vite(\/|$)/,
      /^typescript(\/|$)/,
      /^preact(\/|$)/,
      /^tico8(\/|$)/,
      /^node:/,
    ],
  },
  copy: ({ outDir }) => [{ from: 'src/ui/tico8.otf', to: join(outDir, 'ui') }],
  banner: ({ fileName }) =>
    fileName === 'cli.js' ? { js: '#!/usr/bin/env node' } : undefined,
})
