import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ResolvedConfig } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { dataUrl, inlineAssets } from './inline.ts'
import { renderSounds, SOUNDS_DIR, SOUNDS_FILE } from './sounds.ts'
import { renderSprites, SPRITES_DIR, SPRITES_FILE } from './sprites.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'tico8-inline-'))
  roots.push(root)
  mkdirSync(join(root, SPRITES_DIR))
  mkdirSync(join(root, SOUNDS_DIR))
  return root
}

/** Run the plugin's transform hook the way Vite would. */
function transform(root: string, code: string, id: string): string | undefined {
  const plugin = inlineAssets() as unknown as {
    configResolved: (config: ResolvedConfig) => void
    transform: (code: string, id: string) => { code: string } | undefined
  }
  plugin.configResolved({ root } as ResolvedConfig)
  return plugin.transform(code, id)?.code
}

/** The bytes inside every `data:` URL in the text, in order. */
function decoded(code: string): Buffer[] {
  return [...code.matchAll(/'data:[^;]+;base64,([^']*)'/g)].map((m) =>
    Buffer.from(m[1]!, 'base64'),
  )
}

it('has the build-only plugin shape', () => {
  expect(inlineAssets().apply).toBe('build')
})

it('swaps sheet addresses for data URLs, names that need encoding too', () => {
  const root = project()
  const plain = Buffer.from([1, 2, 3, 250])
  const odd = Buffer.from([9, 8, 7, 255, 0])
  writeFileSync(join(root, SPRITES_DIR, 'hero.png'), plain)
  writeFileSync(join(root, SPRITES_DIR, "it's me.16.png"), odd)
  const code = renderSprites([
    { name: 'hero', file: 'hero.png', cellWidth: 8, cellHeight: 8 },
    { name: 'itsMe', file: "it's me.16.png", cellWidth: 16, cellHeight: 16 },
  ])
  expect(code).toContain('%27')

  const out = transform(root, code, join(root, SPRITES_FILE))!
  expect(out).not.toContain('/sprites/')
  expect(out).toContain("'data:image/png;base64,")
  // Sorted by name: hero, then itsMe.
  expect(decoded(out)).toEqual([plain, odd])
  expect(out).toContain('sheet(')
})

it('swaps sound addresses, with a query on the id', () => {
  const root = project()
  const wav = Buffer.from([0, 1, 2])
  const mp3 = Buffer.from([5, 6, 7, 8])
  writeFileSync(join(root, SOUNDS_DIR, 'big boss.wav'), wav)
  writeFileSync(join(root, SOUNDS_DIR, 'tune.MP3'), mp3)
  const code = renderSounds([
    { name: 'bigBoss', file: 'big boss.wav' },
    { name: 'tune', file: 'tune.MP3' },
  ])

  const out = transform(root, code, `${join(root, SOUNDS_FILE)}?t=1`)!
  expect(out).not.toContain('/sounds/')
  expect(out).toContain("'data:audio/wav;base64,")
  expect(out).toContain("'data:audio/mpeg;base64,")
  expect(decoded(out)).toEqual([wav, mp3])
})

it('handles a call the formatter broke over lines', () => {
  const root = project()
  const file = `${'long '.repeat(20)}name.wav`
  writeFileSync(join(root, SOUNDS_DIR, file), 'x')
  const out = transform(
    root,
    renderSounds([{ name: 'long', file }]),
    join(root, SOUNDS_FILE),
  )!
  expect(out).not.toContain('/sounds/')
  expect(decoded(out)).toEqual([Buffer.from('x')])
})

it('leaves other files untouched', () => {
  const root = project()
  const code = "const a = '/sprites/hero.png'\n"
  expect(transform(root, code, join(root, 'game.ts'))).toBeUndefined()
  expect(
    transform(root, code, join(root, 'nested', SPRITES_FILE)),
  ).toBeUndefined()
})

it('names the file when it is missing', () => {
  const root = project()
  const code = renderSounds([{ name: 'gone', file: 'gone it.wav' }])
  expect(() => transform(root, code, join(root, SOUNDS_FILE))).toThrow(
    /sounds\/gone it\.wav/,
  )
})

it('types a data URL by extension, ignoring case', () => {
  const bytes = new Uint8Array([104, 105])
  const body = ';base64,aGk='
  expect(dataUrl({ file: 'a.png', bytes })).toBe(`data:image/png${body}`)
  expect(dataUrl({ file: 'a.PNG', bytes })).toBe(`data:image/png${body}`)
  expect(dataUrl({ file: 'a.wav', bytes })).toBe(`data:audio/wav${body}`)
  expect(dataUrl({ file: 'a.Ogg', bytes })).toBe(`data:audio/ogg${body}`)
  expect(dataUrl({ file: 'a.mp3', bytes })).toBe(`data:audio/mpeg${body}`)
  expect(dataUrl({ file: 'a.bin', bytes })).toBe(
    `data:application/octet-stream${body}`,
  )
})
