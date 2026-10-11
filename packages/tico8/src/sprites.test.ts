import { describe, expect, it } from 'vitest'
import { createScreen } from './screen.ts'
import { createSheet, type IndexedImage } from './sprites.ts'
import { picture, toPicture } from './testing.ts'

/** 4x4 image of four 2x2 cells, each mostly one colour (1, 2, 4, 5). */
function image4(): IndexedImage {
  const pixels = [1, 1, 2, 2, 1, 1, 2, 3, 4, 4, 5, 5, 4, 6, 5, 5]
  return { width: 4, height: 4, pixels: Uint8Array.from(pixels) }
}

function setup() {
  const screen = createScreen(8, 4)
  const sheet = createSheet(screen, 2, 2)
  sheet.setImage(image4())
  return { screen, sheet }
}

describe('sheet', () => {
  it('draws nothing before it has an image', () => {
    const screen = createScreen(4, 2)
    const sheet = createSheet(screen, 2, 2)
    expect(sheet.frames).toBe(0)
    sheet.draw(0, 0, 0)
    sheet.sprite().draw(0, 0)
    expect(toPicture(screen)).toBe(
      picture(`
      ....
      ....
    `),
    )
  })

  it('numbers frames left to right, then down', () => {
    const { screen, sheet } = setup()
    expect(sheet.frames).toBe(4)
    sheet.draw(0, 0, 0)
    sheet.draw(1, 2, 0)
    sheet.draw(2, 4, 0)
    sheet.draw(3, 6, 0)
    expect(toPicture(screen)).toBe(
      picture(`
      11224455
      11234655
      ........
      ........
    `),
    )
  })

  it('flips through options', () => {
    const { screen, sheet } = setup()
    sheet.draw(1, 0, 0, { flipX: true })
    sheet.draw(1, { x: 4, y: 0 }, { flipY: true })
    expect(toPicture(screen)).toBe(
      picture(`
      22..23..
      32..22..
      ........
      ........
    `),
    )
  })

  it('floors the frame and ignores frames out of range', () => {
    const { screen, sheet } = setup()
    sheet.draw(-1, 0, 0)
    sheet.draw(4, 0, 0)
    sheet.draw(Number.NaN, 0, 0)
    expect(toPicture(screen)).not.toMatch(/[1-9]/)
    sheet.draw(1.9, 0, 0)
    expect(toPicture(screen).split('\n')[0]).toBe('22000000')
  })

  it('makes separate sprites that remember frame and flips', () => {
    const { screen, sheet } = setup()
    const a = sheet.sprite()
    const b = sheet.sprite()
    expect([a.frame, a.flipX, a.flipY]).toEqual([0, false, false])
    a.frame = 1
    a.flipX = true
    expect(b.frame).toBe(0)
    a.draw(0, 0)
    b.draw({ x: 4, y: 2 })
    expect(toPicture(screen)).toBe(
      picture(`
      22......
      32......
      ....11..
      ....11..
    `),
    )
  })

  it('flips a sprite vertically', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.frame = 3
    s.flipY = true
    s.draw(0, 0)
    expect(toPicture(screen)).toBe(
      picture(`
      55......
      55......
      ........
      ........
    `),
    )
  })

  it('throws when the image is not whole cells', () => {
    const sheet = createSheet(createScreen(4, 4), 2, 2)
    const bad = { width: 5, height: 4, pixels: new Uint8Array(20) }
    expect(() => sheet.setImage(bad)).toThrow(/5x4.*2x2/)
    expect(sheet.frames).toBe(0)
  })

  it('shows new art on old sprites after setImage', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.frame = 2
    const next = { width: 6, height: 2, pixels: new Uint8Array(12).fill(7) }
    sheet.setImage(next)
    expect(sheet.frames).toBe(3)
    s.draw(0, 0)
    expect(toPicture(screen).split('\n').slice(0, 2)).toEqual([
      '77000000',
      '77000000',
    ])
    s.frame = 3
    s.draw(4, 2)
    expect(toPicture(screen).split('\n')[2]).toBe('00000000')
  })
})
