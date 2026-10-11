import { display } from './console.ts'
import type { Vec } from './vec.ts'

export type { Game } from './loop.ts'
export { COLOR } from './palette.ts'
export { type Vec, vec } from './vec.ts'

/** The screen's size in game pixels. Use these, never a hardcoded 128. */
export const SCREEN: { readonly width: number; readonly height: number } =
  display

/** Fill the whole screen with one palette colour, such as `COLOR.black`. */
export function clear(color = 0): void {
  display.clear(color)
}

/** Set one pixel to a palette colour. Off-screen pixels are ignored. */
export function pixel(at: Readonly<Vec>, color: number): void
export function pixel(x: number, y: number, color: number): void
export function pixel(a: number | Readonly<Vec>, b: number, c = 0): void {
  if (typeof a === 'number') display.pixel(a, b, c)
  else display.pixel(a.x, a.y, b)
}
