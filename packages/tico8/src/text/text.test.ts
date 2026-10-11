import { describe, expect, it } from 'vitest'
import { createScreen } from '../screen.ts'
import { picture, toPicture } from '../testing.ts'
import { createText } from './text.ts'
import type { Font, Glyph } from './types.ts'

const glyph = (width: number, rows: number[]): Glyph => ({ width, rows })

// a is 3 wide, i is 1 wide, ♥ is 3 wide; anything else is a 2 wide block.
const font: Font = {
  height: 4,
  spacing: 1,
  glyphs: new Map([
    ['a', glyph(3, [0b111, 0b101, 0b111, 0b101])],
    ['i', glyph(1, [1, 1, 1, 1])],
    ['♥', glyph(3, [0b101, 0b111, 0b010, 0])],
  ]),
  missing: glyph(2, [3, 3, 3, 3]),
}

function setup(width = 12, height = 10) {
  const screen = createScreen(width, height)
  return { screen, ...createText(screen, font) }
}

describe('text', () => {
  it('draws a word in white', () => {
    const { screen, text } = setup(8, 6)
    text('ai', { x: 1, y: 1 })
    expect(toPicture(screen)).toBe(
      picture(`
        ........
        .777.7..
        .7.7.7..
        .777.7..
        .7.7.7..
        ........
      `),
    )
  })

  it('takes a colour', () => {
    const { screen, text } = setup(4, 4)
    text('i', { x: 1, y: 0, color: 8 })
    expect(toPicture(screen)).toBe(
      picture(`
        .8..
        .8..
        .8..
        .8..
      `),
    )
  })

  it('draws in the default colour it was given', () => {
    const screen = createScreen(4, 4)
    const { text } = createText(screen, font, { color: 12 })
    text('i', { x: 1, y: 0 })
    text('i', { x: 2, y: 0, color: 8 })
    expect(screen.read(1, 0)).toBe(12)
    expect(screen.read(2, 0)).toBe(8)
  })

  it('takes any object with x and y', () => {
    const { screen, text } = setup(4, 4)
    text('i', { x: 2, y: 0, vx: 3 } as { x: number; y: number })
    expect(screen.read(2, 0)).toBe(7)
  })

  it('breaks lines at newlines and skips carriage returns', () => {
    const { screen, text } = setup(5, 8)
    text('i\r\na', { x: 0, y: 0 })
    expect(toPicture(screen)).toBe(
      picture(`
        7....
        7....
        7....
        7....
        777..
        7.7..
        777..
        7.7..
      `),
    )
  })

  it('leaves an empty line between lines', () => {
    const { screen, text } = setup(2, 12)
    text('i\n\ni', { x: 0, y: 0 })
    expect(toPicture(screen)).toBe(
      picture(`
        7.
        7.
        7.
        7.
        ..
        ..
        ..
        ..
        7.
        7.
        7.
        7.
      `),
    )
  })

  it('centres each line on x', () => {
    const { screen, text } = setup(9, 8)
    text('i\na', { x: 4, y: 0, align: 'center' })
    expect(toPicture(screen)).toBe(
      picture(`
        ....7....
        ....7....
        ....7....
        ....7....
        ...777...
        ...7.7...
        ...777...
        ...7.7...
      `),
    )
  })

  it('centres an odd width a column to the left of the half', () => {
    const { screen, text } = setup(8, 4)
    // 'ai' is 5 wide: first column is 4 - floor(5 / 2) = 2.
    text('ai', { x: 4, y: 0, align: 'center' })
    expect(toPicture(screen)).toBe(
      picture(`
        ..777.7.
        ..7.7.7.
        ..777.7.
        ..7.7.7.
      `),
    )
  })

  it('ends a right aligned line just before x, each line on its own', () => {
    const { screen, text } = setup(6, 8)
    text('ai\ni', { x: 6, y: 0, align: 'right' })
    expect(toPicture(screen)).toBe(
      picture(`
        .777.7
        .7.7.7
        .777.7
        .7.7.7
        .....7
        .....7
        .....7
        .....7
      `),
    )
  })

  it('draws the missing glyph for a character the font lacks', () => {
    const { screen, text } = setup(6, 4)
    text('iz', { x: 0, y: 0 })
    expect(toPicture(screen)).toBe(
      picture(`
        7.77..
        7.77..
        7.77..
        7.77..
      `),
    )
  })

  it('treats a symbol as one character', () => {
    const { screen, text } = setup(5, 4)
    text('♥i', { x: 0, y: 0 })
    expect(toPicture(screen)).toBe(
      picture(`
        7.7.7
        777.7
        .7..7
        ....7
      `),
    )
    expect(text.measure('♥')).toEqual({ width: 3, height: 4 })
  })

  it('draws a number', () => {
    const { screen, text } = setup(3, 4)
    text(1, { x: 0, y: 0 })
    // '1' is not in the font, so it is the missing glyph.
    expect(toPicture(screen)).toBe(picture('77.\n77.\n77.\n77.'))
  })

  it('floors fractional positions', () => {
    const a = setup(4, 6)
    const b = setup(4, 6)
    a.text('i', { x: 1.9, y: 1.9 })
    b.text('i', { x: 1, y: 1 })
    expect(toPicture(a.screen)).toBe(toPicture(b.screen))
  })

  it('follows the camera and is cut by the clip', () => {
    const { screen, text } = setup(6, 5)
    screen.withCamera(-1, 0, () => {
      screen.withClip(2, 0, 3, 2, () => {
        text('ai', { x: 0, y: 0 })
      })
    })
    expect(toPicture(screen)).toBe(
      picture(`
        ...7.7
        ...7.7
        ......
        ......
        ......
      `),
    )
  })

  describe('measure', () => {
    it('gives an empty string no width and one line', () => {
      expect(setup().text.measure('')).toEqual({ width: 0, height: 4 })
    })

    it('adds glyphs and spacing, none after the last', () => {
      expect(setup().text.measure('ai')).toEqual({ width: 5, height: 4 })
    })

    it('takes the widest line and counts every line', () => {
      expect(setup().text.measure('i\naia\n')).toEqual({ width: 9, height: 12 })
      expect(setup().text.measure(12)).toEqual({ width: 5, height: 4 })
    })
  })
})

describe('label', () => {
  it('is plain data, with text defaulting to empty', () => {
    const { label } = setup()
    expect(label({ x: 1, y: 2 })).toEqual({ x: 1, y: 2, text: '' })
    expect(label({ x: 1, y: 2, text: 'ai' })).toEqual({
      x: 1,
      y: 2,
      text: 'ai',
    })
  })

  it('sets colour and align only when given', () => {
    const { label } = setup()
    const l = label({ x: 0, y: 0, text: 'a', color: 3, align: 'right' })
    expect(l).toEqual({ x: 0, y: 0, text: 'a', color: 3, align: 'right' })
  })

  it('is a fresh object that drops extra fields', () => {
    const { label } = setup()
    const source = { x: 1, y: 2, text: 'a', hp: 9 }
    const l = label(source)
    expect(l).not.toBe(source)
    expect(l).not.toHaveProperty('hp')
  })

  it('is bare when spread', () => {
    const { label } = setup()
    const copy = { ...label({ x: 1, y: 2, text: 'a' }) }
    expect(copy).toEqual({ x: 1, y: 2, text: 'a' })
    expect(copy).not.toHaveProperty('draw')
    expect(copy).not.toHaveProperty('bounds')
  })

  it('draws, and draws differently once its fields change', () => {
    const { screen, label } = setup(6, 4)
    const l = label({ x: 0, y: 0, text: 'i' })
    l.draw()
    expect(toPicture(screen)).toBe(picture('7.....\n7.....\n7.....\n7.....'))
    screen.clear()
    l.text = 'a'
    l.x = 2
    l.color = 8
    l.draw()
    expect(toPicture(screen)).toBe(picture('..888.\n..8.8.\n..888.\n..8.8.'))
  })

  it('has bounds for each alignment', () => {
    const { label } = setup()
    const fields = { x: 10.5, y: 3.7, text: 'ai\na' }
    expect(label(fields).bounds).toEqual({ x: 10, y: 3, width: 5, height: 8 })
    expect(label({ ...fields, align: 'center' }).bounds).toEqual({
      x: 8,
      y: 3,
      width: 5,
      height: 8,
    })
    expect(label({ ...fields, align: 'right' }).bounds).toEqual({
      x: 5,
      y: 3,
      width: 5,
      height: 8,
    })
  })

  it('has bounds that follow the text', () => {
    const { label } = setup()
    const l = label({ x: 0, y: 0, text: 'i' })
    l.text = 'ai'
    expect(l.bounds.width).toBe(5)
  })
})
