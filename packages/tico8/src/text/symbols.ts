import type { Glyph } from './types.ts'

/**
 * A glyph from a text picture: `#` is a set pixel, anything else is empty.
 * Every row must be the same length, which is the glyph's width.
 */
function drawn(text: string): Glyph {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const width = lines[0]?.length ?? 0
  const rows = lines.map((line) => {
    if (line.length !== width) throw new Error(`Uneven glyph row "${line}"`)
    let row = 0
    for (let c = 0; c < width; c++) if (line[c] === '#') row |= 1 << c
    return row
  })
  return { width, rows }
}

/**
 * The game symbols, drawn by hand to sit beside Tom Thumb's capitals: five
 * rows of picture and an empty sixth, where letters like `g` hang. The pad
 * buttons alone fill all six.
 */
export const SYMBOLS: ReadonlyMap<string, Glyph> = new Map([
  [
    '♥',
    drawn(`
      .#.#.
      #####
      #####
      .###.
      ..#..
      .....
    `),
  ],
  [
    '●',
    drawn(`
      .###.
      #####
      #####
      #####
      .###.
      .....
    `),
  ],
  [
    '★',
    drawn(`
      ..#..
      #####
      .###.
      ##.##
      #...#
      .....
    `),
  ],
  [
    '♪',
    drawn(`
      ..##.
      ..#.#
      ..#..
      ###..
      ###..
      .....
    `),
  ],
  [
    '←',
    drawn(`
      ..#..
      .#...
      #####
      .#...
      ..#..
      .....
    `),
  ],
  [
    '↑',
    drawn(`
      ..#..
      .###.
      #.#.#
      ..#..
      ..#..
      .....
    `),
  ],
  [
    '→',
    drawn(`
      ..#..
      ...#.
      #####
      ...#.
      ..#..
      .....
    `),
  ],
  [
    '↓',
    drawn(`
      ..#..
      ..#..
      #.#.#
      .###.
      ..#..
      .....
    `),
  ],
  // The pad buttons: a filled button with the letter cut out of it. They
  // use the sixth row too, which gives the letter four rows to be read in.
  [
    'Ⓐ',
    drawn(`
      .#####.
      ###.###
      ##.#.##
      ##...##
      ##.#.##
      .#####.
    `),
  ],
  [
    'Ⓑ',
    drawn(`
      .#####.
      ##.####
      ##..###
      ##.#.##
      ##..###
      .#####.
    `),
  ],
  [
    'Ⓧ',
    drawn(`
      .#####.
      ##.#.##
      ###.###
      ###.###
      ##.#.##
      .#####.
    `),
  ],
  [
    'Ⓨ',
    drawn(`
      .#####.
      ##.#.##
      ##.#.##
      ###.###
      ###.###
      .#####.
    `),
  ],
])
