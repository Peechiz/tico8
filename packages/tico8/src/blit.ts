import type { Screen } from './screen.ts'
import { type IndexedImage, TRANSPARENT } from './sprites.ts'

/**
 * Copy a rectangle of `image` onto the screen with its top left at
 * (`dx`, `dy`). Transparent pixels are skipped and whatever falls off
 * the screen is cut.
 */
export function blit(
  screen: Screen,
  image: IndexedImage,
  sx: number,
  sy: number,
  width: number,
  height: number,
  dx: number,
  dy: number,
  flipX = false,
  flipY = false,
): void {
  const left = Math.floor(dx)
  const top = Math.floor(dy)
  // The part of the rectangle that lands on the screen.
  const i0 = Math.max(0, -left)
  const i1 = Math.min(width, screen.width - left)
  const j0 = Math.max(0, -top)
  const j1 = Math.min(height, screen.height - top)
  const out = screen.pixels
  const src = image.pixels
  for (let j = j0; j < j1; j++) {
    const y = sy + (flipY ? height - 1 - j : j)
    if (y < 0 || y >= image.height) continue
    const srcRow = y * image.width
    const outRow = (top + j) * screen.width + left
    for (let i = i0; i < i1; i++) {
      const x = sx + (flipX ? width - 1 - i : i)
      if (x < 0 || x >= image.width) continue
      const c = src[srcRow + x]!
      if (c !== TRANSPARENT) out[outRow + i] = c
    }
  }
}
