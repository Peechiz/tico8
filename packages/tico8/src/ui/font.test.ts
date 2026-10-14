import { readFileSync } from 'node:fs'
import { type Glyph as OtfGlyph, parse } from 'opentype.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FONT } from '../text/font.ts'
import type { Glyph } from '../text/types.ts'
import { addFont } from './font.ts'

const file = readFileSync(new URL('./tico8.otf', import.meta.url))
const font = parse(
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
)

const PIXEL = 100
const ASCENDER = 500

type Point = { x: number; y: number }

/** The outline as closed polygons; the font only uses straight lines. */
function polygons(glyph: OtfGlyph): Point[][] {
  const result: Point[][] = []
  let current: Point[] = []
  for (const command of glyph.path.commands) {
    if (command.type === 'M') {
      if (current.length) result.push(current)
      current = [{ x: command.x, y: command.y }]
    } else if (command.type === 'L')
      current.push({ x: command.x, y: command.y })
    else if (command.type === 'Z') {
      result.push(current)
      current = []
    } else throw new Error(`unexpected curve in ${glyph.name}`)
  }
  if (current.length) result.push(current)
  return result
}

/** The nonzero winding number of the outline around a point. */
function winding(shapes: Point[][], p: Point): number {
  let total = 0
  for (const shape of shapes) {
    for (const [i, a] of shape.entries()) {
      const b = shape[(i + 1) % shape.length] as Point
      if (a.y <= p.y && b.y > p.y) {
        if ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0) total++
      } else if (a.y > p.y && b.y <= p.y) {
        if ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0) total--
      }
    }
  }
  return total
}

/** Sample each pixel's centre back into rows, bit 0 leftmost. */
function rasterise(glyph: OtfGlyph, width: number): number[] {
  const shapes = polygons(glyph)
  const rows: number[] = []
  for (let row = 0; row < FONT.height; row++) {
    let bits = 0
    const y = ASCENDER - row * PIXEL - PIXEL / 2
    // One column either side catches anything drawn outside the glyph.
    for (let col = -1; col <= width; col++) {
      if (winding(shapes, { x: col * PIXEL + PIXEL / 2, y }) === 0) continue
      if (col < 0 || col >= width)
        throw new Error(`pixel outside ${glyph.name}`)
      bits |= 1 << col
    }
    rows.push(bits)
  }
  return rows
}

function padded(glyph: Glyph): number[] {
  return Array.from({ length: FONT.height }, (_, i) => glyph.rows[i] ?? 0)
}

describe('tico8.otf', () => {
  it('has the console metrics', () => {
    expect(font.getEnglishName('fontFamily')).toBe('tico8')
    expect(font.unitsPerEm).toBe(600)
    expect(font.ascender).toBe(500)
    expect(font.descender).toBe(-100)
  })

  it('draws every glyph as its pixels, as wide as it advances', () => {
    expect(font.glyphs.length).toBe(FONT.glyphs.size + 1)
    for (const [char, glyph] of FONT.glyphs) {
      const otf = font.charToGlyph(char)
      expect(otf.unicode, char).toBe(char.codePointAt(0))
      expect(otf.advanceWidth, char).toBe((glyph.width + FONT.spacing) * PIXEL)
      expect(rasterise(otf, glyph.width), char).toEqual(padded(glyph))
    }
  })

  it('draws .notdef as the missing glyph', () => {
    const notdef = font.glyphs.get(0)
    expect(notdef.name).toBe('.notdef')
    expect(notdef.advanceWidth).toBe(
      (FONT.missing.width + FONT.spacing) * PIXEL,
    )
    expect(rasterise(notdef, FONT.missing.width)).toEqual(padded(FONT.missing))
  })
})

describe('addFont', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFontFace() {
    const load = vi.fn(() => Promise.resolve())
    const FontFace = vi.fn(function (
      this: object,
      family: string,
      source: string,
    ) {
      Object.assign(this, { family, source, load })
    })
    vi.stubGlobal('FontFace', FontFace)
    return { FontFace, load }
  }

  function fakeDocument() {
    const add = vi.fn()
    return { add, document: { fonts: { add } } as unknown as Document }
  }

  it('adds the tico8 face from the font file once per document', () => {
    const { FontFace, load } = stubFontFace()
    const { add, document } = fakeDocument()
    addFont(document)
    addFont(document)
    expect(FontFace).toHaveBeenCalledOnce()
    expect(FontFace).toHaveBeenCalledWith(
      'tico8',
      expect.stringMatching(/^url\(.*tico8\.otf\)$/),
    )
    expect(add).toHaveBeenCalledOnce()
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'tico8' }),
    )
    expect(load).toHaveBeenCalledOnce()

    const other = fakeDocument()
    addFont(other.document)
    expect(other.add).toHaveBeenCalledOnce()
  })

  it('does nothing without FontFace', () => {
    vi.stubGlobal('FontFace', undefined)
    const { add, document } = fakeDocument()
    addFont(document)
    expect(add).not.toHaveBeenCalled()
  })
})
