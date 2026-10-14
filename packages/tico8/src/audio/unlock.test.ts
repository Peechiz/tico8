import { describe, expect, it, vi } from 'vitest'
import { attachUnlock, UNLOCK_EVENTS } from './unlock.ts'

describe('attachUnlock', () => {
  it.each(UNLOCK_EVENTS)('unlocks once on the first %s', (type) => {
    const target = new EventTarget()
    const unlock = vi.fn()
    attachUnlock(target, unlock)
    target.dispatchEvent(new Event(type))
    target.dispatchEvent(new Event(type))
    for (const other of UNLOCK_EVENTS) target.dispatchEvent(new Event(other))
    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when detached early', () => {
    const target = new EventTarget()
    const unlock = vi.fn()
    const detach = attachUnlock(target, unlock)
    detach()
    for (const type of UNLOCK_EVENTS) target.dispatchEvent(new Event(type))
    expect(unlock).not.toHaveBeenCalled()
  })
})
