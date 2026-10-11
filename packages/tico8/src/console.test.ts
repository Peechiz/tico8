import { expect, it, vi } from 'vitest'

// Stands in for a project's `tico8.config.ts`, as the dev tool serves it.
vi.mock('./project.ts', () => ({
  default: { screen: '160x144', rate: 60 },
}))

const { display, palette: shown, settings } = await import('./console.ts')
const { COLOR, SCREEN, clear, palette, text } = await import('./index.ts')
const { toRgba } = await import('./screen.ts')

/** The first pixel of the screen as the player sees it. */
function firstPixel(): number[] {
  const rgba = new Uint8ClampedArray(display.pixels.length * 4)
  toRgba(display, shown, rgba)
  return [...rgba.subarray(0, 4)]
}

it('builds the screen at the size the config asks for', () => {
  expect(SCREEN.width).toBe(160)
  expect(SCREEN.height).toBe(144)
  expect(display.pixels).toHaveLength(160 * 144)
  expect(settings.rate).toBe(60)
})

it("has Pico-8's palette until the game gives its own", () => {
  clear(COLOR.red)
  expect(firstPixel()).toEqual([255, 0, 77, 255])
  clear()
  text('I', { x: 0, y: 0 })
  expect([...display.pixels.subarray(0, 4)]).toEqual([7, 7, 7, 0])
})

it('takes a palette from the game and names its colours', () => {
  const mine = palette({ ink: '#1b1b2f', moss: '#3a5a40', sand: '#e9c46a' })
  expect(mine).toEqual({ ink: 0, moss: 1, sand: 2 })

  clear(mine.moss)
  expect(display.pixels.every((c) => c === 1)).toBe(true)
  expect(firstPixel()).toEqual([58, 90, 64, 255])
  expect(shown).toHaveLength(3)
})

it('draws text in the lightest colour of the palette', () => {
  const mine = palette({ ink: '#1b1b2f', moss: '#3a5a40', sand: '#e9c46a' })
  clear(mine.ink)
  text('I', { x: 0, y: 0 })
  expect([...display.pixels.subarray(0, 4)]).toEqual([2, 2, 2, 0])
})
