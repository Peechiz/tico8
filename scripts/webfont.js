// `node scripts/webfont.js` draws the console's `FONT` as an OpenType font,
// `tico8`, for the UI layer's HTML text. Each pixel is a 100-unit square and
// the em is the font's six rows, so at `font-size: 6px` a font pixel is a
// CSS pixel.
import { writeFileSync } from 'node:fs'
import opentype from 'opentype.js'
import { FONT } from '../packages/tico8/src/text/font.ts'

const target = new URL('../packages/tico8/src/ui/tico8.otf', import.meta.url)

const PIXEL = 100
const ASCENDER = 500
const DESCENDER = ASCENDER - FONT.height * PIXEL

/**
 * A glyph's outline: each row's runs of set pixels as one rectangle, bit 0
 * leftmost, as the console draws them. Row 0's top is the ascender. The
 * rectangles never overlap and all wind the same way, so they fill as one.
 */
function outline(glyph) {
  const path = new opentype.Path()
  glyph.rows.forEach((bits, row) => {
    const top = ASCENDER - row * PIXEL
    const bottom = top - PIXEL
    let col = 0
    while (col < glyph.width) {
      if (!(bits & (1 << col))) {
        col++
        continue
      }
      const from = col
      while (col < glyph.width && bits & (1 << col)) col++
      const left = from * PIXEL
      const right = col * PIXEL
      path.moveTo(left, bottom)
      path.lineTo(right, bottom)
      path.lineTo(right, top)
      path.lineTo(left, top)
      path.close()
    }
  })
  return path
}

function glyphOf(name, glyph, unicode) {
  return new opentype.Glyph({
    name,
    unicode,
    advanceWidth: (glyph.width + FONT.spacing) * PIXEL,
    path: outline(glyph),
  })
}

const glyphs = [glyphOf('.notdef', FONT.missing)]
for (const [char, glyph] of FONT.glyphs) {
  const code = char.codePointAt(0)
  const name =
    char === ' '
      ? 'space'
      : `uni${code.toString(16).toUpperCase().padStart(4, '0')}`
  glyphs.push(glyphOf(name, glyph, code))
}

const font = new opentype.Font({
  familyName: 'tico8',
  styleName: 'Regular',
  unitsPerEm: FONT.height * PIXEL,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs,
})

writeFileSync(target, Buffer.from(font.toArrayBuffer()))
console.log(`wrote ${glyphs.length} glyphs to ${target.pathname}`)
