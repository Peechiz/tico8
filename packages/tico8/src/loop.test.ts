import { describe, expect, it } from 'vitest'
import { createLoop, MAX_CATCH_UP } from './loop.ts'

function counted(rate = 30) {
  const calls = { init: 0, update: 0, draw: 0, onDraw: 0 }
  const game = {
    init: () => void calls.init++,
    update: () => void calls.update++,
    draw: () => void calls.draw++,
  }
  const loop = createLoop(game, { rate, onDraw: () => void calls.onDraw++ })
  return { calls, loop, game }
}

describe('createLoop', () => {
  it('runs init once, then one update and one draw on the first tick', () => {
    const { calls, loop } = counted()
    loop.tick(5)
    expect(calls).toEqual({ init: 1, update: 1, draw: 1, onDraw: 1 })
    loop.tick(500)
    loop.tick(1000)
    expect(calls.init).toBe(1)
  })

  it('keeps the update rate under irregular ticks', () => {
    for (const spacings of [[16], [17, 33, 5, 100], [1], [99, 3]]) {
      const { calls, loop } = counted()
      loop.tick(500)
      let now = 500
      for (let i = 0; now < 10500; i++) {
        now = Math.min(10500, now + spacings[i % spacings.length]!)
        loop.tick(now)
      }
      expect(calls.update).toBe(301)
    }
  })

  it('keeps the update rate when ticks are slow but within the cap', () => {
    const { calls, loop } = counted()
    loop.tick(0)
    for (let t = 100; t <= 10000; t += 100) loop.tick(t)
    expect(calls.update).toBe(301)
  })

  it('skips draws when ticks are far apart', () => {
    const { calls, loop } = counted()
    loop.tick(0)
    for (let t = 100; t <= 10000; t += 100) loop.tick(t)
    expect(calls.draw).toBe(101)
    expect(calls.draw).toBeLessThan(calls.update)
    expect(calls.onDraw).toBe(calls.draw)
  })

  it('does not draw when no update ran', () => {
    const { calls, loop } = counted()
    loop.tick(0)
    loop.tick(10)
    loop.tick(20)
    expect(calls.update).toBe(1)
    expect(calls.draw).toBe(1)
    loop.tick(34)
    expect(calls.update).toBe(2)
    expect(calls.draw).toBe(2)
    expect(calls.onDraw).toBe(2)
  })

  it('runs updates before the draw within a tick', () => {
    const order: string[] = []
    const loop = createLoop(
      { update: () => order.push('u'), draw: () => order.push('d') },
      { rate: 30, onDraw: () => order.push('o') },
    )
    loop.tick(0)
    order.length = 0
    loop.tick(70)
    expect(order).toEqual(['u', 'u', 'd', 'o'])
  })

  it('caps catch-up after a long gap and drops the backlog', () => {
    const { calls, loop } = counted()
    loop.tick(0)
    loop.tick(60_000)
    expect(calls.update).toBe(1 + MAX_CATCH_UP)
    expect(calls.draw).toBe(2)
    // Back to the normal rate afterwards, with no fast-forward.
    loop.tick(60_000 + 34)
    expect(calls.update).toBe(2 + MAX_CATCH_UP)
    loop.tick(60_000 + 40)
    expect(calls.update).toBe(2 + MAX_CATCH_UP)
  })

  it('supports a rate of 60', () => {
    const { calls, loop } = counted(60)
    loop.tick(0)
    for (let t = 20; t <= 1000; t += 20) loop.tick(t)
    expect(calls.update).toBe(61)
  })

  it('treats init, update and draw as optional', () => {
    let drawn = 0
    const loop = createLoop({}, { rate: 30, onDraw: () => void drawn++ })
    loop.tick(0)
    loop.tick(100)
    expect(drawn).toBe(2)
  })

  it('reads update and draw at call time', () => {
    const calls: string[] = []
    const game: { update?: () => void; draw?: () => void } = {}
    const loop = createLoop(game, { rate: 30 })
    loop.tick(0)
    game.update = () => calls.push('u')
    game.draw = () => calls.push('d')
    loop.tick(34)
    expect(calls).toEqual(['u', 'd'])
  })
})

it('calls onUpdate before every update', () => {
  const order: string[] = []
  const loop = createLoop(
    { update: () => order.push('update') },
    { rate: 30, onUpdate: () => order.push('sample') },
  )
  loop.tick(0)
  loop.tick(100)
  expect(order).toEqual([
    'sample',
    'update',
    'sample',
    'update',
    'sample',
    'update',
    'sample',
    'update',
  ])
})
