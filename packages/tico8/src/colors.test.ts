import { expect, it, vi } from 'vitest'

// Stands in for a project's `tico8.config.ts`, as the dev tool serves it.
vi.mock('./project.ts', async () => {
  const { defineConfig } = await import('./config.ts')
  return {
    default: defineConfig({
      palette: { ink: '#1b1b2f', moss: '#3a5a40', sand: '#e9c46a' },
    }),
  }
})

const { default: project } = await import('./project.ts')
const { display, palette: shown } = await import('./console.ts')
const { clear, text } = await import('./index.ts')
const { toRgba } = await import('./screen.ts')

// What the project's config file exports for its game to import.
const { COLOR } = project as unknown as {
  COLOR: Record<'ink' | 'moss' | 'sand', number>
}

/** The first pixel of the screen as the player sees it. */
function firstPixel(): number[] {
  const rgba = new Uint8ClampedArray(display.pixels.length * 4)
  toRgba(display, shown, rgba)
  return [...rgba.subarray(0, 4)]
}

it('takes its palette from the config and names its colours', () => {
  expect(COLOR).toEqual({ ink: 0, moss: 1, sand: 2 })

  clear(COLOR.moss)
  expect(display.pixels.every((c) => c === 1)).toBe(true)
  expect(firstPixel()).toEqual([58, 90, 64, 255])
  expect(shown).toHaveLength(3)
})

it('draws text in the lightest colour of the palette', () => {
  clear(COLOR.ink)
  text('I', { x: 0, y: 0 })
  expect([...display.pixels.subarray(0, 4)]).toEqual([2, 2, 2, 0])
})
