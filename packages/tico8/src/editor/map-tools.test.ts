import { describe, expect, it } from 'vitest'
import { EMPTY } from '../maps/types.ts'
import {
  cellsBetween,
  copyCells,
  dropCells,
  emptyCells,
  eraseLine,
  fillCells,
  layerCells,
  liftCells,
  moveCellSelection,
  pasteCells,
  pickCell,
  rectCells,
  stampLine,
} from './map-tools.ts'
import type { Cells } from './map-types.ts'

/** Cells from a text picture: numbers apart by spaces, `.` is empty. */
function cells(text: string): Cells {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.split(/\s+/))
  const columns = rows[0]!.length
  const data = new Int16Array(columns * rows.length)
  for (const [y, row] of rows.entries()) {
    for (const [x, word] of row.entries()) {
      data[y * columns + x] = word === '.' ? EMPTY : Number(word)
    }
  }
  return { columns, rows: rows.length, cells: data }
}

/** The cells back as text, in the same form. */
function show(layer: Cells): string {
  const rows: string[] = []
  for (let y = 0; y < layer.rows; y++) {
    const row: string[] = []
    for (let x = 0; x < layer.columns; x++) {
      const v = layer.cells[y * layer.columns + x]!
      row.push(v === EMPTY ? '.' : String(v))
    }
    rows.push(row.join(' '))
  }
  return rows.join('\n')
}

const blank = (columns: number, rows: number) => emptyCells({ columns, rows })
const one = (frame: number) => cells(String(frame))

describe('layerCells and emptyCells', () => {
  it('shares the layer array', () => {
    const data = {
      tiles: 'tiles',
      columns: 2,
      rows: 1,
      layers: { ground: new Int16Array([3, EMPTY]) },
    }
    const layer = layerCells(data, 'ground')
    layer.cells[1] = 7
    expect(data.layers.ground[1]).toBe(7)
    expect(show(layer)).toBe('3 7')
  })

  it('throws on a missing layer', () => {
    const data = { tiles: 't', columns: 1, rows: 1, layers: {} }
    expect(() => layerCells(data, 'nope')).toThrow()
  })

  it('makes empty cells', () => {
    expect(show(blank(3, 2))).toBe('. . .\n. . .')
  })
})

describe('stampLine', () => {
  it('draws a diagonal with both ends', () => {
    const layer = blank(4, 4)
    stampLine(layer, {
      from: { x: 0, y: 0 },
      to: { x: 3, y: 3 },
      anchor: { x: 0, y: 0 },
      brush: one(5),
    })
    expect(show(layer)).toBe(
      ['5 . . .', '. 5 . .', '. . 5 .', '. . . 5'].join('\n'),
    )
  })

  it('draws a single cell for a click', () => {
    const layer = blank(3, 1)
    stampLine(layer, {
      from: { x: 1, y: 0 },
      to: { x: 1, y: 0 },
      anchor: { x: 1, y: 0 },
      brush: one(2),
    })
    expect(show(layer)).toBe('. 2 .')
  })

  it('draws backwards the same as forwards', () => {
    const layer = blank(4, 1)
    stampLine(layer, {
      from: { x: 3, y: 0 },
      to: { x: 0, y: 0 },
      anchor: { x: 3, y: 0 },
      brush: one(1),
    })
    expect(show(layer)).toBe('1 1 1 1')
  })

  it('lays a 2x2 brush as a pattern anchored at the stroke start', () => {
    const layer = blank(6, 3)
    stampLine(layer, {
      from: { x: 1, y: 0 },
      to: { x: 4, y: 0 },
      anchor: { x: 1, y: 0 },
      brush: cells('1 2\n3 4'),
    })
    expect(show(layer)).toBe(
      ['. 1 2 1 2 1', '. 3 4 3 4 3', '. . . . . .'].join('\n'),
    )
  })

  it('wraps the pattern to the left of the anchor', () => {
    const layer = blank(4, 2)
    stampLine(layer, {
      from: { x: 2, y: 0 },
      to: { x: 0, y: 0 },
      anchor: { x: 2, y: 0 },
      brush: cells('1 2\n3 4'),
    })
    // x=0 is two from the anchor, so column 0 of the brush; x=1 column 1.
    expect(show(layer)).toBe(['1 2 1 2', '3 4 3 4'].join('\n'))
  })

  it('clips to the layer', () => {
    const layer = blank(3, 2)
    stampLine(layer, {
      from: { x: -2, y: 1 },
      to: { x: 5, y: 1 },
      anchor: { x: -2, y: 1 },
      brush: cells('1 2\n3 4'),
    })
    expect(show(layer)).toBe(['. . .', '1 2 1'].join('\n'))
  })

  it('stamps blocks that overhang the edge in part', () => {
    const layer = blank(3, 3)
    stampLine(layer, {
      from: { x: 2, y: 2 },
      to: { x: 2, y: 2 },
      anchor: { x: 2, y: 2 },
      brush: cells('1 2\n3 4'),
    })
    expect(show(layer)).toBe(['. . .', '. . .', '. . 1'].join('\n'))
  })
})

describe('eraseLine', () => {
  it('empties the cells along the line', () => {
    const layer = cells('1 1 1\n1 1 1')
    eraseLine(layer, { from: { x: 0, y: 0 }, to: { x: 2, y: 1 } })
    expect(show(layer)).toBe(['. 1 1', '1 . .'].join('\n'))
  })

  it('clips to the layer', () => {
    const layer = cells('1 1\n1 1')
    eraseLine(layer, { from: { x: -3, y: 0 }, to: { x: 5, y: 0 } })
    expect(show(layer)).toBe('. .\n1 1')
  })
})

describe('fillCells', () => {
  it('floods a region four ways and stops at other frames', () => {
    const layer = cells(['. . 1 .', '. 1 . .', '1 . . 2'].join('\n'))
    expect(fillCells(layer, { at: { x: 0, y: 0 }, brush: one(9) })).toBe(true)
    expect(show(layer)).toBe(['9 9 1 .', '9 1 . .', '1 . . 2'].join('\n'))
  })

  it('does not leak through diagonals', () => {
    const layer = cells(['. 1', '1 .'].join('\n'))
    fillCells(layer, { at: { x: 0, y: 0 }, brush: one(7) })
    expect(show(layer)).toBe(['7 1', '1 .'].join('\n'))
  })

  it('floods a region of a frame', () => {
    const layer = cells(['3 3 4', '3 4 4'].join('\n'))
    fillCells(layer, { at: { x: 2, y: 1 }, brush: one(0) })
    expect(show(layer)).toBe(['3 3 0', '3 0 0'].join('\n'))
  })

  it('anchors the pattern at the click', () => {
    const layer = blank(4, 3)
    fillCells(layer, { at: { x: 1, y: 1 }, brush: cells('1 2\n3 4') })
    expect(show(layer)).toBe(['4 3 4 3', '2 1 2 1', '4 3 4 3'].join('\n'))
  })

  it('changes nothing and says so when the result is the start', () => {
    const layer = cells('5 5\n5 .')
    expect(fillCells(layer, { at: { x: 0, y: 0 }, brush: one(5) })).toBe(false)
    expect(show(layer)).toBe('5 5\n5 .')
  })

  it('is false outside the layer', () => {
    const layer = blank(2, 2)
    expect(fillCells(layer, { at: { x: 2, y: 0 }, brush: one(1) })).toBe(false)
    expect(show(layer)).toBe('. .\n. .')
  })

  it('fills with an empty brush', () => {
    const layer = cells('1 1\n1 2')
    expect(fillCells(layer, { at: { x: 0, y: 0 }, brush: one(EMPTY) })).toBe(
      true,
    )
    expect(show(layer)).toBe('. .\n. 2')
  })
})

describe('rectCells', () => {
  it('fills the rectangle between two cells, either way round', () => {
    const layer = blank(4, 3)
    rectCells(layer, {
      from: { x: 2, y: 2 },
      to: { x: 1, y: 1 },
      brush: one(6),
    })
    expect(show(layer)).toBe(['. . . .', '. 6 6 .', '. 6 6 .'].join('\n'))
  })

  it('anchors the pattern at its top left', () => {
    const layer = blank(5, 3)
    rectCells(layer, {
      from: { x: 4, y: 2 },
      to: { x: 1, y: 0 },
      brush: cells('1 2\n3 4'),
    })
    expect(show(layer)).toBe(['. 1 2 1 2', '. 3 4 3 4', '. 1 2 1 2'].join('\n'))
  })

  it('clips to the layer without moving the pattern', () => {
    const layer = blank(3, 2)
    rectCells(layer, {
      from: { x: -1, y: 0 },
      to: { x: 5, y: 5 },
      brush: cells('1 2\n3 4'),
    })
    // The anchor is (-1, 0), so cell 0 takes brush column 1.
    expect(show(layer)).toBe(['2 1 2', '4 3 4'].join('\n'))
  })
})

describe('pickCell', () => {
  const layer = cells('. 4')

  it('gives the frame', () => {
    expect(pickCell(layer, { x: 1, y: 0 })).toBe(4)
  })

  it('gives undefined for empty and outside', () => {
    expect(pickCell(layer, { x: 0, y: 0 })).toBeUndefined()
    expect(pickCell(layer, { x: 2, y: 0 })).toBeUndefined()
    expect(pickCell(layer, { x: 0, y: -1 })).toBeUndefined()
  })

  it('gives frame 0', () => {
    expect(pickCell(cells('0'), { x: 0, y: 0 })).toBe(0)
  })
})

describe('cellsBetween', () => {
  const bounds = { x: 0, y: 0, width: 4, height: 3 }

  it('includes both corners, either way round', () => {
    const want = { x: 1, y: 0, width: 3, height: 2 }
    expect(cellsBetween({ x: 1, y: 0 }, { x: 3, y: 1 }, bounds)).toEqual(want)
    expect(cellsBetween({ x: 3, y: 1 }, { x: 1, y: 0 }, bounds)).toEqual(want)
  })

  it('is one cell for one corner', () => {
    expect(cellsBetween({ x: 2, y: 2 }, { x: 2, y: 2 }, bounds)).toEqual({
      x: 2,
      y: 2,
      width: 1,
      height: 1,
    })
  })

  it('cuts to the bounds', () => {
    expect(cellsBetween({ x: -2, y: 1 }, { x: 9, y: 9 }, bounds)).toEqual({
      x: 0,
      y: 1,
      width: 4,
      height: 2,
    })
  })

  it('is empty when entirely outside', () => {
    const r = cellsBetween({ x: 6, y: 0 }, { x: 8, y: 1 }, bounds)
    expect(r.width).toBe(0)
  })
})

describe('copyCells', () => {
  it('copies a block, not sharing the array', () => {
    const layer = cells('1 2 3\n4 5 6')
    const clip = copyCells(layer, { x: 1, y: 0, width: 2, height: 2 })
    expect(show(clip)).toBe('2 3\n5 6')
    clip.cells[0] = 9
    expect(layer.cells[1]).toBe(2)
  })

  it('leaves what is outside the layer empty', () => {
    const layer = cells('1 2\n3 4')
    const clip = copyCells(layer, { x: 1, y: 1, width: 2, height: 2 })
    expect(show(clip)).toBe('4 .\n. .')
  })
})

describe('liftCells', () => {
  it('takes the cells and empties the hole', () => {
    const layer = cells('1 2 3\n4 5 6')
    const rect = { x: 0, y: 0, width: 2, height: 2 }
    const sel = liftCells(layer, rect)
    expect(sel.rect).toEqual(rect)
    expect(show(sel.lifted!)).toBe('1 2\n4 5')
    expect(show(layer)).toBe('. . 3\n. . 6')
  })
})

describe('moveCellSelection', () => {
  it('moves only the rect', () => {
    const layer = cells('1 2\n3 4')
    const sel = liftCells(layer, { x: 0, y: 0, width: 1, height: 2 })
    const moved = moveCellSelection(sel, { x: 1, y: -1 })
    expect(moved.rect).toEqual({ x: 1, y: -1, width: 1, height: 2 })
    expect(moved.lifted).toBe(sel.lifted)
    expect(sel.rect.x).toBe(0)
  })
})

describe('dropCells', () => {
  it('puts the cells down and leaves what is under empty ones', () => {
    const layer = cells('7 7 7\n7 7 7')
    const sel = {
      rect: { x: 1, y: 0, width: 2, height: 2 },
      lifted: cells('1 .\n. 4'),
    }
    dropCells(layer, sel)
    expect(show(layer)).toBe('7 1 7\n7 7 4')
  })

  it('clips to the layer', () => {
    const layer = blank(2, 2)
    dropCells(layer, {
      rect: { x: 1, y: 1, width: 2, height: 2 },
      lifted: cells('1 2\n3 4'),
    })
    expect(show(layer)).toBe('. .\n. 1')
  })

  it('does nothing for a selection not lifted', () => {
    const layer = cells('1')
    dropCells(layer, { rect: { x: 0, y: 0, width: 1, height: 1 } })
    expect(show(layer)).toBe('1')
  })

  it('moves a block when lifted, moved and dropped', () => {
    const layer = cells('1 2 .\n3 4 .')
    const sel = moveCellSelection(
      liftCells(layer, { x: 0, y: 0, width: 2, height: 2 }),
      { x: 1, y: 0 },
    )
    dropCells(layer, sel)
    expect(show(layer)).toBe('. 1 2\n. 3 4')
  })
})

describe('pasteCells', () => {
  it('gives a lifted copy with its top left at the point', () => {
    const clip = cells('1 2')
    const sel = pasteCells(clip, { x: 3, y: 4 })
    expect(sel.rect).toEqual({ x: 3, y: 4, width: 2, height: 1 })
    expect(show(sel.lifted!)).toBe('1 2')
    sel.lifted!.cells[0] = 9
    expect(clip.cells[0]).toBe(1)
  })
})
