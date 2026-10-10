import { expect, it } from 'vitest'
import { PICO8 } from './palette.ts'

it('has sixteen valid colours', () => {
  expect(PICO8).toHaveLength(16)
  for (const rgb of PICO8) {
    expect(rgb).toHaveLength(3)
    for (const c of rgb)
      expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true)
  }
})
