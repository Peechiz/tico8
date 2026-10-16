import { describe, expect, it } from 'vitest'
import type { FlagData, MapData, Pixels } from './map-types.ts'
import { swapTiles } from './rearrange.ts'

/** A 16x16 sheet of 2x2 tiles, each a colour of its own: red value = frame + 1. */
function sheet(): Pixels {
  const data = new Uint8ClampedArray(16 * 16 * 4)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const frame = Math.floor(y / 8) * 2 + Math.floor(x / 8)
      const i = (y * 16 + x) * 4
      data[i] = frame + 1
      data[i + 1] = x
      data[i + 2] = y
      data[i + 3] = 255
    }
  }
  return { data, width: 16, height: 16 }
}

const flags = (): FlagData => ({
  solid: new Set([0, 1]),
  water: new Set([1]),
  goal: new Set([3]),
  none: new Set(),
})

const maps = (): MapData[] => [
  {
    tiles: 'tiles',
    columns: 2,
    rows: 2,
    layers: {
      ground: Int16Array.of(0, 1, 2, 3),
      front: Int16Array.of(-1, 1, 1, 0),
    },
  },
  {
    tiles: 'tiles',
    columns: 3,
    rows: 1,
    layers: {
      ground: Int16Array.of(3, 3, 0),
      front: Int16Array.of(2, -1, 2),
    },
  },
]

/** A layer's cells, or a failure if the map or layer is missing. */
function cells(list: readonly MapData[], map: number, layer: string) {
  const found = list[map]?.layers[layer]
  if (!found) throw new Error(`no layer ${layer} on map ${map}`)
  return [...found]
}

const input = () => ({ pixels: sheet(), flags: flags(), maps: maps() })

describe('swapTiles', () => {
  it('swaps the two blocks of pixels', () => {
    const out = swapTiles({ a: 0, b: 3, ...input() })
    const was = sheet()
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const frame = Math.floor(y / 8) * 2 + Math.floor(x / 8)
        const swapped = frame === 0 ? 3 : frame === 3 ? 0 : frame
        const i = (y * 16 + x) * 4
        expect(out.pixels.data[i]).toBe(swapped + 1)
        // Position within the tile travels with it.
        expect((out.pixels.data[i + 1] ?? -1) % 8).toBe(
          (was.data[i + 1] ?? -2) % 8,
        )
      }
    }
    expect(out.pixels.width).toBe(16)
    expect(out.pixels.height).toBe(16)
  })

  it('swaps the tiles in each flag', () => {
    const out = swapTiles({ a: 0, b: 3, ...input() })
    expect(Object.keys(out.flags)).toEqual(['solid', 'water', 'goal', 'none'])
    expect(out.flags.solid).toEqual(new Set([3, 1]))
    expect(out.flags.water).toEqual(new Set([1]))
    expect(out.flags.goal).toEqual(new Set([0]))
    expect(out.flags.none).toEqual(new Set())
  })

  it('keeps a flag that is on both', () => {
    const out = swapTiles({
      a: 0,
      b: 1,
      ...input(),
    })
    expect(out.flags.solid).toEqual(new Set([0, 1]))
    expect(out.flags.water).toEqual(new Set([0]))
  })

  it('swaps the tiles in every layer of every map', () => {
    const out = swapTiles({ a: 0, b: 3, ...input() })
    expect(out.maps).toHaveLength(2)
    expect(cells(out.maps, 0, 'ground')).toEqual([3, 1, 2, 0])
    expect(cells(out.maps, 0, 'front')).toEqual([-1, 1, 1, 3])
    expect(cells(out.maps, 1, 'ground')).toEqual([0, 0, 3])
    expect(cells(out.maps, 1, 'front')).toEqual([2, -1, 2])
    expect(out.maps[1]?.columns).toBe(3)
    expect(Object.keys(out.maps[0]?.layers ?? {})).toEqual(['ground', 'front'])
  })

  it('leaves the inputs untouched', () => {
    const given = input()
    swapTiles({ a: 1, b: 2, ...given })
    expect(given.pixels).toEqual(sheet())
    expect(given.flags).toEqual(flags())
    expect(given.maps).toEqual(maps())
  })

  it('gives the start back when swapped twice', () => {
    const once = swapTiles({ a: 1, b: 2, ...input() })
    const twice = swapTiles({ a: 1, b: 2, ...once })
    expect(twice.pixels).toEqual(sheet())
    expect(twice.flags).toEqual(flags())
    expect(twice.maps).toEqual(maps())
  })

  it('gives equal copies when a is b', () => {
    const given = input()
    const out = swapTiles({ a: 2, b: 2, ...given })
    expect(out.pixels).toEqual(given.pixels)
    expect(out.pixels.data).not.toBe(given.pixels.data)
    expect(out.flags).toEqual(given.flags)
    expect(out.maps).toEqual(given.maps)
    expect(out.maps[0]?.layers.ground).not.toBe(given.maps[0]?.layers.ground)
  })

  it('refuses a tile that is not on the sheet', () => {
    for (const [a = 0, b = 0] of [
      [4, 0],
      [0, 4],
      [-1, 0],
      [0, 1.5],
      [Number.NaN, 0],
    ]) {
      expect(() => swapTiles({ a, b, ...input() })).toThrow(/not a tile/)
    }
  })
})
