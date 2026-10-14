import type { Pixels } from './types.ts'

/** The bytes of an 8-bit RGBA PNG holding these pixels exactly. */
export async function encodePng(_pixels: Pixels): Promise<Uint8Array> {
  throw new Error('not yet')
}
