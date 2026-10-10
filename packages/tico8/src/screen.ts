import type { Palette } from './palette.ts'

export interface Screen {
  readonly width: number
  readonly height: number
  /** One palette index (0-15) per pixel, row by row from the top left. */
  readonly pixels: Uint8Array
  clear(color?: number): void
  pixel(x: number, y: number, color: number): void
}

export function createScreen(width: number, height: number): Screen {
  const pixels = new Uint8Array(width * height)
  return {
    width,
    height,
    pixels,
    clear(color = 0) {
      pixels.fill(color & 15)
    },
    pixel(x, y, color) {
      x = Math.floor(x)
      y = Math.floor(y)
      if (!(x >= 0 && x < width && y >= 0 && y < height)) return
      pixels[y * width + x] = color & 15
    },
  }
}

/** Write the screen as RGBA bytes into `out` (width * height * 4 long). */
export function toRGBA(
  screen: Screen,
  palette: Palette,
  out: Uint8ClampedArray,
): void {
  const { pixels } = screen
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = palette[pixels[i]!]!
    const o = i * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = 255
  }
}
