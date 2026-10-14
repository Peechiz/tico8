import { createMixer } from './audio/mixer.ts'
import type { AudioOut } from './audio/types.ts'
import { createWebAudio } from './audio/web.ts'
import { createClock } from './clock.ts'
import { padOf, resolveConfig } from './config.ts'
import { createPad } from './input/pad.ts'
import { lightest, type Rgb } from './palette.ts'
import project from './project.ts'
import { createScreen } from './screen.ts'

/** The project's config with every choice made. */
export const settings = resolveConfig(project)

// The one console every game draws to, built from the project's config.
export const display = createScreen(settings.width, settings.height)
// A config made by `defineConfig` brings the pad its game already reads.
export const pad = padOf(project) ?? createPad({ actions: settings.actions })

// Game time at the project's update rate. `run` steps and resets it.
export const time = createClock(settings.rate)
export const clock = time.clock

/** An output that plays nothing, for where there is no Web Audio, as in tests. */
function silentAudio(): AudioOut {
  return {
    decode: async () => ({ duration: 0 }),
    start: () => ({ setGain() {}, stop() {} }),
    resume() {},
  }
}

// The one mixer every sound plays through.
export const audioOut: AudioOut =
  typeof AudioContext === 'undefined' ? silentAudio() : createWebAudio()
export const mixer = createMixer(audioOut)

// Every colour the screen can show. The first `colors.size` are the game's
// palette; colours found in imported art are added after them.
export const palette: Rgb[] = [...settings.palette]

/** What is known of the game's palette. */
export const colors = {
  /** How many of `palette`, from the start, are the game's own. */
  size: palette.length,
  /** The colour text is drawn in when given none: the palette's lightest. */
  text: lightest(palette),
}
