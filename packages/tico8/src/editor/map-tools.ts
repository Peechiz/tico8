// The map editor's tools, on one layer's cells. Everything clips to the
// layer. The brush is laid down as a pattern: the cell at an offset from the
// anchor takes the brush's cell at that offset, wrapped.
import { EMPTY } from '../maps/types.ts'
import type { Cells, LayerSelection, MapData, Rect, Vec } from './map-types.ts'

/** A layer of `data` as `Cells`, sharing its array, so edits land in it. */
export function layerCells(data: MapData, layer: string): Cells {
  const cells = data.layers[layer]
  if (!cells) {
    throw new Error(`no layer ${layer}`)
  }
  return { columns: data.columns, rows: data.rows, cells }
}

/** `columns` by `rows` empty cells. */
export function emptyCells(size: { columns: number; rows: number }): Cells {
  return {
    columns: size.columns,
    rows: size.rows,
    cells: new Int16Array(size.columns * size.rows).fill(EMPTY),
  }
}

const inside = (layer: Cells, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < layer.columns && y < layer.rows

/** A modulo that is never negative. */
const wrap = (n: number, size: number): number => ((n % size) + size) % size

/** The brush's cell for the layer cell (x, y), pattern anchored at `anchor`. */
function patternAt(brush: Cells, anchor: Vec, x: number, y: number): number {
  const column = wrap(x - anchor.x, brush.columns)
  const row = wrap(y - anchor.y, brush.rows)
  return brush.cells[row * brush.columns + column]!
}

/** Put the brush's pattern on one layer cell, if it is in the layer. */
function paint(layer: Cells, brush: Cells, anchor: Vec, x: number, y: number) {
  if (inside(layer, x, y)) {
    layer.cells[y * layer.columns + x] = patternAt(brush, anchor, x, y)
  }
}

/** Each cell of the Bresenham line from `from` to `to`, both ends included. */
function lineCells(from: Vec, to: Vec, visit: (x: number, y: number) => void) {
  const dx = Math.abs(to.x - from.x)
  const dy = -Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let err = dx + dy
  let x = from.x
  let y = from.y
  for (;;) {
    visit(x, y)
    if (x === to.x && y === to.y) {
      return
    }
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/**
 * Lay the brush down along a line of cells from `from` to `to`, covering
 * the brush's size at each cell, its pattern anchored at `anchor`, the cell
 * the stroke started on.
 */
export function stampLine(
  layer: Cells,
  stroke: { from: Vec; to: Vec; anchor: Vec; brush: Cells },
): void {
  const { brush, anchor } = stroke
  lineCells(stroke.from, stroke.to, (x, y) => {
    for (let row = 0; row < brush.rows; row++) {
      for (let column = 0; column < brush.columns; column++) {
        paint(layer, brush, anchor, x + column, y + row)
      }
    }
  })
}

/** Empty the cells along a line. */
export function eraseLine(layer: Cells, stroke: { from: Vec; to: Vec }): void {
  lineCells(stroke.from, stroke.to, (x, y) => {
    if (inside(layer, x, y)) {
      layer.cells[y * layer.columns + x] = EMPTY
    }
  })
}

/**
 * Flood the cells joined four ways to `at` that hold its frame with the
 * brush, anchored at `at`. False, and nothing changed, when it would change
 * nothing.
 */
export function fillCells(
  layer: Cells,
  fill: { at: Vec; brush: Cells },
): boolean {
  const { at, brush } = fill
  if (!inside(layer, at.x, at.y)) {
    return false
  }
  const target = layer.cells[at.y * layer.columns + at.x]!
  // Find the region first, so the brush's own frames cannot be re-flooded.
  const seen = new Uint8Array(layer.cells.length)
  const region: number[] = []
  const todo = [at.y * layer.columns + at.x]
  seen[todo[0]!] = 1
  while (todo.length > 0) {
    const i = todo.pop()!
    region.push(i)
    const x = i % layer.columns
    const y = Math.floor(i / layer.columns)
    const next: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of next) {
      if (!inside(layer, nx, ny)) {
        continue
      }
      const j = ny * layer.columns + nx
      if (!seen[j] && layer.cells[j] === target) {
        seen[j] = 1
        todo.push(j)
      }
    }
  }
  let changed = false
  for (const i of region) {
    const value = patternAt(
      brush,
      at,
      i % layer.columns,
      Math.floor(i / layer.columns),
    )
    if (layer.cells[i] !== value) {
      layer.cells[i] = value
      changed = true
    }
  }
  return changed
}

/** Fill the rectangle between two cells with the brush, anchored at its top left. */
export function rectCells(
  layer: Cells,
  rect: { from: Vec; to: Vec; brush: Cells },
): void {
  const left = Math.min(rect.from.x, rect.to.x)
  const top = Math.min(rect.from.y, rect.to.y)
  const right = Math.max(rect.from.x, rect.to.x)
  const bottom = Math.max(rect.from.y, rect.to.y)
  const anchor = { x: left, y: top }
  for (let y = Math.max(top, 0); y <= Math.min(bottom, layer.rows - 1); y++) {
    for (
      let x = Math.max(left, 0);
      x <= Math.min(right, layer.columns - 1);
      x++
    ) {
      paint(layer, rect.brush, anchor, x, y)
    }
  }
}

/** The frame at a cell, undefined when empty or outside. */
export function pickCell(layer: Cells, at: Vec): number | undefined {
  if (!inside(layer, at.x, at.y)) {
    return undefined
  }
  const frame = layer.cells[at.y * layer.columns + at.x]!
  return frame === EMPTY ? undefined : frame
}

/** The rectangle of cells from one corner cell to another, both in, cut to `bounds`. */
export function cellsBetween(from: Vec, to: Vec, bounds: Rect): Rect {
  const left = Math.max(Math.min(from.x, to.x), bounds.x)
  const top = Math.max(Math.min(from.y, to.y), bounds.y)
  const right = Math.min(Math.max(from.x, to.x) + 1, bounds.x + bounds.width)
  const bottom = Math.min(Math.max(from.y, to.y) + 1, bounds.y + bounds.height)
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

/** The cells in `rect`, copied; any part outside the layer comes out empty. */
export function copyCells(layer: Cells, rect: Rect): Cells {
  const copy = emptyCells({ columns: rect.width, rows: rect.height })
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const lx = rect.x + x
      const ly = rect.y + y
      if (inside(layer, lx, ly)) {
        copy.cells[y * rect.width + x] = layer.cells[ly * layer.columns + lx]!
      }
    }
  }
  return copy
}

/** Lift `rect` off the layer, leaving it empty. */
export function liftCells(layer: Cells, rect: Rect): LayerSelection {
  const lifted = copyCells(layer, rect)
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (inside(layer, x, y)) {
        layer.cells[y * layer.columns + x] = EMPTY
      }
    }
  }
  return { rect: { ...rect }, lifted }
}

/** The selection moved by `by` cells. */
export function moveCellSelection(
  selection: LayerSelection,
  by: Vec,
): LayerSelection {
  const { rect } = selection
  return { ...selection, rect: { ...rect, x: rect.x + by.x, y: rect.y + by.y } }
}

/** Put a lifted selection's cells down; its empty cells leave what is under. */
export function dropCells(layer: Cells, selection: LayerSelection): void {
  const { rect, lifted } = selection
  if (!lifted) {
    return
  }
  for (let y = 0; y < lifted.rows; y++) {
    for (let x = 0; x < lifted.columns; x++) {
      const value = lifted.cells[y * lifted.columns + x]!
      const lx = rect.x + x
      const ly = rect.y + y
      if (value !== EMPTY && inside(layer, lx, ly)) {
        layer.cells[ly * layer.columns + lx] = value
      }
    }
  }
}

/** Copied cells as a lifted selection with its top left at `at`. */
export function pasteCells(clip: Cells, at: Vec): LayerSelection {
  return {
    rect: { x: at.x, y: at.y, width: clip.columns, height: clip.rows },
    lifted: {
      columns: clip.columns,
      rows: clip.rows,
      cells: clip.cells.slice(),
    },
  }
}
