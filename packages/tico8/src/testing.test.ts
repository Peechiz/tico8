import { expect, it } from 'vitest'
import { createScreen } from './screen.ts'
import { picture, toPicture } from './testing.ts'

it('toPicture writes one hex digit per pixel', () => {
  const s = createScreen(3, 2)
  s.pixel(0, 0, 10)
  s.pixel(2, 1, 15)
  expect(toPicture(s)).toBe('a00\n00f')
})

it('picture drops indentation and the outer blank lines', () => {
  expect(
    picture(`
    a.1
    .f.
  `),
  ).toBe('a01\n0f0')
})
