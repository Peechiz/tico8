import { SYMBOLS } from './symbols.ts'
import { TOM_THUMB, TOM_THUMB_HEIGHT, TOM_THUMB_SPACING } from './tom-thumb.ts'
import type { Font } from './types.ts'

/**
 * The console's font: Tom Thumb's letters, 3 wide and 5 tall with a sixth
 * row for the tails of `g` and `y`, and the game symbols, which are wider.
 */
export const FONT: Font = {
  height: TOM_THUMB_HEIGHT,
  spacing: TOM_THUMB_SPACING,
  glyphs: new Map([...TOM_THUMB, ...SYMBOLS]),
  // A hollow box the size of a capital.
  missing: { width: 3, rows: [7, 5, 5, 5, 7, 0] },
}
