import { expect, it } from 'vitest'
import { defineConfig } from '../config.ts'
import type { Save, SaveOf } from './types.ts'

/** A save typed as `defineConfig` types it, never run. */
function typed<const C>(_config: C): SaveOf<C> {
  return undefined as unknown as SaveOf<C>
}

it('types a save from its defaults, widened and readonly', () => {
  const check = (save: SaveOf<{ save: { best: 0; name: 'ann' } }>) => {
    const best: number = save.best
    const name: string = save.name
    save.write({ best: 90 })
    save.write({ name: 'bo', best: 1 })
    save.write({})
    save.clear()
    // @ts-expect-error: fields are changed through write
    save.best = 1
    // @ts-expect-error: not a field of this save
    save.write({ bets: 1 })
    // @ts-expect-error: best holds a number
    save.write({ best: 'x' })
    // @ts-expect-error: not a field of this save
    save.level
    return [best, name]
  }
  expect(check).toBeTypeOf('function')
})

it('widens arrays and objects inside, and freezes them', () => {
  const check = () => {
    const save = typed({
      save: { items: [1, 2], opts: { music: true, speed: 2 } },
    })
    const items: readonly number[] = save.items
    const music: boolean = save.opts.music
    // @ts-expect-error: arrays are changed through write
    save.items.push(3)
    // @ts-expect-error: objects are changed through write
    save.opts.music = false
    save.write({ items: [...save.items, 3] })
    save.write({ items: save.items, opts: { ...save.opts, speed: 3 } })
    return [items, music]
  }
  expect(check).toBeTypeOf('function')
})

it('gives a config with no save one with no fields', () => {
  const check = (save: Save<Record<never, never>>) => {
    save.clear()
    // @ts-expect-error: there are no fields
    save.best
  }
  expect(check).toBeTypeOf('function')
})

it('is handed back by defineConfig, typed from the save setting', () => {
  const check = () => {
    const { save } = defineConfig({ save: { best: 0, items: ['a'] } })
    const best: number = save.best
    const items: readonly string[] = save.items
    // @ts-expect-error: not a field of this save
    save.write({ bets: 1 })
    // @ts-expect-error: a save holds plain data
    defineConfig({ save: { when: new Date() } })
    return [best, items]
  }
  expect(check).toBeTypeOf('function')
})
