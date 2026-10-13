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
 * How long to wait before the one second try at a file that would not
 * load. An editor that saves in two steps can be caught between them.
 */
export const RETRY_DELAY = 100

/**
 * What the generated `maps.ts` hands over for one map: the two files as
 * imported, each with the address it can be fetched from again. The
 * layers' and flags' names are read off the types of the imports.
 */
export interface MapSource<L extends string, F extends string> {
  /** The map file's address from the project root: `/maps/room1.json`. */
  url: string
  /** The map file, as imported. */
  data: { tiles: string; layers: Record<L, readonly string[]> }
  /** The tileset's sheet. */
  tiles: Sheet
  /** The tileset's flags file, when it has one. */
  flags?: { url: string; data: Record<F, readonly number[]> }
}

export interface MapsOptions {
  screen: Screen
  /** Fetch the JSON at an address, parsed, never from the browser's cache. */
  load(url: string): Promise<unknown>
  /** Milliseconds before the second try. Defaults to `RETRY_DELAY`. */
  retryDelay?: number
}

export interface Maps {
  map<L extends string, F extends string = never>(
    source: MapSource<L, F>,
  ): TileMap<L, F>
  /** Fetch a changed map file and swap it into its map. Never rejects. */
  reload(url: string): Promise<void>
  /** Fetch a changed flags file and swap it into every map using it. */
  reloadFlags(url: string): Promise<void>
  /** Put every map back as its file has it, undoing what a game `set`. */
  restore(): void
}

function reportFailure(url: string, error: unknown, outcome: string): void {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.replace(/\.$/, '')
  console.error(`tico8: ${url} was not loaded: ${reason}. ${outcome}`)
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

/** The maps of one console, by address. `load` is passed in for tests. */
export function createMaps(options: MapsOptions): Maps {
  const { screen, load, retryDelay = RETRY_DELAY } = options

  interface Entry {
    map: LoadableMap
    /** The address of the flags file its tileset has, if any. */
    flagsUrl: string | undefined
    /** Whether a file has been read into it, or it is still empty. */
    loaded: boolean
  }

  const registry = new Map<string, Entry>()
  /** Loads started, by address. A load that is no longer the last gives up. */
  const turns = new Map<string, number>()

  /**
   * Load `url`, read it with `parse` and hand the result to `put`. Never
   * rejects, and puts nothing if the file is bad or a newer load of the
   * same address has started since. `outcome` ends the report of a failure.
   */
  async function fill<T>(
    url: string,
    parse: (file: unknown) => T,
    put: (value: T) => void,
    outcome: () => string,
  ) {
    const turn = (turns.get(url) ?? 0) + 1
    turns.set(url, turn)
    const stale = () => turn !== turns.get(url)
    try {
      let file: unknown
      try {
        file = await load(url)
      } catch {
        if (stale()) return
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        if (stale()) return
        file = await load(url)
      }
      if (stale()) return
      put(parse(file))
    } catch (error) {
      if (!stale()) reportFailure(url, error, outcome())
    }
  }

  return {
    map<L extends string, F extends string = never>(source: MapSource<L, F>) {
      let flags: FlagData | undefined
      if (source.flags) {
        try {
          flags = parseFlags(source.flags.data)
        } catch (error) {
          reportFailure(source.flags.url, error, 'The map has no flags.')
        }
      }

      const entry: Entry = {
        map: createMap(screen, source.tiles, undefined, flags),
        flagsUrl: source.flags?.url,
        loaded: false,
      }
      try {
        entry.map.setData(parseMap(source.data))
        entry.loaded = true
      } catch (error) {
        reportFailure(source.url, error, 'The map stays empty.')
        entry.map.setData(emptyData(source.data))
      }

      // Asked for again when the generated file is re-run: the game that
      // starts next holds this map, so it replaces the one before.
      registry.set(source.url, entry)
      return entry.map.map as unknown as TileMap<L, F>
    },

    async reload(url) {
      const entry = registry.get(url)
      if (!entry) return
      await fill(
        url,
        parseMap,
        (data) => {
          entry.map.setData(data)
          entry.loaded = true
        },
        () => (entry.loaded ? 'The old map stays.' : 'The map stays empty.'),
      )
    },

    async reloadFlags(url) {
      // Looked up when the file arrives, so a map made meanwhile gets it too.
      const using = () =>
        [...registry.values()].filter((entry) => entry.flagsUrl === url)
      if (using().length === 0) return
      await fill(
        url,
        parseFlags,
        (flags) => {
          for (const entry of using()) entry.map.setFlags(flags)
        },
        () => 'The old flags stay.',
      )
    },

    restore() {
      for (const entry of registry.values()) entry.map.restore()
    },
  }
}

/** Fetch a JSON file under an address the browser has not fetched before. */
async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(`${url}?t=${Date.now()}`)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim())
  }
  return response.json()
}

const maps = createMaps({ screen: display, load: loadJson })

/**
 * A map that draws to the console's screen. Called by the generated
 * `maps.ts`, not by game code.
 */
export function map<L extends string, F extends string = never>(
  source: MapSource<L, F>,
): TileMap<L, F> {
  return maps.map(source)
}

/** Put every map back as its file has it. Called when a game starts. */
export function restoreMaps(): void {
  maps.restore()
}

// Listen here and not in the game's entry: the entry runs again on every
// code change, this module only once per page.
if (import.meta.hot) {
  import.meta.hot.on(MAP_CHANGED, ({ url }: MapChanged) => {
    maps.reload(url)
  })
  import.meta.hot.on(FLAGS_CHANGED, ({ url }: FlagsChanged) => {
    maps.reloadFlags(url)
  })
}
