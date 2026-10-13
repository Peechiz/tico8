import { expect, it } from 'vitest'
import { parseMap, writeMap } from './file.ts'
import { EMPTY } from './types.ts'

/** A file with one layer of these rows. */
function file(rows: unknown, extra: Record<string, unknown> = {}) {
  return { tiles: 'tiles', layers: { ground: rows, ...extra } }
}

it('reads rows into cells, in the file order of layers', () => {
  const data = parseMap({
    tiles: 'tiles',
    layers: { walls: ['4 .', '. 12'], ground: ['1 1', '1 2'] },
  })
  expect(data.tiles).toBe('tiles')
  expect([data.columns, data.rows]).toEqual([2, 2])
  expect(Object.keys(data.layers)).toEqual(['walls', 'ground'])
  expect([...(data.layers.walls ?? [])]).toEqual([4, EMPTY, EMPTY, 12])
  expect(data.layers.ground).toBeInstanceOf(Int16Array)
})

it('accepts any run of spaces, and spaces at either end', () => {
  const data = parseMap(file(['  1   .  2 ', '3 4 5']))
  expect(data.columns).toBe(3)
  expect([...(data.layers.ground ?? [])]).toEqual([1, EMPTY, 2, 3, 4, 5])
})

it('writes a map with its columns lined up', () => {
  const data = parseMap({
    tiles: 'tiles',
    layers: { ground: ['1 1', '1 2'], walls: ['4 .', '. 4'] },
  })
  expect(writeMap(data)).toBe(`{
  "tiles": "tiles",
  "layers": {
    "ground": [
      " 1  1",
      " 1  2"
    ],
    "walls": [
      " 4  .",
      " .  4"
    ]
  }
}
`)
})

it('lines up two-digit tiles across every layer', () => {
  const data = parseMap({
    tiles: 'tiles',
    layers: {
      a: ['1 12', '. 3'],
      b: ['100 .', '5 6'],
    },
  })
  expect(writeMap(data)).toBe(`{
  "tiles": "tiles",
  "layers": {
    "a": [
      "   1   12",
      "   .    3"
    ],
    "b": [
      " 100    .",
      "   5    6"
    ]
  }
}
`)
})

it('reads back what it wrote', () => {
  const data = parseMap({
    tiles: 'tiles',
    layers: {
      ground: ['1 2 3', '. 40 5'],
      front: ['. . .', '7 . 32767'],
    },
  })
  expect(parseMap(JSON.parse(writeMap(data)))).toEqual(data)
  expect(writeMap(data).endsWith('}\n')).toBe(true)
})

const refused: [string, unknown, string][] = [
  ['not an object', [], 'the map file is not an object'],
  [
    'no tileset',
    { layers: {} },
    'the map file has no "tiles" naming its tileset',
  ],
  [
    'empty tileset',
    { tiles: '', layers: {} },
    'the map file has no "tiles" naming its tileset',
  ],
  ['no layers object', { tiles: 't' }, 'the map file has no "layers" object'],
  ['no layers', { tiles: 't', layers: {} }, 'the map has no layers'],
  ['layer not a list', file('1 1'), 'layer "ground" is not a list of rows'],
  ['row not text', file([1]), 'layer "ground" row 1 is not text'],
  ['no rows', file([]), 'layer "ground" has no rows'],
  ['empty first row', file(['  ']), 'layer "ground" row 1 has no tiles'],
  [
    'row too long',
    file(['1 1', '1 1 1']),
    'layer "ground" row 2 has 3 tiles and the map is 2 wide',
  ],
  [
    'row too short in a later layer',
    file(['1 1 1'], { walls: ['1 1'] }),
    'layer "walls" row 1 has 2 tiles and the map is 3 wide',
  ],
  [
    'layer too tall',
    file(['1 1'], { walls: ['1 1', '1 1'] }),
    'layer "walls" has 2 rows and the map is 1 tall',
  ],
  [
    'layer too short',
    file(['1 1', '1 1'], { walls: ['1 1'] }),
    'layer "walls" has 1 rows and the map is 2 tall',
  ],
  [
    'bad token',
    file(['1 x']),
    'layer "ground" row 1 has "x", which is not a tile or "."',
  ],
  [
    'negative tile',
    file(['1 -2']),
    'layer "ground" row 1 has "-2", which is not a tile or "."',
  ],
  [
    'fraction',
    file(['1.5']),
    'layer "ground" row 1 has "1.5", which is not a tile or "."',
  ],
  [
    'tile too large',
    file(['32768']),
    'layer "ground" row 1 has tile 32768, above the largest, 32767',
  ],
  [
    'bad layer name',
    { tiles: 't', layers: { '1st': ['1'] } },
    'layer "1st" cannot be used as a name: letters and digits, starting with a letter',
  ],
  [
    'reserved layer name',
    { tiles: 't', layers: { width: ['1'] } },
    'layer "width" cannot be used as a name: a map has one',
  ],
]

it.each(refused)('refuses %s', (_name, input, message) => {
  expect(() => parseMap(input)).toThrow(new Error(message))
})
