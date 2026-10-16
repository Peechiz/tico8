import { describe, expect, it } from 'vitest'
import { parseFlags } from '../maps/flags.ts'
import { EMPTY } from '../maps/types.ts'
import {
  addFlag,
  addLayer,
  cloneMap,
  flagNameProblem,
  flagsFileFor,
  layerNameProblem,
  mapFile,
  moveLayer,
  newMapData,
  removeFlag,
  removeLayer,
  renameFlag,
  renameLayer,
  resizeMap,
  sameMap,
  setFlag,
  tilesCut,
  writeFlags,
} from './map-doc.ts'
import type { FlagData, MapData } from './map-types.ts'

const E = EMPTY

/** A 3x2 map of layers `a` and `b`. */
const sample = (): MapData => ({
  tiles: 'tiles',
  columns: 3,
  rows: 2,
  layers: {
    a: Int16Array.of(1, 2, 3, 4, 5, 6),
    b: Int16Array.of(E, 7, E, E, E, 8),
  },
})

const flagSets = (flags: FlagData) =>
  Object.fromEntries(
    Object.entries(flags).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]),
  )

describe('file names', () => {
  it('names a map file', () => {
    expect(mapFile('room1')).toBe('room1.json')
  })

  it('names the flags file of a sheet', () => {
    expect(flagsFileFor('tiles.png')).toBe('tiles.flags.json')
    expect(flagsFileFor('tiles.8.png')).toBe('tiles.flags.json')
    expect(flagsFileFor('my-tiles.png')).toBe('my-tiles.flags.json')
    expect(flagsFileFor('big.16x24.png')).toBe('big.flags.json')
  })
})

describe('maps', () => {
  it('makes a map of one empty layer', () => {
    const map = newMapData({ columns: 4, rows: 3, tiles: 'tiles', layer: 'bg' })
    expect(map.tiles).toBe('tiles')
    expect(Object.keys(map.layers)).toEqual(['bg'])
    expect([...(map.layers.bg ?? [])]).toEqual(Array(12).fill(E))
  })

  it('clones without sharing and compares', () => {
    const map = sample()
    const copy = cloneMap(map)
    expect(sameMap(map, copy)).toBe(true)
    copy.layers.a?.fill(0)
    expect(map.layers.a?.[0]).toBe(1)
    expect(sameMap(map, copy)).toBe(false)
    expect(sameMap(map, { ...sample(), tiles: 'other' })).toBe(false)
    expect(sameMap(map, removeLayer(map, 'b'))).toBe(false)
    expect(sameMap(map, moveLayer(map, 'a', 1))).toBe(false)
  })

  it('grows keeping the top left', () => {
    const map = sample()
    const grown = resizeMap(map, { columns: 4, rows: 3 })
    expect(grown.columns).toBe(4)
    expect(grown.rows).toBe(3)
    expect([...(grown.layers.a ?? [])]).toEqual([
      ...[1, 2, 3, E],
      ...[4, 5, 6, E],
      ...[E, E, E, E],
    ])
    expect(map.columns).toBe(3)
    expect(map.layers.a?.length).toBe(6)
  })

  it('shrinks keeping the top left', () => {
    const shrunk = resizeMap(sample(), { columns: 2, rows: 1 })
    expect([...(shrunk.layers.a ?? [])]).toEqual([1, 2])
    expect([...(shrunk.layers.b ?? [])]).toEqual([E, 7])
    expect(Object.keys(shrunk.layers)).toEqual(['a', 'b'])
  })

  it('counts the tiles a resize would cut', () => {
    const map = sample()
    expect(tilesCut(map, { columns: 3, rows: 2 })).toBe(0)
    expect(tilesCut(map, { columns: 5, rows: 5 })).toBe(0)
    // a loses 3 and 6; b loses 8.
    expect(tilesCut(map, { columns: 2, rows: 2 })).toBe(3)
    // Row 2 goes: a loses 4, 5, 6 and b loses 8.
    expect(tilesCut(map, { columns: 3, rows: 1 })).toBe(4)
  })
})

describe('layers', () => {
  it('adds an empty layer at the end', () => {
    const map = sample()
    const added = addLayer(map, 'c')
    expect(Object.keys(added.layers)).toEqual(['a', 'b', 'c'])
    expect([...(added.layers.c ?? [])]).toEqual(Array(6).fill(E))
    expect(Object.keys(map.layers)).toEqual(['a', 'b'])
  })

  it('renames in place', () => {
    const map = sample()
    const renamed = renameLayer(map, 'a', 'front')
    expect(Object.keys(renamed.layers)).toEqual(['front', 'b'])
    expect([...(renamed.layers.front ?? [])]).toEqual([1, 2, 3, 4, 5, 6])
    expect(Object.keys(map.layers)).toEqual(['a', 'b'])
  })

  it('removes a layer', () => {
    const removed = removeLayer(sample(), 'a')
    expect(Object.keys(removed.layers)).toEqual(['b'])
  })

  it('moves a layer earlier or later', () => {
    const map = addLayer(sample(), 'c')
    expect(Object.keys(moveLayer(map, 'c', -1).layers)).toEqual(['a', 'c', 'b'])
    expect(Object.keys(moveLayer(map, 'a', 1).layers)).toEqual(['b', 'a', 'c'])
    expect(Object.keys(map.layers)).toEqual(['a', 'b', 'c'])
  })

  it('leaves a layer at the end where it is', () => {
    const map = sample()
    expect(Object.keys(moveLayer(map, 'a', -1).layers)).toEqual(['a', 'b'])
    expect(Object.keys(moveLayer(map, 'b', 1).layers)).toEqual(['a', 'b'])
  })

  it('does not share cells with its input', () => {
    const map = sample()
    for (const out of [
      addLayer(map, 'c'),
      renameLayer(map, 'a', 'z'),
      removeLayer(map, 'b'),
      moveLayer(map, 'a', 1),
    ]) {
      for (const cells of Object.values(out.layers)) {
        expect(cells).not.toBe(map.layers.a)
        expect(cells).not.toBe(map.layers.b)
      }
    }
  })

  it('refuses bad names', () => {
    const map = sample()
    expect(layerNameProblem(map, 'walls')).toBeUndefined()
    expect(layerNameProblem(map, 'walls2')).toBeUndefined()
    for (const bad of ['', '1walls', 'my layer', 'a-b', 'é']) {
      expect(layerNameProblem(map, bad)).toMatch(/letters and digits/)
    }
  })

  it('refuses the names a map has', () => {
    for (const name of ['columns', 'rows', 'width', 'height']) {
      expect(layerNameProblem(sample(), name)).toBe(
        `"${name}" is a name a map has`,
      )
    }
  })

  it('refuses a taken name unless renaming that layer', () => {
    const map = sample()
    expect(layerNameProblem(map, 'b')).toBe('there is already a layer "b"')
    expect(layerNameProblem(map, 'b', 'a')).toBe('there is already a layer "b"')
    expect(layerNameProblem(map, 'a', 'a')).toBeUndefined()
  })
})

describe('flags', () => {
  const flags = (): FlagData => ({
    solid: new Set([5, 4]),
    ladder: new Set([7]),
  })

  it('adds a flag on no tiles at the end', () => {
    const base = flags()
    const added = addFlag(base, 'spawn')
    expect(Object.keys(added)).toEqual(['solid', 'ladder', 'spawn'])
    expect(added.spawn?.size).toBe(0)
    expect(Object.keys(base)).toEqual(['solid', 'ladder'])
  })

  it('renames in place', () => {
    const base = flags()
    const renamed = renameFlag(base, 'solid', 'wall')
    expect(Object.keys(renamed)).toEqual(['wall', 'ladder'])
    expect([...(renamed.wall ?? [])].sort()).toEqual([4, 5])
    expect(Object.keys(base)).toEqual(['solid', 'ladder'])
  })

  it('removes a flag', () => {
    const base = flags()
    expect(Object.keys(removeFlag(base, 'solid'))).toEqual(['ladder'])
    expect(Object.keys(base)).toEqual(['solid', 'ladder'])
  })

  it('gives and takes a flag', () => {
    const base = flags()
    const given = setFlag(base, { flag: 'ladder', frames: [8, 9], on: true })
    expect(flagSets(given)).toEqual({ solid: [4, 5], ladder: [7, 8, 9] })
    const taken = setFlag(given, { flag: 'ladder', frames: [7, 20], on: false })
    expect(flagSets(taken)).toEqual({ solid: [4, 5], ladder: [8, 9] })
    expect(flagSets(base)).toEqual({ solid: [4, 5], ladder: [7] })
    expect(Object.keys(taken)).toEqual(['solid', 'ladder'])
  })

  it('refuses bad names', () => {
    expect(flagNameProblem(flags(), 'hurts')).toBeUndefined()
    for (const bad of ['', '2fast', 'two words', 'a_b']) {
      expect(flagNameProblem(flags(), bad)).toMatch(/letters and digits/)
    }
    for (const name of ['frame', 'x', 'y', 'column', 'row']) {
      expect(flagNameProblem(flags(), name)).toBe(
        `"${name}" is a name a tile has`,
      )
    }
  })

  it('refuses a taken name unless renaming that flag', () => {
    expect(flagNameProblem(flags(), 'ladder')).toBe(
      'there is already a flag "ladder"',
    )
    expect(flagNameProblem(flags(), 'ladder', 'solid')).toBe(
      'there is already a flag "ladder"',
    )
    expect(flagNameProblem(flags(), 'ladder', 'ladder')).toBeUndefined()
  })

  it('writes one flag to a line with frames sorted', () => {
    expect(writeFlags(flags())).toBe(
      '{\n  "solid": [4, 5],\n  "ladder": [7]\n}\n',
    )
    expect(writeFlags({})).toBe('{}\n')
    expect(writeFlags(addFlag({}, 'empty'))).toBe('{\n  "empty": []\n}\n')
  })

  it('reads back what it wrote', () => {
    const base = setFlag(flags(), { flag: 'solid', frames: [1, 30], on: true })
    const back = parseFlags(JSON.parse(writeFlags(base)))
    expect(flagSets(back)).toEqual(flagSets(base))
    expect(Object.keys(back)).toEqual(Object.keys(base))
  })
})
