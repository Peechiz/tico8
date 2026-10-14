import type { SaveStore } from './types.ts'

/** The project's name, defined by the dev tool's `project` plugin. */
declare const __TICO8_PROJECT__: string | undefined

/** A store that lasts as long as the page. */
export function memoryStore(): SaveStore {
  let text: string | undefined
  return {
    load: () => text,
    store(next) {
      text = next
    },
    remove() {
      text = undefined
    },
  }
}

/** A store kept under `key` in a browser `Storage`. */
export function browserStore(storage: Storage, key: string): SaveStore {
  return {
    load: () => storage.getItem(key) ?? undefined,
    store: (text) => storage.setItem(key, text),
    remove: () => storage.removeItem(key),
  }
}

/**
 * The project's store: `localStorage` under `tico8:<project>:save` in the
 * page, a memory store anywhere else.
 */
export function projectStore(): SaveStore {
  if (typeof __TICO8_PROJECT__ === 'undefined') return memoryStore()
  try {
    if (typeof localStorage === 'undefined') return memoryStore()
    return browserStore(localStorage, `tico8:${__TICO8_PROJECT__}:save`)
  } catch {
    // Reading `localStorage` throws when the browser blocks storage.
    return memoryStore()
  }
}
