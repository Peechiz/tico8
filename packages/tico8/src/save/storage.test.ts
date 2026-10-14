import { afterEach, expect, it, vi } from 'vitest'
import { browserStore, memoryStore, projectStore } from './storage.ts'

/** A `Storage` that keeps its items in a map. */
function fakeStorage(): Storage & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  } as unknown as Storage & { items: Map<string, string> }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('a memory store has nothing until something is stored', () => {
  const store = memoryStore()
  expect(store.load()).toBeUndefined()
  store.store('a')
  expect(store.load()).toBe('a')
  store.store('b')
  expect(store.load()).toBe('b')
  store.remove()
  expect(store.load()).toBeUndefined()
})

it('a browser store keeps its text under its key', () => {
  const storage = fakeStorage()
  const store = browserStore(storage, 'k')
  expect(store.load()).toBeUndefined()
  store.store('text')
  expect(storage.items.get('k')).toBe('text')
  expect(store.load()).toBe('text')
  store.remove()
  expect(storage.items.has('k')).toBe(false)
  expect(store.load()).toBeUndefined()
})

it('a browser store lets the storage fail', () => {
  const storage = fakeStorage()
  storage.setItem = () => {
    throw new Error('full')
  }
  expect(() => browserStore(storage, 'k').store('x')).toThrow('full')
})

it('the project store is a memory store outside a page', () => {
  const store = projectStore()
  store.store('a')
  expect(store.load()).toBe('a')
  expect(projectStore().load()).toBeUndefined()
})

it('the project store uses localStorage under the project name', () => {
  const storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('__TICO8_PROJECT__', 'game')
  projectStore().store('saved')
  expect(storage.items.get('tico8:game:save')).toBe('saved')
})

it('the project store is a memory store without a project name', () => {
  const storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
  projectStore().store('saved')
  expect(storage.items.size).toBe(0)
})

it('the project store falls back to memory when storage is blocked', () => {
  vi.stubGlobal('__TICO8_PROJECT__', 'game')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked')
    },
  })
  try {
    const store = projectStore()
    store.store('a')
    expect(store.load()).toBe('a')
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
