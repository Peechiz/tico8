import type { Save, SaveData, SaveStore } from './types.ts'

/**
 * Lay a stored save over the defaults: missing fields take their default,
 * fields the defaults lack are dropped, and a field of another kind takes
 * its default. Objects inside are laid over field by field; an array is
 * taken whole. The result shares nothing with either argument.
 */
export function overlay<D extends SaveData>(defaults: D, stored: unknown): D {
  throw new Error(`not built yet: ${typeof defaults} ${typeof stored}`)
}

/**
 * A save with these defaults, kept in the store `store` gives. The store
 * is asked for on first use, not here.
 */
export function createSave<D extends SaveData>(
  defaults: D,
  store: () => SaveStore,
): Save<D> {
  throw new Error(`not built yet: ${typeof defaults} ${typeof store}`)
}
