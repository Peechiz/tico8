import type { Clip, IndexedImage, Rect, Selection, Vec } from './types.ts'

/** Lift the pixels in `rect` off the image, leaving it see-through there. */
export function lift(_image: IndexedImage, _rect: Rect): Selection {
  throw new Error('not yet')
}

/** The selection moved by `by`. */
export function moveSelection(_selection: Selection, _by: Vec): Selection {
  throw new Error('not yet')
}

/**
 * Put a lifted selection's pixels down on the image; its see-through pixels
 * leave what is under them. Parts outside the image are lost.
 */
export function drop(_image: IndexedImage, _selection: Selection): void {
  throw new Error('not yet')
}

/** A copy of the pixels in `rect`. */
export function copyRect(_image: IndexedImage, _rect: Rect): Clip {
  throw new Error('not yet')
}

/** A clip as a lifted selection with its top left at `at`. */
export function paste(_clip: Clip, _at: Vec): Selection {
  throw new Error('not yet')
}

/** An image mirrored left to right (`x`) or top to bottom (`y`). */
export function flipped(_image: IndexedImage, _axis: 'x' | 'y'): IndexedImage {
  throw new Error('not yet')
}

/**
 * An image turned a quarter clockwise, or undefined when it is not square,
 * since turning it would change the area it covers.
 */
export function rotated(_image: IndexedImage): IndexedImage | undefined {
  throw new Error('not yet')
}
