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

  /** The size getters of a map, or of anything `columns` by `rows` cells. */
  function sizeOf(columns: () => number, rows: () => number) {
    return {
      columns: { get: columns, enumerable: true },
      rows: { get: rows, enumerable: true },
      width: { get: () => columns() * cell.width, enumerable: true },
      height: { get: () => rows() * cell.height, enumerable: true },
    }
  }

  /**
   * A layer over a window of cells: the whole of a layer's cells, or an
   * area of another window. `index` gives where a whole column and row of
   * the window are in `cells.now`, or -1 outside the window or the cells.
   */
  interface Window {
    columns(): number
    rows(): number
    index(column: number, row: number): number
  }

  function createLayer(cells: Cells, window: Window): Layer<string> {
    const { index } = window

    function frameAt(c: number, r: number): number {
      const i = index(c, r)
      return i < 0 ? EMPTY : cells.now[i]!
    }

    function tile(column: number, row: number): Tile<string> {
      return tileOf(frameAt(Math.floor(column), Math.floor(row)))
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
        const c1 = Math.min(
          window.columns(),
          Math.ceil((x1 - left) / cell.width),
        )
        const r0 = Math.max(0, Math.floor((y0 - top) / cell.height))
        const r1 = Math.min(window.rows(), Math.ceil((y1 - top) / cell.height))
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const frame = frameAt(c, r)
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
        const i = index(Math.floor(column), Math.floor(row))
        if (i < 0) return
        const f = frame === undefined ? EMPTY : Math.floor(frame)
        cells.now[i] = f >= 0 && f <= MAX_FRAME ? f : EMPTY
      },

      tiles(flag?: string): PlacedTile<string>[] {
        const out: PlacedTile<string>[] = []
        const wanted = flag === undefined ? undefined : framesWith(flag)
        if (flag !== undefined && !wanted) return out
        const columns = window.columns()
        const rows = window.rows()
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < columns; c++) {
            const frame = frameAt(c, r)
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
          window.columns(),
          Math.ceil((area.x + area.width) / cell.width),
        )
        const r0 = Math.max(0, Math.floor(area.y / cell.height))
        const r1 = Math.min(
          window.rows(),
          Math.ceil((area.y + area.height) / cell.height),
        )
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const i = index(c, r)
            if (i >= 0 && wanted.has(cells.now[i]!)) return true
          }
        }
        return false
      },

      area(area: Readonly<Rect>): Layer<string> {
        // The cells the rectangle covers any part of, grown to whole cells.
        const left = Math.floor(area.x / cell.width)
        const top = Math.floor(area.y / cell.height)
        const columns = Math.max(
          0,
          Math.ceil((area.x + area.width) / cell.width) - left,
        )
        const rows = Math.max(
          0,
          Math.ceil((area.y + area.height) / cell.height) - top,
        )
        return createLayer(cells, {
          columns: () => columns,
          rows: () => rows,
          index: (c, r) =>
            c >= 0 && c < columns && r >= 0 && r < rows
              ? index(left + c, top + r)
              : -1,
        })
      },
    }
    return Object.defineProperties(
      layer,
      sizeOf(window.columns, window.rows),
    ) as typeof layer & Pick<Layer, 'columns' | 'rows' | 'width' | 'height'>
  }

  /** The whole of a layer's cells, as big as the map is now. */
  const whole: Window = {
    columns: () => columns,
    rows: () => rows,
    index: (c, r) =>
      c >= 0 && c < columns && r >= 0 && r < rows ? r * columns + c : -1,
  }

  const map = Object.defineProperties(
    {},
    sizeOf(whole.columns, whole.rows),
  ) as TileMap<string, string>

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
          value: createLayer(cells, whole),
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
