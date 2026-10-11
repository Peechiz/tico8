import { expect, it } from 'vitest'
import { vec } from './vec.ts'

it('makes plain data', () => {
  expect(vec(3, 4)).toEqual({ x: 3, y: 4 })
  expect(vec()).toEqual({ x: 0, y: 0 })
  expect(JSON.parse(JSON.stringify(vec(1, 2)))).toEqual(vec(1, 2))
})

it('does the maths without changing its arguments', () => {
  const a = vec(3, 4)
  const b = vec(1, 1)
  expect(vec.add(a, b)).toEqual({ x: 4, y: 5 })
  expect(vec.sub(a, b)).toEqual({ x: 2, y: 3 })
  expect(vec.scale(a, 2)).toEqual({ x: 6, y: 8 })
  expect(vec.len(a)).toBe(5)
  expect(vec.distance(a, vec(0, 0))).toBe(5)
  expect(vec.normalize(a)).toEqual({ x: 0.6, y: 0.8 })
  expect(vec.normalize(vec())).toEqual({ x: 0, y: 0 })
  expect(a).toEqual({ x: 3, y: 4 })
  expect(b).toEqual({ x: 1, y: 1 })
})

it('moves in place and keeps the object', () => {
  const player = { x: 1, y: 2, hp: 3 }
  expect(vec.move(player, vec(10, 20))).toBe(player)
  expect(player).toEqual({ x: 11, y: 22, hp: 3 })
})

it('takes anything with x and y', () => {
  const player = { x: 1, y: 2, hp: 3 }
  expect(vec.add(player, vec(1, 1))).toEqual({ x: 2, y: 3 })
})
