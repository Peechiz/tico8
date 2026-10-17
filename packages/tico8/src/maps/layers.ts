import type { Screen } from '../screen.ts'
import type { Rect } from '../shapes.ts'
import type { Sheet } from '../sprites.ts'
import type { Vec } from '../vec.ts'
import {
  EMPTY,
  type FlagData,
  type Layer,
  type MapData,
  type PlacedTile,
  type Tile,
  type TileMap,
} from './types.ts'

/** A map whose cells and flags can be set, and set again when a file changes. */
export interface LoadableMap {
  /**
   * What the game holds. It and its layers stay the same objects for as
   * long as the map lives, whatever is put into it.
   */
  readonly map: TileMap<string, string>
  /**
   * Replace every layer's cells. A layer the data no longer has becomes
   * empty, and a new one appears on `map`.
   */
  setData(data: MapData): void
  /** Replace the tileset's flags. */
  setFlags(flags: FlagData): void
  /** Undo every `set` since the last `setData`. */
  restore(): void
}

/** The highest frame a cell can hold. */
const MAX_FRAME = 32767

/** One layer's cells: as the game has changed them, and as last given. */
interface Cells {
  now: Int16Array
  given: Int16Array
}

/**
 * A map that draws to `screen` with the tiles of `sheet`, a cell being the
 * sheet's cell size. Without `data` it has no layers and no size.
 */
export function createMap(
  screen: Screen,
  sheet: Sheet,
  data?: MapData,
  flags?: FlagData,
): LoadableMap {
  const cell = sheet.cell
  let columns = 0
  let rows = 0

  let flagSets: FlagData = {}
  let flagNames: string[] = []
  // One frozen tile per frame, built when first asked for, so reading a
  // cell in a collision loop makes nothing new.
  let known = new Map<number, Tile<string>>()
  let emptyTile = flagsOf(EMPTY, { frame: undefined }) as Tile<string>

  const layers = new Map<string, Cells>()

  /** Add each flag to `tile` as true or false for a frame, and freeze it. */
  function flagsOf<T extends object>(frame: number, tile: T): T {
    const out = tile as Record<string, unknown>
    for (const name of flagNames) out[name] = flagSets[name]!.has(frame)
    return Object.freeze(tile)
  }

  function tileOf(frame: number): Tile<string> {
    if (frame === EMPTY) return emptyTile
    let tile = known.get(frame)
    if (!tile) {
      tile = flagsOf(frame, { frame }) as Tile<string>
      known.set(frame, tile)
    }
    return tile
  }

  /** The frames that have a flag, or undefined for a flag nobody declared. */
  function framesWith(flag: string): ReadonlySet<number> | undefined {
    return Object.hasOwn(flagSets, flag) ? flagSets[flag] : undefined
  }

  /** The size getters a map and its layers share. */
  const size = {
    columns: { get: () => columns, enumerable: true },
    rows: { get: () => rows, enumerable: true },
    width: { get: () => columns * cell.width, enumerable: true },
    height: { get: () => rows * cell.height, enumerable: true },
  }

  function createLayer(cells: Cells): Layer<string> {
    function tile(column: number, row: number): Tile<string> {
      const c = Math.floor(column)
      const r = Math.floor(row)
      if (!(c >= 0 && c < columns && r >= 0 && r < rows)) return emptyTile
      return tileOf(cells.now[r * columns + c]!)
    }

    const layer = {
      draw(a?: number | Readonly<Vec>, b?: number): void {
        const [x, y] =
          a === undefined
            ? [0, 0]
            : typeof a === 'number'
              ? [a, b!]
              : [a.x, a.y]
        // Where the layer's top left lands on the screen.
        const left = Math.floor(x - screen.offset.x)
        const top = Math.floor(y - screen.offset.y)
        const { x0, y0, x1, y1 } = screen.bounds
        // The cells with any pixel inside the clip.
        const c0 = Math.max(0, Math.floor((x0 - left) / cell.width))
        const c1 = Math.min(columns, Math.ceil((x1 - left) / cell.width))
        const r0 = Math.max(0, Math.floor((y0 - top) / cell.height))
        const r1 = Math.min(rows, Math.ceil((y1 - top) / cell.height))
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const frame = cells.now[r * columns + c]!
            if (frame === EMPTY) continue
            sheet.draw({
              frame,
              x: x + c * cell.width,
              y: y + r * cell.height,
            })
          }
        }
      },

      tile,

      tileAt(a: number | Readonly<Vec>, b?: number): Tile<string> {
        const [x, y] = typeof a === 'number' ? [a, b!] : [a.x, a.y]
        return tile(x / cell.width, y / cell.height)
      },

      set(column: number, row: number, frame: number | undefined): void {
        const c = Math.floor(column)
        const r = Math.floor(row)
        if (!(c >= 0 && c < columns && r >= 0 && r < rows)) return
        const f = frame === undefined ? EMPTY : Math.floor(frame)
        cells.now[r * columns + c] = f >= 0 && f <= MAX_FRAME ? f : EMPTY
      },

      tiles(flag?: string): PlacedTile<string>[] {
        const out: PlacedTile<string>[] = []
        const wanted = flag === undefined ? undefined : framesWith(flag)
        if (flag !== undefined && !wanted) return out
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < columns; c++) {
            const frame = cells.now[r * columns + c]!
            if (frame === EMPTY) continue
            if (wanted && !wanted.has(frame)) continue
            out.push(
              flagsOf(frame, {
                frame,
                x: c * cell.width,
                y: r * cell.height,
                column: c,
                row: r,
              }) as PlacedTile<string>,
            )
          }
        }
        return out
      },

      overlaps(area: Readonly<Rect>, flag: string): boolean {
        if (!(area.width > 0 && area.height > 0)) return false
        const wanted = framesWith(flag)
        if (!wanted) return false
        // The cells the rectangle covers any part of.
        const c0 = Math.max(0, Math.floor(area.x / cell.width))
        const c1 = Math.min(
          columns,
          Math.ceil((area.x + area.width) / cell.width),
        )
        const r0 = Math.max(0, Math.floor(area.y / cell.height))
        const r1 = Math.min(
          rows,
          Math.ceil((area.y + area.height) / cell.height),
        )
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            if (wanted.has(cells.now[r * columns + c]!)) return true
          }
        }
        return false
      },

      area(_area: Readonly<Rect>): Layer<string> {
        throw new Error('not yet')
      },
    }
    return Object.defineProperties(layer, size) as typeof layer &
      Pick<Layer, 'columns' | 'rows' | 'width' | 'height'>
  }

  const map = Object.defineProperties({}, size) as TileMap<string, string>

  function setFlags(next: FlagData): void {
    flagSets = next
    flagNames = Object.keys(next)
    known = new Map()
    emptyTile = flagsOf(EMPTY, { frame: undefined }) as Tile<string>
  }

  function setData(next: MapData): void {
    columns = next.columns
    rows = next.rows
    const length = columns * rows
    for (const name of new Set([
      ...layers.keys(),
      ...Object.keys(next.layers),
    ])) {
      // A copy, so `set` never reaches the caller's cells.
      const given = new Int16Array(length).fill(EMPTY)
      const from = next.layers[name]
      if (from) given.set(from.subarray(0, length))
      let cells = layers.get(name)
      if (!cells) {
        cells = { now: given, given }
        layers.set(name, cells)
        Object.defineProperty(map, name, {
          value: createLayer(cells),
          enumerable: true,
        })
      }
      cells.given = given
      cells.now = given.slice()
    }
  }

  if (flags) setFlags(flags)
  if (data) setData(data)

  return {
    map,
    setData,
    setFlags,
    restore() {
      for (const cells of layers.values()) cells.now.set(cells.given)
    },
  }
}
