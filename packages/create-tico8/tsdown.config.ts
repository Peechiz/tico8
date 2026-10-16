import { defineConfig } from 'tsdown'

/** The packed build: one module per source file, the CLI runnable. */
export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  root: 'src',
  outDir: 'dist',
  unbundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2023',
  fixedExtension: false,
  hash: false,
  minify: false,
  tsconfig: '../../tsconfig.json',
  dts: false,
  deps: { neverBundle: [/^node:/] },
  banner: ({ fileName }) =>
    fileName === 'cli.js' ? { js: '#!/usr/bin/env node' } : undefined,
})
