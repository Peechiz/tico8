import { beforeEach, expect, it } from 'vitest'
import { map } from './assets/index.ts'
import { restoreMaps } from './assets/maps.ts'
import { display } from './console.ts'
import { COLOR, camera, clear, pixel } from './index.ts'
import { createSheet, type IndexedImage, TRANSPARENT } from './sprites.ts'

/** A sheet of 8x8 cells in a row, each filled as its painter says. */
function sheetOf(...cells: ((x: number, y: number) => number)[]) {
  const image: IndexedImage = {
    width: cells.length * 8,
    height: 8,
    pixels: new Uint8Array(cells.length * 64),
  }
  cells.forEach((paint, cell) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        image.pixels[y * image.width + cell * 8 + x] = paint(x, y)
      }
    }
  })
  const sheet = createSheet(display, 8, 8)
  sheet.setImage(image)
  return sheet
}

// Grass, a wall, and an arch that is see-through below its top half.
const tiles = sheetOf(
  () => COLOR.darkGreen,
  () => COLOR.darkGrey,
  (_x, y) => (y < 4 ? COLOR.red : TRANSPARENT),
)
const hero = sheetOf(() => COLOR.yellow).sprite()

// What a project's generated `maps.ts` does with its two JSON files.
const room = map('room', {
  data: {
    tiles: 'tiles',
    layers: { ground: ['0 0'], walls: ['. 1'], front: ['2 .'] },
  },
  tiles,
  flags: { solid: [1] },
})

function draw(heroX: number) {
  clear(COLOR.black)
  room.ground.draw()
  room.walls.draw()
  hero.draw(heroX, 0)
  room.front.draw()
}

beforeEach(() => {
  display.beginFrame()
  restoreMaps()
})

it('draws a sprite between two layers on the console screen', () => {
  draw(0)
  // The arch is over the sprite, and the sprite shows through its gap.
  expect(pixel(0, 0)).toBe(COLOR.red)
  expect(pixel(0, 7)).toBe(COLOR.yellow)
  expect(pixel(8, 0)).toBe(COLOR.darkGrey)
  expect(pixel(16, 0)).toBe(COLOR.black)

  // Half a tile on, the sprite covers the wall drawn before it.
  draw(4)
  expect(pixel(3, 7)).toBe(COLOR.darkGreen)
  expect(pixel(9, 4)).toBe(COLOR.yellow)
  expect(pixel(12, 4)).toBe(COLOR.darkGrey)
})

it('moves with the camera', () => {
  clear(COLOR.black)
  camera(8, 0, () => room.walls.draw())
  expect(display.pixels[0]).toBe(COLOR.darkGrey)
  expect(display.pixels[8]).toBe(COLOR.black)
})

it('reads the flags of the tileset', () => {
  expect(room.walls.tile(1, 0).solid).toBe(true)
  expect(room.walls.tileAt(3, 3).solid).toBe(false)
  expect(room.ground.tile(1, 0).solid).toBe(false)
  const hitbox = { x: 4, y: 0, width: 8, height: 8 }
  expect(room.walls.overlaps(hitbox, 'solid')).toBe(true)
  expect(room.walls.overlaps({ ...hitbox, x: 0 }, 'solid')).toBe(false)
  expect([room.width, room.height]).toEqual([16, 8])
})

it('gives back a tile a game took out when the game starts again', () => {
  room.walls.set(1, 0, undefined)
  expect(room.walls.tile(1, 0).frame).toBeUndefined()
  restoreMaps()
  expect(room.walls.tile(1, 0).frame).toBe(1)
})

it('knows the names in the two files', () => {
  // @ts-expect-error not a layer of this map
  room.roof
  // @ts-expect-error not a flag of this tileset
  room.walls.tile(0, 0).ladder
})
