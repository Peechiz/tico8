import { beforeEach, expect, it } from 'vitest'
import { display, settings, time } from './console.ts'
import { COLOR, clear, clock, pixel } from './index.ts'
import { createLoop } from './loop.ts'
import { createSheet, type IndexedImage } from './sprites.ts'

/** A sheet of 8x8 cells in a row, each one solid colour. */
function sheetOf(...colors: number[]) {
  const image: IndexedImage = {
    width: colors.length * 8,
    height: 8,
    pixels: new Uint8Array(colors.length * 64),
  }
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < image.width; x++) {
      image.pixels[y * image.width + x] = colors[Math.floor(x / 8)]!
    }
  }
  const sheet = createSheet(display, 8, 8, settings.rate)
  sheet.setImage(image)
  return sheet
}

const hero = sheetOf(COLOR.red, COLOR.blue).sprite()
// Two frames a second: each shows for half the updates of a second.
const walk = { frames: [0, 1], fps: 2 }

// The game's loop as `run` builds it, driven by hand.
function start() {
  const shown: number[] = []
  const loop = createLoop(
    {
      update: () => hero.play(walk),
      draw: () => {
        clear(COLOR.black)
        hero.draw()
        shown.push(pixel(0, 0))
      },
    },
    { rate: settings.rate, afterUpdate: time.step },
  )
  return { loop, shown }
}

beforeEach(() => {
  display.beginFrame()
  time.reset()
})

it('plays an animation on the console screen in game time', () => {
  const { loop, shown } = start()
  const update = 1000 / settings.rate
  // The loop counts from its first tick; each later one lands half an
  // update late, so exactly one update runs per tick.
  loop.tick(0)
  for (let i = 1; i < settings.rate; i++) loop.tick(i * update + update / 2)

  const half = settings.rate / 2
  expect(shown.slice(0, half)).toEqual(Array(half).fill(COLOR.red))
  expect(shown.slice(half)).toEqual(Array(half).fill(COLOR.blue))
  expect(clock.ticks).toBe(settings.rate)
  expect(clock.seconds).toBe(1)
})

it('starts game time again on reset', () => {
  const { loop } = start()
  loop.tick(0)
  loop.tick(1000)
  expect(clock.ticks).toBeGreaterThan(0)
  time.reset()
  expect(clock.ticks).toBe(0)
  expect(clock.seconds).toBe(0)
})
