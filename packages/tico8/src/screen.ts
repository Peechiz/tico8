import type { Palette } from './palette.ts'

export interface Screen {
  readonly width: number
  readonly height: number
  /** One colour number per pixel, row by row from the top left. */
  readonly pixels: Uint8Array
  /**
   * The cameras in force, added up: something drawn at (x, y) lands on the
   * screen at (x - offset.x, y - offset.y).
   */
  readonly offset: { readonly x: number; readonly y: number }
  /**
   * The part of the screen drawing may touch, in screen pixels: from
   * (x0, y0) up to but not including (x1, y1).
   */
  readonly bounds: {
    readonly x0: number
    readonly y0: number
    readonly x1: number
    readonly y1: number
  }
  /**
   * The whole-frame colour swap: `shown[c]` is the colour that pixels of
   * colour `c` are shown as.
   */
  readonly shown: Uint8Array
  /** Fill the whole screen, whatever the camera and clip. */
  clear(color?: number): void
  pixel(x: number, y: number, color: number): void
  /** The colour at a position, or 0 off screen. */
  read(x: number, y: number): number
  /** A horizontal run of `length` pixels starting at (x, y). */
  span(x: number, y: number, length: number, color: number): void
  /** Run `draw` seen through a camera at (x, y). Cameras inside add up. */
  withCamera(x: number, y: number, draw: () => void): void
  /**
   * Run `draw` limited to a rectangle. The rectangle is placed like
   * anything else drawn here, so the camera in force moves it; a clip
   * inside a clip can only narrow it.
   */
  withClip(
    x: number,
    y: number,
    width: number,
    height: number,
    draw: () => void,
  ): void
  /** Start a frame clean: no camera, no clip, no colour swap. */
  beginFrame(): void
}

export function createScreen(width: number, height: number): Screen {
  const pixels = new Uint8Array(width * height)
  const offset = { x: 0, y: 0 }
  const bounds = { x0: 0, y0: 0, x1: width, y1: height }
  const shown = new Uint8Array(256)

  function beginFrame() {
    offset.x = 0
    offset.y = 0
    bounds.x0 = 0
    bounds.y0 = 0
    bounds.x1 = width
    bounds.y1 = height
    for (let i = 0; i < shown.length; i++) shown[i] = i
  }
  beginFrame()

  return {
    width,
    height,
    pixels,
    offset,
    bounds,
    shown,
    beginFrame,
    clear(color = 0) {
      pixels.fill(color)
    },
    pixel(x, y, color) {
      x = Math.floor(x - offset.x)
      y = Math.floor(y - offset.y)
      if (!(x >= bounds.x0 && x < bounds.x1 && y >= bounds.y0 && y < bounds.y1))
        return
      pixels[y * width + x] = color
    },
    read(x, y) {
      x = Math.floor(x - offset.x)
      y = Math.floor(y - offset.y)
      if (!(x >= 0 && x < width && y >= 0 && y < height)) return 0
      return pixels[y * width + x]!
    },
    span(x, y, length, color) {
      y = Math.floor(y - offset.y)
      if (!(y >= bounds.y0 && y < bounds.y1)) return
      const left = Math.floor(x - offset.x)
      const from = Math.max(left, bounds.x0)
      const to = Math.min(left + Math.floor(length), bounds.x1)
      if (from < to) pixels.fill(color, y * width + from, y * width + to)
    },
    withCamera(x, y, draw) {
      offset.x += x
      offset.y += y
      try {
        draw()
      } finally {
        offset.x -= x
        offset.y -= y
      }
    },
    withClip(x, y, w, h, draw) {
      const { x0, y0, x1, y1 } = bounds
      const left = Math.floor(x - offset.x)
      const top = Math.floor(y - offset.y)
      bounds.x0 = Math.max(x0, left)
      bounds.y0 = Math.max(y0, top)
      bounds.x1 = Math.max(bounds.x0, Math.min(x1, left + Math.floor(w)))
      bounds.y1 = Math.max(bounds.y0, Math.min(y1, top + Math.floor(h)))
      try {
        draw()
      } finally {
        bounds.x0 = x0
        bounds.y0 = y0
        bounds.x1 = x1
        bounds.y1 = y1
      }
    },
  }
}

const BLACK = [0, 0, 0] as const

/**
 * Write the screen as RGBA bytes into `out` (width * height * 4 long),
 * through the whole-frame colour swap. A colour number with no colour
 * behind it comes out black.
 */
export function toRgba(
  screen: Screen,
  palette: Palette,
  out: Uint8ClampedArray,
): void {
  const { pixels, shown } = screen
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = palette[shown[pixels[i]!]!] ?? BLACK
    const o = i * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = 255
  }
}
