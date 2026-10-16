import type { FlagsChanged, MapChanged, MapsListed } from '../assets/event.ts'
import { FLAGS_CHANGED, MAP_CHANGED, MAPS_LISTED } from '../assets/event.ts'
import type { HotChannel } from './host.ts'
import type { MapHost, MapInfo } from './map-types.ts'
import type { FileHost } from './types.ts'

/** Where the dev server lists, reads and writes maps. */
export const MAPS_API = '/@tico8/maps'

/** Where the dev server reads and writes flags files. */
export const FLAGS_API = '/@tico8/flags'

/**
 * The `MapHost` of `tico8 dev`: its HTTP endpoints and HMR events, with
 * tilesets through the sprite editor's host.
 */
export function devMapHost(
  sheets: FileHost,
  hot: HotChannel | undefined = import.meta.hot,
): MapHost {
  function listen<T>(event: string, listener: (data: T) => void): () => void {
    if (!hot) return () => {}
    hot.on(event, listener)
    return () => hot.off(event, listener)
  }

  async function read(api: string, file: string, missing: 'throw' | 'none') {
    const response = await fetch(`${api}/${encodeURIComponent(file)}`)
    if (response.status === 404 && missing === 'none') return undefined
    if (!response.ok) throw new Error(await failure(response, `read ${file}`))
    return (await response.json()) as unknown
  }

  async function write(api: string, file: string, text: string) {
    const response = await fetch(`${api}/${encodeURIComponent(file)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    })
    if (!response.ok) throw new Error(await failure(response, `write ${file}`))
  }

  return {
    sheets,

    async listMaps() {
      const response = await fetch(MAPS_API)
      if (!response.ok) throw new Error(await failure(response, 'list maps'))
      return (await response.json()) as MapInfo[]
    },

    readMap: (file) => read(MAPS_API, file, 'throw'),
    writeMap: (file, text) => write(MAPS_API, file, text),
    readFlags: (file) => read(FLAGS_API, file, 'none'),
    writeFlags: (file, text) => write(FLAGS_API, file, text),

    onMapChange(listener) {
      return listen<MapChanged>(MAP_CHANGED, ({ name, data }) => {
        listener(name, data)
      })
    },

    onFlagsChange(listener) {
      return listen<FlagsChanged>(FLAGS_CHANGED, ({ tiles, data }) => {
        listener(tiles, data)
      })
    },

    onMapList(listener) {
      return listen<MapsListed>(MAPS_LISTED, ({ maps }) => listener(maps))
    },
  }
}

/** The server's reason a request failed, or its status if it gave none. */
async function failure(response: Response, doing: string): Promise<string> {
  const text = (await response.text()).trim()
  return `could not ${doing}: ${text || `${response.status} ${response.statusText}`}`
}
