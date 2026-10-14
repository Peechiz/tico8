import { describe, expect, it } from 'vitest'
import { TRANSPARENT } from '../sprites.ts'
import {
  drawRect,
  fillArea,
  pickColor,
  rectBetween,
  strokeLine,
} from './tools.ts'
import type { IndexedImage, Rect } from './types.ts'

/** An image from a text picture: hex digits are colours, `.` is TRANSPARENT. */
function image(text: string): IndexedImage {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const width = rows[0]!.length
  const pixels = new Uint8Array(width * rows.length)
  for (const [y, row] of rows.entries()) {
    for (const [x, ch] of [...row].entries()) {
      pixels[y * width + x] = ch === '.' ? TRANSPARENT : parseInt(ch, 16)
    }
  }
  return { width, height: rows.length, pixels }
}

/** The image back as text, in the same form. */
function show(img: IndexedImage): string {
  const rows: string[] = []
  for (let y = 0; y < img.height; y++) {
    let row = ''
    for (let x = 0; x < img.width; x++) {
      const c = img.pixels[y * img.width + x]!
      row += c === TRANSPARENT ? '.' : c.toString(16)
    }
    rows.push(row)
  }
  return rows.join('\n')
}

const blank = (w: number, h: number) => image(`${'.'.repeat(w)}\n`.repeat(h))
const all = (img: IndexedImage): Rect => ({
  x: 0,
  y: 0,
  width: img.width,
  height: img.height,
})

describe('strokeLine', () => {
  it('draws a diagonal with both ends', () => {
    const img = blank(5, 5)
    strokeLine(img, {
      from: { x: 0, y: 0 },
      to: { x: 4, y: 4 },
      color: 1,
      clip: all(img),
    })
    expect(show(img)).toBe(
      ['1....', '.1...', '..1..', '...1.', '....1'].join('\n'),
    )
  })

  it('leaves no gaps on a shallow line, in either direction', () => {
    const img = blank(7, 3)
    strokeLine(img, {
      from: { x: 6, y: 2 },
      to: { x: 0, y: 0 },
      color: 2,
      clip: all(img),
    })
    expect(show(img)).toBe(['22.....', '..222..', '.....22'].join('\n'))
  })

  it('paints a single point when both ends meet', () => {
    const img = blank(3, 3)
    strokeLine(img, {
      from: { x: 1, y: 1 },
      to: { x: 1, y: 1 },
      color: 3,
      clip: all(img),
    })
    expect(show(img)).toBe(['...', '.3.', '...'].join('\n'))
  })

  it('paints the eraser colour over pixels', () => {
    const img = image('111\n111')
    strokeLine(img, {
      from: { x: 0, y: 0 },
      to: { x: 2, y: 0 },
      color: TRANSPARENT,
      clip: all(img),
    })
    expect(show(img)).toBe('...\n111')
  })

  it('leaves pixels outside the clip and the image alone', () => {
    const img = blank(5, 3)
    strokeLine(img, {
      from: { x: -3, y: 1 },
      to: { x: 9, y: 1 },
      color: 4,
      clip: { x: 1, y: 0, width: 3, height: 3 },
    })
    expect(show(img)).toBe(['.....', '.444.', '.....'].join('\n'))
  })
})

describe('fillArea', () => {
  it('fills the connected area of one colour, four ways', () => {
    const img = image(['..1..', '..1..', '11.1.', '...1.'].join('\n'))
    fillArea(img, { at: { x: 0, y: 0 }, color: 5, clip: all(img) })
    expect(show(img)).toBe(['551..', '551..', '11.1.', '...1.'].join('\n'))
  })

  it('does not cross diagonals', () => {
    const img = image(['0.', '.0'].join('\n'))
    fillArea(img, { at: { x: 0, y: 0 }, color: 7, clip: all(img) })
    expect(show(img)).toBe('7.\n.0')
  })

  it('fills transparent areas', () => {
    const img = image(['..1', '..1'].join('\n'))
    fillArea(img, { at: { x: 0, y: 1 }, color: 2, clip: all(img) })
    expect(show(img)).toBe('221\n221')
  })

  it('is a no-op with the same colour', () => {
    const img = image('11\n1.')
    fillArea(img, { at: { x: 0, y: 0 }, color: 1, clip: all(img) })
    expect(show(img)).toBe('11\n1.')
  })

  it('stops at the clip', () => {
    const img = image(['.....', '.....', '.....'].join('\n'))
    fillArea(img, {
      at: { x: 2, y: 1 },
      color: 3,
      clip: { x: 1, y: 1, width: 3, height: 2 },
    })
    expect(show(img)).toBe(['.....', '.333.', '.333.'].join('\n'))
  })

  it('does nothing from outside the clip or image', () => {
    const img = blank(3, 3)
    const clip = { x: 1, y: 1, width: 1, height: 1 }
    fillArea(img, { at: { x: 0, y: 0 }, color: 3, clip })
    fillArea(img, { at: { x: 9, y: 9 }, color: 3, clip: all(img) })
    expect(show(img)).toBe('...\n...\n...')
  })
})

describe('drawRect', () => {
  it('outlines, whichever way round the corners are', () => {
    const img = blank(5, 4)
    drawRect(img, {
      from: { x: 3, y: 3 },
      to: { x: 1, y: 0 },
      color: 1,
      filled: false,
      clip: all(img),
    })
    expect(show(img)).toBe(['.111.', '.1.1.', '.1.1.', '.111.'].join('\n'))
  })

  it('fills', () => {
    const img = blank(4, 3)
    drawRect(img, {
      from: { x: 1, y: 0 },
      to: { x: 2, y: 2 },
      color: 6,
      filled: true,
      clip: all(img),
    })
    expect(show(img)).toBe(['.66.', '.66.', '.66.'].join('\n'))
  })

  it('draws a one pixel wide rect as a line', () => {
    const img = blank(3, 3)
    drawRect(img, {
      from: { x: 1, y: 0 },
      to: { x: 1, y: 2 },
      color: 2,
      filled: false,
      clip: all(img),
    })
    expect(show(img)).toBe('.2.\n.2.\n.2.')
  })

  it('clips, keeping the edges that fall outside undrawn', () => {
    const img = blank(5, 4)
    drawRect(img, {
      from: { x: -2, y: 0 },
      to: { x: 2, y: 3 },
      color: 1,
      filled: false,
      clip: { x: 0, y: 1, width: 5, height: 2 },
    })
    expect(show(img)).toBe(['.....', '..1..', '..1..', '.....'].join('\n'))
  })
})

describe('pickColor', () => {
  const img = image('12\n.3')

  it('gives the index at a point', () => {
    expect(pickColor(img, { x: 1, y: 0 })).toBe(2)
    expect(pickColor(img, { x: 0, y: 1 })).toBe(TRANSPARENT)
  })

  it('gives undefined outside the image', () => {
    expect(pickColor(img, { x: -1, y: 0 })).toBeUndefined()
    expect(pickColor(img, { x: 2, y: 0 })).toBeUndefined()
    expect(pickColor(img, { x: 0, y: 2 })).toBeUndefined()
  })
})

describe('rectBetween', () => {
  const clip = { x: 0, y: 0, width: 8, height: 8 }

  it('includes both corners, in any order', () => {
    expect(rectBetween({ x: 5, y: 4 }, { x: 2, y: 1 }, clip)).toEqual({
      x: 2,
      y: 1,
      width: 4,
      height: 4,
    })
  })

  it('is one pixel for one point', () => {
    expect(rectBetween({ x: 3, y: 3 }, { x: 3, y: 3 }, clip)).toEqual({
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    })
  })

  it('is cut to the clip', () => {
    expect(rectBetween({ x: -3, y: 6 }, { x: 4, y: 20 }, clip)).toEqual({
      x: 0,
      y: 6,
      width: 5,
      height: 2,
    })
  })

  it('is empty when wholly outside the clip', () => {
    const r = rectBetween({ x: 10, y: 10 }, { x: 12, y: 12 }, clip)
    expect(r.width * r.height).toBe(0)
  })
})
