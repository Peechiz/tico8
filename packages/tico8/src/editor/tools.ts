import type { IndexedImage, Rect, Vec } from './types.ts'

/**
 * Paint a line one pixel wide from `from` to `to`, both ends included, with
 * no gaps however far apart they are. Pixels outside `clip` are left alone.
 * The pencil and eraser paint their strokes with it.
 */
export function strokeLine(
  _image: IndexedImage,
  _line: { from: Vec; to: Vec; color: number; clip: Rect },
): void {
  throw new Error('not yet')
}

/** Flood the area of one colour around `at`, four ways, inside `clip`. */
export function fillArea(
  _image: IndexedImage,
  _fill: { at: Vec; color: number; clip: Rect },
): void {
  throw new Error('not yet')
}

/** A rectangle with corners `from` and `to`, outlined or filled, inside `clip`. */
export function drawRect(
  _image: IndexedImage,
  _rect: { from: Vec; to: Vec; color: number; filled: boolean; clip: Rect },
): void {
  throw new Error('not yet')
}

/** The colour index at a point, or undefined outside the image. */
export function pickColor(_image: IndexedImage, _at: Vec): number | undefined {
  throw new Error('not yet')
}

/** The rect with corners `from` and `to`, both included, inside `clip`. */
export function rectBetween(_from: Vec, _to: Vec, _clip: Rect): Rect {
  throw new Error('not yet')
}
