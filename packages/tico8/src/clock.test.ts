import { describe, expect, it } from 'vitest'
import { createClock } from './clock.ts'

describe('createClock', () => {
  it('starts at 0', () => {
    const { clock } = createClock(30)
    expect(clock.ticks).toBe(0)
    expect(clock.seconds).toBe(0)
  })

  it('counts ticks and seconds at 30 updates a second', () => {
    const { clock, step } = createClock(30)
    for (let i = 0; i < 45; i++) step()
    expect(clock.ticks).toBe(45)
    expect(clock.seconds).toBe(1.5)
  })

  it('counts ticks and seconds at 60 updates a second', () => {
    const { clock, step } = createClock(60)
    for (let i = 0; i < 45; i++) step()
    expect(clock.ticks).toBe(45)
    expect(clock.seconds).toBe(0.75)
  })

  it('puts both back to 0 on reset', () => {
    const { clock, step, reset } = createClock(30)
    for (let i = 0; i < 10; i++) step()
    reset()
    expect(clock.ticks).toBe(0)
    expect(clock.seconds).toBe(0)
    step()
    expect(clock.ticks).toBe(1)
  })

  it('ignores a game assigning to it', () => {
    const { clock, step } = createClock(30)
    step()
    const loose = clock as { ticks: number; seconds: number }
    try {
      loose.ticks = 99
      loose.seconds = 99
    } catch {
      // Strict mode may throw; either way the value must not change.
    }
    expect(clock.ticks).toBe(1)
    expect(clock.seconds).toBe(1 / 30)
  })
})
