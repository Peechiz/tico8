import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { modulePath } from './module-path.ts'

/** A folder holding these files, empty, and the URL of `name` in it. */
function folder(...files: string[]): (name: string) => URL {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tico8-module-path-')))
  for (const file of files) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), '')
  }
  return (name) => pathToFileURL(join(root, name))
}

it('finds the source file', () => {
  const at = folder('project.ts')
  expect(modulePath(at('project.ts'))).toBe(
    join(at('.').pathname, 'project.ts'),
  )
})

it('finds the built file when only that is there', () => {
  const at = folder('editor/main.js')
  expect(modulePath(at('editor/main.tsx'))).toBe(
    join(at('.').pathname, 'editor/main.js'),
  )
})

it('prefers the source when both are there', () => {
  const at = folder('project.ts', 'project.js')
  expect(modulePath(at('project.ts'))).toMatch(/project\.ts$/)
})

it('throws when neither is there', () => {
  const at = folder()
  expect(() => modulePath(at('project.ts'))).toThrow(/does not exist/)
})
