import type { Plugin } from 'vite'

/** The project folder sounds live in, and the file written beside it. */
export const SOUNDS_DIR = 'sounds'
export const SOUNDS_FILE = 'sounds.ts'

/** The file types a sound can be. */
export const SOUND_TYPES = ['.wav', '.ogg', '.mp3'] as const

export interface SoundFile {
  /** The name game code imports: `bigBoss` for `big-boss.wav`. */
  name: string
  /** The file name inside the sounds folder. */
  file: string
}

/** A file in the sounds folder that was left out, and why. */
export interface SoundProblem {
  file: string
  reason: string
}

/** The text of the generated `sounds.ts`. */
export function renderSounds(files: readonly SoundFile[]): string {
  throw new Error(`not built yet: ${files.length}`)
}

/**
 * The sounds in a project's sounds folder, sorted by name, and the files
 * left out. A folder that is missing counts as empty.
 */
export function scanSounds(root: string): {
  sounds: SoundFile[]
  problems: SoundProblem[]
} {
  throw new Error(`not built yet: ${root}`)
}

/**
 * Bring a project's `sounds.ts` in step with its sounds folder. Written only
 * for a project with a sounds folder, and only when its text would change.
 */
export function writeSounds(root: string): {
  changed: boolean
  problems: SoundProblem[]
} {
  throw new Error(`not built yet: ${root}`)
}

/** Keeps the project's `sounds.ts` in step with its sounds folder. */
export function sounds(): Plugin {
  return { name: 'tico8:sounds' }
}
