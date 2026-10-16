// A map's cells and a tileset's flags as data: making, resizing, layers,
// flags and the names they may take. Nothing here touches files.
import { EMPTY, NAME, RESERVED_FLAGS, RESERVED_LAYERS } from '../maps/types.ts'
import type { CellCount, FlagData, MapData } from './map-types.ts'

/** `data` with its layers replaced, in the order given. */
const withLayers = (
  data: MapData,
  layers: [string, Int16Array][],
): MapData => ({ ...data, layers: Object.fromEntries(layers) })

/** The file a map is saved as: `room1.json`. */
export function mapFile(name: string): string {
  return `${name}.json`
}

/**
 * The flags file of a tileset whose sheet is `file`, in the sprites folder:
 * `tiles.png` and `tiles.8.png` give `tiles.flags.json`.
 */
export function flagsFileFor(file: string): string {
  const stem = file.replace(/\.png$/i, '').replace(/\.\d+(?:x\d+)?$/, '')
  return `${stem}.flags.json`
}

/** A map of one empty layer. */
export function newMapData(
  map: CellCount & { tiles: string; layer: string },
): MapData {
  return {
    tiles: map.tiles,
    columns: map.columns,
    rows: map.rows,
    layers: { [map.layer]: new Int16Array(map.columns * map.rows).fill(EMPTY) },
  }
}

/** A copy that shares nothing with `data`. */
export function cloneMap(data: MapData): MapData {
  return withLayers(
    data,
    Object.entries(data.layers).map(([name, cells]) => [name, cells.slice()]),
  )
}

/** Whether two maps hold the same tileset, size, layers in order and cells. */
export function sameMap(a: MapData, b: MapData): boolean {
  if (a.tiles !== b.tiles || a.columns !== b.columns || a.rows !== b.rows) {
    return false
  }
  const x = Object.entries(a.layers)
  const y = Object.entries(b.layers)
  return (
    x.length === y.length &&
    x.every(([name, cells], i) => {
      const [other, otherCells] = y[i] ?? []
      return (
        name === other &&
        otherCells !== undefined &&
        cells.length === otherCells.length &&
        cells.every((cell, at) => cell === otherCells[at])
      )
    })
  )
}

/** The map at a new size in cells, its top left kept, new cells empty. */
export function resizeMap(data: MapData, size: CellCount): MapData {
  const { columns, rows } = size
  const kept = Math.min(columns, data.columns)
  const keptRows = Math.min(rows, data.rows)
  return {
    ...withLayers(
      data,
      Object.entries(data.layers).map(([name, cells]) => {
        const out = new Int16Array(columns * rows).fill(EMPTY)
        for (let row = 0; row < keptRows; row++) {
          const from = row * data.columns
          out.set(cells.subarray(from, from + kept), row * columns)
        }
        return [name, out]
      }),
    ),
    columns,
    rows,
  }
}

/** How many cells holding a tile, on every layer, a resize would cut. */
export function tilesCut(data: MapData, size: CellCount): number {
  let cut = 0
  for (const cells of Object.values(data.layers)) {
    for (let row = 0; row < data.rows; row++) {
      for (let column = 0; column < data.columns; column++) {
        if (column < size.columns && row < size.rows) continue
        if (cells[row * data.columns + column] !== EMPTY) cut++
      }
    }
  }
  return cut
}

/**
 * Why `name` cannot name a layer of `data`, or undefined if it can: letters
 * and digits starting with a letter, not one of the map's own names, not
 * taken by another layer. `renaming` is the layer being renamed, which may
 * keep its name.
 */
export function layerNameProblem(
  data: MapData,
  name: string,
  renaming?: string,
): string | undefined {
  if (!NAME.test(name)) {
    return 'a layer name is letters and digits, starting with a letter'
  }
  if (RESERVED_LAYERS.includes(name)) return `"${name}" is a name a map has`
  if (name !== renaming && name in data.layers) {
    return `there is already a layer "${name}"`
  }
  return undefined
}

/** `data` with an empty layer added at the end. */
export function addLayer(data: MapData, name: string): MapData {
  return withLayers(data, [
    ...Object.entries(data.layers).map(
      ([layer, cells]): [string, Int16Array] => [layer, cells.slice()],
    ),
    [name, new Int16Array(data.columns * data.rows).fill(EMPTY)],
  ])
}

/** `data` with a layer renamed in its place. */
export function renameLayer(data: MapData, from: string, to: string): MapData {
  return withLayers(
    data,
    Object.entries(data.layers).map(([layer, cells]) => [
      layer === from ? to : layer,
      cells.slice(),
    ]),
  )
}

/** `data` without a layer. */
export function removeLayer(data: MapData, name: string): MapData {
  return withLayers(
    data,
    Object.entries(data.layers)
      .filter(([layer]) => layer !== name)
      .map(([layer, cells]) => [layer, cells.slice()]),
  )
}

/** `data` with a layer moved one place earlier (-1) or later (1). */
export function moveLayer(data: MapData, name: string, by: -1 | 1): MapData {
  const entries = Object.entries(data.layers).map(
    ([layer, cells]): [string, Int16Array] => [layer, cells.slice()],
  )
  const from = entries.findIndex(([layer]) => layer === name)
  const to = from + by
  const [moved] = entries.splice(from, 1)
  if (from < 0 || to < 0 || to > entries.length || !moved) {
    return cloneMap(data)
  }
  entries.splice(to, 0, moved)
  return withLayers(data, entries)
}

/**
 * Why `name` cannot name a flag, or undefined if it can: letters and digits
 * starting with a letter, not one of a tile's own names, not taken.
 * `renaming` is the flag being renamed, which may keep its name.
 */
export function flagNameProblem(
  flags: FlagData,
  name: string,
  renaming?: string,
): string | undefined {
  if (!NAME.test(name)) {
    return 'a flag name is letters and digits, starting with a letter'
  }
  if (RESERVED_FLAGS.includes(name)) return `"${name}" is a name a tile has`
  if (name !== renaming && name in flags) {
    return `there is already a flag "${name}"`
  }
  return undefined
}

/** `flags` with a new flag, on no tiles, at the end. */
export function addFlag(flags: FlagData, name: string): FlagData {
  return { ...flags, [name]: new Set<number>() }
}

/** `flags` with a flag renamed in its place. */
export function renameFlag(
  flags: FlagData,
  from: string,
  to: string,
): FlagData {
  return Object.fromEntries(
    Object.entries(flags).map(([flag, frames]) => [
      flag === from ? to : flag,
      frames,
    ]),
  )
}

/** `flags` without a flag. */
export function removeFlag(flags: FlagData, name: string): FlagData {
  return Object.fromEntries(
    Object.entries(flags).filter(([flag]) => flag !== name),
  )
}

/** `flags` with a flag given to, or taken from, every frame in `frames`. */
export function setFlag(
  flags: FlagData,
  change: { flag: string; frames: readonly number[]; on: boolean },
): FlagData {
  const frames = new Set(flags[change.flag])
  for (const frame of change.frames) {
    if (change.on) frames.add(frame)
    else frames.delete(frame)
  }
  return { ...flags, [change.flag]: frames }
}

/**
 * The text of a flags file: JSON, one flag to a line with its frames
 * sorted, ending in a newline. `parseFlags(JSON.parse(writeFlags(f)))`
 * gives `f` back.
 */
export function writeFlags(flags: FlagData): string {
  const lines = Object.entries(flags).map(
    ([flag, frames]) =>
      `  ${JSON.stringify(flag)}: [${[...frames].sort((a, b) => a - b).join(', ')}]`,
  )
  return lines.length === 0 ? '{}\n' : `{\n${lines.join(',\n')}\n}\n`
}
