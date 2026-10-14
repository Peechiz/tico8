import { TRANSPARENT } from '../sprites.ts'
import type { Clip, IndexedImage, Rect, Selection, Vec } from './types.ts'

/** The pixels of `rect` as an image; parts outside `image` are see-through. */
function crop(image: IndexedImage, rect: Rect): IndexedImage {
  const pixels = new Uint8Array(rect.width * rect.height).fill(TRANSPARENT)
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue
      pixels[y * rect.width + x] = image.pixels[sy * image.width + sx]!
    }
  }
  return { width: rect.width, height: rect.height, pixels }
}

/** `rect` cut down to the part inside `image`. */
function clamp(image: IndexedImage, rect: Rect): Rect {
  const x = Math.max(0, rect.x)
  const y = Math.max(0, rect.y)
  const right = Math.min(image.width, rect.x + rect.width)
  const bottom = Math.min(image.height, rect.y + rect.height)
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  }
}

/**
 * Lift the pixels in `rect` off the image, leaving it see-through there.
 * The selection's rect is the part of `rect` inside the image.
 */
export function lift(image: IndexedImage, rect: Rect): Selection {
  const inside = clamp(image, rect)
  const lifted = crop(image, inside)
  for (let y = 0; y < inside.height; y++) {
    const row = (inside.y + y) * image.width + inside.x
    image.pixels.fill(TRANSPARENT, row, row + inside.width)
  }
  return { rect: inside, lifted }
}

/** The selection moved by `by`. */
export function moveSelection(selection: Selection, by: Vec): Selection {
  return {
    ...selection,
    rect: {
      ...selection.rect,
      x: selection.rect.x + by.x,
      y: selection.rect.y + by.y,
    },
  }
}

/**
 * Put a lifted selection's pixels down on the image; its see-through pixels
 * leave what is under them. Parts outside the image are lost.
 */
export function drop(image: IndexedImage, selection: Selection): void {
  const { lifted, rect } = selection
  if (!lifted) return
  for (let y = 0; y < lifted.height; y++) {
    for (let x = 0; x < lifted.width; x++) {
      const dx = rect.x + x
      const dy = rect.y + y
      if (dx < 0 || dy < 0 || dx >= image.width || dy >= image.height) continue
      const color = lifted.pixels[y * lifted.width + x]!
      if (color === TRANSPARENT) continue
      image.pixels[dy * image.width + dx] = color
    }
  }
}

/** A copy of the pixels in `rect`. */
export function copyRect(image: IndexedImage, rect: Rect): Clip {
  return crop(image, clamp(image, rect))
}

/** A clip as a lifted selection with its top left at `at`. */
export function paste(clip: Clip, at: Vec): Selection {
  return {
    rect: { x: at.x, y: at.y, width: clip.width, height: clip.height },
    lifted: {
      width: clip.width,
      height: clip.height,
      pixels: clip.pixels.slice(),
    },
  }
}

/** An image mirrored left to right (`x`) or top to bottom (`y`). */
export function flipped(image: IndexedImage, axis: 'x' | 'y'): IndexedImage {
  const { width, height } = image
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = axis === 'x' ? width - 1 - x : x
      const sy = axis === 'y' ? height - 1 - y : y
      pixels[y * width + x] = image.pixels[sy * width + sx]!
    }
  }
  return { width, height, pixels }
}

/**
 * An image turned a quarter clockwise, or undefined when it is not square,
 * since turning it would change the area it covers.
 */
export function rotated(image: IndexedImage): IndexedImage | undefined {
  const { width, height } = image
  if (width !== height) return undefined
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[x * width + (width - 1 - y)] = image.pixels[y * width + x]!
    }
  }
  return { width, height, pixels }
}
