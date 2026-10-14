import { describe, expect, it } from 'vitest'
import { controlRows } from './controls.ts'

describe('controlRows', () => {
  it('lists the pad and its keys for a game with no actions', () => {
    expect(controlRows({})).toEqual([
      { label: '←↑→↓', bindings: ['Arrows'] },
      { label: 'Ⓐ', bindings: ['A'] },
      { label: 'Ⓑ', bindings: ['S'] },
      { label: 'Ⓧ', bindings: ['W'] },
      { label: 'Ⓨ', bindings: ['D'] },
    ])
  })

  it('drops default keys an action takes, keeping every pad row', () => {
    const rows = controlRows({
      boost: ['b', 'Space'],
      jump: ['KeyA', 'ArrowUp', 'Digit1', 'MouseLeft', 'Comma', 'ShiftRight'],
      menu: ['Escape'],
    })
    expect(rows).toEqual([
      { label: '←↑→↓', bindings: ['←', '→', '↓'] },
      // A controller still presses Ⓐ, though no key is left to it.
      { label: 'Ⓐ', bindings: [] },
      { label: 'Ⓑ', bindings: ['S'] },
      { label: 'Ⓧ', bindings: ['W'] },
      { label: 'Ⓨ', bindings: ['D'] },
      { label: 'boost', bindings: ['Ⓑ', 'Space'] },
      {
        label: 'jump',
        bindings: ['A', '↑', '1', 'Mouse left', ',', 'Shift'],
      },
      { label: 'menu', bindings: ['Esc'] },
    ])
  })

  it('labels extras and lists no row for pausing', () => {
    const rows = controlRows({ pause: ['start', 'l1'] })
    expect(rows.at(-1)).toEqual({ label: 'pause', bindings: ['Start', 'L1'] })
  })
})
