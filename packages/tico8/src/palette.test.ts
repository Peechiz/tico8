import { describe, expect, it } from 'vitest'
import { lightest, PICO8, PICO8_NAMES, readPalette } from './palette.ts'

it('has sixteen valid colours', () => {
  expect(PICO8).toHaveLength(16)
  for (const rgb of PICO8) {
    expect(rgb).toHaveLength(3)
    for (const c of rgb)
      expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true)
  }
})

it('names every colour once, in palette order', () => {
  expect(Object.values(PICO8_NAMES)).toEqual(PICO8.map((_, i) => i))
  expect(PICO8[PICO8_NAMES.red]).toEqual([255, 0, 77])
})

describe('readPalette', () => {
  it('numbers a palette in the order it is written', () => {
    const { colors, names } = readPalette({
      ink: '#1b1b2f',
      moss: '#3A5A40',
      sand: '#fc0',
    })
    expect(names).toEqual({ ink: 0, moss: 1, sand: 2 })
    expect(Object.keys(names)).toEqual(['ink', 'moss', 'sand'])
    expect(colors).toEqual([
      [27, 27, 47],
      [58, 90, 64],
      [255, 204, 0],
    ])
  })

  it('takes a palette of more than sixteen colours', () => {
    const written: Record<string, string> = {}
    for (let i = 0; i < 40; i++) {
      written[`c${i}`] = `#0000${i.toString(16).padStart(2, '0')}`
    }
    const { colors, names } = readPalette(written)
    expect(colors).toHaveLength(40)
    expect(names.c39).toBe(39)
    expect(colors[39]).toEqual([0, 0, 39])
  })

  it('refuses a palette it cannot use, and names the colour', () => {
    const bad = (written: unknown) => () => readPalette(written as never)
    expect(bad({})).toThrow('tico8: a palette needs at least one colour')
    expect(bad({ ink: 'navy' })).toThrow(
      `tico8: the palette colour "ink" must be a hex colour such as '#1b1b2f', got 'navy'`,
    )
    expect(bad({ ink: 7 })).toThrow('the palette colour "ink" must be a hex')
    expect(bad({ '2nd': '#000' })).toThrow(
      'the palette name "2nd" cannot be used',
    )
  })

  it('refuses more colours than the screen can show', () => {
    const written: Record<string, string> = {}
    for (let i = 0; i < 256; i++) written[`c${i}`] = '#000'
    expect(() => readPalette(written)).toThrow(
      'the palette has 256 colours, and the screen can show 255 at most',
    )
  })
})

it('finds the lightest colour, the first of equals', () => {
  expect(lightest(PICO8)).toBe(PICO8_NAMES.white)
  const { colors } = readPalette({
    ink: '#1b1b2f',
    sand: '#e9c46a',
    moss: '#3a5a40',
  })
  expect(lightest(colors)).toBe(1)
  expect(
    lightest([
      [9, 9, 9],
      [9, 9, 9],
    ]),
  ).toBe(0)
})
