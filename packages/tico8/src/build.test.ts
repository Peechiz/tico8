import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'tsdown'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { picture, toPicture } from './testing.ts'

const pkg = dirname(dirname(fileURLToPath(import.meta.url)))

// Inside the package, so the built files resolve `preact`, `vite` and
// `tico8` from its node_modules the way an installed copy would.
const scratch = join(pkg, 'node_modules', '.tmp')
let out = ''

beforeAll(async () => {
  await mkdir(scratch, { recursive: true })
  out = await mkdtemp(join(scratch, 'build-'))
  await build({ cwd: pkg, outDir: out, logLevel: 'silent' })
}, 120_000)

afterAll(async () => {
  if (out) await rm(out, { recursive: true, force: true })
})

it('draws with the built engine', async () => {
  const engine = await import(pathToFileURL(join(out, 'index.js')).href)
  const { display } = await import(pathToFileURL(join(out, 'console.js')).href)
  engine.clear(1)
  engine.pixel(1, 1, engine.COLOR.red)
  engine.pixel(engine.vec(2, 0), engine.COLOR.green)
  const corner = {
    ...display,
    width: 4,
    height: 3,
    pixels: crop(display, 4, 3),
  }
  expect(toPicture(corner)).toBe(
    picture(`
      11b1
      1811
      1111
    `),
  )
})

it('keeps one module per source file, project.js among them', () => {
  for (const file of ['project.js', 'cli.js', 'editor/main.js', 'ui/menu.js']) {
    expect(existsSync(join(out, file)), file).toBe(true)
  }
  expect(existsSync(join(out, 'testing.js'))).toBe(false)
  expect(existsSync(join(out, 'screen.test.js'))).toBe(false)
  expect(existsSync(join(out, 'export/fixtures'))).toBe(false)
})

it('keeps import.meta.hot, the font file and the cli shebang', async () => {
  expect(await readFile(join(out, 'assets/sheets.js'), 'utf8')).toContain(
    'import.meta.hot',
  )
  expect(await readFile(join(out, 'ui/font.js'), 'utf8')).toContain(
    'new URL("./tico8.otf", import.meta.url)',
  )
  expect(existsSync(join(out, 'ui/tico8.otf'))).toBe(true)
  expect(await readFile(join(out, 'cli.js'), 'utf8')).toMatch(
    /^#!\/usr\/bin\/env node\n/,
  )
})

it('writes declarations for every entry point, importing .js files', async () => {
  const manifest = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
  const exports: Record<string, { types: string }> =
    manifest.publishConfig.exports
  for (const { types } of Object.values(exports)) {
    const file = join(out, types.replace(/^\.\/dist\//, ''))
    expect(existsSync(file), types).toBe(true)
  }
  const index = await readFile(join(out, 'index.d.ts'), 'utf8')
  expect(index).toContain('from "./vec.js"')
  expect(index).not.toMatch(/from "\.[^"]*\.tsx?"/)
})

/** The top left `width` by `height` pixels of a screen. */
function crop(
  screen: { width: number; pixels: Uint8Array },
  width: number,
  height: number,
): Uint8Array {
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    pixels.set(
      screen.pixels.subarray(y * screen.width, y * screen.width + width),
      y * width,
    )
  }
  return pixels
}
