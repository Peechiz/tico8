import type { ViteHotContext } from 'vite/types/hot.js'
import type { SheetChanged, SheetsListed } from '../assets/event.ts'
import { SHEET_CHANGED, SHEETS_LISTED } from '../assets/event.ts'
import { loadPixels } from '../assets/png.ts'
import type { FileHost, SheetInfo } from './types.ts'

/** Where the dev server lists and writes sheets. */
export const SHEETS_API = '/@tico8/sheets'

/** The folder sheets are served from, as the dev server names it. */
const SHEETS_URL = '/sprites/'

/** A sheet's address, spelled as the generated `sprites.ts` spells it. */
export function sheetAddress(file: string): string {
  return `${SHEETS_URL}${encodeURIComponent(file).replaceAll("'", '%27')}`
}

/** The file name a sheet's address names, or undefined if it is not one. */
export function fileOfSheetUrl(url: string): string | undefined {
  if (!url.startsWith(SHEETS_URL)) return undefined
  const name = url.slice(SHEETS_URL.length)
  if (name === '' || name.includes('/')) return undefined
  try {
    return decodeURIComponent(name)
  } catch {
    return undefined
  }
}

/** The part of Vite's `import.meta.hot` the host uses. */
export type HotChannel = Pick<ViteHotContext, 'on' | 'off'>

/** The `FileHost` of `tico8 dev`: its HTTP endpoints and HMR events. */
export function devHost(
  hot: HotChannel | undefined = import.meta.hot,
): FileHost {
  function listen<T>(event: string, listener: (data: T) => void): () => void {
    if (!hot) return () => {}
    hot.on(event, listener)
    return () => hot.off(event, listener)
  }

  return {
    async list() {
      const response = await fetch(SHEETS_API)
      if (!response.ok) throw new Error(await failure(response, 'list sheets'))
      return (await response.json()) as SheetInfo[]
    },

    read(file) {
      // The browser may hold the old pixels; ask for the file as it is now.
      return loadPixels(`${sheetAddress(file)}?t=${Date.now()}`)
    },

    async write(file, bytes) {
      const response = await fetch(
        `${SHEETS_API}/${encodeURIComponent(file)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: bytes as Uint8Array<ArrayBuffer>,
        },
      )
      if (!response.ok) {
        throw new Error(await failure(response, `write ${file}`))
      }
    },

    onChange(listener) {
      return listen<SheetChanged>(SHEET_CHANGED, ({ url }) => {
        const file = fileOfSheetUrl(url)
        if (file !== undefined) listener(file)
      })
    },

    onList(listener) {
      return listen<SheetsListed>(SHEETS_LISTED, ({ sheets }) => {
        listener(sheets)
      })
    },
  }
}

/** The server's reason a request failed, or its status if it gave none. */
async function failure(response: Response, doing: string): Promise<string> {
  const text = (await response.text()).trim()
  return `could not ${doing}: ${text || `${response.status} ${response.statusText}`}`
}
