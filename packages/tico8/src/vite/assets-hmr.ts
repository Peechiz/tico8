import type { Plugin } from 'vite'
import type { SheetChanged } from '../assets/event.ts'
import { SHEET_CHANGED } from '../assets/event.ts'
import { SPRITES_DIR } from './sprites.ts'

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
  const encoded = names.map((name) =>
    encodeURIComponent(name).replaceAll("'", '%27'),
  )
  return `/${SPRITES_DIR}/${encoded.join('/')}`
}

/**
 * Tells the running game when an asset file changes, so it swaps live
 * and the game is not restarted.
 */
export function assetsHmr(): Plugin {
  return {
    name: 'tico8:assets-hmr',

    hotUpdate({ type, file }) {
      if (this.environment.name !== 'client' || type === 'delete') return
      const url = sheetUrl(this.environment.config.root, file)
      if (url === undefined) return
      const data: SheetChanged = { url }
      this.environment.hot.send(SHEET_CHANGED, data)
      // A file some editors replace rather than rewrite arrives as created.
      // Leave that to the plugin that writes sprites.ts; for a plain change
      // the page has all it needs, so nothing is reloaded or re-run.
      if (type === 'update') return []
    },
  }
}
