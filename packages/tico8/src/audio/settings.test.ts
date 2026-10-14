import { describe, expect, it } from 'vitest'
import { memoryStore } from '../save/storage.ts'
import type { SaveStore } from '../save/types.ts'
import { DEFAULT_SOUND, rememberSound } from './settings.ts'

function holding(text: string): SaveStore {
  const store = memoryStore()
  store.store(text)
  return store
}

describe('rememberSound', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(rememberSound(memoryStore()).load()).toEqual(DEFAULT_SOUND)
  })

  it('gives back what was stored', () => {
    const sound = rememberSound(memoryStore())
    sound.store({ volume: 0.4, sound: false })
    expect(sound.load()).toEqual({ volume: 0.4, sound: false })
    sound.store({ volume: 0, sound: true })
    expect(sound.load()).toEqual({ volume: 0, sound: true })
  })

  it('takes the default for each setting that is missing or bad', () => {
    expect(rememberSound(holding('{"volume":2,"sound":"no"}')).load()).toEqual({
      volume: 1,
      sound: true,
    })
    expect(rememberSound(holding('{"volume":0.3}')).load()).toEqual({
      ...DEFAULT_SOUND,
      volume: 0.3,
    })
    for (const text of ['nope', 'null', '0.5', '[]']) {
      expect(rememberSound(holding(text)).load(), text).toEqual(DEFAULT_SOUND)
    }
  })

  it('gives the defaults when the store throws on reading', () => {
    const store: SaveStore = {
      load() {
        throw new Error('blocked')
      },
      store() {},
      remove() {},
    }
    expect(rememberSound(store).load()).toEqual(DEFAULT_SOUND)
  })

  it('does not throw when the store throws on writing', () => {
    const store: SaveStore = {
      load: () => undefined,
      store() {
        throw new Error('full')
      },
      remove() {},
    }
    expect(() => rememberSound(store).store(DEFAULT_SOUND)).not.toThrow()
  })
})
