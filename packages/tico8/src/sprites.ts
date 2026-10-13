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

/**
 * A recolouring: each key is a colour, its value the colour drawn in its
 * place. Plain data, so one can be named and shared:
 * `const icy = { [COLOR.red]: COLOR.blue }`.
 */
export type Swap = { readonly [from: number]: number }

export interface DrawOptions {
  flipX?: boolean
  flipY?: boolean
  /** Draw some colours as others. */
  swap?: Swap
  /** Draw every pixel in this one colour, as for a hit flash. */
  flash?: number
}

/** Which cell of a sheet to draw, where, and how. */
export interface CellDraw extends DrawOptions {
  /** The cell, counted from 0, left to right then down. */
  frame: number
  /** Where the cell's top left corner goes. */
  x: number
  y: number
}

/** One pixel of one cell, with (0, 0) the cell's top left. */
export interface CellPixel {
  frame: number
  x: number
  y: number
}

/**
 * One thing on screen made from a sheet. It holds where it is and how it
 * looks, and with its `width` and `height` it is a rect, so it can be
 * handed to anything that takes one: `walls.overlaps(hero, 'solid')`.
 */
export interface Sprite {
  /** Where its top left corner is. */
  x: number
  y: number
  /** The size of its cell in pixels. */
  readonly width: number
  readonly height: number
  /** Which cell of the sheet to show, counted from 0, left to right then down. */
  frame: number
  flipX: boolean
  flipY: boolean
  /** Draw some colours as others, until set back to undefined. */
  swap: Swap | undefined
  /** Draw every pixel in this one colour, until set back to undefined. */
  flash: number | undefined
  /** Draw it where it is. */
  draw(): void
  /** Draw it somewhere else, without moving it. */
  draw(at: Readonly<Vec>): void
  draw(x: number, y: number): void
}

/** What a new sprite can be given to start with: `{ x: 20, y: 60 }`. */
export type SpriteInit = Partial<
  Pick<Sprite, 'x' | 'y' | 'frame' | 'flipX' | 'flipY' | 'swap' | 'flash'>
>

/** A PNG from the sprites folder, cut into a grid of cells. */
export interface Sheet {
  /** The size of one cell in pixels. */
  readonly cell: { readonly width: number; readonly height: number }
  /** How many cells the sheet holds. */
  readonly frames: number
  /**
   * Make a sprite that remembers its own place, frame and flips:
   * `player.sprite({ x: 20, y: 60 })`. It starts at 0, 0 if not told.
   */
  sprite(init?: SpriteInit): Sprite
  /**
   * Draw one cell without making a sprite, for tiles and particles:
   * `tiles.draw({ frame: 3, x: 16, y: 8 })`.
   */
  draw(cell: CellDraw): void
  /**
   * Read one pixel of a cell: its colour, or undefined where the cell is
   * see-through or the position is outside it.
   */
  pixel(at: CellPixel): number | undefined
  /** Change one pixel of a cell. Every sprite using the sheet shows it. */
  pixel(at: CellPixel & { color: number }): void
  /** Make one pixel of a cell see-through. */
  erase(at: CellPixel): void
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

  // Reused by every swapped or flashed draw.
  const table = new Uint8Array(256)

  /** The remap for a draw's swap and flash, or undefined for the plain path. */
  function remapFor(options?: DrawOptions): Uint8Array | undefined {
    const flash = options?.flash
    if (flash !== undefined) return table.fill(flash)
    const swap = options?.swap
    if (!swap) return undefined
    for (let c = 0; c < 256; c++) table[c] = c
    for (const key of Object.keys(swap)) {
      const from = Number(key)
      if (from >= 0 && from < 256) table[from] = swap[from]!
    }
    return table
  }

  /** Index into the image of a cell's pixel, or -1 if there is none. */
  function locate(frame: number, x: number, y: number): number {
    if (!image) return -1
    const f = Math.floor(frame)
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (!(f >= 0 && f < frames)) return -1
    if (!(px >= 0 && px < cellWidth && py >= 0 && py < cellHeight)) return -1
    const col = (f % columns) * cellWidth + px
    const row = Math.floor(f / columns) * cellHeight + py
    return row * image.width + col
  }

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
      remapFor(options),
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
    sprite(init) {
      const sprite: Sprite = {
        x: 0,
        y: 0,
        width: cellWidth,
        height: cellHeight,
        frame: 0,
        flipX: false,
        flipY: false,
        swap: undefined,
        flash: undefined,
        ...init,
        draw(a?: number | Readonly<Vec>, b?: number): void {
          const at = a ?? sprite
          const [x, y] = typeof at === 'number' ? [at, b!] : [at.x, at.y]
          drawFrame(sprite.frame, x, y, sprite)
        },
      }
      return sprite
    },
    draw(cell) {
      drawFrame(cell.frame, cell.x, cell.y, cell)
    },
    pixel: ((at: CellPixel & { color?: number }): number | undefined => {
      const i = locate(at.frame, at.x, at.y)
      const color = at.color
      if (color === undefined) {
        if (i < 0) return undefined
        const value = image!.pixels[i]!
        return value === TRANSPARENT ? undefined : value
      }
      if (i >= 0)
        image!.pixels[i] = color === TRANSPARENT ? TRANSPARENT - 1 : color
      return undefined
    }) as Sheet['pixel'],
    erase(at) {
      const i = locate(at.frame, at.x, at.y)
      if (i >= 0) image!.pixels[i] = TRANSPARENT
    },
  }
  return sheet
}
