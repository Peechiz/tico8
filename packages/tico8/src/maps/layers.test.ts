import { describe, expect, it, vi } from 'vitest'
import { createScreen } from '../screen.ts'
import { createSheet, type IndexedImage } from '../sprites.ts'
import { picture, toPicture } from '../testing.ts'
import { createMap } from './layers.ts'
import { EMPTY, type FlagData, type MapData } from './types.ts'

const _ = EMPTY

/** Four 2x2 cells in a row, frames 0 to 3, solid colours 1, 2, 3 and 4. */
function image(): IndexedImage {
  const row = [1, 1, 2, 2, 3, 3, 4, 4]
  return { width: 8, height: 2, pixels: Uint8Array.from([...row, ...row]) }
}

/** A 4x3 room: a wall of frame 1 around the top, and one marker. */
function room(): MapData {
  return {
    tiles: 'tiles',
    columns: 4,
    rows: 3,
    // biome-ignore format: one row of cells per line
    layers: {
      walls: Int16Array.from([
        1, 1, 1, 1,
        1, _, _, 2,
        0, _, _, _,
      ]),
      markers: Int16Array.from([
        _, _, _, _,
        _, 3, _, _,
        _, _, 3, _,
      ]),
    },
  }
}

function flags(): FlagData {
  return { solid: new Set([1, 2]), spawn: new Set([3]) }
}

function setup(data: MapData | null = room(), flagData = flags()) {
  const screen = createScreen(8, 6)
  const sheet = createSheet(screen, 2, 2)
  sheet.setImage(image())
  const loadable = createMap(screen, sheet, data ?? undefined, flagData)
  return { screen, sheet, loadable, map: loadable.map }
}

describe('a map without data', () => {
  it('has no layers and no size', () => {
    const { map } = setup(null)
    expect(Object.keys(map)).toEqual(['columns', 'rows', 'width', 'height'])
    expect([map.columns, map.rows, map.width, map.height]).toEqual([0, 0, 0, 0])
    expect(map.walls).toBeUndefined()
  })
})

describe('size', () => {
  it('is in cells and in pixels, on the map and on each layer', () => {
    const { map } = setup()
    expect([map.columns, map.rows, map.width, map.height]).toEqual([4, 3, 8, 6])
    const { walls } = map
    expect([walls!.columns, walls!.rows]).toEqual([4, 3])
    expect([walls!.width, walls!.height]).toEqual([8, 6])
    expect(Object.keys(map).slice(4)).toEqual(['walls', 'markers'])
  })
})

describe('draw', () => {
  it('draws a layer at 0, 0, leaving empty cells alone', () => {
    const { screen, map } = setup()
    screen.clear(7)
    map.walls!.draw()
    expect(toPicture(screen)).toBe(
      picture(`
      22222222
      22222222
      22777733
      22777733
      11777777
      11777777
    `),
    )
  })

  it('draws at a position, given as x, y or as one value', () => {
    const { screen, map } = setup()
    const expected = picture(`
      ........
      ...22222
      ...22222
      ...22...
      ...22...
      ...11...
    `)
    map.walls!.draw(3, 1)
    expect(toPicture(screen)).toBe(expected)
    screen.clear()
    map.walls!.draw({ x: 3, y: 1 })
    expect(toPicture(screen)).toBe(expected)
  })

  it('is moved by the camera', () => {
    const { screen, map } = setup()
    screen.withCamera(3, 2, () => map.walls!.draw())
    expect(toPicture(screen)).toBe(
      picture(`
      ...33...
      ...33...
      ........
      ........
      ........
      ........
    `),
    )
  })

  it('is cut by the clip', () => {
    const { screen, map } = setup()
    screen.withClip(1, 1, 6, 4, () => map.walls!.draw())
    expect(toPicture(screen)).toBe(
      picture(`
      ........
      .222222.
      .2....3.
      .2....3.
      .1......
      ........
    `),
    )
  })

  it('draws through a camera and a clip together', () => {
    const { screen, map } = setup()
    screen.withCamera(-1, -1, () => {
      screen.withClip(0, 0, 3, 4, () => map.walls!.draw())
    })
    expect(toPicture(screen)).toBe(
      picture(`
      ........
      .222....
      .222....
      .22.....
      .22.....
      ........
    `),
    )
  })

  it('visits only the cells the clip can show', () => {
    const { screen, sheet, map } = setup()
    const draw = vi.spyOn(sheet, 'draw')
    // Pixels 2 to 4 across and 0 to 1 down: columns 1 and 2 of row 0.
    screen.withClip(2, 0, 3, 2, () => map.walls!.draw())
    expect(draw.mock.calls.map(([cell]) => cell)).toEqual([
      { frame: 1, x: 2, y: 0 },
      { frame: 1, x: 4, y: 0 },
    ])
    draw.mockClear()
    screen.withClip(0, 0, 0, 0, () => map.walls!.draw())
    map.walls!.draw(8, 0)
    map.walls!.draw(0, -6)
    expect(draw).not.toHaveBeenCalled()
  })

  it('costs what is on screen, however big the map', () => {
    const { screen, sheet, loadable, map } = setup()
    const columns = 500
    const rows = 60
    loadable.setData({
      tiles: 'tiles',
      columns,
      rows,
      layers: { walls: new Int16Array(columns * rows).fill(0) },
    })
    const draw = vi.spyOn(sheet, 'draw')
    screen.withCamera(401, 51, () => map.walls!.draw())
    // An 8x6 screen one pixel off the grid shows 5 columns of 4 rows.
    expect(draw).toHaveBeenCalledTimes(20)
    expect(toPicture(screen)).not.toMatch(/0/)
  })
})

describe('tile and tileAt', () => {
  it('reads a frame and its flags', () => {
    const { map } = setup()
    expect(map.walls!.tile(0, 0)).toEqual({
      frame: 1,
      solid: true,
      spawn: false,
    })
    expect(map.walls!.tile(0, 2)).toEqual({
      frame: 0,
      solid: false,
      spawn: false,
    })
    expect(map.markers!.tile(1, 1)).toEqual({
      frame: 3,
      solid: false,
      spawn: true,
    })
  })

  it('gives no frame and no flags for an empty cell or one outside', () => {
    const { map } = setup()
    const nothing = { frame: undefined, solid: false, spawn: false }
    expect(map.walls!.tile(1, 1)).toEqual(nothing)
    expect(map.walls!.tile(-1, 0)).toEqual(nothing)
    expect(map.walls!.tile(4, 0)).toEqual(nothing)
    expect(map.walls!.tile(0, 3)).toEqual(nothing)
    expect(map.walls!.tile(Number.NaN, 0)).toEqual(nothing)
  })

  it('floors a column and row that are not whole', () => {
    const { map } = setup()
    expect(map.walls!.tile(3.9, 1.5).frame).toBe(2)
    expect(map.walls!.tile(-0.5, 0).frame).toBeUndefined()
  })

  it('reads the cell under a pixel, given as x, y or as one value', () => {
    const { map } = setup()
    expect(map.walls!.tileAt(7, 3)).toEqual({
      frame: 2,
      solid: true,
      spawn: false,
    })
    expect(map.walls!.tileAt({ x: 6.5, y: 2 }).frame).toBe(2)
    expect(map.walls!.tileAt(5.9, 2).frame).toBeUndefined()
    expect(map.walls!.tileAt(-0.1, 0).frame).toBeUndefined()
    expect(map.walls!.tileAt(8, 0).solid).toBe(false)
  })

  it('hands back the same frozen tile for the same frame', () => {
    const { map } = setup()
    const tile = map.walls!.tile(0, 0)
    expect(map.walls!.tile(1, 0)).toBe(tile)
    expect(Object.isFrozen(tile)).toBe(true)
    expect(map.walls!.tile(1, 1)).toBe(map.walls!.tile(-1, -1))
  })
})

describe('set and restore', () => {
  it('puts a tile in a cell and empties one', () => {
    const { screen, map } = setup()
    map.walls!.set(1, 1, 3)
    map.walls!.set(0, 0, undefined)
    expect(map.walls!.tile(1, 1).frame).toBe(3)
    expect(map.walls!.tile(0, 0).frame).toBeUndefined()
    map.walls!.draw()
    expect(toPicture(screen).split('\n').slice(0, 4)).toEqual([
      '00222222',
      '00222222',
      '22440033',
      '22440033',
    ])
  })

  it('ignores a cell outside the layer', () => {
    const { map } = setup()
    const before = map.walls!.tiles()
    map.walls!.set(-1, 0, 3)
    map.walls!.set(4, 0, 3)
    map.walls!.set(0, 3, 3)
    map.walls!.set(0, -1, 3)
    expect(map.walls!.tiles()).toEqual(before)
  })

  it('empties the cell for a frame that cannot be one', () => {
    const { map } = setup()
    map.walls!.set(0, 0, -5)
    map.walls!.set(1, 0, Number.NaN)
    map.walls!.set(2, 0, 40000)
    map.walls!.set(3, 0, 2.9)
    expect(map.walls!.tile(0, 0).frame).toBeUndefined()
    expect(map.walls!.tile(1, 0).frame).toBeUndefined()
    expect(map.walls!.tile(2, 0).frame).toBeUndefined()
    expect(map.walls!.tile(3, 0).frame).toBe(2)
  })

  it('leaves the other layers and the given data alone', () => {
    const data = room()
    const { map } = setup(data)
    map.walls!.set(1, 1, 3)
    expect(map.markers!.tile(1, 1).frame).toBe(3)
    map.markers!.set(1, 1, undefined)
    expect(map.walls!.tile(1, 1).frame).toBe(3)
    expect(data.layers.walls![5]).toBe(EMPTY)
    expect(data.layers.markers![5]).toBe(3)
  })

  it('restores every layer to what setData gave', () => {
    const data = room()
    const { loadable, map } = setup(data)
    const walls = map.walls!.tiles()
    const markers = map.markers!.tiles()
    map.walls!.set(1, 1, 3)
    map.walls!.set(0, 0, undefined)
    map.markers!.set(1, 1, undefined)
    // Changing the caller's own array afterwards changes nothing either.
    data.layers.walls![1] = 3
    loadable.restore()
    expect(map.walls!.tiles()).toEqual(walls)
    expect(map.markers!.tiles()).toEqual(markers)
  })
})

describe('tiles', () => {
  it('walks every tile row by row with its position', () => {
    const { map } = setup()
    expect(map.markers!.tiles()).toEqual([
      { frame: 3, x: 2, y: 2, column: 1, row: 1, solid: false, spawn: true },
      { frame: 3, x: 4, y: 4, column: 2, row: 2, solid: false, spawn: true },
    ])
    expect(map.walls!.tiles().map((t) => [t.column, t.row, t.frame])).toEqual([
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [3, 0, 1],
      [0, 1, 1],
      [3, 1, 2],
      [0, 2, 0],
    ])
  })

  it('keeps only the tiles that have a flag', () => {
    const { map } = setup()
    const [start] = map.markers!.tiles('spawn')
    expect(start).toMatchObject({ x: 2, y: 2, column: 1, row: 1 })
    expect(map.markers!.tiles('solid')).toEqual([])
    expect(map.walls!.tiles('solid')).toHaveLength(6)
    expect(map.walls!.tiles('nope')).toEqual([])
  })

  it('sees what set changed', () => {
    const { map } = setup()
    map.markers!.set(0, 0, 3)
    expect(map.markers!.tiles('spawn').map((t) => [t.x, t.y])).toEqual([
      [0, 0],
      [2, 2],
      [4, 4],
    ])
  })
})

describe('overlaps', () => {
  // The solid tile at column 3, row 1 covers pixels 6 to 8 across and 2 to
  // 4 down; columns 1 and 2 of rows 1 and 2 are open.
  it('is true for a rectangle that covers part of a tile with the flag', () => {
    const { map } = setup()
    const { walls } = map
    expect(
      walls!.overlaps({ x: 4, y: 2, width: 2.5, height: 2 }, 'solid'),
    ).toBe(true)
    expect(walls!.overlaps({ x: 2, y: 1, width: 1, height: 2 }, 'solid')).toBe(
      true,
    )
    expect(
      walls!.overlaps({ x: -5, y: -5, width: 5.5, height: 5.5 }, 'solid'),
    ).toBe(true)
  })

  it('is false beside a tile, touching edges included', () => {
    const { map } = setup()
    const { walls } = map
    expect(walls!.overlaps({ x: 2, y: 2, width: 4, height: 4 }, 'solid')).toBe(
      false,
    )
    expect(walls!.overlaps({ x: 3, y: 3, width: 1, height: 1 }, 'solid')).toBe(
      false,
    )
    // Outside the layer there is nothing to touch.
    expect(walls!.overlaps({ x: 8, y: 0, width: 4, height: 4 }, 'solid')).toBe(
      false,
    )
    expect(walls!.overlaps({ x: -4, y: 0, width: 4, height: 4 }, 'solid')).toBe(
      false,
    )
  })

  it('is false for a tile without the flag, and for an unknown flag', () => {
    const { map } = setup()
    const onFloor = { x: 0, y: 4, width: 2, height: 2 }
    expect(map.walls!.overlaps(onFloor, 'solid')).toBe(false)
    expect(map.walls!.overlaps(onFloor, 'spawn')).toBe(false)
    const all = { x: 0, y: 0, width: 8, height: 6 }
    expect(map.walls!.overlaps(all, 'nope')).toBe(false)
    expect(map.walls!.overlaps(all, 'toString')).toBe(false)
    expect(map.markers!.overlaps(all, 'spawn')).toBe(true)
  })

  it('is false for a rectangle with no width or height', () => {
    const { map } = setup()
    const { walls } = map
    expect(walls!.overlaps({ x: 0, y: 0, width: 0, height: 2 }, 'solid')).toBe(
      false,
    )
    expect(walls!.overlaps({ x: 0, y: 0, width: 2, height: 0 }, 'solid')).toBe(
      false,
    )
    expect(walls!.overlaps({ x: 2, y: 0, width: -2, height: 2 }, 'solid')).toBe(
      false,
    )
  })

  it('looks only at the cells the rectangle covers', () => {
    const { loadable, map } = setup()
    const columns = 1000
    const rows = 1000
    const cells = new Int16Array(columns * rows).fill(0)
    cells[500 * columns + 500] = 1
    loadable.setData({
      tiles: 'tiles',
      columns,
      rows,
      layers: { walls: cells },
    })
    const solid = new Set([1])
    const has = vi.spyOn(solid, 'has')
    loadable.setFlags({ solid })
    has.mockClear()
    const hit = { x: 996, y: 996, width: 4, height: 4 }
    expect(map.walls!.overlaps(hit, 'solid')).toBe(false)
    // Columns 498 and 499 of rows 498 and 499.
    expect(has).toHaveBeenCalledTimes(4)
    expect(
      map.walls!.overlaps({ x: 1000, y: 1000, width: 1, height: 1 }, 'solid'),
    ).toBe(true)
  })
})

describe('setData and setFlags on a map already held', () => {
  it('keeps the map and its layers, with the new cells and size', () => {
    const { screen, loadable, map } = setup()
    const { walls, markers } = map
    map.walls!.set(1, 1, 3)
    loadable.setData({
      tiles: 'tiles',
      columns: 2,
      rows: 1,
      layers: { walls: Int16Array.from([3, 1]) },
    })
    expect(loadable.map).toBe(map)
    expect(map.walls).toBe(walls)
    expect(map.markers).toBe(markers)
    expect([map.columns, map.rows, map.width, map.height]).toEqual([2, 1, 4, 2])
    expect([walls!.columns, walls!.rows]).toEqual([2, 1])
    expect([walls!.width, walls!.height]).toEqual([4, 2])
    expect(walls!.tile(1, 1).frame).toBeUndefined()
    walls!.draw()
    expect(toPicture(screen).split('\n').slice(0, 3)).toEqual([
      '44220000',
      '44220000',
      '00000000',
    ])
  })

  it('empties a layer the new data lacks, and adds a new one', () => {
    const { loadable, map } = setup()
    const { markers } = map
    loadable.setData({
      tiles: 'tiles',
      columns: 2,
      rows: 2,
      layers: {
        walls: Int16Array.from([1, 1, _, _]),
        front: Int16Array.from([_, _, 2, _]),
      },
    })
    expect(map.markers).toBe(markers)
    expect([markers!.columns, markers!.rows]).toEqual([2, 2])
    expect(markers!.tiles()).toEqual([])
    expect(map.front!.tiles().map((t) => [t.x, t.y, t.frame])).toEqual([
      [0, 2, 2],
    ])
    expect(Object.keys(map).slice(4)).toEqual(['walls', 'markers', 'front'])
    // The emptied layer still takes tiles, and restore empties it again.
    markers!.set(1, 1, 3)
    expect(markers!.tiles('spawn')).toHaveLength(1)
    loadable.restore()
    expect(markers!.tiles()).toEqual([])
  })

  it('restores to the newest data', () => {
    const { loadable, map } = setup()
    map.walls!.set(1, 1, 3)
    loadable.setData(room())
    expect(map.walls!.tile(1, 1).frame).toBeUndefined()
    map.walls!.set(2, 2, 3)
    loadable.restore()
    expect(map.walls!.tile(2, 2).frame).toBeUndefined()
    expect(map.walls!.tile(0, 0).frame).toBe(1)
  })

  it('reads new flags through layers already held', () => {
    const { loadable, map } = setup()
    const { walls } = map
    expect(walls!.tile(0, 2)).toEqual({ frame: 0, solid: false, spawn: false })
    const floor = { x: 0, y: 4, width: 2, height: 2 }
    expect(walls!.overlaps(floor, 'solid')).toBe(false)
    loadable.setFlags({ solid: new Set([0]), ladder: new Set([2]) })
    expect(map.walls).toBe(walls)
    expect(walls!.tile(0, 2)).toEqual({ frame: 0, solid: true, ladder: false })
    expect(walls!.tile(0, 0)).toEqual({ frame: 1, solid: false, ladder: false })
    expect(walls!.tile(1, 1)).toEqual({
      frame: undefined,
      solid: false,
      ladder: false,
    })
    expect(walls!.overlaps(floor, 'solid')).toBe(true)
    expect(walls!.overlaps(floor, 'spawn')).toBe(false)
    expect(walls!.tiles('ladder').map((t) => [t.column, t.row])).toEqual([
      [3, 1],
    ])
  })

  it('takes data and flags after being made with neither', () => {
    const screen = createScreen(8, 6)
    const sheet = createSheet(screen, 2, 2)
    sheet.setImage(image())
    const loadable = createMap(screen, sheet)
    const { map } = loadable
    loadable.setData(room())
    expect(map.walls!.tile(0, 0)).toEqual({ frame: 1 })
    loadable.setFlags(flags())
    expect(map.walls!.tile(0, 0).solid).toBe(true)
  })
})

describe('two layers', () => {
  it('put what is drawn between them behind the second', () => {
    const { screen, sheet, map } = setup()
    const hero = sheet.sprite()
    hero.frame = 3
    hero.flash = 9
    map.walls!.draw()
    // Half on the wall of row 0, half under the marker of row 1.
    hero.draw(2, 1)
    map.markers!.draw()
    expect(toPicture(screen)).toBe(
      picture(`
      22222222
      22992222
      22440033
      22440033
      11004400
      11004400
    `),
    )
  })
})
