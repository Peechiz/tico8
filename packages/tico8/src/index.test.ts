import { expect, it } from 'vitest'
import { display } from './console.ts'
import { COLOR, camera, clear, clip, label, pixel, text, vec } from './index.ts'
import { picture } from './testing.ts'

/** The top left corner of the screen as a text picture. */
function corner(width: number, height: number): string {
  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    const row = display.pixels.subarray(
      y * display.width,
      y * display.width + width,
    )
    rows.push([...row].map((c) => c.toString(16)).join(''))
  }
  return rows.join('\n')
}

it('takes a position as x, y or as one value', () => {
  clear()
  pixel(2, 0, COLOR.red)
  pixel(vec(4, 0), COLOR.green)
  const player = { x: 6, y: 0, hp: 3 }
  pixel(player, COLOR.blue)
  expect([...display.pixels.subarray(0, 8)]).toEqual([0, 0, 8, 0, 11, 0, 12, 0])
})

it('draws words and symbols in the built-in font, white by default', () => {
  clear()
  text('Hey ♥', { x: 0, y: 0 })
  expect(corner(22, 6)).toBe(
    picture(`
      7.7..............7.7..
      7.7..77.7.7.....77777.
      777.7.7.7.7.....77777.
      7.7.77...77......777..
      7.7..77...7.......7...
      .........7............
    `),
  )
})

it('ends each line of right-aligned text just before x', () => {
  clear()
  text('ab\nc', { x: 12, y: 0, color: COLOR.red, align: 'right' })
  expect(corner(12, 12)).toBe(
    picture(`
      .........8..
      .....88..88.
      ......88.8.8
      .....8.8.8.8
      .....888.88.
      ............
      ............
      ..........88
      .........8..
      .........8..
      ..........88
      ............
    `),
  )
})

it('moves text with the camera and cuts it with the clip', () => {
  clear()
  camera(-2, -1, () => {
    clip({ x: 0, y: 0, width: 5, height: 4 }, () => {
      text('gg', { x: 0, y: 0, color: COLOR.darkGreen })
    })
  })
  expect(corner(10, 6)).toBe(
    picture(`
      ..........
      ..........
      ...33.....
      ..3.3.3...
      ..333.3...
      ..........
    `),
  )
})

it('makes a label that draws itself and knows its bounds', () => {
  clear()
  const title = label({ x: 8, y: 1, text: 'Go', align: 'center' })
  title.draw()
  expect(corner(16, 7)).toBe(
    picture(`
      ................
      ......77........
      .....7....7.....
      .....777.7.7....
      .....7.7.7.7....
      ......77..7.....
      ................
    `),
  )
  expect(title.bounds).toEqual({ x: 5, y: 1, width: 7, height: 6 })
  expect(text.measure('Go\n!')).toEqual({ width: 7, height: 12 })
})
