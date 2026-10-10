import { PICO8 } from './palette.ts'
import { createScreen } from './screen.ts'

// The one console every game draws to. Fixed here until config arrives.
export const WIDTH = 128
export const HEIGHT = 128
export const RATE = 30

export const display = createScreen(WIDTH, HEIGHT)
export const palette = PICO8
