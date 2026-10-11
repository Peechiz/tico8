import { createPad } from './input.ts'
import { PICO8, type Rgb } from './palette.ts'
import { createScreen } from './screen.ts'

// The one console every game draws to. Fixed here until config arrives.
export const WIDTH = 128
export const HEIGHT = 128
export const RATE = 30

export const display = createScreen(WIDTH, HEIGHT)

// Every colour the screen can show. The first PALETTE_SIZE are the project's
// palette; colours found in imported art are added after them.
export const PALETTE_SIZE = PICO8.length
export const palette: Rgb[] = [...PICO8]
export const pad = createPad()
