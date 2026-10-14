import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { picture } from '../testing.ts'
import { FONT } from './font.ts'
import { SYMBOLS } from './symbols.ts'
import { TOM_THUMB } from './tom-thumb.ts'
import type { Glyph } from './types.ts'

/** A glyph as a text picture: `1` for a set pixel, `0` for an empty one. */
function toPicture(glyph: Glyph): string {
  return glyph.rows
    .map((row) =>
      Array.from({ length: glyph.width }, (_, c) =>
        row & (1 << c) ? '1' : '0',
      ).join(''),
    )
    .join('\n')
}

const drawn = (char: string) => toPicture(FONT.glyphs.get(char)!)

describe('FONT', () => {
  it('is 6 tall with a gap of 1', () => {
    expect(FONT.height).toBe(6)
    expect(FONT.spacing).toBe(1)
  })

  it('draws a capital in the top five rows', () => {
    expect(drawn('A')).toBe(
      picture(`
        .1.
        1.1
        111
        1.1
        1.1
        ...
      `),
    )
  })

  it('hangs the tail of g in the sixth row', () => {
    expect(drawn('g')).toBe(
      picture(`
        ...
        .11
        1.1
        111
        ..1
        .1.
      `),
    )
  })

  it('has accented letters', () => {
    expect(drawn('é')).toBe(
      picture(`
        .1.
        1..
        .11
        111
        .11
        ...
      `),
    )
  })

  it('has a space with nothing in it', () => {
    expect(FONT.glyphs.get(' ')).toEqual({ width: 3, rows: [0, 0, 0, 0, 0, 0] })
  })

  it('draws a heart wider than a letter', () => {
    expect(drawn('♥')).toBe(
      picture(`
        .1.1.
        11111
        11111
        .111.
        ..1..
        .....
      `),
    )
  })

  it('draws a pad button with its letter cut out, six rows tall', () => {
    expect(drawn('Ⓐ')).toBe(
      picture(`
        .11111.
        111.111
        11.1.11
        11...11
        11.1.11
        .11111.
      `),
    )
  })

  it('draws a hollow box for a missing character', () => {
    expect(toPicture(FONT.missing)).toBe(
      picture(`
        111
        1.1
        1.1
        1.1
        111
        ...
      `),
    )
  })

  it('fits every glyph in its cell', () => {
    for (const [char, glyph] of [...FONT.glyphs, ['missing', FONT.missing]] as [
      string,
      Glyph,
    ][]) {
      expect(glyph.rows, char).toHaveLength(FONT.height)
      expect(glyph.width, char).toBeGreaterThan(0)
      for (const row of glyph.rows) {
        expect(row >>> glyph.width, char).toBe(0)
      }
    }
  })

  it('has all of printable ASCII', () => {
    for (let code = 32; code <= 126; code++) {
      const char = String.fromCharCode(code)
      expect(FONT.glyphs.has(char), char).toBe(true)
    }
  })

  it('has every game symbol, each one character long', () => {
    for (const char of '♥●★✧♪←↑→↓ⒶⒷⓍⓎ') {
      expect(FONT.glyphs.has(char), char).toBe(true)
    }
    for (const char of '♥●★✧♪←↑→↓') {
      expect(FONT.glyphs.get(char)!.rows[5], char).toBe(0)
    }
    expect(SYMBOLS.size).toBe(13)
  })

  it('holds all of Tom Thumb and the symbols, with no clashes', () => {
    expect(TOM_THUMB.size).toBe(203)
    expect(FONT.glyphs.size).toBe(TOM_THUMB.size + SYMBOLS.size)
  })
})

describe('tom-thumb.ts', () => {
  it('is what scripts/font.js makes from the BDF', () => {
    const script = new URL('../../../../scripts/font.js', import.meta.url)
    const made = execFileSync(
      process.execPath,
      [fileURLToPath(script), '--print'],
      { encoding: 'utf8' },
    )
    const kept = readFileSync(
      new URL('./tom-thumb.ts', import.meta.url),
      'utf8',
    )
    expect(made).toBe(kept)
  })
})
