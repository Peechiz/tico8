import { describe, expect, it } from 'vitest'
import { createScreen } from './screen.ts'
import {
  type Animation,
  createSheet,
  type IndexedImage,
  type Sprite,
} from './sprites.ts'
import { picture, toPicture } from './testing.ts'

/** 4x4 image of four 2x2 cells, each one colour (1, 2, 3, 4). */
function image4(): IndexedImage {
  const pixels = [1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4]
  return { width: 4, height: 4, pixels: Uint8Array.from(pixels) }
}

function setup(rate?: number) {
  const screen = createScreen(2, 2)
  const sheet = createSheet(screen, 2, 2, rate)
  sheet.setImage(image4())
  return { screen, sheet, sprite: sheet.sprite() }
}

/** The frames shown by `count` plays in a row. */
function shown(sprite: Sprite, animation: Animation, count: number) {
  const frames: number[] = []
  for (let i = 0; i < count; i++) {
    sprite.play(animation)
    frames.push(sprite.frame)
  }
  return frames
}

describe('play', () => {
  it('shows each frame for the right number of updates at 30', () => {
    const { sprite } = setup(30)
    expect(shown(sprite, { frames: [0, 1, 2], fps: 10 }, 9)).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2,
    ])
  })

  it('looks the same at 60 with the same fps', () => {
    const { sprite } = setup(60)
    expect(shown(sprite, { frames: [0, 1, 2], fps: 10 }, 12)).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
    ])
  })

  it('wraps a loop and maps frames through the list', () => {
    const { sprite } = setup(30)
    expect(shown(sprite, { frames: [3, 1], fps: 15 }, 8)).toEqual([
      3, 3, 1, 1, 3, 3, 1, 1,
    ])
  })

  it('carries on with an equal new object', () => {
    const { sprite } = setup(30)
    sprite.play({ frames: [0, 1], fps: 15 })
    sprite.play({ frames: [0, 1], fps: 15, loop: true })
    sprite.play({ frames: [0, 1], fps: 15, loop: undefined })
    expect(sprite.frame).toBe(1)
  })

  it('starts a different animation from its first frame', () => {
    const { sprite } = setup(30)
    shown(sprite, { frames: [0, 1], fps: 15 }, 3)
    sprite.play({ frames: [2, 3], fps: 15 })
    expect(sprite.frame).toBe(2)
    sprite.play({ frames: [2, 3], fps: 30 })
    expect(sprite.frame).toBe(2)
    sprite.play({ frames: [2, 3], fps: 30, loop: false })
    expect(sprite.frame).toBe(2)
  })

  it('starts over with restart', () => {
    const { sprite } = setup(30)
    const walk = { frames: [0, 1], fps: 15 }
    shown(sprite, walk, 3)
    expect(sprite.frame).toBe(1)
    sprite.play(walk, { restart: true })
    expect(sprite.frame).toBe(0)
    sprite.play(walk)
    sprite.play(walk)
    expect(sprite.frame).toBe(1)
  })

  it('holds a one-shot on its last frame and sets finished', () => {
    const { sprite } = setup(30)
    const attack = { frames: [0, 1, 2], fps: 10, loop: false }
    expect(sprite.finished).toBe(false)
    const seen: [number, boolean][] = []
    for (let i = 0; i < 12; i++) {
      sprite.play(attack)
      seen.push([sprite.frame, sprite.finished])
    }
    expect(seen.map(([f]) => f)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2])
    expect(seen.findIndex(([, done]) => done)).toBe(9)
    expect(seen.slice(9).every(([, done]) => done)).toBe(true)
  })

  it('clears finished when another animation starts or on restart', () => {
    const { sprite } = setup(30)
    const attack = { frames: [0, 1], fps: 30, loop: false }
    shown(sprite, attack, 3)
    expect(sprite.finished).toBe(true)
    sprite.play(attack, { restart: true })
    expect(sprite.finished).toBe(false)
    shown(sprite, attack, 3)
    expect(sprite.finished).toBe(true)
    sprite.play({ frames: [0, 1], fps: 30 })
    expect(sprite.finished).toBe(false)
  })

  it('is never finished for a loop', () => {
    const { sprite } = setup(30)
    shown(sprite, { frames: [0, 1], fps: 30 }, 10)
    expect(sprite.finished).toBe(false)
  })

  it('refuses an animation with no frames', () => {
    const { sprite } = setup()
    expect(() => sprite.play({ frames: [], fps: 8 })).toThrow(
      /at least one frame/,
    )
  })

  it('refuses an fps that is not above 0', () => {
    const { sprite } = setup()
    for (const fps of [0, -1, Number.NaN]) {
      expect(() => sprite.play({ frames: [0], fps })).toThrow(/fps above 0/)
    }
  })

  it('shows the played frame in the pixel buffer', () => {
    const { screen, sprite } = setup(30)
    const anim = { frames: [0, 3], fps: 30 }
    sprite.play(anim)
    sprite.draw()
    expect(toPicture(screen)).toBe(
      picture(`
      11
      11
    `),
    )
    sprite.play(anim)
    sprite.draw()
    expect(toPicture(screen)).toBe(
      picture(`
      44
      44
    `),
    )
  })
})
