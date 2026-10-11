import type { Rect } from '../shapes.ts'

/**
 * Where a line of text sits against its `x`: starting there, centred on it,
 * or ending just before it. Each line of a longer text is placed on its own.
 */
export type Align = 'left' | 'center' | 'right'

/** How text is drawn. Both can be left out. */
export interface TextLook {
  /** The colour of the letters. White when left out. */
  color?: number
  /** `'left'` when left out. */
  align?: Align
}

/**
 * Where text goes and how it looks. `y` is the top of the first line. Any
 * object with `x` and `y` will do, so `text('hi', player)` works.
 */
export interface TextOptions extends TextLook {
  x: number
  y: number
}

/** What a label holds: its place, its look and what it says. */
export interface Label extends TextOptions {
  text: string | number
}

/**
 * A label from the maker: its fields, `draw()` and `bounds`. Neither is a
 * field of the data, so a copy made by spreading is a bare object again.
 */
export type DrawnLabel = Label & {
  draw(): void
  /**
   * The box the label's pixels fall in, worked out from its text and
   * alignment each time it is read. A rect like any other:
   * `fill(title.bounds, COLOR.black)`, `rect.contains(title.bounds, point)`.
   */
  readonly bounds: Rect
}

/** How much room a text takes, in pixels. */
export interface Size {
  width: number
  height: number
}

/** One character's picture. */
export interface Glyph {
  /** How many pixels wide the picture is. */
  width: number
  /**
   * One number per row, from the top of the line down, `Font.height` of
   * them. The pixel in column `c` (0 on the left) is set when
   * `row & (1 << c)` is not 0.
   */
  rows: readonly number[]
}

/** A pixel font: a picture for each character it knows. */
export interface Font {
  /** From the top of one line to the top of the next, in pixels. */
  height: number
  /** The empty columns between one character and the next. */
  spacing: number
  /** Keyed by the character itself: `glyphs.get('A')`, `glyphs.get('♥')`. */
  glyphs: ReadonlyMap<string, Glyph>
  /** Drawn in place of a character the font does not have. */
  missing: Glyph
}

/**
 * The size rules every part agrees on:
 *
 * - A string is walked by code point (`for (const ch of str)`), so `'♥'` is
 *   one character. `\n` starts a new line; `\r` is skipped.
 * - A line is as wide as its glyphs plus `spacing` between each pair, with
 *   none after the last. An empty line is 0 wide.
 * - A text is as wide as its widest line and `height` tall per line, so an
 *   empty string is 0 wide and one line tall.
 * - Left: the line's first column is `floor(x)`. Right: its last column is
 *   `floor(x) - 1`. Centre: its first column is
 *   `floor(x) - floor(width / 2)`.
 */
export type TextRules = never
