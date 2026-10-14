import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScreen } from '../screen.ts'
import { createSheet } from '../sprites.ts'
import { picture, toPicture } from '../testing.ts'
import { createMaps } from './maps.ts'

/** A map file two cells wide and one high, with one layer or two. */
const room = (ground: string, walls = '. .', tiles = 'tiles') => ({
  tiles,
  layers: { ground: [ground], walls: [walls] },
})

/**
 * A screen of two 2x2 cells, and a tileset of three tiles in colours 8, 9
 * and 10.
 */
function setup() {
  const screen = createScreen(4, 2)
  const tiles = createSheet(screen, 2, 2)
  tiles.setImage({
    width: 6,
    height: 2,
    pixels: Uint8Array.from([8, 8, 9, 9, 10, 10, 8, 8, 9, 9, 10, 10]),
  })
  const maps = createMaps({ screen })
  /** What a layer draws on a cleared screen. */
  const shown = (layer: { draw(): void }) => {
    screen.pixels.fill(0)
    layer.draw()
    return toPicture(screen)
  }
  return { screen, tiles, maps, shown }
}

const cells = (left: string, right: string) =>
  picture(`${left}${left}${right}${right}\n${left}${left}${right}${right}`)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('map', () => {
  it('is whole at once and draws its layers', () => {
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1', '. 2'), tiles })
    expect(room1.columns).toBe(2)
    expect(room1.rows).toBe(1)
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(shown(room1.walls)).toBe(cells('0', 'a'))
  })

  it('types the layers and the flags by the files', () => {
    const { maps, tiles } = setup()
    const room1 = maps.map('room1', {
      data: room('0 1'),
      tiles,
      flags: { solid: [1], ladder: [2] },
    })
    expect(room1.ground.tile(0, 0).solid).toBe(false)
    expect(room1.ground.tile(1, 0).solid).toBe(true)
    expect(room1.ground.tile(1, 0).ladder).toBe(false)
    expect(room1.ground.tiles('solid')).toHaveLength(1)
    // @ts-expect-error: the map file has no such layer
    expect(room1.front).toBeUndefined()
    // @ts-expect-error: the flags file has no such flag
    expect(room1.ground.tile(1, 0).spawn).toBeUndefined()
    // @ts-expect-error: the flags file has no such flag
    expect(room1.ground.tiles('spawn')).toHaveLength(0)
  })

  it('has no flag to ask for when the tileset has no flags file', () => {
    const { maps, tiles } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })
    expect(room1.ground.tile(0, 0).frame).toBe(0)
    // @ts-expect-error: there are no flags
    expect(room1.ground.tile(0, 0).solid).toBeUndefined()
    // @ts-expect-error: there are no flags
    expect(room1.ground.tiles('solid')).toHaveLength(0)
  })

  it('reports a refused file and leaves the map empty but safe to draw', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1', '. . .'), tiles })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: map room1 was not loaded: .+\. The map stays empty\.$/,
    )
    expect(room1.columns).toBe(0)
    expect(room1.rows).toBe(0)
    expect(shown(room1.ground)).toBe(cells('0', '0'))
    expect(shown(room1.walls)).toBe(cells('0', '0'))
    expect(room1.walls.tile(0, 0).frame).toBeUndefined()
    expect(room1.walls.tiles()).toEqual([])
  })

  it('starts without flags when only the flags file is refused', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', {
      data: room('0 1'),
      tiles,
      flags: { solid: [-1] },
    })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: the flags of tileset tiles were not loaded: .+\. The map has no flags\.$/,
    )
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(room1.ground.tile(1, 0).frame).toBe(1)
  })

  it('gives a fresh map when asked again, and swaps into that one', () => {
    const { maps, tiles, shown } = setup()
    const first = maps.map('room1', { data: room('0 0'), tiles })
    const second = maps.map('room1', { data: room('1 1'), tiles })
    expect(second).not.toBe(first)
    maps.swap('room1', room('2 2'))
    expect(shown(first.ground)).toBe(cells('8', '8'))
    expect(shown(second.ground)).toBe(cells('a', 'a'))
  })
})

describe('swap', () => {
  it('puts new cells into the map and layers already held', () => {
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })
    const { ground } = room1
    expect(shown(ground)).toBe(cells('8', '9'))

    maps.swap('room1', room('2 0'))
    expect(room1.ground).toBe(ground)
    expect(shown(ground)).toBe(cells('a', '8'))
  })

  it('does nothing for a name nobody asked for', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })
    maps.swap('stranger', room('2 2'))
    maps.swap('stranger', 'not a map')
    maps.swapFlags('stranger', { solid: [0] })
    maps.swapFlags('stranger', 'not flags')
    expect(error).not.toHaveBeenCalled()
    expect(shown(room1.ground)).toBe(cells('8', '9'))
  })

  it('keeps the old map when the new file is refused, and says so', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })

    maps.swap('room1', room('2 2', '.'))
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: map room1 was not loaded: .+\. The old map stays\.$/,
    )
    maps.swap('room1', null)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error.mock.calls[1]![0]).toContain('The old map stays.')

    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(room1.columns).toBe(2)
  })

  it('fills a map that started empty once its file is mended', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1', '.'), tiles })
    const { ground } = room1
    maps.swap('room1', room('0 1', '.'))
    expect(error.mock.calls[1]![0]).toContain('The map stays empty.')
    maps.swap('room1', room('0 1'))
    expect(error).toHaveBeenCalledTimes(2)
    expect(shown(ground)).toBe(cells('8', '9'))
  })
})

describe('swapFlags', () => {
  it('reaches every map on the tileset, and no other', () => {
    const { maps, tiles } = setup()
    const flags = { solid: [1] }
    const room1 = maps.map('room1', { data: room('0 1'), tiles, flags })
    const room2 = maps.map('room2', { data: room('1 0'), tiles, flags })
    const other = maps.map('other', {
      data: room('0 1', '. .', 'other'),
      tiles,
      flags,
    })

    maps.swapFlags('tiles', { solid: [0] })
    expect(room1.ground.tile(0, 0).solid).toBe(true)
    expect(room1.ground.tile(1, 0).solid).toBe(false)
    expect(room2.ground.tile(1, 0).solid).toBe(true)
    expect(room2.ground.tile(0, 0).solid).toBe(false)
    expect(other.ground.tile(0, 0).solid).toBe(false)
    expect(other.ground.tile(1, 0).solid).toBe(true)
  })

  it('keeps the old flags when the new file is refused, and says so', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles } = setup()
    const room1 = maps.map('room1', {
      data: room('0 1'),
      tiles,
      flags: { solid: [1] },
    })
    maps.swapFlags('tiles', { solid: [-1] })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: the flags of tileset tiles were not loaded: .+\. The old flags stay\.$/,
    )
    expect(room1.ground.tile(1, 0).solid).toBe(true)
  })

  it('reaches a map whose own file was refused, by the tileset it names', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles } = setup()
    const room1 = maps.map('room1', {
      data: room('0 1', '.'),
      tiles,
      flags: { solid: [1] },
    })
    maps.swapFlags('tiles', { solid: [0] })
    maps.swap('room1', room('0 1'))
    expect(room1.ground.tile(0, 0).solid).toBe(true)
    expect(room1.ground.tile(1, 0).solid).toBe(false)
  })

  it('follows a map to the tileset a swap moves it to', () => {
    const { maps, tiles } = setup()
    const room1 = maps.map('room1', {
      data: room('0 1'),
      tiles,
      flags: { solid: [1] },
    })
    maps.swap('room1', room('0 1', '. .', 'other'))

    maps.swapFlags('tiles', { solid: [0] })
    expect(room1.ground.tile(0, 0).solid).toBe(false)
    expect(room1.ground.tile(1, 0).solid).toBe(true)
    maps.swapFlags('other', { solid: [0] })
    expect(room1.ground.tile(0, 0).solid).toBe(true)
    expect(room1.ground.tile(1, 0).solid).toBe(false)
  })
})

describe('restore', () => {
  it('puts every map back as its file has it', () => {
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })
    const room2 = maps.map('room2', { data: room('1 1'), tiles })
    room1.ground.set(0, 0, 2)
    room2.ground.set(1, 0, undefined)
    expect(shown(room1.ground)).toBe(cells('a', '9'))
    expect(shown(room2.ground)).toBe(cells('9', '0'))

    maps.restore()
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(shown(room2.ground)).toBe(cells('9', '9'))
  })

  it('goes back to the file last swapped in, not the first', () => {
    const { maps, tiles, shown } = setup()
    const room1 = maps.map('room1', { data: room('0 1'), tiles })
    maps.swap('room1', room('2 2'))
    room1.ground.set(0, 0, 0)
    maps.restore()
    expect(shown(room1.ground)).toBe(cells('a', 'a'))
  })
})
