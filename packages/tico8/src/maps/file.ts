import type { MapData } from './types.ts'
import { EMPTY, NAME, RESERVED_LAYERS } from './types.ts'

/** The largest frame a cell can hold. */
const MAX_FRAME = 32767

/** Whether a value is a plain object, not an array or null. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The cells of one row of text, or the reason it cannot be read. */
function parseRow(text: string, where: string): number[] {
  const trimmed = text.trim()
  if (trimmed === '') return []
  return trimmed.split(/ +/).map((token) => {
    if (token === '.') return EMPTY
    if (!/^\d+$/.test(token)) {
      throw new Error(`${where} has "${token}", which is not a tile or "."`)
    }
    const frame = Number(token)
    if (frame > MAX_FRAME) {
      throw new Error(
        `${where} has tile ${token}, above the largest, ${MAX_FRAME}`,
      )
    }
    return frame
  })
}

/**
 * Read a map file's JSON, already parsed, into cells. Throws an `Error`
 * whose message says what is wrong, ending without a full stop, for
 * anything that is not a map: see `MapFile` for the shape.
 */
export function parseMap(file: unknown): MapData {
  if (!isObject(file)) throw new Error('the map file is not an object')
  const { tiles, layers } = file
  if (typeof tiles !== 'string' || tiles === '') {
    throw new Error('the map file has no "tiles" naming its tileset')
  }
  if (!isObject(layers)) {
    throw new Error('the map file has no "layers" object')
  }
  const names = Object.keys(layers)
  if (names.length === 0) throw new Error('the map has no layers')

  let columns = 0
  let rows = 0
  const out: { [layer: string]: Int16Array } = {}
  for (const [index, name] of names.entries()) {
    if (!NAME.test(name)) {
      throw new Error(
        `layer "${name}" cannot be used as a name: letters and digits, starting with a letter`,
      )
    }
    if (RESERVED_LAYERS.includes(name)) {
      throw new Error(`layer "${name}" cannot be used as a name: a map has one`)
    }
    const lines = layers[name]
    if (!Array.isArray(lines)) {
      throw new Error(`layer "${name}" is not a list of rows`)
    }
    const cells: number[][] = lines.map((line: unknown, row) => {
      if (typeof line !== 'string') {
        throw new Error(`layer "${name}" row ${row + 1} is not text`)
      }
      return parseRow(line, `layer "${name}" row ${row + 1}`)
    })
    if (index === 0) {
      rows = cells.length
      columns = cells[0]?.length ?? 0
      if (rows === 0) throw new Error(`layer "${name}" has no rows`)
      if (columns === 0) throw new Error(`layer "${name}" row 1 has no tiles`)
    } else if (cells.length !== rows) {
      throw new Error(
        `layer "${name}" has ${cells.length} rows and the map is ${rows} tall`,
      )
    }
    const data = new Int16Array(columns * rows)
    for (const [row, line] of cells.entries()) {
      if (line.length !== columns) {
        throw new Error(
          `layer "${name}" row ${row + 1} has ${line.length} tiles and the map is ${columns} wide`,
        )
      }
      data.set(line, row * columns)
    }
    out[name] = data
  }
  return { tiles, columns, rows, layers: out }
}

/**
 * The text of a map file holding these cells: JSON, two-space indents,
 * one row to a line with its columns lined up, ending in a newline.
 * `parseMap(JSON.parse(writeMap(data)))` gives `data` back.
 *
 * Every cell is right-aligned to one more than the width of the widest
 * cell in the map, and cells are one space apart, so a one-digit map has
 * a space before each tile, as in the spec's example.
 */
export function writeMap(data: MapData): string {
  let widest = 1
  for (const cells of Object.values(data.layers)) {
    for (const cell of cells) {
      widest = Math.max(widest, cell === EMPTY ? 1 : String(cell).length)
    }
  }
  const width = widest + 1
  const layers: { [layer: string]: string[] } = {}
  for (const [name, cells] of Object.entries(data.layers)) {
    const rows: string[] = []
    for (let row = 0; row < data.rows; row++) {
      const line: string[] = []
      for (let column = 0; column < data.columns; column++) {
        const cell = cells[row * data.columns + column]
        line.push((cell === EMPTY ? '.' : String(cell)).padStart(width))
      }
      rows.push(line.join(' '))
    }
    layers[name] = rows
  }
  // One row to a line: stringify each layer's array with its own indent.
  const body = Object.entries(layers).map(
    ([name, rows]) =>
      `    ${JSON.stringify(name)}: [\n${rows
        .map((row) => `      ${JSON.stringify(row)}`)
        .join(',\n')}\n    ]`,
  )
  return `{\n  "tiles": ${JSON.stringify(data.tiles)},\n  "layers": {\n${body.join(',\n')}\n  }\n}\n`
}
