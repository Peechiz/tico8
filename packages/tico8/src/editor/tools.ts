import type { IndexedImage, Rect, Vec } from './types.ts'

/** Whether a point is inside the rect. */
function inside(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x < rect.x + rect.width &&
    y < rect.y + rect.height
  )
}

/** Paint one pixel, unless it is outside the image or `clip`. */
function plot(
  image: IndexedImage,
  clip: Rect,
  x: number,
  y: number,
  c: number,
) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  if (!inside(clip, x, y)) return
  image.pixels[y * image.width + x] = c
}

/**
 * Paint a line one pixel wide from `from` to `to`, both ends included, with
 * no gaps however far apart they are. Pixels outside `clip` are left alone.
 * The pencil and eraser paint their strokes with it.
 */
export function strokeLine(
  image: IndexedImage,
  line: { from: Vec; to: Vec; color: number; clip: Rect },
): void {
  const { from, to, color, clip } = line
  let x = Math.round(from.x)
  let y = Math.round(from.y)
  const endX = Math.round(to.x)
  const endY = Math.round(to.y)
  const dx = Math.abs(endX - x)
  const dy = -Math.abs(endY - y)
  const stepX = x < endX ? 1 : -1
  const stepY = y < endY ? 1 : -1
  let error = dx + dy
  for (;;) {
    plot(image, clip, x, y, color)
    if (x === endX && y === endY) return
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += stepX
    }
    if (doubled <= dx) {
      error += dx
      y += stepY
    }
  }
}

/** Flood the area of one colour around `at`, four ways, inside `clip`. */
export function fillArea(
  image: IndexedImage,
  fill: { at: Vec; color: number; clip: Rect },
): void {
  const { at, color, clip } = fill
  const { width, height, pixels } = image
  const ok = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && inside(clip, x, y)
  if (!ok(at.x, at.y)) return
  const target = pixels[at.y * width + at.x]!
  if (target === color) return
  const stack = [at.x, at.y]
  while (stack.length > 0) {
    const y = stack.pop()!
    const x = stack.pop()!
    if (!ok(x, y) || pixels[y * width + x] !== target) continue
    pixels[y * width + x] = color
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
}

/** A rectangle with corners `from` and `to`, outlined or filled, inside `clip`. */
export function drawRect(
  image: IndexedImage,
  rect: { from: Vec; to: Vec; color: number; filled: boolean; clip: Rect },
): void {
  const { from, to, color, filled, clip } = rect
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  for (let y = top; y <= bottom; y++) {
    const edge = y === top || y === bottom
    for (let x = left; x <= right; x++) {
      if (filled || edge || x === left || x === right) {
        plot(image, clip, x, y, color)
      }
    }
  }
}

/** The colour index at a point, or undefined outside the image. */
export function pickColor(image: IndexedImage, at: Vec): number | undefined {
  if (at.x < 0 || at.y < 0 || at.x >= image.width || at.y >= image.height) {
    return undefined
  }
  return image.pixels[at.y * image.width + at.x]
}

/** The rect with corners `from` and `to`, both included, inside `clip`. */
export function rectBetween(from: Vec, to: Vec, clip: Rect): Rect {
  const left = Math.max(Math.min(from.x, to.x), clip.x)
  const top = Math.max(Math.min(from.y, to.y), clip.y)
  const right = Math.min(Math.max(from.x, to.x) + 1, clip.x + clip.width)
  const bottom = Math.min(Math.max(from.y, to.y) + 1, clip.y + clip.height)
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}
