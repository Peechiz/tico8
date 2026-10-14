import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ConfigEnv, UserConfig } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { project, projectName } from './project.ts'

const roots: string[] = []

/** A project folder, with this text as its package.json when given. */
function folder(packageJson?: string): string {
  const parent = mkdtempSync(join(tmpdir(), 'tico8-project-'))
  roots.push(parent)
  const root = join(parent, 'my-game')
  mkdirSync(root)
  if (packageJson !== undefined) {
    writeFileSync(join(root, 'package.json'), packageJson)
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

it('the name is the package name', () => {
  expect(projectName(folder('{"name":"cool-game"}'))).toBe('cool-game')
})

it('the name is the folder name without a package.json', () => {
  expect(projectName(folder())).toBe('my-game')
})

it('the name is the folder name when the package has no name', () => {
  expect(projectName(folder('{"version":"1.0.0"}'))).toBe('my-game')
  expect(projectName(folder('{"name":""}'))).toBe('my-game')
  expect(projectName(folder('{"name":3}'))).toBe('my-game')
})

it('the name is the folder name when the package cannot be parsed', () => {
  expect(projectName(folder('{nope'))).toBe('my-game')
})

it('the plugin defines the project name from the config root', () => {
  const root = folder('{"name":"cool-game"}')
  const hook = project().config as (
    config: UserConfig,
    env: ConfigEnv,
  ) => UserConfig
  const env = { command: 'serve', mode: 'development' } as ConfigEnv
  expect(project().name).toBe('tico8:project')
  expect(hook({ root }, env)).toEqual({
    define: { __TICO8_PROJECT__: '"cool-game"' },
  })
  // No root given: the working folder.
  expect(hook({}, env)).toEqual({
    define: { __TICO8_PROJECT__: JSON.stringify(projectName(process.cwd())) },
  })
})
