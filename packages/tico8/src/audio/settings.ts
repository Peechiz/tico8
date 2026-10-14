import { browserStore, memoryStore } from '../save/storage.ts'
import type { SaveStore } from '../save/types.ts'
import type { RememberedSound, SoundSettings } from './types.ts'

/** The project's name, defined by the dev tool's `project` plugin. */
declare const __TICO8_PROJECT__: string | undefined

/** Full volume, sound on: how a game sounds until the player says. */
export const DEFAULT_SOUND: Readonly<SoundSettings> = {
  volume: 1,
  sound: true,
}

/** `localStorage` under `tico8:<project>:sound`, memory anywhere else. */
function projectSoundStore(): SaveStore {
  if (typeof __TICO8_PROJECT__ === 'undefined') return memoryStore()
  try {
    if (typeof localStorage === 'undefined') return memoryStore()
    return browserStore(localStorage, `tico8:${__TICO8_PROJECT__}:sound`)
  } catch {
    // Reading `localStorage` throws when the browser blocks storage.
    return memoryStore()
  }
}

/** What was read from storage, or nothing when it was not JSON. */
function read(store: SaveStore): unknown {
  try {
    const text = store.load()
    return text === undefined ? undefined : JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * The pause menu's sound settings kept in `store`, by default the project's
 * own in the browser, apart from its save.
 */
export function rememberSound(store?: SaveStore): RememberedSound {
  const kept = store ?? projectSoundStore()
  return {
    load() {
      const stored = Object(read(kept)) as Partial<Record<string, unknown>>
      const { volume, sound } = stored
      return {
        volume:
          typeof volume === 'number' && volume >= 0 && volume <= 1
            ? volume
            : DEFAULT_SOUND.volume,
        sound: typeof sound === 'boolean' ? sound : DEFAULT_SOUND.sound,
      }
    },
    store(settings) {
      try {
        kept.store(JSON.stringify(settings))
      } catch {
        // Storage that is full or blocked loses the settings, not the game.
      }
    },
  }
}
