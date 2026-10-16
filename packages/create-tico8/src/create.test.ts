import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { defaultTico8Spec, isEmptyDir, writeProjectFrom } from './create.ts'

let root: string
let template: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'create-tico8-'))
  template = join(root, 'template')
  mkdirSync(join(template, 'sprites'), { recursive: true })
  writeFileSync(
    join(template, 'package.json'),
    JSON.stringify({ name: 'my-game', dependencies: { tico8: '^9.9.9' } }),
  )
  writeFileSync(join(template, '_gitignore'), 'node_modules\n')
  writeFileSync(join(template, 'main.ts'), 'export {}\n')
  writeFileSync(join(template, 'sprites', 'player.png'), Buffer.from([1, 2, 3]))
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

it('copies the template and sets the name and tico8 spec', () => {
  const dir = join(root, 'out', 'game')
  writeProjectFrom(template, { dir, name: 'cool-game', tico8: 'file:t.tgz' })

  expect(readFileSync(join(dir, 'main.ts'), 'utf8')).toBe('export {}\n')
  expect([...readFileSync(join(dir, 'sprites', 'player.png'))]).toEqual([
    1, 2, 3,
  ])
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('node_modules\n')
  expect(existsSync(join(dir, '_gitignore'))).toBe(false)
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  expect(pkg.name).toBe('cool-game')
  expect(pkg.dependencies.tico8).toBe('file:t.tgz')
})

it('refuses names npm would not accept', () => {
  const bad = [
    '',
    'Upper',
    'has space',
    '.dot',
    '_under',
    'a'.repeat(215),
    '@s/',
    '@/x',
  ]
  for (const name of bad) {
    const dir = join(root, 'bad')
    expect(() =>
      writeProjectFrom(template, { dir, name, tico8: '^0.0.0' }),
    ).toThrow()
    expect(existsSync(dir)).toBe(false)
  }
  const dir = join(root, 'ok')
  writeProjectFrom(template, { dir, name: '@me/my-game', tico8: '^0.0.0' })
  expect(existsSync(join(dir, 'main.ts'))).toBe(true)
})

it('treats a missing folder or one holding only .git as empty', () => {
  expect(isEmptyDir(join(root, 'nope'))).toBe(true)
  const dir = join(root, 'repo')
  mkdirSync(join(dir, '.git'), { recursive: true })
  expect(isEmptyDir(dir)).toBe(true)
  writeFileSync(join(dir, 'a.txt'), '')
  expect(isEmptyDir(dir)).toBe(false)
})

it('reads its own version for the default spec', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  )
  expect(defaultTico8Spec()).toBe(`^${pkg.version}`)
})
