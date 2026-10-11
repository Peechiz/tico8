export type Rgb = readonly [r: number, g: number, b: number]

/** A list of colours; a colour's number is its place in the list. */
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

/**
 * The most colours the screen can tell apart: it holds one byte per pixel,
 * and one value marks see-through pixels in sprite sheets.
 */
export const MAX_COLORS = 255

/** Names for the colours of Pico-8's palette, each its palette index. */
export const PICO8_NAMES = {
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

/**
 * Turn a palette as a game writes it, names and hex colours in palette
 * order, into its colours and each name's place among them. Throws for one
 * that cannot be used, naming the colour at fault.
 */
export function readPalette(written: Readonly<Record<string, string>>): {
  colors: Rgb[]
  names: Record<string, number>
} {
  if (typeof written !== 'object' || written === null) {
    throw new Error(
      "tico8: a palette is names and colours, such as { ink: '#1b1b2f' }",
    )
  }
  const entries = Object.entries(written)
  if (entries.length === 0) {
    throw new Error('tico8: a palette needs at least one colour')
  }
  if (entries.length > MAX_COLORS) {
    throw new Error(
      `tico8: the palette has ${entries.length} colours, and the screen ` +
        `can show ${MAX_COLORS} at most`,
    )
  }
  const colors: Rgb[] = []
  const names: Record<string, number> = {}
  for (const [name, hex] of entries) {
    // A name is read as `COLOR.name`. One starting with a digit is refused
    // for a second reason: such keys do not keep the order they are written
    // in, so the palette's order would not be the code's.
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(
        `tico8: the palette name "${name}" cannot be used: a name is ` +
          'letters and digits, starting with a letter',
      )
    }
    names[name] = colors.length
    colors.push(readHex(name, hex))
  }
  return { colors, names }
}

/** `#rrggbb` or `#rgb`, in either case. */
function readHex(name: string, hex: unknown): Rgb {
  const match =
    typeof hex === 'string' &&
    /^#(?:([0-9a-f]{6})|([0-9a-f]{3}))$/i.exec(hex.trim())
  if (!match) {
    const got = typeof hex === 'string' ? `'${hex}'` : String(hex)
    throw new Error(
      `tico8: the palette colour "${name}" must be a hex colour such as ` +
        `'#1b1b2f', got ${got}`,
    )
  }
  const digits = match[1] ?? [...match[2]!].map((d) => d + d).join('')
  const value = Number.parseInt(digits, 16)
  return [value >> 16, (value >> 8) & 255, value & 255]
}

/** The colour that looks brightest; of equals, the first. */
export function lightest(colors: readonly Rgb[]): number {
  let best = 0
  let bestLight = -1
  colors.forEach(([r, g, b], index) => {
    const light = 299 * r + 587 * g + 114 * b
    if (light > bestLight) {
      bestLight = light
      best = index
    }
  })
  return best
}
