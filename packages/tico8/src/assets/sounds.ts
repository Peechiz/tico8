import type { AudioOut, LoadableSound, Mixer, Sound } from '../audio/types.ts'
import { audioOut, mixer } from '../console.ts'
import type { SoundChanged } from './event.ts'
import { SOUND_CHANGED } from './event.ts'

/**
 * How long to wait before the second try at a file that would not load. The
 * same as the sheets' delay.
 */
const RETRY_DELAY = 100

export interface SoundsOptions {
  mixer: Mixer
  /** Turn a file's bytes into a clip: the mixer's output's `decode`. */
  decode: AudioOut['decode']
  /** Fetch the file at an address as bytes. */
  load(url: string): Promise<ArrayBuffer>
  /** Milliseconds before the second try. Defaults to `RETRY_DELAY`. */
  retryDelay?: number
}

export interface Sounds {
  /**
   * The sound for a file, at once, its clip set when the file has loaded.
   * The same address always gives the same sound.
   */
  sound(url: string): Sound
  /** Settles when every sound asked for so far has loaded. Never rejects. */
  ready(): Promise<void>
  /** Fetch a changed file past the cache and swap it in. Never rejects. */
  reload(url: string): Promise<void>
}

/** The same file under an address the browser has not fetched before. */
function bust(url: string): string {
  return `${url}?t=${Date.now()}`
}

function reportFailure(url: string, error: unknown, kept: boolean): void {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.replace(/\.$/, '')
  console.warn(
    `tico8: ${url} was not loaded: ${reason}. ` +
      (kept ? 'The old sound stays.' : 'The sound plays nothing.'),
  )
}

/** The sounds of one console, by address. `load` is passed in for tests. */
export function createSounds(options: SoundsOptions): Sounds {
  const { mixer, decode, load, retryDelay = RETRY_DELAY } = options

  interface Entry {
    sound: LoadableSound
    /** Counts loads started. A load that is no longer the last gives up. */
    turn: number
    loaded: boolean
  }

  const registry = new Map<string, Entry>()
  const loading = new Set<Promise<void>>()

  /**
   * Load `url` into its sound. `fresh` asks past the browser's cache. Never
   * rejects, and leaves the sound as it was if the file is bad or a newer
   * load has started since.
   */
  async function fill(url: string, entry: Entry, fresh: boolean) {
    const turn = ++entry.turn
    const stale = () => turn !== entry.turn
    try {
      let bytes: ArrayBuffer
      try {
        bytes = await load(fresh ? bust(url) : url)
      } catch {
        if (stale()) return
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        if (stale()) return
        bytes = await load(bust(url))
      }
      if (stale()) return
      const clip = await decode(bytes)
      if (stale()) return
      entry.sound.setClip(clip)
      entry.loaded = true
    } catch (error) {
      if (!stale()) reportFailure(url, error, entry.loaded)
    }
  }

  function track(job: Promise<void>): Promise<void> {
    loading.add(job)
    job.then(() => loading.delete(job))
    return job
  }

  return {
    sound(url) {
      // Asked for again when the generated file is re-run: the sound is
      // the same one, already loaded or loading, so nothing is fetched.
      const known = registry.get(url)
      if (known) return known.sound
      const entry: Entry = { sound: mixer.sound(), turn: 0, loaded: false }
      registry.set(url, entry)
      track(fill(url, entry, false))
      return entry.sound
    },

    async ready() {
      await Promise.all(loading)
    },

    async reload(url) {
      const entry = registry.get(url)
      if (entry) await track(fill(url, entry, true))
    },
  }
}

/**
 * A sound played through the console's mixer, loaded from `url`. Called by
 * the generated `sounds.ts`, not by game code.
 */
export function sound(url: string): Sound {
  return sounds.sound(url)
}

/** Settles when every sound asked for so far has loaded. Never rejects. */
export function soundsReady(): Promise<void> {
  return sounds.ready()
}

/** A file's bytes, or a rejection naming why it could not be had. */
async function loadBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`the server said ${response.status}`)
  return response.arrayBuffer()
}

const sounds = createSounds({
  mixer,
  decode: (bytes) => audioOut.decode(bytes),
  load: loadBytes,
})

// Listen here and not in the game's entry: the entry runs again on every
// code change, this module only once per page.
if (import.meta.hot) {
  import.meta.hot.on(SOUND_CHANGED, ({ url }: SoundChanged) => {
    sounds.reload(url)
  })
}
