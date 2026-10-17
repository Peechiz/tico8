import { beforeEach, expect, it } from 'vitest'
import { map } from './assets/index.ts'
import { restoreMaps } from './assets/maps.ts'
import { display } from './console.ts'
import { COLOR, clear, type LayerOf, pixel, vec } from './index.ts'
import { createSheet, type IndexedImage } from './sprites.ts'

/** A sheet of plain 8x8 cells in a row, one colour each. */
function sheetOf(...colors: number[]) {
  const image: IndexedImage = {
    width: colors.length * 8,
    height: 8,
    pixels: new Uint8Array(colors.length * 64),
  }
  colors.forEach((color, cell) => {
    for (let y = 0; y < 8; y++) {
      image.pixels.fill(
        color,
        y * image.width + cell * 8,
        y * image.width + cell * 8 + 8,
      )
    }
  })
  const sheet = createSheet(display, 8, 8)
  sheet.setImage(image)
  return sheet
}

const tiles = sheetOf(COLOR.darkGreen, COLOR.darkGrey, COLOR.red)

// Two rooms of 2x2 cells side by side: the left one green with a wall on
// its right, the right one red.
const world = map('world', {
  data: {
    tiles: 'tiles',
    layers: { walls: ['0 1 2 2', '0 1 2 2'] },
  },
  tiles,
  flags: { solid: [1, 2] },
})

const left = { x: 0, y: 0, width: 16, height: 16 }
const right = { x: 16, y: 0, width: 16, height: 16 }

function drawRoom(layer: LayerOf<typeof world>) {
  clear(COLOR.black)
  layer.draw()
}

beforeEach(() => {
  display.beginFrame()
  restoreMaps()
})

it('draws one room of a map and nothing of the next', () => {
  drawRoom(world.walls.area(left))
  expect(pixel(0, 0)).toBe(COLOR.darkGreen)
  expect(pixel(15, 15)).toBe(COLOR.darkGrey)
  expect(pixel(16, 0)).toBe(COLOR.black)

  drawRoom(world.walls.area(right))
  expect(pixel(0, 0)).toBe(COLOR.red)
  expect(pixel(15, 15)).toBe(COLOR.red)
  expect(pixel(16, 0)).toBe(COLOR.black)
})

it('stops a body at its own room’s wall and not the next room’s', () => {
  const room = world.walls.area(right)
  const blocked = (at: { x: number; y: number }) =>
    room.overlaps({ ...at, width: 4, height: 4 }, 'solid')
  // The right room is all wall, but read through the left room's view a
  // body stepping off its right edge meets only the wall at column 1.
  const inLeft = world.walls.area(left)
  const pos = vec(0, 0)
  const hit = vec.step(pos, vec(20, 0), (at) =>
    inLeft.overlaps({ ...at, width: 4, height: 4 }, 'solid'),
  )
  expect(hit).toEqual({ x: true, y: false })
  expect(pos).toEqual({ x: 4, y: 0 })
  expect(blocked(vec(0, 0))).toBe(true)
  expect(inLeft.overlaps({ x: 16, y: 0, width: 4, height: 4 }, 'solid')).toBe(
    false,
  )
})
