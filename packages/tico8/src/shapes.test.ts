import { describe, expect, it } from 'vitest'
import { createScreen } from './screen.ts'
import {
  circle,
  drawLine,
  fillShape,
  outlineShape,
  oval,
  rect,
  type Shape,
} from './shapes.ts'
import { picture, toPicture } from './testing.ts'

function drawn(
  width: number,
  height: number,
  draw: (screen: ReturnType<typeof createScreen>) => void,
): string {
  const s = createScreen(width, height)
  draw(s)
  return toPicture(s)
}

const outlined = (shape: Shape, size = 9) =>
  drawn(size, size, (s) => outlineShape(s, shape, 1))
const filled = (shape: Shape, size = 9) =>
  drawn(size, size, (s) => fillShape(s, shape, 2))
describe('makers', () => {
  it('make plain rects, circles and ovals from named fields', () => {
    expect(rect({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })
    expect(circle({ x: 1, y: 2, radius: 3 })).toEqual({ x: 1, y: 2, radius: 3 })
    expect(oval({ x: 1, y: 2, radiusX: 3, radiusY: 4 })).toEqual({
      x: 1,
      y: 2,
      radiusX: 3,
      radiusY: 4,
    })
  })

  it('return a fresh object, not the argument', () => {
    const input = { x: 1, y: 1, radius: 1 }
    const made = circle(input)
    expect(made).not.toBe(input)
    expect(made).toEqual(input)
    expect(circle(input)).not.toBe(made)
  })

  it('drop extra fields on the argument', () => {
    const player = { x: 1, y: 2, width: 3, height: 4, hp: 5 }
    const ball = { x: 1, y: 2, radius: 3, color: 'red' }
    const egg = { x: 1, y: 2, radiusX: 3, radiusY: 4, name: 'egg' }
    expect(Object.keys(rect(player)).sort()).toEqual([
      'height',
      'width',
      'x',
      'y',
    ])
    expect(rect(player)).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(circle(ball)).toEqual({ x: 1, y: 2, radius: 3 })
    expect(oval(egg)).toEqual({ x: 1, y: 2, radiusX: 3, radiusY: 4 })
  })

  it('accept a spread position', () => {
    const pos = { x: 1, y: 2 }
    expect(rect({ ...pos, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })
    expect(circle({ ...pos, radius: 3 })).toEqual({ x: 1, y: 2, radius: 3 })
    expect(oval({ ...pos, radiusX: 3, radiusY: 4 })).toEqual({
      x: 1,
      y: 2,
      radiusX: 3,
      radiusY: 4,
    })
  })

  it('are not needed: fillShape takes a plain object literal', () => {
    expect(
      drawn(4, 4, (s) => fillShape(s, { x: 1, y: 1, width: 2, height: 2 }, 8)),
    ).toBe(
      picture(`
      ....
      .88.
      .88.
      ....
    `),
    )
  })
})

describe('rect.overlaps', () => {
  const a = rect({ x: 0, y: 0, width: 4, height: 4 })

  it('is true when they share area', () => {
    expect(rect.overlaps(a, rect({ x: 3, y: 3, width: 4, height: 4 }))).toBe(
      true,
    )
    expect(rect.overlaps(a, rect({ x: 1, y: 1, width: 1, height: 1 }))).toBe(
      true,
    )
    expect(rect.overlaps(rect({ x: 3, y: 3, width: 4, height: 4 }), a)).toBe(
      true,
    )
  })

  it('is false for rects that only touch', () => {
    expect(rect.overlaps(a, rect({ x: 4, y: 0, width: 4, height: 4 }))).toBe(
      false,
    )
    expect(rect.overlaps(a, rect({ x: 0, y: 4, width: 4, height: 4 }))).toBe(
      false,
    )
    expect(rect.overlaps(a, rect({ x: 4, y: 4, width: 4, height: 4 }))).toBe(
      false,
    )
    expect(rect.overlaps(a, rect({ x: 9, y: 9, width: 1, height: 1 }))).toBe(
      false,
    )
  })

  it('is false for empty rects', () => {
    expect(rect.overlaps(a, rect({ x: 1, y: 1, width: 0, height: 2 }))).toBe(
      false,
    )
    expect(rect.overlaps(a, rect({ x: 1, y: 1, width: 2, height: 0 }))).toBe(
      false,
    )
    expect(rect.overlaps(a, rect({ x: 1, y: 1, width: -2, height: 2 }))).toBe(
      false,
    )
    expect(rect.overlaps(rect({ x: 1, y: 1, width: 0, height: 0 }), a)).toBe(
      false,
    )
  })
})

describe('rect.contains', () => {
  const r = rect({ x: 2, y: 3, width: 4, height: 2 })

  it('includes the top left and excludes the far edges', () => {
    expect(rect.contains(r, { x: 2, y: 3 })).toBe(true)
    expect(rect.contains(r, { x: 5, y: 4 })).toBe(true)
    expect(rect.contains(r, { x: 6, y: 4 })).toBe(false)
    expect(rect.contains(r, { x: 5, y: 5 })).toBe(false)
    expect(rect.contains(r, { x: 1, y: 3 })).toBe(false)
    expect(rect.contains(r, { x: 2, y: 2 })).toBe(false)
  })

  it('holds nothing when empty', () => {
    expect(
      rect.contains(rect({ x: 2, y: 3, width: 0, height: 2 }), { x: 2, y: 3 }),
    ).toBe(false)
  })
})

describe('rect drawing', () => {
  it('fills x .. x+width-1 and y .. y+height-1', () => {
    expect(
      drawn(8, 6, (s) =>
        fillShape(s, rect({ x: 1, y: 1, width: 5, height: 4 }), 3),
      ),
    ).toBe(
      picture(`
      ........
      .33333..
      .33333..
      .33333..
      .33333..
      ........
    `),
    )
  })

  it('outlines one pixel thick inside the bounds', () => {
    expect(
      drawn(8, 6, (s) =>
        outlineShape(s, rect({ x: 1, y: 1, width: 5, height: 4 }), 3),
      ),
    ).toBe(
      picture(`
      ........
      .33333..
      .3...3..
      .3...3..
      .33333..
      ........
    `),
    )
  })

  it('outlines a 1-wide or 1-tall rect as a line, each pixel once', () => {
    expect(
      drawn(5, 5, (s) =>
        outlineShape(s, rect({ x: 1, y: 1, width: 1, height: 3 }), 3),
      ),
    ).toBe(
      picture(`
      .....
      .3...
      .3...
      .3...
      .....
    `),
    )
    expect(
      drawn(5, 3, (s) =>
        outlineShape(s, rect({ x: 1, y: 1, width: 3, height: 1 }), 3),
      ),
    ).toBe(
      picture(`
      .....
      .333.
      .....
    `),
    )
    expect(
      drawn(3, 3, (s) =>
        outlineShape(s, rect({ x: 1, y: 1, width: 1, height: 1 }), 3),
      ),
    ).toBe(
      picture(`
      ...
      .3.
      ...
    `),
    )
  })

  it('draws nothing when empty or negative', () => {
    const blank = drawn(4, 4, () => {})
    for (const r of [
      rect({ x: 1, y: 1, width: 0, height: 2 }),
      rect({ x: 1, y: 1, width: 2, height: 0 }),
      rect({ x: 1, y: 1, width: -2, height: 2 }),
    ]) {
      expect(drawn(4, 4, (s) => fillShape(s, r, 3))).toBe(blank)
      expect(drawn(4, 4, (s) => outlineShape(s, r, 3))).toBe(blank)
    }
  })

  it('floors positions and sizes', () => {
    expect(filled(rect({ x: 1.9, y: 1.9, width: 2.9, height: 1.5 }))).toBe(
      filled(rect({ x: 1, y: 1, width: 2, height: 1 })),
    )
  })
})

describe('circle drawing', () => {
  const at = (r: number) => circle({ x: 4, y: 4, radius: r })

  it('draws radius 0 as the centre pixel', () => {
    const one = picture(`
      .........
      .........
      .........
      .........
      ....1....
      .........
      .........
      .........
      .........
    `)
    expect(outlined(at(0))).toBe(one)
    expect(filled(at(0))).toBe(one.replace('1', '2'))
  })

  it('draws radius 1 as a plus', () => {
    expect(outlined(at(1))).toBe(
      picture(`
      .........
      .........
      .........
      ....1....
      ...1.1...
      ....1....
      .........
      .........
      .........
    `),
    )
    expect(filled(at(1))).toBe(
      picture(`
      .........
      .........
      .........
      ....2....
      ...222...
      ....2....
      .........
      .........
      .........
    `),
    )
  })

  it('draws radius 2 as a 5x5 ring with the corners cut', () => {
    expect(outlined(at(2))).toBe(
      picture(`
      .........
      .........
      ...111...
      ..1...1..
      ..1...1..
      ..1...1..
      ...111...
      .........
      .........
    `),
    )
    expect(filled(at(2))).toBe(
      picture(`
      .........
      .........
      ...222...
      ..22222..
      ..22222..
      ..22222..
      ...222...
      .........
      .........
    `),
    )
  })

  it('draws radius 3', () => {
    expect(outlined(at(3))).toBe(
      picture(`
      .........
      ...111...
      ..1...1..
      .1.....1.
      .1.....1.
      .1.....1.
      ..1...1..
      ...111...
      .........
    `),
    )
    expect(filled(at(3))).toBe(
      picture(`
      .........
      ...222...
      ..22222..
      .2222222.
      .2222222.
      .2222222.
      ..22222..
      ...222...
      .........
    `),
    )
  })

  it('draws radius 4', () => {
    expect(outlined(at(4))).toBe(
      picture(`
      ...111...
      .11...11.
      .1.....1.
      1.......1
      1.......1
      1.......1
      .1.....1.
      .11...11.
      ...111...
    `),
    )
    expect(filled(at(4))).toBe(
      picture(`
      ...222...
      .2222222.
      .2222222.
      222222222
      222222222
      222222222
      .2222222.
      .2222222.
      ...222...
    `),
    )
  })

  it('draws nothing for a negative radius', () => {
    const blank = drawn(9, 9, () => {})
    expect(outlined(at(-1))).toBe(blank)
    expect(filled(at(-1))).toBe(blank)
  })
})

describe('oval drawing', () => {
  it('outlines and fills a wide oval', () => {
    const o = oval({ x: 5, y: 3, radiusX: 4, radiusY: 2 })
    expect(drawn(11, 7, (s) => outlineShape(s, o, 1))).toBe(
      picture(`
      ...........
      ....111....
      ..11...11..
      .1.......1.
      ..11...11..
      ....111....
      ...........
    `),
    )
    expect(drawn(11, 7, (s) => fillShape(s, o, 2))).toBe(
      picture(`
      ...........
      ....222....
      ..2222222..
      .222222222.
      ..2222222..
      ....222....
      ...........
    `),
    )
  })

  it('outlines a tall oval', () => {
    expect(
      drawn(7, 9, (s) =>
        outlineShape(s, oval({ x: 3, y: 4, radiusX: 2, radiusY: 4 }), 1),
      ),
    ).toBe(
      picture(`
      ...1...
      ..1.1..
      ..1.1..
      .1...1.
      .1...1.
      .1...1.
      ..1.1..
      ..1.1..
      ...1...
    `),
    )
  })

  it('draws a zero radius as a line or a pixel', () => {
    const line = picture(`
      ...........
      ...........
      ...........
      ..1111111..
      ...........
      ...........
      ...........
    `)
    expect(
      drawn(11, 7, (s) =>
        outlineShape(s, oval({ x: 5, y: 3, radiusX: 3, radiusY: 0 }), 1),
      ),
    ).toBe(line)
    expect(
      drawn(11, 7, (s) =>
        fillShape(s, oval({ x: 5, y: 3, radiusX: 3, radiusY: 0 }), 1),
      ),
    ).toBe(line)
    const upright = picture(`
      .......
      ...1...
      ...1...
      ...1...
      ...1...
      ...1...
      ...1...
      ...1...
      .......
    `)
    expect(
      drawn(7, 9, (s) =>
        outlineShape(s, oval({ x: 3, y: 4, radiusX: 0, radiusY: 3 }), 1),
      ),
    ).toBe(upright)
    expect(
      drawn(7, 9, (s) =>
        fillShape(s, oval({ x: 3, y: 4, radiusX: 0, radiusY: 3 }), 1),
      ),
    ).toBe(upright)
    expect(outlined(oval({ x: 4, y: 4, radiusX: 0, radiusY: 0 }))).toBe(
      outlined(circle({ x: 4, y: 4, radius: 0 })),
    )
  })

  it('draws nothing for a negative radius', () => {
    const blank = drawn(9, 9, () => {})
    expect(outlined(oval({ x: 4, y: 4, radiusX: -1, radiusY: 2 }))).toBe(blank)
    expect(filled(oval({ x: 4, y: 4, radiusX: 2, radiusY: -1 }))).toBe(blank)
  })

  it('matches the circle when the radii are equal', () => {
    for (let r = 0; r <= 8; r++) {
      expect(outlined(oval({ x: 9, y: 9, radiusX: r, radiusY: r }), 19)).toBe(
        outlined(circle({ x: 9, y: 9, radius: r }), 19),
      )
      expect(filled(oval({ x: 9, y: 9, radiusX: r, radiusY: r }), 19)).toBe(
        filled(circle({ x: 9, y: 9, radius: r }), 19),
      )
    }
  })
})

describe('circle and oval invariants', () => {
  const size = 21
  const pairs: [number, number][] = []
  for (let a = 0; a <= 8; a++) pairs.push([a, a], [a, 3], [8 - a, a])

  function check(shape: Shape) {
    const out = outlined(shape, size).split('\n')
    const fill = filled(shape, size).split('\n')
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (out[y]![x] === '1') expect(fill[y]![x]).toBe('2')
        if (fill[y]![x] === '2' && out[y]![x] === '0') {
          // an inside pixel: must sit between outline pixels or fill on its row
          expect(out[y]!.includes('1')).toBe(true)
        }
      }
      const row = fill[y]!
      const first = row.indexOf('2')
      if (first >= 0) {
        expect(row.slice(first, row.lastIndexOf('2') + 1)).not.toContain('0')
      }
    }
  }

  it('keeps every circle outline pixel in its fill, with no gaps', () => {
    for (let r = 0; r <= 8; r++) check(circle({ x: 10, y: 10, radius: r }))
  })

  it('does the same for ovals', () => {
    for (const [rx, ry] of pairs)
      check(oval({ x: 10, y: 10, radiusX: rx, radiusY: ry }))
  })

  it('fills exactly the outline plus the inside', () => {
    for (const [rx, ry] of pairs) {
      const out = outlined(
        oval({ x: 10, y: 10, radiusX: rx, radiusY: ry }),
        size,
      ).split('\n')
      const fill = filled(
        oval({ x: 10, y: 10, radiusX: rx, radiusY: ry }),
        size,
      ).split('\n')
      for (let y = 0; y < size; y++) {
        const row = out[y]!
        const left = row.indexOf('1')
        const right = row.lastIndexOf('1')
        const expected =
          left < 0
            ? '0'.repeat(size)
            : row
                .replaceAll('0', '.')
                .replace(/\.+/g, (m, i) =>
                  i > left && i < right
                    ? '2'.repeat(m.length)
                    : '0'.repeat(m.length),
                )
                .replaceAll('1', '2')
        expect(fill[y]).toBe(expected)
      }
    }
  })
})

describe('drawLine', () => {
  const line = (
    w: number,
    h: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => drawn(w, h, (s) => drawLine(s, x0, y0, x1, y1, 1))

  it('draws horizontal and vertical lines with both ends', () => {
    expect(line(5, 3, 0, 1, 4, 1)).toBe(
      picture(`
      .....
      11111
      .....
    `),
    )
    expect(line(3, 4, 1, 0, 1, 3)).toBe(
      picture(`
      .1.
      .1.
      .1.
      .1.
    `),
    )
  })

  it('draws both diagonals', () => {
    expect(line(6, 6, 0, 0, 5, 5)).toBe(
      picture(`
      1.....
      .1....
      ..1...
      ...1..
      ....1.
      .....1
    `),
    )
    expect(line(6, 6, 5, 0, 0, 5)).toBe(
      picture(`
      .....1
      ....1.
      ...1..
      ..1...
      .1....
      1.....
    `),
    )
  })

  it('draws shallow and steep lines', () => {
    expect(line(10, 5, 0, 0, 9, 3)).toBe(
      picture(`
      11........
      ..111.....
      .....111..
      ........11
      ..........
    `),
    )
    expect(line(5, 8, 1, 0, 3, 7)).toBe(
      picture(`
      .1...
      .1...
      ..1..
      ..1..
      ..1..
      ..1..
      ...1.
      ...1.
    `),
    )
  })

  it('draws the same pixels whichever end comes first', () => {
    const ends = [
      [0, 0, 9, 3],
      [1, 0, 3, 7],
      [9, 1, 0, 5],
      [2, 8, 7, 0],
      [0, 0, 7, 7],
      [3, 3, 3, 3],
      [0, 4, 8, 4],
    ] as const
    for (const [x0, y0, x1, y1] of ends) {
      expect(line(10, 10, x0, y0, x1, y1)).toBe(line(10, 10, x1, y1, x0, y0))
    }
  })

  it('draws a single pixel from a point to itself', () => {
    expect(line(3, 3, 1, 1, 1, 1)).toBe(
      picture(`
      ...
      .1.
      ...
    `),
    )
  })

  it('floors the coordinates first', () => {
    expect(line(5, 3, 0.9, 1.9, 4.5, 1.2)).toBe(line(5, 3, 0, 1, 4, 1))
  })
})

describe('camera, clip and extra fields', () => {
  it('moves and cuts shapes drawn inside withCamera and withClip', () => {
    const s = createScreen(8, 6)
    s.withCamera(-2, -1, () => {
      s.withClip(3, 2, 3, 2, () =>
        fillShape(s, rect({ x: 0, y: 0, width: 8, height: 8 }), 5),
      )
    })
    expect(toPicture(s)).toBe(
      picture(`
      ........
      ........
      ........
      .....555
      .....555
      ........
    `),
    )

    const c = createScreen(8, 6)
    c.withCamera(-2, -1, () =>
      outlineShape(c, circle({ x: 1, y: 1, radius: 1 }), 4),
    )
    expect(toPicture(c)).toBe(
      picture(`
      ........
      ...4....
      ..4.4...
      ...4....
      ........
      ........
    `),
    )
  })

  it('accepts a game object with extra fields', () => {
    const player = { x: 1, y: 1, width: 3, height: 2, hp: 10 }
    const ball = { x: 4, y: 4, radius: 1, color: 'red' }
    const egg = { x: 4, y: 4, radiusX: 1, radiusY: 2, name: 'egg' }
    expect(filled(player)).toBe(
      filled(rect({ x: 1, y: 1, width: 3, height: 2 })),
    )
    expect(outlined(ball)).toBe(outlined(circle({ x: 4, y: 4, radius: 1 })))
    expect(filled(egg)).toBe(
      filled(oval({ x: 4, y: 4, radiusX: 1, radiusY: 2 })),
    )
  })
})
