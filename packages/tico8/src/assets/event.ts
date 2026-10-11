/** Sent by the dev server to the page when a sheet's PNG has new content. */
export const SHEET_CHANGED = 'tico8:sheet-changed'

export interface SheetChanged {
  /** The file's address from the project root: `/sprites/player.png`. */
  url: string
}
