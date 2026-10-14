import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'
import type { FlagsChanged, MapChanged, SheetChanged } from '../assets/event.ts'
import { FLAGS_CHANGED, MAP_CHANGED, SHEET_CHANGED } from '../assets/event.ts'
import { FLAGS_SUFFIX, MAPS_DIR } from './maps.ts'
import { camelCase, SPRITES_DIR } from './sprites.ts'

/** A file name spelled as the generated files spell it in an address. */
function encodeName(name: string): string {
  return encodeURIComponent(name).replaceAll("'", '%27')
}

/**
 * The name of a file directly inside a folder of the project, or undefined if
 * the file is elsewhere, in a subfolder, or hidden.
 */
function directChild(
  root: string,
  dir: string,
  file: string,
): string | undefined {
  const folder = `${root.replace(/\/$/, '')}/${dir}/`
  if (!file.startsWith(folder)) return undefined
  const name = file.slice(folder.length)
  if (name === '' || name.includes('/') || name.startsWith('.'))
    return undefined
  return name
}

/**
 * The name a map is exported by from `maps.ts`, given the file's full path, or
 * undefined if the file is not a `.json` file directly in the project's maps
 * folder. A flags file there is not a map.
 */
export function mapName(root: string, file: string): string | undefined {
  const name = directChild(root, MAPS_DIR, file)
  if (name === undefined || !/\.json$/i.test(name)) return undefined
  if (name.endsWith(FLAGS_SUFFIX)) return undefined
  return camelCase(name.slice(0, -'.json'.length)) || undefined
}

/**
 * The sheet name of the tileset a flags file belongs to, given the file's full
 * path, or undefined if the file is not a flags file directly in the project's
 * sprites folder.
 */
export function flagsTileset(root: string, file: string): string | undefined {
  const name = directChild(root, SPRITES_DIR, file)
  if (name === undefined || !name.endsWith(FLAGS_SUFFIX)) return undefined
  return camelCase(name.slice(0, -FLAGS_SUFFIX.length)) || undefined
}

/**
 * The address the page loads a sheet from, given the file's full path, or
 * undefined if the file is not a PNG in the project's sprites folder. Both
 * paths use forward slashes, as Vite gives them. The address is spelled as
 * the generated `sprites.ts` spells it, since the page looks sheets up by it.
 */
export function sheetUrl(root: string, file: string): string | undefined {
  const folder = `${root.replace(/\/$/, '')}/${SPRITES_DIR}/`
  if (!file.startsWith(folder) || !/\.png$/i.test(file)) return undefined
  const names = file.slice(folder.length).split('/')
  const encoded = names.map(encodeName)
  return `/${SPRITES_DIR}/${encoded.join('/')}`
}

/**
 * The address the page loads a sound from, given the file's full path, or
 * undefined if the file is not a wav, ogg or mp3 directly in the project's
 * sounds folder. Spelled as the generated `sounds.ts` spells it.
 */
export function soundUrl(root: string, file: string): string | undefined {
  throw new Error(`not built yet: ${root} ${file}`)
}

/** Parse JSON text, or return undefined if it is not valid. */
function parseJson(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) }
  } catch {
    return undefined
  }
}

/**
 * Tells the running game when an asset, map or flags file changes, so it swaps
 * live and the game is not restarted. A map or flags file is sent as parsed
 * contents. If it does not parse, it may be half-written by an editor that
 * saves in two steps, so it is read once more after `retryDelay` ms.
 */
export function assetsHmr(retryDelay = 100): Plugin {
  return {
    name: 'tico8:assets-hmr',

    hotUpdate({ type, file, read }) {
      if (this.environment.name !== 'client' || type === 'delete') return
      const { root } = this.environment.config
      const sheet = sheetUrl(root, file)
      if (sheet !== undefined) {
        const data: SheetChanged = { url: sheet }
        this.environment.hot.send(SHEET_CHANGED, data)
        // A file some editors replace rather than rewrite arrives as created.
        // Leave that to the plugin that writes sprites.ts; for a plain change
        // the page has all it needs, so nothing is reloaded or re-run.
        if (type === 'update') return []
        return
      }
      const map = mapName(root, file)
      const tiles = map === undefined ? flagsTileset(root, file) : undefined
      if (map === undefined && tiles === undefined) return
      const { hot, logger } = this.environment
      return (async () => {
        let parsed = parseJson(await read())
        if (parsed === undefined) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          parsed = parseJson(await readFile(file, 'utf8'))
        }
        if (parsed === undefined) {
          const path = file.slice(root.replace(/\/$/, '').length + 1)
          logger.warn(
            `[tico8] ${path} was not swapped in: it is not valid JSON.`,
          )
        } else if (map !== undefined) {
          const data: MapChanged = { name: map, data: parsed.value }
          hot.send(MAP_CHANGED, data)
        } else if (tiles !== undefined) {
          const data: FlagsChanged = { tiles, data: parsed.value }
          hot.send(FLAGS_CHANGED, data)
        }
        if (type === 'update') return []
      })()
    },
  }
}
