import { display, pad } from './console.ts'
import type { Input } from './input.ts'
import type { Rect, Shape } from './shapes.ts'
import { drawLine, fillShape, outlineShape } from './shapes.ts'
import type { Swap } from './sprites.ts'
import type { Vec } from './vec.ts'

export type { Button, ButtonName, Input } from './input.ts'
export type { Game } from './loop.ts'
export { COLOR } from './palette.ts'
export {
  type Circle,
  circle,
  type Oval,
  oval,
  type Rect,
  rect,
  type Shape,
} from './shapes.ts'
export type { DrawOptions, Sheet, Sprite, Swap } from './sprites.ts'
export { type Vec, vec } from './vec.ts'

type Point = Readonly<Vec>

/** The screen's size in game pixels. Use these, never a hardcoded 128. */
export const SCREEN: { readonly width: number; readonly height: number } =
  display

/**
 * The standard pad, read from the keyboard: `input.left.held`,
 * `input.a.pressed`, `input.dir`.
 */
export const input: Input = pad.input

/** Fill the whole screen with one colour, such as `COLOR.black`. */
export function clear(color = 0): void {
  display.clear(color)
}

/**
 * Set one pixel to a colour, or with no colour, read the colour that is
 * there. Off-screen pixels are ignored, and read as 0.
 */
export function pixel(at: Point): number
export function pixel(x: number, y: number): number
export function pixel(at: Point, color: number): void
export function pixel(x: number, y: number, color: number): void
export function pixel(a: number | Point, b?: number, c?: number) {
  if (typeof a === 'number') {
    if (c === undefined) return display.read(a, b ?? 0)
    display.pixel(a, b ?? 0, c)
  } else {
    if (b === undefined) return display.read(a.x, a.y)
    display.pixel(a.x, a.y, b)
  }
}

/**
 * Draw a shape solid:
 * `fill({ x: 0, y: 0, width: 8, height: 8 }, COLOR.red)`.
 */
export function fill(shape: Shape, color: number): void {
  fillShape(display, shape, color)
}

/** Draw a shape's edge, one pixel thick. */
export function outline(shape: Shape, color: number): void {
  outlineShape(display, shape, color)
}

/** A straight line between two points, both ends included, and its colour. */
export interface Line {
  from: Point
  to: Point
  color: number
}

/** Draw a straight line: `line({ from: a, to: b, color: COLOR.yellow })`. */
export function line({ from, to, color }: Readonly<Line>): void {
  drawLine(display, from.x, from.y, to.x, to.y, color)
}

/**
 * Draw the world through a camera: everything `draw` draws is moved so
 * that the camera's position is the screen's top left. What is drawn
 * outside the block, such as a HUD, is untouched. Cameras inside add up.
 */
export function camera(at: Point, draw: () => void): void
export function camera(x: number, y: number, draw: () => void): void
export function camera(
  a: number | Point,
  b: number | (() => void),
  c?: () => void,
): void {
  if (typeof a === 'number' && typeof b === 'number' && c) {
    display.withCamera(a, b, c)
  } else if (typeof a === 'object' && typeof b === 'function') {
    display.withCamera(a.x, a.y, b)
  }
}

/**
 * Limit everything `draw` draws to a rectangle. The rectangle sits where
 * `fill` would draw it, so a camera moves it. A clip inside a clip can
 * only narrow it.
 */
export function clip(area: Readonly<Rect>, draw: () => void): void {
  display.withClip(area.x, area.y, area.width, area.height, draw)
}

/**
 * Show some colours as others across the whole finished frame, for fades
 * and flashes: `screenSwap({ [COLOR.darkBlue]: COLOR.black })`. It lasts
 * for this frame only, so call it from `draw` for as long as it should show.
 */
export function screenSwap(swap: Swap): void {
  for (const from in swap) {
    const to = swap[from]
    if (to !== undefined) display.shown[Number(from) & 255] = to
  }
}
