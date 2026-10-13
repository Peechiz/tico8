import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags.ts'

describe('parseFlags', () => {
  it('reads each flag into a set of frames, in the file order', () => {
    const flags = parseFlags({ solid: [4, 5, 6, 12], ladder: [7], spawn: [] })
    expect(Object.keys(flags)).toEqual(['solid', 'ladder', 'spawn'])
    expect(flags.solid).toEqual(new Set([4, 5, 6, 12]))
    expect(flags.ladder).toEqual(new Set([7]))
    expect(flags.spawn).toEqual(new Set())
  })

  it('accepts an empty file', () => {
    expect(parseFlags({})).toEqual({})
  })

  it('lets a tile be listed twice', () => {
    expect(parseFlags({ solid: [3, 3, 0] }).solid).toEqual(new Set([3, 0]))
  })

  it('refuses a file that is not an object', () => {
    for (const bad of [[], null, 'solid', 4, undefined]) {
      expect(() => parseFlags(bad)).toThrow(/must be an object/)
    }
  })

  it('refuses a name that a tile has of its own, and says which are taken', () => {
    expect(() => parseFlags({ frame: [1] })).toThrow(
      'flag "frame" is a name a tile has of its own: frame, x, y, column, row are taken',
    )
  })

  it('refuses a name that is not letters and digits', () => {
    for (const name of ['', '1up', 'is-solid', 'a b']) {
      expect(() => parseFlags({ [name]: [1] })).toThrow(
        `flag "${name}" must be letters and digits, starting with a letter`,
      )
    }
  })

  it('refuses a flag that is not a list', () => {
    expect(() => parseFlags({ solid: 4 })).toThrow(
      'flag "solid" must be a list of tile numbers',
    )
  })

  it('refuses a tile that is not a whole number from 0', () => {
    for (const bad of [-1, 1.5, '4', null, Number.NaN]) {
      expect(() => parseFlags({ solid: [2, bad] })).toThrow(
        /flag "solid" lists .*, which is not a whole number from 0$/,
      )
    }
  })
})
