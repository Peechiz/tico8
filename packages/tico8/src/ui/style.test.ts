import { describe, expect, it } from 'vitest'
import { PICO8, PICO8_NAMES } from '../palette.ts'
import { baseStyle } from './style.ts'

describe('baseStyle', () => {
  const css = baseStyle(PICO8_NAMES, PICO8)

  it('is wrapped in @layer tico8', () => {
    expect(css.startsWith('@layer tico8 {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  it('sets a variable for every palette name', () => {
    expect(css).toContain('--darkBlue: #1d2b53;')
    for (const [name, index] of Object.entries(PICO8_NAMES)) {
      const [r, g, b] = PICO8[index] as readonly number[]
      const hex = [r, g, b].map((c) =>
        (c as number).toString(16).padStart(2, '0'),
      )
      expect(css).toContain(`--${name}: #${hex.join('')};`)
    }
  })

  it('uses the lightest colour as the text colour', () => {
    expect(css).toMatch(/color: #fff1e8;/)
  })

  it('sets the font, the pointer rules and the highlight', () => {
    expect(css).toContain('font: 6px/6px tico8;')
    expect(css).toContain('pointer-events: none;')
    expect(css).toContain('[data-tico8-ui] :focus {')
    expect(css).toContain('outline: 1px solid currentColor;')
  })

  it('styles the pause menu inside the layer', () => {
    const inLayer = css.slice(css.indexOf('@layer tico8 {'))
    expect(css.indexOf('@layer')).toBe(css.lastIndexOf('@layer'))
    for (const rule of [
      '[data-tico8-ui] .tico8-pause {',
      '[data-tico8-ui] :is(.tico8-pause-menu, .tico8-options, .tico8-controls) {',
      '[data-tico8-ui] .tico8-pause-items {',
      '[data-tico8-ui] .tico8-control {',
    ]) {
      expect(inLayer).toContain(rule)
    }
    expect(css).toContain('inset: 0;')
    expect(css).toContain('rgb(0 0 0 / 50%)')
    // darkest PICO8 colour is black, mid-brightness border is a 1 px line
    expect(css).toMatch(/background: #000000;\n\s+border: 1px solid #/)
  })

  it('works with a custom palette', () => {
    const custom = baseStyle({ ink: 0, sky: 1, paper: 2 }, [
      [0, 0, 0],
      [0, 128, 255],
      [250, 250, 250],
    ])
    expect(custom).toContain('--ink: #000000;')
    expect(custom).toContain('--sky: #0080ff;')
    expect(custom).toContain('--paper: #fafafa;')
    expect(custom).toContain('color: #fafafa;')
    expect(custom).not.toContain('--darkBlue')
  })
})
