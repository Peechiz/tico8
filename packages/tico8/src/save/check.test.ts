import { expect, it } from 'vitest'
import { readSave } from './check.ts'

const refused = (written: unknown): string => {
  try {
    readSave(written)
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    return (error as Error).message
  }
  throw new Error('expected readSave to throw')
}

it('gives an empty save for undefined', () => {
  expect(readSave(undefined)).toEqual({})
})

it('passes a nested plain save through as itself', () => {
  const save = {
    best: 0,
    name: 'ann',
    on: true,
    none: null,
    opts: { speed: 2, keys: ['a', { b: [1, 2] }] },
    items: [1, 'two', [3]],
    bare: Object.assign(Object.create(null), { x: 1 }),
  }
  expect(readSave(save)).toBe(save)
})

it('refuses a save that is not an object', () => {
  for (const bad of [5, 'x', null, [1], () => 0]) {
    expect(refused(bad)).toMatch(
      /^save must be an object of fields, such as \{ best: 0 \}, got /,
    )
  }
  expect(refused('x')).toContain("got 'x'")
  expect(refused(new Date())).toContain('got a Date instance')
})

it('refuses a function and names its path', () => {
  expect(refused({ opts: { speed: () => 1 } })).toBe(
    'save.opts.speed holds a function: a save holds only plain data',
  )
})

it('refuses undefined, NaN and Infinity', () => {
  expect(refused({ a: undefined })).toContain('save.a holds undefined')
  expect(refused({ a: NaN })).toContain('save.a holds NaN')
  expect(refused({ a: [0, Infinity] })).toContain('save.a[1] holds Infinity')
  expect(refused({ a: -Infinity })).toContain('save.a holds -Infinity')
})

it('refuses a class instance and names the class', () => {
  expect(refused({ when: new Date() })).toContain(
    'save.when holds a Date instance',
  )
  class Hero {}
  expect(refused({ items: [1, 2, new Hero()] })).toContain(
    'save.items[2] holds a Hero instance',
  )
  expect(refused({ m: new Map() })).toContain('save.m holds a Map instance')
})

it('refuses a symbol and a bigint', () => {
  expect(refused({ a: Symbol('s') })).toContain('save.a holds a symbol')
  expect(refused({ a: { b: 10n } })).toContain('save.a.b holds a bigint')
})

it('refuses write and clear at the top level only', () => {
  expect(refused({ write: 1 })).toBe(
    'a save cannot have a field called "write": save.write is already taken',
  )
  expect(refused({ best: 0, clear: 1 })).toContain(
    'save.clear is already taken',
  )
  expect(() => readSave({ opts: { write: 1, clear: 2 } })).not.toThrow()
})

it('refuses a loop', () => {
  const loop: Record<string, unknown> = {}
  loop.me = loop
  expect(refused(loop)).toContain('save.me holds itself')
})
