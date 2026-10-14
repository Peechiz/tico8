import type { AudioOut, Mixer, Sound } from '../audio/types.ts'

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

/** The sounds of one console, by address. `load` is passed in for tests. */
export function createSounds(options: SoundsOptions): Sounds {
  throw new Error(`not built yet: ${typeof options}`)
}

/**
 * A sound played through the console's mixer, loaded from `url`. Called by
 * the generated `sounds.ts`, not by game code.
 */
export function sound(url: string): Sound {
  throw new Error(`not built yet: ${url}`)
}

/** Settles when every sound asked for so far has loaded. Never rejects. */
export function soundsReady(): Promise<void> {
  return Promise.resolve()
}
