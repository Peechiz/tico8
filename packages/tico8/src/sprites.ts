import { blit } from './blit.ts'
import type { Screen } from './screen.ts'
import type { Vec } from './vec.ts'

/** Marks a see-through pixel in an indexed image. */
export const TRANSPARENT = 255

/** A decoded picture: one palette index per pixel, or `TRANSPARENT`. */
export interface IndexedImage {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8Array
}

export interface DrawOptions {
  flipX?: boolean
  flipY?: boolean
}

/** One thing on screen made from a sheet. It holds how it looks, not where. */
export interface Sprite {
  /** Which cell of the sheet to show, counted from 0, left to right then down. */
  frame: number
  flipX: boolean
  flipY: boolean
  /** Draw with the top left corner at a position. */
  draw(at: Readonly<Vec>): void
  draw(x: number, y: number): void
}

/** A PNG from the sprites folder, cut into a grid of cells. */
export interface Sheet {
  /** The size of one cell in pixels. */
  readonly cell: { readonly width: number; readonly height: number }
  /** How many cells the sheet holds. */
  readonly frames: number
  /** Make a sprite that remembers its own frame and flips. */
  sprite(): Sprite
  /** Draw one cell without making a sprite: for tiles and particles. */
  draw(frame: number, at: Readonly<Vec>, options?: DrawOptions): void
  draw(frame: number, x: number, y: number, options?: DrawOptions): void
}

/** A sheet whose picture can be set, and set again when the PNG changes. */
export interface LoadableSheet extends Sheet {
  /** Throws if the image is not a whole number of cells. */
  setImage(image: IndexedImage): void
}

/** A sheet that draws to `screen`. It draws nothing until it has an image. */
export function createSheet(
  screen: Screen,
  cellWidth: number,
  cellHeight: number,
): LoadableSheet {
  let image: IndexedImage | undefined
  let columns = 0
  let frames = 0

  function drawFrame(
    frame: number,
    x: number,
    y: number,
    options?: DrawOptions,
  ): void {
    if (!image) return
    const f = Math.floor(frame)
    if (!(f >= 0 && f < frames)) return
    blit(
      screen,
      image,
      (f % columns) * cellWidth,
      Math.floor(f / columns) * cellHeight,
      cellWidth,
      cellHeight,
      x,
      y,
      options?.flipX,
      options?.flipY,
    )
  }

  const sheet: LoadableSheet = {
    cell: { width: cellWidth, height: cellHeight },
    get frames() {
      return frames
    },
    setImage(next) {
      if (next.width % cellWidth !== 0 || next.height % cellHeight !== 0) {
        throw new Error(
          `Image is ${next.width}x${next.height}, which is not a whole number of ${cellWidth}x${cellHeight} cells`,
        )
      }
      image = next
      columns = next.width / cellWidth
      frames = columns * (next.height / cellHeight)
    },
    sprite() {
      const sprite: Sprite = {
        frame: 0,
        flipX: false,
        flipY: false,
        draw(a: number | Readonly<Vec>, b?: number): void {
          const [x, y] = typeof a === 'number' ? [a, b!] : [a.x, a.y]
          drawFrame(sprite.frame, x, y, sprite)
        },
      }
      return sprite
    },
    draw(
      frame: number,
      a: number | Readonly<Vec>,
      b?: number | DrawOptions,
      c?: DrawOptions,
    ): void {
      if (typeof a === 'number') drawFrame(frame, a, b as number, c)
      else drawFrame(frame, a.x, a.y, b as DrawOptions | undefined)
    },
  }
  return sheet
}
