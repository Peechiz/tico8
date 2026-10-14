import type { AudioOut } from './types.ts'

/** An `AudioOut` over one `AudioContext`. Call only in a browser. */
export function createWebAudio(): AudioOut {
  throw new Error('not built yet')
}
