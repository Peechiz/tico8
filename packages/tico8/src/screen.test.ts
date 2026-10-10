import { describe, expect, it } from 'vitest'
import { PICO8 } from './palette.ts'
import { createScreen, toRGBA } from './screen.ts'
import { picture, toPicture } from './testing.ts'

describe('screen', () => {
  it('starts blank', () => {
    const s = createScreen(4, 3)
    expect(toPicture(s)).toBe(
      picture(`
      ....
      ....
      ....
    `),
    )
  })

  it('clears to a colour', () => {
    const s = createScreen(4, 3)
    s.clear(7)
    expect(toPicture(s)).toBe(
      picture(`
      7777
      7777
      7777
    `),
    )
    s.clear()
    expect(toPicture(s)).toBe(
      picture(`
      ....
      ....
      ....
    `),
    )
  })

  it('sets a pixel', () => {
    const s = createScreen(4, 3)
    s.pixel(1, 2, 0xa)
    s.pixel(3, 0, 5)
    expect(toPicture(s)).toBe(
      picture(`
      ...5
      ....
      .a..
    `),
    )
  })

  it('ignores writes off the screen without wrapping', () => {
    const s = createScreen(4, 3)
    s.pixel(-1, 1, 9)
    s.pixel(4, 0, 9)
    s.pixel(0, -1, 9)
    s.pixel(0, 3, 9)
    s.pixel(NaN, 0, 9)
    expect(toPicture(s)).toBe(
      picture(`
      ....
      ....
      ....
    `),
    )
  })

  it('floors fractional coordinates', () => {
    const s = createScreen(4, 3)
    s.pixel(1.9, 0.5, 3)
    s.pixel(-0.5, 2, 4)
    expect(toPicture(s)).toBe(
      picture(`
      .3..
      ....
      ....
    `),
    )
  })

  it('wraps colours outside 0-15', () => {
    const s = createScreen(4, 3)
    s.pixel(0, 0, 17)
    s.pixel(1, 0, -1)
    s.clear(18)
    s.pixel(0, 0, 17)
    s.pixel(1, 0, -1)
    expect(toPicture(s)).toBe(
      picture(`
      1f22
      2222
      2222
    `),
    )
  })

  it('converts to opaque RGBA through the palette', () => {
    const s = createScreen(2, 1)
    s.pixel(1, 0, 8)
    const out = new Uint8ClampedArray(2 * 4)
    toRGBA(s, PICO8, out)
    expect([...out]).toEqual([0, 0, 0, 255, 255, 0, 77, 255])
  })
})
