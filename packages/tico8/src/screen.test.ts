import { describe, expect, it } from 'vitest'
import { PICO8 } from './palette.ts'
import { createScreen, toRgba } from './screen.ts'
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

  it('keeps colour numbers above the palette, as one byte', () => {
    const s = createScreen(3, 1)
    s.pixel(0, 0, 17)
    s.pixel(1, 0, 254)
    s.pixel(2, 0, 256 + 5)
    expect([...s.pixels]).toEqual([17, 254, 5])
  })

  it('converts to opaque RGBA through the palette', () => {
    const s = createScreen(2, 1)
    s.pixel(1, 0, 8)
    const out = new Uint8ClampedArray(2 * 4)
    toRgba(s, PICO8, out)
    expect([...out]).toEqual([0, 0, 0, 255, 255, 0, 77, 255])
  })

  it('shows a colour number with no colour behind it as black', () => {
    const s = createScreen(1, 1)
    s.pixel(0, 0, 200)
    const out = new Uint8ClampedArray(4).fill(9)
    toRgba(s, PICO8, out)
    expect([...out]).toEqual([0, 0, 0, 255])
  })

  it('swaps colours for the whole frame without changing the pixels', () => {
    const s = createScreen(2, 1)
    s.pixel(0, 0, 8)
    s.shown[8] = 7
    const out = new Uint8ClampedArray(2 * 4)
    toRgba(s, PICO8, out)
    expect([...out]).toEqual([255, 241, 232, 255, 0, 0, 0, 255])
    expect([...s.pixels]).toEqual([8, 0])
    s.beginFrame()
    toRgba(s, PICO8, out)
    expect([...out.subarray(0, 4)]).toEqual([255, 0, 77, 255])
  })

  it('reads a pixel, and 0 off screen', () => {
    const s = createScreen(4, 3)
    s.pixel(2, 1, 9)
    expect(s.read(2, 1)).toBe(9)
    expect(s.read(2.9, 1.9)).toBe(9)
    expect(s.read(-1, 0)).toBe(0)
    expect(s.read(4, 0)).toBe(0)
  })

  it('draws a run of pixels, cut at the edges', () => {
    const s = createScreen(4, 3)
    s.span(1, 0, 2, 8)
    s.span(-2, 1, 4, 9)
    s.span(2, 2, 9, 10)
    s.span(0, 3, 4, 11)
    s.span(0, 0, 0, 11)
    expect(toPicture(s)).toBe(
      picture(`
      .88.
      99..
      ..aa
    `),
    )
  })

  it('draws through a camera, and cameras add up', () => {
    const s = createScreen(4, 3)
    s.withCamera(10, 20, () => {
      s.pixel(10, 20, 8)
      s.span(11, 21, 2, 9)
      expect(s.read(10, 20)).toBe(8)
      s.withCamera(1, 1, () => s.pixel(14, 23, 10))
      s.pixel(13, 20, 11)
    })
    s.pixel(0, 2, 12)
    expect(toPicture(s)).toBe(
      picture(`
      8..b
      .99.
      c..a
    `),
    )
  })

  it('limits drawing to a clip, which a clip inside can only narrow', () => {
    const s = createScreen(4, 3)
    s.withClip(1, 0, 2, 2, () => {
      for (let y = 0; y < 3; y++) s.span(0, y, 4, 8)
      s.withClip(0, 0, 2, 3, () => {
        for (let y = 0; y < 3; y++) s.span(0, y, 4, 9)
        s.pixel(3, 0, 9)
      })
    })
    s.pixel(3, 2, 10)
    expect(toPicture(s)).toBe(
      picture(`
      .98.
      .98.
      ...a
    `),
    )
  })

  it('places a clip through the camera in force', () => {
    const s = createScreen(4, 3)
    s.withCamera(10, 10, () => {
      s.withClip(11, 11, 2, 1, () => {
        for (let y = 10; y < 13; y++) s.span(10, y, 4, 8)
      })
    })
    expect(toPicture(s)).toBe(
      picture(`
      ....
      .88.
      ....
    `),
    )
  })

  it('clears the whole screen whatever the camera and clip', () => {
    const s = createScreen(2, 2)
    s.withCamera(5, 5, () => s.withClip(5, 5, 1, 1, () => s.clear(3)))
    expect(toPicture(s)).toBe(picture('33\n33'))
  })

  it('puts camera and clip back when drawing throws', () => {
    const s = createScreen(2, 1)
    expect(() =>
      s.withCamera(5, 5, () =>
        s.withClip(5, 5, 1, 1, () => {
          throw new Error('boom')
        }),
      ),
    ).toThrow('boom')
    s.span(0, 0, 2, 8)
    expect(toPicture(s)).toBe(picture('88'))
  })
})
