/** Sent by the dev server to the page when a sheet's PNG has new content. */
export const SHEET_CHANGED = 'tico8:sheet-changed'

export interface SheetChanged {
  /** The file's address from the project root: `/sprites/player.png`. */
  url: string
}

/** Sent by the dev server to the page when a map file has new content. */
export const MAP_CHANGED = 'tico8:map-changed'

export interface MapChanged {
  /** The file's address from the project root: `/maps/room1.json`. */
  url: string
}

/** Sent by the dev server to the page when a flags file has new content. */
export const FLAGS_CHANGED = 'tico8:flags-changed'

export interface FlagsChanged {
  /** The file's address from the project root: `/sprites/tiles.flags.json`. */
  url: string
}
