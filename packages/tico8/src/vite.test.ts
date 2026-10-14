import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { tico8 } from './vite.ts'

const roots: string[] = []

/** A project folder holding these files, empty. */
function folder(...files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'tico8-vite-'))
  roots.push(root)
  for (const file of files) writeFileSync(join(root, file), '')
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function core(): Plugin {
  const plugin = tico8().find((p) => p.name === 'tico8')
  if (!plugin) throw new Error('no core plugin')
  return plugin
}

/** Resolves the plugin against a root and loads its entry module. */
function entryFor(root: string): string {
  const plugin = core()
  const configResolved = plugin.configResolved as (c: ResolvedConfig) => void
  configResolved({ root } as ResolvedConfig)
  const load = plugin.load as (id: string) => string
  return load('/@tico8/entry.js')
}

it('the entry imports main.tsx when there is one', () => {
  expect(entryFor(folder('main.ts', 'main.tsx'))).toContain("from '/main.tsx'")
})

it('the entry imports main.ts when it is the only one', () => {
  expect(entryFor(folder('main.ts'))).toContain("from '/main.ts'")
})

it('the entry imports main.tsx when it is the only one', () => {
  expect(entryFor(folder('main.tsx'))).toContain("from '/main.tsx'")
})

it('without a main file the error names both', () => {
  expect(() => entryFor(folder())).toThrow(/main\.tsx or main\.ts/)
})

it('JSX compiles through tico8/ui and preact is prebundled', () => {
  const hook = core().config as (c: UserConfig, e: ConfigEnv) => UserConfig
  const env = { command: 'serve', mode: 'development' } as ConfigEnv
  const result = hook({}, env)
  expect(result.oxc).toMatchObject({
    jsx: { runtime: 'automatic', importSource: 'tico8/ui' },
  })
  expect(result.optimizeDeps?.exclude).toContain('tico8')
  expect(result.optimizeDeps?.include).toContain('tico8 > preact')
})

/** The page the dev server answers an address with, or undefined. */
async function pageAt(url: string): Promise<string | undefined> {
  const plugin = core()
  const configResolved = plugin.configResolved as (c: ResolvedConfig) => void
  configResolved({ root: folder('main.ts') } as ResolvedConfig)
  let handler: (req: unknown, res: unknown, next: () => void) => Promise<void>
  const server = {
    middlewares: { use: (h: typeof handler) => (handler = h) },
    transformIndexHtml: async (_url: string, html: string) => html,
  }
  ;(plugin.configureServer as (s: unknown) => void)(server)
  let body: string | undefined
  const res = { setHeader() {}, end: (text: string) => (body = text) }
  await handler!({ url }, res, () => {})
  return body
}

it('the dev page holds the tabs and the game page the game', async () => {
  expect(await pageAt('/')).toContain('src="/@tico8/shell.js"')
  expect(await pageAt('/?x=1')).toContain('src="/@tico8/shell.js"')
  expect(await pageAt('/@tico8/game')).toContain('src="/@tico8/entry.js"')
  expect(await pageAt('/main.ts')).toBeUndefined()
})

it('the shell module loads the editors from the package', () => {
  const load = core().load as (id: string) => string
  expect(load('/@tico8/shell.js')).toMatch(/^import ".*\/editor\/main\.tsx"\n$/)
})
