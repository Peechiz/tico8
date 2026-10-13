import type { Plugin } from 'vite'
import type { FlagsChanged, MapChanged, SheetChanged } from '../assets/event.ts'
import { FLAGS_CHANGED, MAP_CHANGED, SHEET_CHANGED } from '../assets/event.ts'
import { FLAGS_SUFFIX, MAPS_DIR } from './maps.ts'
import { SPRITES_DIR } from './sprites.ts'

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
 * The address the page looks a map up by, given the file's full path, or
 * undefined if the file is not a `.json` file directly in the project's maps
 * folder.
 */
export function mapUrl(root: string, file: string): string | undefined {
  const name = directChild(root, MAPS_DIR, file)
  if (name === undefined || !/\.json$/i.test(name)) return undefined
  return `/${MAPS_DIR}/${encodeName(name)}`
}

/**
 * The address the page looks a sheet's flags up by, given the file's full path,
 * or undefined if the file is not a flags file directly in the project's
 * sprites folder.
 */
export function flagsUrl(root: string, file: string): string | undefined {
  const name = directChild(root, SPRITES_DIR, file)
  if (name === undefined || !name.endsWith(FLAGS_SUFFIX)) return undefined
  return `/${SPRITES_DIR}/${encodeName(name)}`
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
 * Tells the running game when an asset, map or flags file changes, so it swaps live
 * and the game is not restarted.
 */
export function assetsHmr(): Plugin {
  return {
    name: 'tico8:assets-hmr',

    hotUpdate({ type, file }) {
      if (this.environment.name !== 'client' || type === 'delete') return
      const { root } = this.environment.config
      const sheet = sheetUrl(root, file)
      const map = mapUrl(root, file)
      const flags = flagsUrl(root, file)
      if (sheet !== undefined) {
        const data: SheetChanged = { url: sheet }
        this.environment.hot.send(SHEET_CHANGED, data)
      } else if (map !== undefined) {
        const data: MapChanged = { url: map }
        this.environment.hot.send(MAP_CHANGED, data)
      } else if (flags !== undefined) {
        const data: FlagsChanged = { url: flags }
        this.environment.hot.send(FLAGS_CHANGED, data)
      } else return
      // A file some editors replace rather than rewrite arrives as created.
      // Leave that to the plugin that writes sprites.ts; for a plain change
      // the page has all it needs, so nothing is reloaded or re-run.
      if (type === 'update') return []
    },
  }
}
