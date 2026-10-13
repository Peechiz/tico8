import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScreen } from '../screen.ts'
import { createSheet } from '../sprites.ts'
import { picture, toPicture } from '../testing.ts'
import { createMaps } from './maps.ts'

const URL = '/maps/room1.json'
const FLAGS_URL = '/sprites/tiles.flags.json'

/** A map file two cells wide and one high, with one layer or two. */
const room = (ground: string, walls = '. .') => ({
  tiles: 'tiles',
  layers: { ground: [ground], walls: [walls] },
})

/** A load whose every call waits to be settled by the test, in order. */
function manual() {
  const calls: {
    url: string
    resolve(file: unknown): void
    reject(error: Error): void
  }[] = []
  const load = (url: string) =>
    new Promise<unknown>((resolve, reject) => {
      calls.push({ url, resolve, reject })
    })
  return { calls, load }
}

/** A load that gives the next of `answers` each time, throwing an `Error`. */
function answering(answers: unknown[]) {
  return vi.fn(async (_url: string) => {
    const answer = answers.shift()
    if (answer instanceof Error) throw answer
    return answer
  })
}

/**
 * A screen of two 2x2 cells, and a tileset of three tiles in colours 8, 9
 * and 10.
 */
function setup(load: (url: string) => Promise<unknown> = manual().load) {
  const screen = createScreen(4, 2)
  const tiles = createSheet(screen, 2, 2)
  tiles.setImage({
    width: 6,
    height: 2,
    pixels: Uint8Array.from([8, 8, 9, 9, 10, 10, 8, 8, 9, 9, 10, 10]),
  })
  const maps = createMaps({ screen, load, retryDelay: 0 })
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
    const { calls, load } = manual()
    const { maps, tiles, shown } = setup(load)
    const room1 = maps.map({ url: URL, data: room('0 1', '. 2'), tiles })
    expect(calls).toHaveLength(0)
    expect(room1.columns).toBe(2)
    expect(room1.rows).toBe(1)
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(shown(room1.walls)).toBe(cells('0', 'a'))
  })

  it('types the layers and the flags by the files', () => {
    const { maps, tiles } = setup()
    const room1 = maps.map({
      url: URL,
      data: room('0 1'),
      tiles,
      flags: { url: FLAGS_URL, data: { solid: [1], ladder: [2] } },
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
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })
    expect(room1.ground.tile(0, 0).frame).toBe(0)
    // @ts-expect-error: there are no flags
    expect(room1.ground.tile(0, 0).solid).toBeUndefined()
    // @ts-expect-error: there are no flags
    expect(room1.ground.tiles('solid')).toHaveLength(0)
  })

  it('reports a refused file and leaves the map empty but safe to draw', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map({ url: URL, data: room('0 1', '. . .'), tiles })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: \/maps\/room1\.json was not loaded: .+\. The map stays empty\.$/,
    )
    expect(room1.columns).toBe(0)
    expect(room1.rows).toBe(0)
    expect(shown(room1.ground)).toBe(cells('0', '0'))
    expect(shown(room1.walls)).toBe(cells('0', '0'))
    expect(room1.walls.tile(0, 0).frame).toBeUndefined()
    expect(room1.walls.tiles()).toEqual([])
  })

  it('loads without flags when only the flags file is refused', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup()
    const room1 = maps.map({
      url: URL,
      data: room('0 1'),
      tiles,
      flags: { url: FLAGS_URL, data: { solid: [-1] } },
    })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: \/sprites\/tiles\.flags\.json was not loaded: .+\. The map has no flags\.$/,
    )
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(room1.ground.tile(1, 0).frame).toBe(1)
  })

  it('gives a fresh map when asked again, and reloads that one', async () => {
    const { maps, tiles, shown } = setup(async () => room('2 2'))
    const first = maps.map({ url: URL, data: room('0 0'), tiles })
    const second = maps.map({ url: URL, data: room('1 1'), tiles })
    expect(second).not.toBe(first)
    await maps.reload(URL)
    expect(shown(first.ground)).toBe(cells('8', '8'))
    expect(shown(second.ground)).toBe(cells('a', 'a'))
  })
})

describe('reload', () => {
  it('swaps new cells into the map and layers already held', async () => {
    const { calls, load } = manual()
    const { maps, tiles, shown } = setup(load)
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })
    const { ground } = room1

    const reloaded = maps.reload(URL)
    expect(calls.map((call) => call.url)).toEqual([URL])
    expect(shown(ground)).toBe(cells('8', '9'))
    calls[0]!.resolve(room('2 0'))
    await reloaded
    expect(room1.ground).toBe(ground)
    expect(shown(ground)).toBe(cells('a', '8'))
  })

  it('does nothing for a file nobody asked for', async () => {
    const { calls, load } = manual()
    const { maps } = setup(load)
    await maps.reload('/maps/stranger.json')
    await maps.reloadFlags('/sprites/stranger.flags.json')
    expect(calls).toHaveLength(0)
  })

  it('keeps the old map when the new one fails, and says so', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const load = answering([
      new Error('broken'),
      new Error('still broken'),
      room('2 2', '.'),
    ])
    const { maps, tiles, shown } = setup(load)
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })

    await maps.reload(URL)
    expect(load).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toBe(
      'tico8: /maps/room1.json was not loaded: still broken. The old map stays.',
    )
    // A file that is read but refused is not tried again.
    await maps.reload(URL)
    expect(load).toHaveBeenCalledTimes(3)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error.mock.calls[1]![0]).toContain('The old map stays.')

    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(room1.columns).toBe(2)
  })

  it('fills a map that started empty once its file is mended', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup(
      answering([room('0 1', '.'), room('0 1')]),
    )
    const room1 = maps.map({ url: URL, data: room('0 1', '.'), tiles })
    const { ground } = room1
    await maps.reload(URL)
    expect(error.mock.calls[1]![0]).toContain('The map stays empty.')
    await maps.reload(URL)
    expect(error).toHaveBeenCalledTimes(2)
    expect(shown(ground)).toBe(cells('8', '9'))
  })

  it('tries once more when a file is caught half written', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles, shown } = setup(
      answering([new Error('cut'), room('2 2')]),
    )
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })
    await maps.reload(URL)
    expect(shown(room1.ground)).toBe(cells('a', 'a'))
    expect(error).not.toHaveBeenCalled()
  })

  it('ends on the last save when an earlier load finishes late', async () => {
    const { calls, load } = manual()
    const { maps, tiles, shown } = setup(load)
    const room1 = maps.map({ url: URL, data: room('0 0'), tiles })

    const first = maps.reload(URL)
    const second = maps.reload(URL)
    calls[1]!.resolve(room('2 2'))
    await second
    calls[0]!.resolve(room('1 1'))
    await first
    expect(shown(room1.ground)).toBe(cells('a', 'a'))
  })

  it('drops a failed earlier load without a word or a second try', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls, load } = manual()
    const { maps, tiles, shown } = setup(load)
    const room1 = maps.map({ url: URL, data: room('0 0'), tiles })

    const first = maps.reload(URL)
    const second = maps.reload(URL)
    calls[0]!.reject(new Error('cut'))
    await first
    calls[1]!.resolve(room('2 2'))
    await second
    expect(calls).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    expect(shown(room1.ground)).toBe(cells('a', 'a'))
  })
})

describe('reloadFlags', () => {
  it('reaches every map that uses the flags file, and no other', async () => {
    const { calls, load } = manual()
    const { maps, tiles } = setup(load)
    const flags = () => ({ url: FLAGS_URL, data: { solid: [1] } })
    const room1 = maps.map({
      url: URL,
      data: room('0 1'),
      tiles,
      flags: flags(),
    })
    const room2 = maps.map({
      url: '/maps/room2.json',
      data: room('1 0'),
      tiles,
      flags: flags(),
    })
    const other = maps.map({
      url: '/maps/other.json',
      data: room('0 1'),
      tiles,
      flags: { url: '/sprites/other.flags.json', data: { solid: [1] } },
    })

    const reloaded = maps.reloadFlags(FLAGS_URL)
    expect(calls.map((call) => call.url)).toEqual([FLAGS_URL])
    calls[0]!.resolve({ solid: [0] })
    await reloaded
    expect(room1.ground.tile(0, 0).solid).toBe(true)
    expect(room1.ground.tile(1, 0).solid).toBe(false)
    expect(room2.ground.tile(1, 0).solid).toBe(true)
    expect(room2.ground.tile(0, 0).solid).toBe(false)
    expect(other.ground.tile(0, 0).solid).toBe(false)
    expect(other.ground.tile(1, 0).solid).toBe(true)
  })

  it('keeps the old flags when the new file is refused, and says so', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { maps, tiles } = setup(async () => ({ solid: [-1] }))
    const room1 = maps.map({
      url: URL,
      data: room('0 1'),
      tiles,
      flags: { url: FLAGS_URL, data: { solid: [1] } },
    })
    await maps.reloadFlags(FLAGS_URL)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toMatch(
      /^tico8: \/sprites\/tiles\.flags\.json was not loaded: .+\. The old flags stay\.$/,
    )
    expect(room1.ground.tile(1, 0).solid).toBe(true)
  })

  it('ends on the last save when an earlier load finishes late', async () => {
    const { calls, load } = manual()
    const { maps, tiles } = setup(load)
    const room1 = maps.map({
      url: URL,
      data: room('0 1'),
      tiles,
      flags: { url: FLAGS_URL, data: { solid: [] as number[] } },
    })
    const first = maps.reloadFlags(FLAGS_URL)
    const second = maps.reloadFlags(FLAGS_URL)
    calls[1]!.resolve({ solid: [1] })
    await second
    calls[0]!.resolve({ solid: [0] })
    await first
    expect(room1.ground.tile(1, 0).solid).toBe(true)
    expect(room1.ground.tile(0, 0).solid).toBe(false)
  })
})

describe('restore', () => {
  it('puts every map back as its file has it', () => {
    const { maps, tiles, shown } = setup()
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })
    const room2 = maps.map({
      url: '/maps/room2.json',
      data: room('1 1'),
      tiles,
    })
    room1.ground.set(0, 0, 2)
    room2.ground.set(1, 0, undefined)
    expect(shown(room1.ground)).toBe(cells('a', '9'))
    expect(shown(room2.ground)).toBe(cells('9', '0'))

    maps.restore()
    expect(shown(room1.ground)).toBe(cells('8', '9'))
    expect(shown(room2.ground)).toBe(cells('9', '9'))
  })

  it('goes back to the file last loaded, not the first', async () => {
    const { maps, tiles, shown } = setup(async () => room('2 2'))
    const room1 = maps.map({ url: URL, data: room('0 1'), tiles })
    await maps.reload(URL)
    room1.ground.set(0, 0, 0)
    maps.restore()
    expect(shown(room1.ground)).toBe(cells('a', 'a'))
  })
})
