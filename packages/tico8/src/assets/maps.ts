import { display } from '../console.ts'
import { parseMap } from '../maps/file.ts'
import { parseFlags } from '../maps/flags.ts'
import type { LoadableMap } from '../maps/layers.ts'
import { createMap } from '../maps/layers.ts'
import type { FlagData, MapData, TileMap } from '../maps/types.ts'
import { NAME, RESERVED_LAYERS } from '../maps/types.ts'
import type { Screen } from '../screen.ts'
import type { Sheet } from '../sprites.ts'
import type { FlagsChanged, MapChanged } from './event.ts'
import { FLAGS_CHANGED, MAP_CHANGED } from './event.ts'

/**
 * What the generated `maps.ts` hands over for one map: the two files as
 * imported. The layers' and flags' names are read off the types of the
 * imports.
 */
export interface MapSource<L extends string, F extends string> {
  /** The map file, as imported. */
  data: { tiles: string; layers: Record<L, readonly string[]> }
  /** The tileset's sheet. */
  tiles: Sheet
  /** The tileset's flags file, as imported, when it has one. */
  flags?: Record<F, readonly number[]>
}

export interface MapsOptions {
  screen: Screen
}

export interface Maps {
  map<L extends string, F extends string = never>(
    name: string,
    source: MapSource<L, F>,
  ): TileMap<L, F>
  /** Put a changed map file's contents into the map of that name. */
  swap(name: string, data: unknown): void
  /** Put a changed flags file's contents into every map on that tileset. */
  swapFlags(tiles: string, data: unknown): void
  /** Put every map back as its file has it, undoing what a game `set`. */
  restore(): void
}

/** `what` names the file and ends in its verb: `map room1 was`. */
function reportFailure(what: string, error: unknown, outcome: string): void {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.replace(/\.$/, '')
  console.error(`tico8: ${what} not loaded: ${reason}. ${outcome}`)
}

/**
 * Cells for a map whose file was refused: no size, and an empty layer for
 * each name that can be read, so a game drawing `room1.walls` does not
 * throw.
 */
function emptyData(file: unknown): MapData {
  const data: MapData = { tiles: '', columns: 0, rows: 0, layers: {} }
  const layers = (file as { layers?: unknown } | null | undefined)?.layers
  if (typeof layers !== 'object' || layers === null) return data
  for (const name of Object.keys(layers)) {
    if (!NAME.test(name) || RESERVED_LAYERS.includes(name)) continue
    data.layers[name] = new Int16Array(0)
  }
  return data
}

/** The maps of one console, by the name each is exported by. */
export function createMaps(options: MapsOptions): Maps {
  const { screen } = options

  interface Entry {
    map: LoadableMap
    /** The name of its tileset, as its map file has it, if that can be read. */
    tiles: string | undefined
    /** Whether a file has been read into it, or it is still empty. */
    loaded: boolean
  }

  const registry = new Map<string, Entry>()

  return {
    map<L extends string, F extends string = never>(
      name: string,
      source: MapSource<L, F>,
    ) {
      const named: unknown = (source.data as { tiles?: unknown } | null)?.tiles
      const tiles = typeof named === 'string' ? named : undefined

      let flags: FlagData | undefined
      if (source.flags) {
        try {
          flags = parseFlags(source.flags)
        } catch (error) {
          const what =
            tiles === undefined
              ? `the flags of map ${name} were`
              : `the flags of tileset ${tiles} were`
          reportFailure(what, error, 'The map has no flags.')
        }
      }

      const entry: Entry = {
        map: createMap(screen, source.tiles, undefined, flags),
        tiles,
        loaded: false,
      }
      try {
        entry.map.setData(parseMap(source.data))
        entry.loaded = true
      } catch (error) {
        reportFailure(`map ${name} was`, error, 'The map stays empty.')
        entry.map.setData(emptyData(source.data))
      }

      // Asked for again when the generated file is re-run: the game that
      // starts next holds this map, so it replaces the one before.
      registry.set(name, entry)
      return entry.map.map as unknown as TileMap<L, F>
    },

    swap(name, data) {
      const entry = registry.get(name)
      if (!entry) return
      try {
        const parsed = parseMap(data)
        entry.map.setData(parsed)
        entry.tiles = parsed.tiles
        entry.loaded = true
      } catch (error) {
        const outcome = entry.loaded
          ? 'The old map stays.'
          : 'The map stays empty.'
        reportFailure(`map ${name} was`, error, outcome)
      }
    },

    swapFlags(tiles, data) {
      const using = [...registry.values()].filter(
        (entry) => entry.tiles === tiles,
      )
      if (using.length === 0) return
      try {
        const flags = parseFlags(data)
        for (const entry of using) entry.map.setFlags(flags)
      } catch (error) {
        const what = `the flags of tileset ${tiles} were`
        reportFailure(what, error, 'The old flags stay.')
      }
    },

    restore() {
      for (const entry of registry.values()) entry.map.restore()
    },
  }
}

const maps = createMaps({ screen: display })

/**
 * A map that draws to the console's screen. Called by the generated
 * `maps.ts`, not by game code.
 */
export function map<L extends string, F extends string = never>(
  name: string,
  source: MapSource<L, F>,
): TileMap<L, F> {
  return maps.map(name, source)
}

/** Put every map back as its file has it. Called when a game starts. */
export function restoreMaps(): void {
  maps.restore()
}

// Listen here and not in the game's entry: the entry runs again on every
// code change, this module only once per page.
if (import.meta.hot) {
  import.meta.hot.on(MAP_CHANGED, ({ name, data }: MapChanged) => {
    maps.swap(name, data)
  })
  import.meta.hot.on(FLAGS_CHANGED, ({ tiles, data }: FlagsChanged) => {
    maps.swapFlags(tiles, data)
  })
}
