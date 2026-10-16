import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, it } from 'vitest'
import { TEMPLATE_DIR } from './create.ts'

const EXAMPLE_DIR = join(import.meta.dirname, '../../../examples/17-scaffold')
const IGNORED = new Set(['node_modules', 'dist'])

/** Every file under a folder, as sorted paths relative to it. */
function files(root: string, dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !IGNORED.has(entry.name))
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(root, join(dir, entry.name))
        : [relative(root, join(dir, entry.name))],
    )
    .sort()
}

/** The template's path for an example path: `.gitignore` is `_gitignore`. */
const inTemplate = (path: string) =>
  path === '.gitignore' ? '_gitignore' : path

const read = (root: string, path: string) => readFileSync(join(root, path))

it('has the same files as the template', () => {
  const example = files(EXAMPLE_DIR).map(inTemplate).sort()
  expect(example).toEqual(files(TEMPLATE_DIR))
})

it('matches the template byte for byte, except package.json', () => {
  for (const path of files(EXAMPLE_DIR)) {
    if (path === 'package.json') continue
    const same = read(EXAMPLE_DIR, path).equals(
      read(TEMPLATE_DIR, inTemplate(path)),
    )
    expect(same, path).toBe(true)
  }
})

it('differs from the template package.json only in name and tico8', () => {
  const template = JSON.parse(read(TEMPLATE_DIR, 'package.json').toString())
  const example = JSON.parse(read(EXAMPLE_DIR, 'package.json').toString())
  expect(example).toEqual({
    ...template,
    name: '17-scaffold',
    dependencies: { ...template.dependencies, tico8: 'workspace:*' },
  })
})
