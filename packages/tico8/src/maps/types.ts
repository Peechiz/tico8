import type { Rect } from '../shapes.ts'
import type { Vec } from '../vec.ts'

type Point = Readonly<Vec>

/**
 * A map file as written, `maps/room1.json`. A row is one line of text:
 * tile numbers apart by spaces, `.` for an empty cell. Every row of every
 * layer holds the same number of cells, and every layer the same number
 * of rows.
 */
export interface MapFile {
  /** The tileset: the name a sheet in the sprites folder is imported by. */
  readonly tiles: string
  /** Each layer's rows, top to bottom, by the layer's name. */
  readonly layers: { readonly [layer: string]: readonly string[] }
}

/**
 * A flags file as written, `sprites/tiles.flags.json`: for each flag, the
 * tiles that have it.
 */
export interface FlagsFile {
  readonly [flag: string]: readonly number[]
}

/** What a cell holds when it has no tile. */
export const EMPTY = -1

/** Names a map has of its own, which a layer cannot take. */
export const RESERVED_LAYERS: readonly string[] = [
  'columns',
  'rows',
  'width',
  'height',
]

/** Names a tile has of its own, which a flag cannot take. */
export const RESERVED_FLAGS: readonly string[] = [
  'frame',
  'x',
  'y',
  'column',
  'row',
]

/** A layer or flag name: letters and digits, starting with a letter. */
export const NAME = /^[A-Za-z][A-Za-z0-9]*$/

/** A map file read into cells. */
export interface MapData {
  /** The tileset's name, as the file gives it. */
  tiles: string
  /** How many cells across, and down. */
  columns: number
  rows: number
  /**
   * Each layer's cells by name, in the file's order: row by row from the
   * top left, `columns * rows` long, a cell being a frame of the tileset
   * or `EMPTY`.
   */
  layers: { [layer: string]: Int16Array }
}

/** A flags file read into sets: for each flag, the frames that have it. */
export interface FlagData {
  readonly [flag: string]: ReadonlySet<number>
}

/**
 * What is in a cell: the tile's frame in the tileset, or undefined for an
 * empty cell, and each of the tileset's flags as true or false. An empty
 * cell, and one outside the layer, has every flag false.
 *
 *     if (room1.walls.tile(3, 4).solid) { ... }
 */
export type Tile<F extends string = never> = {
  readonly frame: number | undefined
} & { readonly [flag in F]: boolean }

/**
 * A tile and where it is: `x` and `y` are its top left corner in pixels,
 * so it can be handed to anything that takes a position; `column` and
 * `row` are its cell.
 */
export type PlacedTile<F extends string = never> = {
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly column: number
  readonly row: number
} & { readonly [flag in F]: boolean }

/**
 * One layer of a map. Nothing draws it but `draw`, so the order of the
 * calls in a game's `draw` is what puts a sprite between two layers.
 *
 * A position in pixels is given as `x, y` or as one value, and counts from
 * the layer's top left corner: reading a layer takes it to be drawn at
 * 0, 0. A cell is given as its column and row.
 */
export interface Layer<F extends string = never> {
  /** The layer's size in cells. */
  readonly columns: number
  readonly rows: number
  /** The layer's size in pixels. */
  readonly width: number
  readonly height: number

  /**
   * Draw the layer with its top left corner at a position, or at 0, 0.
   * Empty cells draw nothing, and cells the clip hides are skipped.
   */
  draw(): void
  draw(at: Point): void
  draw(x: number, y: number): void

  /** What is in a cell. */
  tile(column: number, row: number): Tile<F>

  /** What is in the cell under a position in pixels. */
  tileAt(at: Point): Tile<F>
  tileAt(x: number, y: number): Tile<F>

  /**
   * Put a tile in a cell by its frame, or empty the cell with undefined.
   * A cell outside the layer is ignored. The change lasts until the game
   * restarts or the map's file is saved.
   */
  set(column: number, row: number, frame: number | undefined): void

  /**
   * Every tile on the layer with its position, row by row from the top
   * left, empty cells left out. Given a flag, only the tiles that have it:
   *
   *     const [start] = room1.markers.tiles('spawn')
   */
  tiles(flag?: F): PlacedTile<F>[]

  /**
   * Whether a rectangle, in pixels, covers any part of a tile that has a
   * flag: `room1.walls.overlaps(hitbox, 'solid')`. Touching edges do not
   * count.
   */
  overlaps(area: Readonly<Rect>, flag: F): boolean

  /**
   * A view of part of the layer: the cells a rectangle in pixels covers,
   * grown to whole cells, as a layer of their own counted from the
   * rectangle's top left. Drawing it draws only those cells, and reading it
   * sees only them, with outside reading as empty. `set` writes to this
   * layer. A map of rooms draws and collides one room with it:
   *
   *     const walls = world.walls.area(room)
   *     walls.draw()
   *     if (walls.overlaps(hitbox, 'solid')) { ... }
   */
  area(area: Readonly<Rect>): Layer<F>
}

/**
 * A map from the maps folder: its layers by name, and its size. `L` is
 * the layers' names and `F` the tileset's flags, both read from the files.
 *
 *     room1.ground.draw()
 *     hero.draw(pos)
 *     room1.front.draw()
 */
export type TileMap<L extends string = string, F extends string = never> = {
  /** The map's size in cells. */
  readonly columns: number
  readonly rows: number
  /** The map's size in pixels. */
  readonly width: number
  readonly height: number
} & { readonly [layer in L]: Layer<F> }

/**
 * A layer of a map, for a function that takes one:
 *
 *     function drawRoom(layer: LayerOf<typeof world>) { ... }
 */
export type LayerOf<M> = Exclude<M[keyof M], number>
