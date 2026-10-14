import type { SaveStore } from './types.ts'

/** The project's name, defined by the dev tool's `project` plugin. */
declare const __TICO8_PROJECT__: string | undefined

/** A store that lasts as long as the page. */
export function memoryStore(): SaveStore {
  throw new Error('not built yet')
}

/** A store kept under `key` in a browser `Storage`. */
export function browserStore(storage: Storage, key: string): SaveStore {
  throw new Error(`not built yet: ${typeof storage} ${key}`)
}

/**
 * The project's store: `localStorage` under `tico8:<project>:save` in the
 * page, a memory store anywhere else.
 */
export function projectStore(): SaveStore {
  throw new Error(`not built yet: ${typeof __TICO8_PROJECT__}`)
}
