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

  it('waits past Escape, which the browser does not let sound through for', () => {
    const target = new EventTarget()
    const unlock = vi.fn()
    attachUnlock(target, unlock)
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))
    expect(unlock).not.toHaveBeenCalled()
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }))
    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('waits for a press the browser counts as the user acting', () => {
    const activation = { isActive: false }
    vi.stubGlobal('navigator', { userActivation: activation })
    const target = new EventTarget()
    const unlock = vi.fn()
    attachUnlock(target, unlock)
    target.dispatchEvent(new Event('keydown'))
    expect(unlock).not.toHaveBeenCalled()
    activation.isActive = true
    target.dispatchEvent(new Event('keydown'))
    expect(unlock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
