export type Rgb = readonly [r: number, g: number, b: number]

/** Sixteen colours, indexed 0-15. */
export type Palette = readonly Rgb[]

export const PICO8: Palette = [
  [0, 0, 0],
  [29, 43, 83],
  [126, 37, 83],
  [0, 135, 81],
  [171, 82, 54],
  [95, 87, 79],
  [194, 195, 199],
  [255, 241, 232],
  [255, 0, 77],
  [255, 163, 0],
  [255, 236, 39],
  [0, 228, 54],
  [41, 173, 255],
  [131, 118, 156],
  [255, 119, 168],
  [255, 204, 170],
]

/** Names for the colours of Pico-8's palette, each its palette index. */
export const COLOR = {
  black: 0,
  darkBlue: 1,
  darkPurple: 2,
  darkGreen: 3,
  brown: 4,
  darkGrey: 5,
  lightGrey: 6,
  white: 7,
  red: 8,
  orange: 9,
  yellow: 10,
  green: 11,
  blue: 12,
  lavender: 13,
  pink: 14,
  lightPeach: 15,
} as const
