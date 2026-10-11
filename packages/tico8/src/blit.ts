import type { Screen } from './screen.ts'
import { type IndexedImage, TRANSPARENT } from './sprites.ts'

/**
 * Copy a rectangle of `image` onto the screen with its top left at
 * (`dx`, `dy`) in world space, so the camera moves it. Transparent pixels
 * are skipped and whatever falls outside the clip is cut.
 *
 * `remap`, if given, has 256 entries: a pixel of colour `c` is drawn as
 * `remap[c]`.
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
  remap?: Uint8Array,
): void {
  const left = Math.floor(dx - screen.offset.x)
  const top = Math.floor(dy - screen.offset.y)
  const { x0, y0, x1, y1 } = screen.bounds
  // The part of the rectangle that lands inside the clip.
  const i0 = Math.max(0, x0 - left)
  const i1 = Math.min(width, x1 - left)
  const j0 = Math.max(0, y0 - top)
  const j1 = Math.min(height, y1 - top)
  const out = screen.pixels
  const src = image.pixels
  for (let j = j0; j < j1; j++) {
    const y = sy + (flipY ? height - 1 - j : j)
    if (y < 0 || y >= image.height) continue
    const srcRow = y * image.width
    const outRow = (top + j) * screen.width + left
    if (remap) {
      for (let i = i0; i < i1; i++) {
        const x = sx + (flipX ? width - 1 - i : i)
        if (x < 0 || x >= image.width) continue
        const c = src[srcRow + x]!
        if (c !== TRANSPARENT) out[outRow + i] = remap[c]!
      }
    } else {
      for (let i = i0; i < i1; i++) {
        const x = sx + (flipX ? width - 1 - i : i)
        if (x < 0 || x >= image.width) continue
        const c = src[srcRow + x]!
        if (c !== TRANSPARENT) out[outRow + i] = c
      }
    }
  }
}
