import { describe, expect, it } from 'vitest'
import { PICO8 } from '../palette.ts'
import { TRANSPARENT } from '../sprites.ts'
import {
  blankImage,
  cloneImage,
  createHistory,
  openSheet,
  resizeImage,
  toRgba,
} from './image.ts'
import type { IndexedImage, SheetInfo } from './types.ts'

const info: SheetInfo = {
  file: 'test.png',
  name: 'test',
  url: '/sprites/test.png',
  cellWidth: 2,
  cellHeight: 2,
}

const px = (...pixels: [number, number, number, number?][]) =>
  new Uint8ClampedArray(pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a]))

/**
 * An image from text: one hex digit per pixel, `.` for see-through, one
 * line per row.
 */
function image(text: string): IndexedImage {
  const rows = text
    .trim()
    .split('\n')
    .map((row) => row.trim())
  const width = rows[0]?.length ?? 0
  const pixels = new Uint8Array(
    rows.flatMap((row) =>
      [...row].map((c) => (c === '.' ? TRANSPARENT : Number.parseInt(c, 16))),
    ),
  )
  return { width, height: rows.length, pixels }
}

/** An image as text, the way `image` reads it. */
function text(image: IndexedImage): string {
  const rows: string[] = []
  for (let y = 0; y < image.height; y++) {
    let row = ''
    for (let x = 0; x < image.width; x++) {
      const index = image.pixels[y * image.width + x]!
      row += index === TRANSPARENT ? '.' : index.toString(16)
    }
    rows.push(row)
  }
  return rows.join('\n')
}

describe('openSheet', () => {
  it('indexes palette colours and puts others after the palette', () => {
    const data = px([255, 0, 77], [250, 5, 80], [0, 0, 0], [2, 2, 2])
    const doc = openSheet({
      info,
      pixels: { width: 2, height: 2, data },
      palette: PICO8,
    })
    expect([...doc.image.pixels]).toEqual([8, 16, 0, 17])
    expect(doc.paletteSize).toBe(16)
    expect(doc.colors.slice(16)).toEqual([
      [250, 5, 80],
      [2, 2, 2],
    ])
    expect(PICO8).toHaveLength(16)
  })

  it('reads a pixel less than half opaque as see-through', () => {
    const data = px([255, 0, 77, 127], [255, 0, 77, 128], [9, 9, 9, 0])
    const doc = openSheet({
      info,
      pixels: { width: 3, height: 1, data },
      palette: PICO8,
    })
    expect([...doc.image.pixels]).toEqual([TRANSPARENT, 8, TRANSPARENT])
    expect(doc.colors).toHaveLength(16)
  })
})

describe('toRgba', () => {
  it('round-trips off-palette colours exactly', () => {
    const data = px([250, 5, 80], [1, 2, 3], [255, 0, 77], [0, 0, 0, 0])
    const doc = openSheet({
      info,
      pixels: { width: 2, height: 2, data },
      palette: PICO8,
    })
    const out = toRgba(doc)
    expect(out.width).toBe(2)
    expect(out.height).toBe(2)
    expect([...out.data]).toEqual([...data])
  })

  it('writes half-transparent pixels as fully transparent or opaque', () => {
    const data = px([250, 5, 80, 100], [250, 5, 80, 200])
    const doc = openSheet({
      info,
      pixels: { width: 2, height: 1, data },
      palette: PICO8,
    })
    expect([...toRgba(doc).data]).toEqual([0, 0, 0, 0, 250, 5, 80, 255])
  })
})

describe('blankImage and cloneImage', () => {
  it('makes a see-through image', () => {
    expect(text(blankImage({ width: 3, height: 2 }))).toBe('...\n...')
  })

  it('copies the pixels', () => {
    const original = image('12\n34')
    const copy = cloneImage(original)
    copy.pixels[0] = 9
    expect(text(original)).toBe('12\n34')
    expect(text(copy)).toBe('92\n34')
  })
})

describe('resizeImage', () => {
  const sheet = image(`
    1234
    5678
  `)

  it('grows, keeping the top left and leaving new space see-through', () => {
    const out = resizeImage(sheet, {
      columns: 3,
      rows: 2,
      cellWidth: 2,
      cellHeight: 1,
    })
    expect(text(out)).toBe('1234..\n5678..')
    const tall = resizeImage(sheet, {
      columns: 3,
      rows: 2,
      cellWidth: 2,
      cellHeight: 2,
    })
    expect(text(tall)).toBe('1234..\n5678..\n......\n......')
  })

  it('shrinks, keeping the top left', () => {
    const out = resizeImage(sheet, {
      columns: 1,
      rows: 1,
      cellWidth: 2,
      cellHeight: 1,
    })
    expect(text(out)).toBe('12')
  })
})

describe('createHistory', () => {
  it('undoes and redoes whole images', () => {
    const history = createHistory()
    expect(history.canUndo).toBe(false)
    const before = image('11')
    history.push(before)
    // Changing the image after pushing must not change the snapshot.
    before.pixels[0] = 2
    const now = image('21')
    expect(history.canUndo).toBe(true)
    const undone = history.undo(now)!
    expect(text(undone)).toBe('11')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
    expect(text(history.redo(undone)!)).toBe('21')
    expect(history.canRedo).toBe(false)
    expect(history.redo(now)).toBeUndefined()
  })

  it('keeps at most limit steps back', () => {
    const history = createHistory(3)
    for (let i = 0; i < 5; i++) history.push(image(i.toString(16)))
    let current = image('5')
    const seen: string[] = []
    for (;;) {
      const back = history.undo(current)
      if (!back) break
      seen.push(text(back))
      current = back
    }
    expect(seen).toEqual(['4', '3', '2'])
    expect(history.canUndo).toBe(false)
    expect(history.undo(current)).toBeUndefined()
  })

  it('clears redo on a new step', () => {
    const history = createHistory()
    history.push(image('1'))
    history.undo(image('2'))
    expect(history.canRedo).toBe(true)
    history.push(image('1'))
    expect(history.canRedo).toBe(false)
    expect(history.redo(image('3'))).toBeUndefined()
  })
})
