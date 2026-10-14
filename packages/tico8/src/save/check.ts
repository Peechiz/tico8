import type { SaveData } from './types.ts'

/**
 * Check a config's `save` setting. Undefined gives an empty save. Throws
 * an `Error` naming the field, by its path, that holds something a save
 * cannot.
 */
export function readSave(written: unknown): SaveData {
  throw new Error(`not built yet: ${typeof written}`)
}
