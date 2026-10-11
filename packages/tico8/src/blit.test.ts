import { describe, expect, it } from 'vitest'
import { blit } from './blit.ts'
import { createScreen } from './screen.ts'
import { type IndexedImage, TRANSPARENT } from './sprites.ts'
import { picture, toPicture } from './testing.ts'

/** 3x2 image: 123 / 456 */
function image(): IndexedImage {
  return { width: 3, height: 2, pixels: Uint8Array.from([1, 2, 3, 4, 5, 6]) }
}

function draw(
  dx: number,
  dy: number,
  flipX = false,
  flipY = false,
  img = image(),
) {
  const s = createScreen(6, 4)
  blit(s, img, 0, 0, 3, 2, dx, dy, flipX, flipY)
  return toPicture(s)
}

describe('blit', () => {
  it('copies a rectangle', () => {
    expect(draw(1, 1)).toBe(
      picture(`
      ......
      .123..
      .456..
      ......
    `),
    )
  })

  it('copies a sub-rectangle of the image', () => {
    const s = createScreen(4, 2)
    blit(s, image(), 1, 0, 2, 2, 0, 0)
    expect(toPicture(s)).toBe(
      picture(`
      23..
      56..
    `),
    )
  })

  it('floors the position', () => {
    expect(draw(1.9, 1.2)).toBe(draw(1, 1))
    expect(draw(-0.5, 0)).toBe(draw(-1, 0))
  })

  it('skips transparent pixels', () => {
    const img = {
      width: 3,
      height: 2,
      pixels: Uint8Array.from([1, TRANSPARENT, 3, TRANSPARENT, 5, 6]),
    }
    const s = createScreen(3, 2)
    s.clear(9)
    blit(s, img, 0, 0, 3, 2, 0, 0)
    expect(toPicture(s)).toBe(
      picture(`
      193
      956
    `),
    )
  })

  it('flips left to right', () => {
    expect(draw(1, 1, true)).toBe(
      picture(`
      ......
      .321..
      .654..
      ......
    `),
    )
  })

  it('flips top to bottom', () => {
    expect(draw(1, 1, false, true)).toBe(
      picture(`
      ......
      .456..
      .123..
      ......
    `),
    )
  })

  it('flips both ways', () => {
    expect(draw(1, 1, true, true)).toBe(
      picture(`
      ......
      .654..
      .321..
      ......
    `),
    )
  })

  it('cuts at the left edge', () => {
    expect(draw(-1, 1)).toBe(
      picture(`
      ......
      23....
      56....
      ......
    `),
    )
  })

  it('cuts at the right edge without wrapping', () => {
    expect(draw(4, 1)).toBe(
      picture(`
      ......
      ....12
      ....45
      ......
    `),
    )
  })

  it('cuts at the top edge', () => {
    expect(draw(1, -1)).toBe(
      picture(`
      .456..
      ......
      ......
      ......
    `),
    )
  })

  it('cuts at the bottom edge', () => {
    expect(draw(1, 3)).toBe(
      picture(`
      ......
      ......
      ......
      .123..
    `),
    )
  })

  it('cuts a flipped rectangle by what lands on screen', () => {
    expect(draw(-1, 1, true)).toBe(
      picture(`
      ......
      21....
      54....
      ......
    `),
    )
  })

  it('draws nothing when fully off screen', () => {
    const blank = draw(20, 20)
    expect(blank).toBe(draw(-10, -10))
    expect(blank).not.toMatch(/[1-9]/)
  })

  it('treats source outside the image as transparent', () => {
    const s = createScreen(4, 3)
    blit(s, image(), 2, 1, 3, 3, 0, 0)
    expect(toPicture(s)).toBe(
      picture(`
      6...
      ....
      ....
    `),
    )
  })
})
