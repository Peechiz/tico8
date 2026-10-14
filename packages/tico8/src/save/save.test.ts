import { afterEach, expect, it, vi } from 'vitest'
import { createSave, overlay } from './save.ts'
import type { SaveStore } from './types.ts'

function fakeStore(text?: string) {
  const calls = { load: 0, store: 0, remove: 0 }
  const state = { text }
  const store: SaveStore = {
    load() {
      calls.load++
      return state.text
    },
    store(next) {
      calls.store++
      state.text = next
    },
    remove() {
      calls.remove++
      state.text = undefined
    },
  }
  return { store, state, calls }
}

function throwingStore(): SaveStore {
  const fail = () => {
    throw new Error('disk full')
  }
  return { load: fail, store: fail, remove: fail }
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('lays an old shape over the defaults as the layout says', () => {
  const defaults = { best: 0, level: 1, opts: { music: true, speed: 2 } }
  const stored = { best: 90, level: 'x', old: 5, opts: { music: false } }
  expect(overlay(defaults, stored)).toEqual({
    best: 90,
    level: 1,
    opts: { music: false, speed: 2 },
  })
})

it('gives the defaults for a stored value that is not a plain object', () => {
  const defaults = { best: 3 }
  for (const stored of [undefined, null, 5, 'x', true, [1]]) {
    expect(overlay(defaults, stored)).toEqual({ best: 3 })
  }
})

it('tells the kinds apart, so an array is not an object or a number', () => {
  const defaults = { list: [1], opts: { a: 1 }, n: 1, flag: true, name: 'a' }
  const stored = { list: { a: 1 }, opts: [1], n: '1', flag: 0, name: null }
  expect(overlay(defaults, stored)).toEqual(defaults)
})

it('takes an array whole, without checking its items', () => {
  expect(overlay({ list: [1, 2] }, { list: ['a', { b: 1 }] })).toEqual({
    list: ['a', { b: 1 }],
  })
})

it('lets a default of null accept only null', () => {
  expect(overlay({ x: null }, { x: null })).toEqual({ x: null })
  expect(overlay({ x: null }, { x: 4 })).toEqual({ x: null })
})

it('shares nothing with either argument', () => {
  const defaults = { opts: { a: [1] }, list: [{ n: 1 }] }
  const stored = { list: [{ n: 2 }] }
  const out = overlay(defaults, stored)
  expect(out.opts).not.toBe(defaults.opts)
  expect(out.opts.a).not.toBe(defaults.opts.a)
  expect(out.list).not.toBe(stored.list)
  expect(out.list[0]).not.toBe(stored.list[0])
})

it('does not ask for the store when the save is made', () => {
  const store = vi.fn(() => fakeStore().store)
  createSave({ best: 0 }, store)
  expect(store).not.toHaveBeenCalled()
})

it('reads the stored save on the first read of a field, and only once', () => {
  const fake = fakeStore(JSON.stringify({ best: 7 }))
  const factory = vi.fn(() => fake.store)
  const save = createSave({ best: 0, level: 1 }, factory)
  expect(save.best).toBe(7)
  expect(save.level).toBe(1)
  expect(save.best).toBe(7)
  expect(factory).toHaveBeenCalledTimes(1)
  expect(fake.calls.load).toBe(1)
})

it('asks for the store on the first write or clear', () => {
  const a = vi.fn(() => fakeStore().store)
  createSave({ best: 0 }, a).write({ best: 1 })
  expect(a).toHaveBeenCalledTimes(1)
  const b = vi.fn(() => fakeStore().store)
  createSave({ best: 0 }, b).clear()
  expect(b).toHaveBeenCalledTimes(1)
})

it('has its fields as readable getters beside write and clear', () => {
  const save = createSave({ best: 0 }, () => fakeStore().store)
  expect(Object.keys(save)).toEqual(['best'])
  expect(typeof save.write).toBe('function')
  expect(typeof save.clear).toBe('function')
})

it('merges the fields given, skips undefined, and stores the whole save as JSON', () => {
  const fake = fakeStore(JSON.stringify({ best: 5, level: 2 }))
  const save = createSave({ best: 0, level: 1, name: 'a' }, () => fake.store)
  save.write({ best: 9, name: undefined })
  expect(save.best).toBe(9)
  expect(save.level).toBe(2)
  expect(save.name).toBe('a')
  expect(JSON.parse(fake.state.text!)).toEqual({ best: 9, level: 2, name: 'a' })
})

it('reads back what another save wrote through the same store', () => {
  const fake = fakeStore()
  createSave({ best: 0 }, () => fake.store).write({ best: 12 })
  expect(createSave({ best: 0 }, () => fake.store).best).toBe(12)
})

it('copies what is written, so a later change by the game is not in the save', () => {
  const list = [1, 2]
  const save = createSave({ list: [0] }, () => fakeStore().store)
  save.write({ list })
  list.push(3)
  expect(save.list).toEqual([1, 2])
})

it('hands out values a game cannot change in place', () => {
  const save = createSave(
    { opts: { a: 1 }, list: [1] },
    () => fakeStore().store,
  )
  expect(() => {
    ;(save.opts as { a: number }).a = 2
  }).toThrow()
  expect(() => {
    ;(save.list as number[]).push(2)
  }).toThrow()
  expect(save.opts.a).toBe(1)
})

it('does not let the defaults be changed through the save', () => {
  const defaults = { opts: { a: 1 } }
  const save = createSave(defaults, () => fakeStore().store)
  expect(save.opts).not.toBe(defaults.opts)
  expect(Object.isFrozen(defaults.opts)).toBe(false)
})

it('goes back to the defaults and removes the stored save on clear', () => {
  const fake = fakeStore(JSON.stringify({ best: 5 }))
  const save = createSave({ best: 0 }, () => fake.store)
  expect(save.best).toBe(5)
  save.clear()
  expect(save.best).toBe(0)
  expect(fake.calls.remove).toBe(1)
  expect(fake.state.text).toBeUndefined()
})

it('gives the defaults for stored text that is not JSON, with a warning', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const save = createSave({ best: 4 }, () => fakeStore('{nope').store)
  expect(save.best).toBe(4)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(String(warn.mock.calls[0]![0])).toMatch(/^tico8: /)
})

it('carries on in memory when the store throws, warning once', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const save = createSave({ best: 0 }, throwingStore)
  expect(save.best).toBe(0)
  save.write({ best: 3 })
  expect(save.best).toBe(3)
  save.write({ best: 4 })
  save.clear()
  expect(save.best).toBe(0)
  expect(warn).toHaveBeenCalledTimes(1)
  const message = String(warn.mock.calls[0]![0])
  expect(message).toMatch(/^tico8: /)
  expect(message).toContain('disk full')
})

it('carries on in memory when only storing throws', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fake = fakeStore()
  const store: SaveStore = {
    ...fake.store,
    store() {
      throw new Error('quota')
    },
  }
  const save = createSave({ best: 0 }, () => store)
  save.write({ best: 8 })
  expect(save.best).toBe(8)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(String(warn.mock.calls[0]![0])).toContain('quota')
})
