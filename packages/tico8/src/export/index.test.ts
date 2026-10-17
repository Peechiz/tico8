import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { exportGame, formatSize } from './index.ts'

const fixture = fileURLToPath(new URL('./fixtures/game', import.meta.url))
const quiet = fileURLToPath(new URL('./fixtures/quiet', import.meta.url))
const temp = mkdtempSync(join(tmpdir(), 'tico8-export-'))

afterAll(() => rmSync(temp, { recursive: true, force: true }))

describe('exportGame', () => {
  it('checks, builds and writes the game as one page', async () => {
    const out = join(temp, 'game.html')
    const { path, bytes } = await exportGame({ root: fixture, out })
    expect(path).toBe(out)
    const html = readFileSync(out, 'utf8')
    expect(bytes).toBe(Buffer.byteLength(html))
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<title>export-fixture</title>')
    expect(html).toContain('<script type="module">')
    expect(html).toContain('data:image/png;base64,')
    expect(html).toContain('.fixture-banner')
    expect(html).not.toMatch(/<script[^>]* src=/)
  }, 60_000)

  it('lists the assets largest first and warns about a wav', async () => {
    const out = join(temp, 'loud.html')
    const { assets, warnings } = await exportGame({
      root: fixture,
      out,
      check: false,
    })
    expect(assets).toEqual([
      { path: 'sounds/blip.wav', bytes: 108 },
      { path: 'sprites/dot.png', bytes: 81 },
    ])
    expect(warnings).toEqual([
      'sounds/blip.wav is 108 B of uncompressed audio: ' +
        'an ogg or mp3 is about a tenth of that',
    ])
  }, 60_000)

  it('has nothing to warn about without a wav', async () => {
    const out = join(temp, 'quiet.html')
    const { assets, warnings } = await exportGame({
      root: quiet,
      out,
      check: false,
    })
    expect(assets).toEqual([
      { path: 'sprites/dot.png', bytes: 81 },
      { path: 'sounds/blip.ogg', bytes: 12 },
    ])
    expect(warnings).toEqual([])
  }, 60_000)
})

describe('formatSize', () => {
  it('reads as bytes, kilobytes or megabytes', () => {
    expect(formatSize(812)).toBe('812 B')
    expect(formatSize(217_498)).toBe('212.4 KB')
    expect(formatSize(1_363_149)).toBe('1.3 MB')
  })
})
