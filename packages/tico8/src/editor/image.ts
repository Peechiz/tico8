import { indexPixels } from '../assets/png.ts'
import { TRANSPARENT } from '../sprites.ts'
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
export function openSheet(sheet: {
  info: SheetInfo
  pixels: Pixels
  palette: readonly Rgb[]
}): SheetDoc {
  const { info, pixels, palette } = sheet
  const colors = [...palette]
  const { image } = indexPixels(
    pixels.data,
    pixels.width,
    pixels.height,
    colors,
    palette.length,
  )
  return { info, image, colors, paletteSize: palette.length }
}

/** A sheet's pixels as RGBA, see-through pixels as 0,0,0,0. */
export function toRgba(doc: SheetDoc): Pixels {
  const { width, height, pixels } = doc.image
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i++) {
    const index = pixels[i] ?? TRANSPARENT
    const color = index === TRANSPARENT ? undefined : doc.colors[index]
    // Left at 0,0,0,0 when see-through.
    if (!color) continue
    const o = i * 4
    data[o] = color[0]
    data[o + 1] = color[1]
    data[o + 2] = color[2]
    data[o + 3] = 255
  }
  return { width, height, data }
}

/** An image of this size, every pixel see-through. */
export function blankImage(size: {
  width: number
  height: number
}): IndexedImage {
  const { width, height } = size
  return {
    width,
    height,
    pixels: new Uint8Array(width * height).fill(TRANSPARENT),
  }
}

/** A copy of an image. */
export function cloneImage(image: IndexedImage): IndexedImage {
  return {
    width: image.width,
    height: image.height,
    pixels: image.pixels.slice(),
  }
}

/**
 * The image at a new size in whole cells, keeping its top left; new space is
 * see-through.
 */
export function resizeImage(
  image: IndexedImage,
  size: CellCount & { cellWidth: number; cellHeight: number },
): IndexedImage {
  const out = blankImage({
    width: size.columns * size.cellWidth,
    height: size.rows * size.cellHeight,
  })
  const width = Math.min(image.width, out.width)
  const height = Math.min(image.height, out.height)
  for (let y = 0; y < height; y++) {
    const from = y * image.width
    out.pixels.set(image.pixels.subarray(from, from + width), y * out.width)
  }
  return out
}

/** Undo and redo, keeping at most `limit` steps back. */
export function createHistory(limit = 100): History {
  const back: IndexedImage[] = []
  const forward: IndexedImage[] = []
  return {
    push(before) {
      back.push(cloneImage(before))
      if (back.length > limit) back.shift()
      forward.length = 0
    },
    undo(current) {
      const image = back.pop()
      if (image) forward.push(cloneImage(current))
      return image
    },
    redo(current) {
      const image = forward.pop()
      if (image) back.push(cloneImage(current))
      return image
    },
    get canUndo() {
      return back.length > 0
    },
    get canRedo() {
      return forward.length > 0
    },
  }
}
