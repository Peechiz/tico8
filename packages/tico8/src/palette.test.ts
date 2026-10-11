import { expect, it } from 'vitest'
import { COLOR, PICO8 } from './palette.ts'

it('has sixteen valid colours', () => {
  expect(PICO8).toHaveLength(16)
  for (const rgb of PICO8) {
    expect(rgb).toHaveLength(3)
    for (const c of rgb)
      expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true)
  }
})

it('names every colour once, in palette order', () => {
  expect(Object.values(COLOR)).toEqual(PICO8.map((_, i) => i))
  expect(PICO8[COLOR.red]).toEqual([255, 0, 77])
})
