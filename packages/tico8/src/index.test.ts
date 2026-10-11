import { expect, it } from 'vitest'
import { display } from './console.ts'
import { COLOR, clear, pixel, vec } from './index.ts'

it('takes a position as x, y or as one value', () => {
  clear()
  pixel(2, 0, COLOR.red)
  pixel(vec(4, 0), COLOR.green)
  const player = { x: 6, y: 0, hp: 3 }
  pixel(player, COLOR.blue)
  expect([...display.pixels.subarray(0, 8)]).toEqual([0, 0, 8, 0, 11, 0, 12, 0])
})
