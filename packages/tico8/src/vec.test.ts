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

// A wall is every x at or past 10, or every x below 0.
const walls = (at: { x: number; y: number }) => at.x >= 10 || at.x < 0

it('steps until flush against a wall moving right', () => {
  const pos = vec(7.5, 3)
  expect(vec.step(pos, vec(5, 0), walls)).toEqual({ x: true, y: false })
  expect(pos).toEqual({ x: 9, y: 3 })
})

it('steps until flush against a wall moving left', () => {
  const pos = vec(2.75, 3)
  expect(vec.step(pos, vec(-5, 0), walls)).toEqual({ x: true, y: false })
  expect(pos).toEqual({ x: 0, y: 3 })
})

it('keeps its fraction in the open and asks only on crossing a pixel', () => {
  const pos = vec(2, 0)
  const asked: { x: number; y: number }[] = []
  const blocked = (at: { x: number; y: number }) => {
    asked.push(at)
    return false
  }
  for (let i = 0; i < 3; i++) {
    expect(vec.step(pos, vec(0.25, 0), blocked)).toEqual({ x: false, y: false })
  }
  expect(pos).toEqual({ x: 2.75, y: 0 })
  expect(asked).toEqual([])
  vec.step(pos, vec(0.25, 0), blocked)
  expect(pos).toEqual({ x: 3, y: 0 })
  expect(asked).toEqual([{ x: 3, y: 0 }])
})

it('asks nothing when not moving', () => {
  let calls = 0
  const pos = vec(1.5, 1.5)
  vec.step(pos, vec(0, 0), () => {
    calls++
    return true
  })
  expect(calls).toBe(0)
  expect(pos).toEqual({ x: 1.5, y: 1.5 })
})

it('asks with whole pixels of both axes, x then y', () => {
  const asked: { x: number; y: number }[] = []
  const pos = vec(1.5, 2.5)
  vec.step(pos, vec(2, -2), (at) => {
    asked.push(at)
    return false
  })
  expect(asked).toEqual([
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  expect(pos).toEqual({ x: 3.5, y: 0.5 })
})

it('slides along a wall: a hit on x still moves y', () => {
  const pos = vec(8.5, 0.5)
  expect(vec.step(pos, vec(3, 2.25), walls)).toEqual({ x: true, y: false })
  expect(pos).toEqual({ x: 9, y: 2.75 })
})

it('stops on y and reports it', () => {
  const floor = (at: { x: number; y: number }) => at.y >= 20
  const pos = vec(4.5, 17.5)
  expect(vec.step(pos, vec(1, 4), floor)).toEqual({ x: false, y: true })
  expect(pos).toEqual({ x: 5.5, y: 19 })
})

it('stays put when it starts inside a wall', () => {
  let calls = 0
  const pos = vec(12.5, 0)
  const hit = vec.step(pos, vec(3, 0), (at) => {
    calls++
    return walls(at)
  })
  expect(hit).toEqual({ x: true, y: false })
  expect(pos).toEqual({ x: 12, y: 0 })
  expect(calls).toBe(1)
})
