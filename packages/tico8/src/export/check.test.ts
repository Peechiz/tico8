import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, test } from 'vitest'
import { SETTINGS, typeCheck } from './check.ts'

const fixture = fileURLToPath(new URL('./fixtures/check', import.meta.url))
const pause = fileURLToPath(
  new URL('../../../../examples/12-pause', import.meta.url),
)
// Broken copies go under tico8's node_modules: they still resolve `tico8`,
// and neither git nor the workspace's typecheck sees them.
const scratch = fileURLToPath(new URL('../../node_modules', import.meta.url))
const gameConfig = fileURLToPath(
  new URL('../../tsconfig.game.json', import.meta.url),
)

let temp: string | undefined

afterEach(async () => {
  if (temp) await rm(temp, { recursive: true, force: true })
  temp = undefined
})

test('a clean game checks with no errors', async () => {
  const result = await typeCheck({ root: fixture })
  expect(result.output).toBe('')
  expect(result.errors).toBe(0)
})

test('a real example with UI and engine source checks clean', async () => {
  const result = await typeCheck({ root: pause })
  expect(result.output).toBe('')
  expect(result.errors).toBe(0)
})

test('a type error is counted and printed with its file', async () => {
  temp = await mkdtemp(join(scratch, '.check-'))
  const main = await readFile(join(fixture, 'main.ts'), 'utf8')
  const broken = `${main}\nconst count: number = 'three'\nconst name: string = 4\n`
  await writeFile(join(temp, 'main.ts'), broken)
  const result = await typeCheck({ root: temp })
  expect(result.errors).toBe(2)
  expect(result.output).toContain('main.ts')
  expect(result.output).toContain('TS2322')
})

test("a project's own tsconfig.json is used", async () => {
  temp = await mkdtemp(join(scratch, '.check-'))
  // An error under tico8's noUncheckedIndexedAccess, fine without it.
  await writeFile(
    join(temp, 'main.ts'),
    'export const fixed = [1][0].toFixed()\n',
  )
  expect((await typeCheck({ root: temp })).errors).toBe(1)
  const config = {
    compilerOptions: { strict: true, types: [] },
    files: ['main.ts'],
  }
  await writeFile(join(temp, 'tsconfig.json'), JSON.stringify(config))
  expect(await typeCheck({ root: temp })).toEqual({ errors: 0, output: '' })
})

test('SETTINGS are the compilerOptions of tsconfig.game.json', async () => {
  const { compilerOptions } = JSON.parse(await readFile(gameConfig, 'utf8'))
  const flags = Object.entries(compilerOptions).flatMap(([name, value]) => {
    if (value === true) return [`--${name}`]
    if (Array.isArray(value)) return [`--${name}`, value.join(',')]
    return [`--${name}`, String(value)]
  })
  expect(flags).toEqual(SETTINGS)
})

test('a project extending tico8/tsconfig checks JSX and CSS, and fails on an error', async () => {
  temp = await mkdtemp(join(scratch, '.check-'))
  const config = { extends: 'tico8/tsconfig' }
  await writeFile(join(temp, 'tsconfig.json'), JSON.stringify(config))
  const main = [
    "import { COLOR } from 'tico8'",
    "import { Menu } from 'tico8/ui'",
    "import './ui.css'",
    '',
    'export const ui = (',
    '  <Menu class="menu">',
    '    <p>Colour {COLOR.red}</p>',
    '  </Menu>',
    ')',
    '',
  ].join('\n')
  await writeFile(join(temp, 'main.tsx'), main)
  await writeFile(join(temp, 'ui.css'), '.menu { color: red }\n')
  expect(await typeCheck({ root: temp })).toEqual({ errors: 0, output: '' })

  await writeFile(
    join(temp, 'main.tsx'),
    `${main}export const red: string = COLOR.red\n`,
  )
  const result = await typeCheck({ root: temp })
  expect(result.errors).toBe(1)
  expect(result.output).toContain('main.tsx')
})
