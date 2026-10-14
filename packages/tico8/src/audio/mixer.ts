import type { AudioOut, Mixer } from './types.ts'

/** A console's sounds, played through `out`. Locked until `unlock`. */
export function createMixer(out: AudioOut): Mixer {
  throw new Error(`not built yet: ${typeof out}`)
}
