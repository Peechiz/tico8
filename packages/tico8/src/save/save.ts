import type { Save, SaveData, SaveStore } from './types.ts'

type Kind = 'number' | 'string' | 'boolean' | 'null' | 'array' | 'object'

function kindOf(value: unknown): Kind | undefined {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    case 'boolean':
      return 'boolean'
    case 'object':
      return 'object'
    default:
      return undefined
  }
}

function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copy) as T
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = copy(item)
    return out as T
  }
  return value
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item)
    Object.freeze(value)
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return kindOf(value) === 'object'
}

/**
 * Lay a stored save over the defaults: missing fields take their default,
 * fields the defaults lack are dropped, and a field of another kind takes
 * its default. Objects inside are laid over field by field; an array is
 * taken whole. The result shares nothing with either argument.
 */
export function overlay<D extends SaveData>(defaults: D, stored: unknown): D {
  const from = isPlainObject(stored) ? stored : {}
  const out: Record<string, unknown> = {}
  for (const [field, fallback] of Object.entries(defaults)) {
    const value = Object.hasOwn(from, field) ? from[field] : undefined
    const kind = kindOf(fallback)
    if (value === undefined || kindOf(value) !== kind) {
      out[field] = copy(fallback)
    } else if (kind === 'object') {
      out[field] = overlay(fallback as SaveData, value)
    } else {
      out[field] = copy(value)
    }
  }
  return out as D
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * A save with these defaults, kept in the store `store` gives. The store
 * is asked for on first use, not here.
 */
export function createSave<D extends SaveData>(
  defaults: D,
  store: () => SaveStore,
): Save<D> {
  let backing: SaveStore | undefined
  let fields: Record<string, unknown> | undefined
  let warned = false

  function fail(what: string, error: unknown): void {
    if (warned) return
    warned = true
    console.warn(
      `tico8: the save could not be ${what}: ${reason(error)}. It lasts until the page closes.`,
    )
  }

  // The store, asked for once. A store that cannot be made fails like any other.
  function open(): SaveStore | undefined {
    if (backing) return backing
    try {
      backing = store()
    } catch (error) {
      fail('opened', error)
      backing = {
        load: () => undefined,
        store: () => {},
        remove: () => {},
      }
    }
    return backing
  }

  function current(): Record<string, unknown> {
    if (fields) return fields
    let stored: unknown
    try {
      const text = open()!.load()
      if (text !== undefined) {
        try {
          stored = JSON.parse(text)
        } catch (error) {
          console.warn(
            `tico8: the stored save is not JSON, so the defaults are used: ${reason(error)}`,
          )
        }
      }
    } catch (error) {
      fail('read', error)
    }
    fields = freeze(overlay(defaults, stored))
    return fields
  }

  const save = {} as Record<string, unknown>
  for (const field of Object.keys(defaults)) {
    Object.defineProperty(save, field, {
      enumerable: true,
      get: () => current()[field],
    })
  }
  Object.defineProperty(save, 'write', {
    value(changes: Record<string, unknown>) {
      const next = { ...current() }
      for (const [field, value] of Object.entries(changes)) {
        if (value !== undefined) next[field] = copy(value)
      }
      fields = freeze(next)
      try {
        open()!.store(JSON.stringify(fields))
      } catch (error) {
        fail('stored', error)
      }
    },
  })
  Object.defineProperty(save, 'clear', {
    value() {
      const backing = open()!
      fields = freeze(copy(defaults) as Record<string, unknown>)
      try {
        backing.remove()
      } catch (error) {
        fail('cleared', error)
      }
    },
  })
  return save as Save<D>
}
