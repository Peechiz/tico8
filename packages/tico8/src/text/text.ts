import { COLOR } from '../palette.ts'
import type { Screen } from '../screen.ts'
import type { Rect } from '../shapes.ts'
import type {
  Align,
  DrawnLabel,
  Font,
  Glyph,
  Label,
  Size,
  TextOptions,
} from './types.ts'

type Value = string | number

/** The glyphs of a line, in order. `\r` is skipped. */
function glyphsOf(font: Font, line: string): Glyph[] {
  const glyphs: Glyph[] = []
  for (const ch of line) {
    if (ch === '\r') continue
    glyphs.push(font.glyphs.get(ch) ?? font.missing)
  }
  return glyphs
}

function lineWidth(font: Font, glyphs: readonly Glyph[]): number {
  if (glyphs.length === 0) return 0
  let width = font.spacing * (glyphs.length - 1)
  for (const g of glyphs) width += g.width
  return width
}

/** How much room a text takes: its widest line, and a row of height per line. */
export function measureText(font: Font, value: Value): Size {
  const lines = String(value).split('\n')
  let width = 0
  for (const line of lines) {
    width = Math.max(width, lineWidth(font, glyphsOf(font, line)))
  }
  return { width, height: font.height * lines.length }
}

/** The column a line of this width starts in. */
function startColumn(x: number, width: number, align: Align): number {
  x = Math.floor(x)
  if (align === 'right') return x - width
  if (align === 'center') return x - Math.floor(width / 2)
  return x
}

function drawGlyph(
  screen: Screen,
  glyph: Glyph,
  height: number,
  x: number,
  y: number,
  color: number,
) {
  for (let row = 0; row < height; row++) {
    const bits = glyph.rows[row] ?? 0
    let col = 0
    while (col < glyph.width) {
      if (!(bits & (1 << col))) {
        col++
        continue
      }
      const from = col
      while (col < glyph.width && bits & (1 << col)) col++
      screen.span(x + from, y + row, col - from, color)
    }
  }
}

/** The text functions, drawing `font` to `screen`. */
export function createText(screen: Screen, font: Font) {
  function draw(value: Value, options: Readonly<TextOptions>): void {
    const color = options.color ?? COLOR.white
    const align = options.align ?? 'left'
    let y = Math.floor(options.y)
    for (const line of String(value).split('\n')) {
      const glyphs = glyphsOf(font, line)
      let x = startColumn(options.x, lineWidth(font, glyphs), align)
      for (const glyph of glyphs) {
        drawGlyph(screen, glyph, font.height, x, y, color)
        x += glyph.width + font.spacing
      }
      y += font.height
    }
  }

  const drawable: ThisType<Label> & { draw(): void; readonly bounds: Rect } = {
    draw() {
      draw(this.text, this)
    },
    get bounds(): Rect {
      const size = measureText(font, this.text)
      return {
        x: startColumn(this.x, size.width, this.align ?? 'left'),
        y: Math.floor(this.y),
        width: size.width,
        height: size.height,
      }
    },
  }

  /**
   * Draw text: `text('Score 10', { x: 2, y: 2, color: COLOR.white })`. Any
   * object with `x` and `y` will do. `text.measure(value)` says how much room
   * a text takes.
   */
  const text = Object.assign(draw, {
    measure: (value: Value): Size => measureText(font, value),
  })

  /**
   * Make a label, which holds its place, look and words and draws them with
   * `draw()`: `label({ x, y, text: 'Game Over', align: 'center' })`.
   */
  function label({
    x,
    y,
    text = '',
    color,
    align,
  }: Readonly<TextOptions & { text?: Value }>): DrawnLabel {
    const made: DrawnLabel = Object.assign(Object.create(drawable), {
      x,
      y,
      text,
    })
    if (color !== undefined) made.color = color
    if (align !== undefined) made.align = align
    return made
  }

  return { text, label }
}
