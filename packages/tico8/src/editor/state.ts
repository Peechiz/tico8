import type { Editor, FileHost, Rgb } from './types.ts'

/** A key event as `SHORTCUTS` spells it: `mod+shift+z`, `delete`, `p`. */
export function keyName(_event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): string {
  throw new Error('not yet')
}

/** The file name a new sheet is saved as: `hero.16.png`, `wall.png`. */
export function sheetFile(_sheet: {
  name: string
  cellWidth: number
  cellHeight: number
}): string {
  throw new Error('not yet')
}

/** The sprite editor over a project's files, painting in its palette. */
export function createEditor(_options: {
  host: FileHost
  palette: readonly Rgb[]
}): Editor {
  throw new Error('not yet')
}
