import type { SheetInfo } from '../editor/types.ts'

/** Sent by the dev server to the page when a sheet's PNG has new content. */
export const SHEET_CHANGED = 'tico8:sheet-changed'

export interface SheetChanged {
  /** The file's address from the project root: `/sprites/player.png`. */
  url: string
}

/** Sent by the dev server to the page when a map file has new content. */
export const MAP_CHANGED = 'tico8:map-changed'

export interface MapChanged {
  /** The name the map is exported by from `maps.ts`: `room1`. */
  name: string
  /** The file's JSON, parsed and not yet checked. */
  data: unknown
}

/** Sent by the dev server to the page when a flags file has new content. */
export const FLAGS_CHANGED = 'tico8:flags-changed'

export interface FlagsChanged {
  /** The tileset the flags belong to, by its sheet's name: `tiles`. */
  tiles: string
  /** The file's JSON, parsed and not yet checked. */
  data: unknown
}

/** Sent by the dev server to the page when a sound file has new content. */
export const SOUND_CHANGED = 'tico8:sound-changed'

export interface SoundChanged {
  /** The file's address from the project root: `/sounds/swing.wav`. */
  url: string
}

/** Sent by the dev server to the page when the sprites folder's list changes. */
export const SHEETS_LISTED = 'tico8:sheets-listed'

export interface SheetsListed {
  /** Every sheet in the folder, sorted by name. */
  sheets: SheetInfo[]
}
