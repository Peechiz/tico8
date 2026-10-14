import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { exportGame, formatSize } from './index.ts'

const fixture = fileURLToPath(new URL('./fixtures/game', import.meta.url))
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
})

describe('formatSize', () => {
  it('reads as bytes, kilobytes or megabytes', () => {
    expect(formatSize(812)).toBe('812 B')
    expect(formatSize(217_498)).toBe('212.4 KB')
    expect(formatSize(1_363_149)).toBe('1.3 MB')
  })
})
