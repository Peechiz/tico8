import { display } from './console.ts'

export type { Game } from './loop.ts'

/** The screen's size in game pixels. Use these, never a hardcoded 128. */
export const screen: { readonly width: number; readonly height: number } =
  display

/** Fill the whole screen with one palette colour (0-15). */
export function clear(color = 0): void {
  display.clear(color)
}

/** Set one pixel to a palette colour (0-15). Off-screen pixels are ignored. */
export function pixel(x: number, y: number, color: number): void {
  display.pixel(x, y, color)
}
