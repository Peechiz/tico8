import type { FlagData } from './types.ts'
import { NAME, RESERVED_FLAGS } from './types.ts'

/**
 * Read a flags file's JSON, already parsed, into a set of frames for each
 * flag. Throws an `Error` whose message says what is wrong, ending without
 * a full stop, for anything that is not a flags file: see `FlagsFile`.
 */
export function parseFlags(file: unknown): FlagData {
  if (typeof file !== 'object' || file === null || Array.isArray(file)) {
    throw new Error(
      'a flags file must be an object of flag names to tile lists',
    )
  }
  const flags: { [flag: string]: ReadonlySet<number> } = {}
  for (const [flag, tiles] of Object.entries(file)) {
    if (RESERVED_FLAGS.includes(flag)) {
      throw new Error(
        `flag "${flag}" is a name a tile has of its own: ${RESERVED_FLAGS.join(', ')} are taken`,
      )
    }
    if (!NAME.test(flag)) {
      throw new Error(
        `flag "${flag}" must be letters and digits, starting with a letter`,
      )
    }
    if (!Array.isArray(tiles)) {
      throw new Error(`flag "${flag}" must be a list of tile numbers`)
    }
    const frames = new Set<number>()
    for (const tile of tiles) {
      if (!Number.isInteger(tile) || tile < 0) {
        throw new Error(
          `flag "${flag}" lists ${JSON.stringify(tile)}, which is not a whole number from 0`,
        )
      }
      frames.add(tile)
    }
    flags[flag] = frames
  }
  return flags
}
