import type {
  CellCount,
  History,
  IndexedImage,
  Pixels,
  Rgb,
  SheetDoc,
  SheetInfo,
} from './types.ts'

/**
 * A sheet as colour indices: the palette first, then colours the sheet uses
 * from outside it. A pixel less than half opaque is see-through.
 */
export function openSheet(_sheet: {
  info: SheetInfo
  pixels: Pixels
  palette: readonly Rgb[]
}): SheetDoc {
  throw new Error('not yet')
}

/** A sheet's pixels as RGBA, see-through pixels as 0,0,0,0. */
export function toRgba(_doc: SheetDoc): Pixels {
  throw new Error('not yet')
}

/** An image of this size, every pixel see-through. */
export function blankImage(_size: {
  width: number
  height: number
}): IndexedImage {
  throw new Error('not yet')
}

/** A copy of an image. */
export function cloneImage(_image: IndexedImage): IndexedImage {
  throw new Error('not yet')
}

/**
 * The image at a new size in whole cells, keeping its top left; new space is
 * see-through.
 */
export function resizeImage(
  _image: IndexedImage,
  _size: CellCount & { cellWidth: number; cellHeight: number },
): IndexedImage {
  throw new Error('not yet')
}

/** Undo and redo, keeping at most `limit` steps back. */
export function createHistory(_limit = 100): History {
  throw new Error('not yet')
}
