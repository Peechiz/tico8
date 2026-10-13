import { describe, expect, it } from 'vitest'
import { createScreen } from './screen.ts'
import { createSheet, type IndexedImage, TRANSPARENT } from './sprites.ts'
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
    sheet.draw({ frame: 0, x: 0, y: 0 })
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
    sheet.draw({ frame: 0, x: 0, y: 0 })
    sheet.draw({ frame: 1, x: 2, y: 0 })
    sheet.draw({ frame: 2, x: 4, y: 0 })
    sheet.draw({ frame: 3, x: 6, y: 0 })
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
    sheet.draw({ frame: 1, x: 0, y: 0, flipX: true })
    sheet.draw({ frame: 1, x: 4, y: 0, flipY: true })
    expect(toPicture(screen)).toBe(
      picture(`
      22..23..
      32..22..
      ........
      ........
    `),
    )
  })

  it('takes an object with extra fields, and a spread position', () => {
    const { screen, sheet } = setup()
    const enemy = { frame: 1, x: 0, y: 0, hp: 3, name: 'bat' }
    sheet.draw(enemy)
    const pos = { x: 4, y: 2 }
    sheet.draw({ frame: 1, ...pos })
    expect(toPicture(screen)).toBe(
      picture(`
      22......
      23......
      ....22..
      ....23..
    `),
    )
  })

  it('floors the frame and ignores frames out of range', () => {
    const { screen, sheet } = setup()
    sheet.draw({ frame: -1, x: 0, y: 0 })
    sheet.draw({ frame: 4, x: 0, y: 0 })
    sheet.draw({ frame: Number.NaN, x: 0, y: 0 })
    expect(toPicture(screen)).not.toMatch(/[1-9]/)
    sheet.draw({ frame: 1.9, x: 0, y: 0 })
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

const rows = (screen: ReturnType<typeof createScreen>, n = 2) =>
  toPicture(screen).split('\n').slice(0, n)

describe('sprite swap and flash', () => {
  it('swaps named colours and leaves the rest', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.frame = 1
    s.swap = { 2: 8 }
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['88000000', '83000000'])
  })

  it('does not chain swaps', () => {
    const { screen, sheet } = setup()
    sheet.setImage({
      width: 2,
      height: 2,
      pixels: Uint8Array.from([8, 9, 9, 8]),
    })
    const s = sheet.sprite()
    s.swap = { 8: 9, 9: 10 }
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['9a000000', 'a9000000'])
  })

  it('flashes every opaque pixel', () => {
    const { screen, sheet } = setup()
    sheet.setImage({
      width: 2,
      height: 2,
      pixels: Uint8Array.from([1, TRANSPARENT, 2, 3]),
    })
    const s = sheet.sprite()
    s.flash = 7
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['70000000', '77000000'])
  })

  it('lets flash win over swap', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.swap = { 1: 8 }
    s.flash = 7
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['77000000', '77000000'])
  })

  it('reads a changed swap object at each draw', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    const swap: Record<number, number> = { 1: 8 }
    s.swap = swap
    s.draw(0, 0)
    swap[1] = 9
    s.draw(2, 0)
    expect(rows(screen, 1)).toEqual(['88990000'])
  })

  it('goes back to plain when cleared', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.swap = { 1: 8 }
    s.flash = 7
    s.swap = undefined
    s.flash = undefined
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['11000000', '11000000'])
  })

  it('applies options to a one-off draw', () => {
    const { screen, sheet } = setup()
    sheet.draw({ frame: 0, x: 0, y: 0, swap: { 1: 8 } })
    sheet.draw({ frame: 0, x: 2, y: 0, flash: 7 })
    sheet.draw({ frame: 0, x: 4, y: 0 })
    expect(rows(screen, 1)).toEqual(['88771100'])
  })
})

describe('sheet pixels', () => {
  it('reads one pixel of a cell with a spread position', () => {
    const { sheet } = setup()
    expect(sheet.pixel({ frame: 1, x: 1, y: 1 })).toBe(3)
    expect(sheet.pixel({ frame: 1, ...{ x: 1, y: 1 } })).toBe(3)
    expect(sheet.pixel({ frame: 2, x: 1, y: 1 })).toBe(6)
    expect(sheet.pixel({ frame: 1.9, x: 1.5, y: 1.2 })).toBe(3)
  })

  it('reads undefined where there is nothing', () => {
    const { sheet } = setup()
    sheet.setImage({
      width: 2,
      height: 2,
      pixels: Uint8Array.from([1, TRANSPARENT, 2, 3]),
    })
    expect(sheet.pixel({ frame: 0, x: 1, y: 0 })).toBeUndefined()
    expect(sheet.pixel({ frame: 1, x: 0, y: 0 })).toBeUndefined()
    expect(sheet.pixel({ frame: -1, x: 0, y: 0 })).toBeUndefined()
    expect(sheet.pixel({ frame: 0, x: 2, y: 0 })).toBeUndefined()
    expect(sheet.pixel({ frame: 0, x: 0, y: -1 })).toBeUndefined()
    expect(sheet.pixel({ frame: 0, ...{ x: 0, y: 2 } })).toBeUndefined()
    const empty = createSheet(createScreen(2, 2), 2, 2)
    expect(empty.pixel({ frame: 0, x: 0, y: 0 })).toBeUndefined()
  })

  it('writes, also with a spread position, and shows on an earlier sprite', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.draw(0, 0)
    sheet.pixel({ frame: 0, x: 1, y: 0, color: 9 })
    sheet.pixel({ frame: 0, ...{ x: 0, y: 1 }, color: 10 })
    s.draw(0, 0)
    expect(rows(screen)).toEqual(['19000000', 'a1000000'])
    expect(sheet.pixel({ frame: 0, x: 1, y: 0 })).toBe(9)
  })

  it('ignores writes outside the cell and leaves neighbours alone', () => {
    const { screen, sheet } = setup()
    sheet.pixel({ frame: 0, x: 2, y: 0, color: 9 })
    sheet.pixel({ frame: 0, x: -1, y: 0, color: 9 })
    sheet.pixel({ frame: 0, x: 0, y: 2, color: 9 })
    sheet.pixel({ frame: 0, x: 0, y: -1, color: 9 })
    sheet.pixel({ frame: 9, x: 0, y: 0, color: 9 })
    sheet.erase({ frame: 0, x: 2, y: 0 })
    sheet.erase({ frame: 0, x: 0, y: 2 })
    sheet.draw({ frame: 0, x: 0, y: 0 })
    sheet.draw({ frame: 1, x: 2, y: 0 })
    sheet.draw({ frame: 2, x: 4, y: 0 })
    sheet.draw({ frame: 3, x: 6, y: 0 })
    expect(toPicture(screen)).toBe(
      picture(`
      11224455
      11234655
      ........
      ........
    `),
    )
  })

  it('stores the see-through colour as 254', () => {
    const { sheet } = setup()
    sheet.pixel({ frame: 0, x: 0, y: 0, color: TRANSPARENT })
    expect(sheet.pixel({ frame: 0, x: 0, y: 0 })).toBe(254)
  })

  it('erases a pixel, also with a spread position', () => {
    const { screen, sheet } = setup()
    sheet.erase({ frame: 0, x: 0, y: 0 })
    sheet.erase({ frame: 0, ...{ x: 1, y: 1 } })
    screen.clear(7)
    sheet.draw({ frame: 0, x: 0, y: 0 })
    expect(rows(screen)).toEqual(['71777777', '17777777'])
    expect(sheet.pixel({ frame: 0, x: 0, y: 0 })).toBeUndefined()
  })
})

describe('a sprite and its place', () => {
  it('draws itself where it is', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite({ x: 2, y: 1, frame: 2 })
    s.draw()
    s.x = 6
    s.y = 0
    s.draw()
    expect(toPicture(screen)).toBe(
      picture(`
      ......44
      ..44..46
      ..46....
      ........
    `),
    )
  })

  it('starts at 0, 0 and can be drawn elsewhere without moving', () => {
    const { screen, sheet } = setup()
    const s = sheet.sprite()
    s.draw(4, 2)
    s.draw({ x: 0, y: 2 })
    expect([s.x, s.y]).toEqual([0, 0])
    expect(toPicture(screen)).toBe(
      picture(`
      ........
      ........
      11..11..
      11..11..
    `),
    )
  })

  it('is a rect the size of its cell', () => {
    const { sheet } = setup()
    const s = sheet.sprite({ x: 3, y: 1 })
    expect({ x: s.x, y: s.y, width: s.width, height: s.height }).toEqual({
      x: 3,
      y: 1,
      width: 2,
      height: 2,
    })
  })
})
