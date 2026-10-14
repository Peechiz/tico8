import type { FileHost } from './types.ts'

/** Where the dev server lists and writes sheets. */
export const SHEETS_API = '/@tico8/sheets'

/** The `FileHost` of `tico8 dev`: its HTTP endpoints and HMR events. */
export function devHost(): FileHost {
  throw new Error('not yet')
}
