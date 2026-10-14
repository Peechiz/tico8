import { expect, it } from 'vitest'
import { createSounds } from './assets/sounds.ts'
import { createMixer } from './audio/mixer.ts'
import type { AudioOut, Clip } from './audio/types.ts'
import type { Game } from './loop.ts'
import { createLoop } from './loop.ts'

/** An output that keeps every copy it starts, and whether it was stopped. */
function fakeOut() {
  const voices: { clip: Clip; loop: boolean; stopped: boolean }[] = []
  const out: AudioOut = {
    decode: async (bytes) => ({ duration: bytes.byteLength }),
    start(clip, { loop }) {
      const voice = { clip, loop, stopped: false }
      voices.push(voice)
      return {
        setGain() {},
        stop() {
          voice.stopped = true
        },
      }
    },
    resume() {},
  }
  const sounding = () => voices.filter((voice) => !voice.stopped)
  return { out, voices, sounding }
}

/** Start a game the way `run` does: restart marks, settle after one update. */
function run(mixer: ReturnType<typeof createMixer>, game: Game) {
  mixer.restarting()
  let settled = false
  const loop = createLoop(game, {
    rate: 30,
    afterUpdate() {
      if (!settled) {
        settled = true
        mixer.settle()
      }
    },
  })
  loop.tick(0)
  return loop
}

it('carries a loop the new game plays again across a code restart', async () => {
  const { out, voices, sounding } = fakeOut()
  const mixer = createMixer(out)
  // What the generated sounds.ts does, as the page loads.
  const sounds = createSounds({
    mixer,
    decode: out.decode,
    load: async (url) => new ArrayBuffer(url.length),
  })
  const theme = sounds.sound('/sounds/theme.ogg')
  const swing = sounds.sound('/sounds/swing.wav')
  const boss = sounds.sound('/sounds/boss.ogg')
  await sounds.ready()

  run(mixer, {
    init: () => {
      theme.play({ loop: true })
      boss.play({ loop: true })
    },
    update: () => swing.play(),
  })
  // Nothing sounds before the first press; the loops wait for it.
  expect(voices).toEqual([])
  expect(theme.playing).toBe(true)

  mixer.unlock()
  swing.play()
  expect(sounding().map((voice) => voice.loop)).toEqual([true, true, false])

  // Saving code: the new game plays the theme again, but not the boss.
  const themeCopy = voices[0]
  run(mixer, { init: () => theme.play({ loop: true }) })
  expect(sounding()).toEqual([themeCopy])
  expect(theme.playing).toBe(true)
  expect(boss.playing).toBe(false)
  expect(swing.playing).toBe(false)
})
