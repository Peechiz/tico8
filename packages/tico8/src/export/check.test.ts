import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, test } from 'vitest'
import { typeCheck } from './check.ts'

const fixture = fileURLToPath(new URL('./fixtures/check', import.meta.url))
const pause = fileURLToPath(
  new URL('../../../../examples/12-pause', import.meta.url),
)
// Broken copies go under tico8's node_modules: they still resolve `tico8`,
// and neither git nor the workspace's typecheck sees them.
const scratch = fileURLToPath(new URL('../../node_modules', import.meta.url))

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
