import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConfigError, defineConfig, resolveConfig } from './config.ts'

/** A browser `Storage` held in a map, shared by every save made below. */
function fakeStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key)
    },
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

let storage: Storage

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('__TICO8_PROJECT__', 'stars')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('keeps what one page wrote for the next to read', () => {
  const first = defineConfig({ save: { best: 0, name: 'ann' } })
  expect(first.save.best).toBe(0)
  first.save.write({ best: 90 })
  expect(first.save.best).toBe(90)
  expect(JSON.parse(storage.getItem('tico8:stars:save') ?? '')).toEqual({
    best: 90,
    name: 'ann',
  })

  // A reload runs the config again, over the same storage.
  const second = defineConfig({ save: { best: 0, name: 'ann', level: 1 } })
  expect(second.save.best).toBe(90)
  expect(second.save.level).toBe(1)

  second.save.clear()
  expect(second.save.best).toBe(0)
  expect(storage.getItem('tico8:stars:save')).toBeNull()
})

it('keeps each project apart', () => {
  defineConfig({ save: { best: 0 } }).save.write({ best: 5 })
  vi.stubGlobal('__TICO8_PROJECT__', 'maze')
  expect(defineConfig({ save: { best: 0 } }).save.best).toBe(0)
})

it('checks the save setting as written, not the save handed back', () => {
  const config = defineConfig({ screen: '160x144', save: { best: 0 } })
  expect(resolveConfig(config).save).toEqual({ best: 0 })
  expect(() =>
    resolveConfig({ save: { when: new Date() } } as never),
  ).toThrowError(ConfigError)
  expect(() => resolveConfig({ save: { write: 1 } })).toThrowError(
    /save\.write is already taken/,
  )
})

it('gives a config with no save one with no fields', () => {
  const { save } = defineConfig({})
  save.write({})
  save.clear()
  expect(Object.keys(save)).toEqual([])
})
