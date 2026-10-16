// Swapping two tiles of a tileset everywhere they are named: the sheet's
// pixels, its flags and every map on it.
import type { FlagData, MapData, Pixels } from './map-types.ts'

/** What a swap changes. */
export interface Swapped {
  pixels: Pixels
  flags: FlagData
  maps: MapData[]
}

const TILE = 8

/**
 * Tiles `a` and `b` swapped in an 8x8 tileset's pixels, its flags and the
 * maps, as new values; the inputs are untouched. Throws if either is not a
 * tile of the sheet.
 */
export function swapTiles(swap: {
  a: number
  b: number
  pixels: Pixels
  flags: FlagData
  maps: readonly MapData[]
}): Swapped {
  const { a, b, pixels, flags, maps } = swap
  const { width, height } = pixels
  const columns = Math.floor(width / TILE)
  const frames = columns * Math.floor(height / TILE)
  for (const [name, frame] of [
    ['a', a],
    ['b', b],
  ] as const) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= frames) {
      throw new Error(
        `Tile ${name} (${frame}) is not a tile of the sheet, which has ${frames}`,
      )
    }
  }

  const other = (frame: number) => (frame === a ? b : frame === b ? a : frame)

  const data = new Uint8ClampedArray(pixels.data)
  if (a !== b) {
    const ax = (a % columns) * TILE
    const ay = Math.floor(a / columns) * TILE
    const bx = (b % columns) * TILE
    const by = Math.floor(b / columns) * TILE
    for (let y = 0; y < TILE; y++) {
      const from = ((ay + y) * width + ax) * 4
      const to = ((by + y) * width + bx) * 4
      const row = pixels.data.subarray(from, from + TILE * 4)
      data.set(pixels.data.subarray(to, to + TILE * 4), from)
      data.set(row, to)
    }
  }

  const swappedFlags: { [flag: string]: ReadonlySet<number> } = {}
  for (const [flag, set] of Object.entries(flags)) {
    swappedFlags[flag] = new Set([...set].map(other))
  }

  return {
    pixels: { data, width, height },
    flags: swappedFlags,
    maps: maps.map((map) => ({
      ...map,
      layers: Object.fromEntries(
        Object.entries(map.layers).map(([name, cells]) => [
          name,
          cells.map(other),
        ]),
      ),
    })),
  }
}
