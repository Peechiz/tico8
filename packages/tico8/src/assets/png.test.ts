import { describe, expect, it } from 'vitest'
import { MAX_COLORS, PICO8, type Rgb } from '../palette.ts'
import { TRANSPARENT } from '../sprites.ts'
import { indexPixels } from './png.ts'

const px = (...pixels: [number, number, number, number?][]) =>
  new Uint8ClampedArray(pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a]))

describe('indexPixels', () => {
  it('maps exact palette colours to their index', () => {
    const colors = [...PICO8]
    const rgba = px([0, 0, 0], [255, 0, 77], [255, 204, 170], [29, 43, 83])
    const { image, offPalette, snapped } = indexPixels(rgba, 2, 2, colors, 16)
    expect(image.width).toBe(2)
    expect(image.height).toBe(2)
    expect([...image.pixels]).toEqual([0, 8, 15, 1])
    expect(offPalette).toBe(0)
    expect(snapped).toBe(0)
    expect(colors).toHaveLength(16)
  })

  it('makes pixels with alpha below 128 transparent', () => {
    const colors = [...PICO8]
    const rgba = px([255, 0, 77, 127], [255, 0, 77, 128], [1, 2, 3, 0])
    const { image, offPalette } = indexPixels(rgba, 3, 1, colors, 16)
    expect([...image.pixels]).toEqual([TRANSPARENT, 8, TRANSPARENT])
    expect(offPalette).toBe(0)
    expect(colors).toHaveLength(16)
  })

  it('gives a colour from outside the palette its own slot', () => {
    const colors = [...PICO8]
    const rgba = px([250, 5, 80], [250, 5, 80], [255, 0, 77], [2, 2, 2])
    const { image, offPalette, snapped } = indexPixels(rgba, 4, 1, colors, 16)
    expect([...image.pixels]).toEqual([16, 16, 8, 17])
    expect(colors.slice(16)).toEqual([
      [250, 5, 80],
      [2, 2, 2],
    ])
    expect(offPalette).toBe(3)
    expect(snapped).toBe(0)
  })

  it('reuses a slot another image already made', () => {
    const colors = [...PICO8]
    indexPixels(px([250, 5, 80]), 1, 1, colors, 16)
    const { image, offPalette } = indexPixels(
      px([250, 5, 80]),
      1,
      1,
      colors,
      16,
    )
    expect([...image.pixels]).toEqual([16])
    expect(colors).toHaveLength(17)
    expect(offPalette).toBe(1)
  })

  it('takes the nearest colour once every slot is used', () => {
    const colors: Rgb[] = Array.from({ length: MAX_COLORS }, (_, i) => [
      i,
      0,
      0,
    ])
    const rgba = px([0, 9, 0], [200, 0, 1], [7, 0, 0])
    const { image, offPalette, snapped } = indexPixels(rgba, 3, 1, colors, 16)
    expect([...image.pixels]).toEqual([0, 200, 7])
    expect(colors).toHaveLength(MAX_COLORS)
    expect(snapped).toBe(2)
    expect(offPalette).toBe(2)
  })

  it('never uses the transparent marker as a colour', () => {
    const colors: Rgb[] = Array.from({ length: MAX_COLORS }, (_, i) => [
      i,
      0,
      0,
    ])
    const { image } = indexPixels(px([0, 255, 0]), 1, 1, colors, 16)
    expect(image.pixels[0]).not.toBe(TRANSPARENT)
  })

  it('does not count or keep transparent off-palette pixels', () => {
    const colors = [...PICO8]
    const { offPalette } = indexPixels(px([3, 3, 3, 0]), 1, 1, colors, 16)
    expect(offPalette).toBe(0)
    expect(colors).toHaveLength(16)
  })

  it('throws when the length does not match the size', () => {
    expect(() =>
      indexPixels(new Uint8ClampedArray(7), 1, 2, [...PICO8]),
    ).toThrow(/8 RGBA bytes/)
  })
})
