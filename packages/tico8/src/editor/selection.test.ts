import { describe, expect, it } from 'vitest'
import { TRANSPARENT } from '../sprites.ts'
import {
  copyRect,
  drop,
  flipped,
  lift,
  moveSelection,
  paste,
  rotated,
} from './selection.ts'
import type { IndexedImage } from './types.ts'

/** An image from rows of hex digits, `.` for see-through. */
function image(text: string): IndexedImage {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const width = rows[0]!.length
  const pixels = new Uint8Array(width * rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const ch = row[x]!
      pixels[y * width + x] = ch === '.' ? TRANSPARENT : parseInt(ch, 16)
    }
  })
  return { width, height: rows.length, pixels }
}

/** An image as rows of hex digits, `.` for see-through. */
function text(img: IndexedImage): string {
  const rows: string[] = []
  for (let y = 0; y < img.height; y++) {
    let row = ''
    for (let x = 0; x < img.width; x++) {
      const v = img.pixels[y * img.width + x]!
      row += v === TRANSPARENT ? '.' : v.toString(16)
    }
    rows.push(row)
  }
  return rows.join('\n')
}

const pic = (s: string): string => text(image(s))

describe('lift', () => {
  it('copies the pixels and leaves a transparent hole', () => {
    const img = image(`
      1234
      5678
      9abc
    `)
    const sel = lift(img, { x: 1, y: 0, width: 2, height: 2 })
    expect(text(sel.lifted!)).toBe(pic('23\n67'))
    expect(sel.rect).toEqual({ x: 1, y: 0, width: 2, height: 2 })
    expect(text(img)).toBe(pic('1..4\n5..8\n9abc'))
  })

  it('clamps a rect that hangs off the image', () => {
    const img = image('12\n34')
    const sel = lift(img, { x: 1, y: 1, width: 5, height: 5 })
    expect(text(sel.lifted!)).toBe('4')
    expect(sel.rect).toEqual({ x: 1, y: 1, width: 1, height: 1 })
    expect(text(img)).toBe(pic('12\n3.'))
  })
})

describe('moveSelection', () => {
  it('returns a moved copy', () => {
    const sel = lift(image('12\n34'), { x: 0, y: 0, width: 1, height: 1 })
    const moved = moveSelection(sel, { x: 2, y: -1 })
    expect(moved.rect).toEqual({ x: 2, y: -1, width: 1, height: 1 })
    expect(moved.lifted).toBe(sel.lifted)
    expect(sel.rect.x).toBe(0)
  })
})

describe('drop', () => {
  it('stamps the lifted pixels, keeping what is under transparent ones', () => {
    const img = image('1111\n1111\n1111')
    const sel = paste(image('2.\n.3'), { x: 1, y: 1 })
    drop(img, sel)
    expect(text(img)).toBe(pic('1111\n1211\n1131'))
  })

  it('loses parts outside the image', () => {
    const img = image('111\n111')
    drop(img, paste(image('22\n22'), { x: 2, y: 1 }))
    expect(text(img)).toBe(pic('111\n112'))
    drop(img, paste(image('33'), { x: -1, y: 0 }))
    expect(text(img)).toBe(pic('311\n112'))
  })

  it('does nothing without lifted pixels', () => {
    const img = image('12')
    drop(img, { rect: { x: 0, y: 0, width: 1, height: 1 } })
    expect(text(img)).toBe('12')
  })

  it('moves pixels by lift, move and drop', () => {
    const img = image('12..\n34..')
    const sel = moveSelection(lift(img, { x: 0, y: 0, width: 2, height: 2 }), {
      x: 2,
      y: 0,
    })
    drop(img, sel)
    expect(text(img)).toBe(pic('..12\n..34'))
  })
})

describe('copyRect and paste', () => {
  it('copies without touching the image', () => {
    const img = image('123\n456')
    const clip = copyRect(img, { x: 1, y: 0, width: 2, height: 2 })
    expect(text(clip)).toBe(pic('23\n56'))
    expect(text(img)).toBe(pic('123\n456'))
  })

  it('pastes a lifted selection at a point, leaving the clip alone', () => {
    const clip = image('12\n34')
    const sel = paste(clip, { x: 3, y: 4 })
    expect(sel.rect).toEqual({ x: 3, y: 4, width: 2, height: 2 })
    expect(text(sel.lifted!)).toBe(text(clip))
    sel.lifted!.pixels[0] = 9
    expect(clip.pixels[0]).toBe(1)
  })
})

describe('flipped', () => {
  const img = image('123\n456')
  it('mirrors left to right', () => {
    expect(text(flipped(img, 'x'))).toBe(pic('321\n654'))
  })
  it('mirrors top to bottom', () => {
    expect(text(flipped(img, 'y'))).toBe(pic('456\n123'))
  })
  it('keeps transparency and the input', () => {
    expect(text(flipped(image('1.'), 'x'))).toBe(pic('.1'))
    expect(text(img)).toBe(pic('123\n456'))
  })
})

describe('rotated', () => {
  it('turns a square a quarter clockwise', () => {
    const img = image('12\n34')
    expect(text(rotated(img)!)).toBe(pic('31\n42'))
    expect(text(img)).toBe(pic('12\n34'))
  })

  it('turns four times back to the start', () => {
    let img = image('123\n4.6\n789')
    for (let i = 0; i < 4; i++) img = rotated(img)!
    expect(text(img)).toBe(pic('123\n4.6\n789'))
  })

  it('refuses a rectangle that is not square', () => {
    expect(rotated(image('123\n456'))).toBeUndefined()
  })
})
