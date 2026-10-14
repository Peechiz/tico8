import { describe, expect, it } from 'vitest'
import { createMixer } from './mixer.ts'
import type { AudioOut, Clip } from './types.ts'

interface FakeVoice {
  clip: Clip
  loop: boolean
  gain: number
  stopped: boolean
  ended: boolean
  paused: boolean
  end(): void
}

function fakeOut() {
  const voices: FakeVoice[] = []
  let resumed = 0
  const out: AudioOut = {
    decode: async () => ({ duration: 1 }),
    start(clip, options) {
      const voice: FakeVoice = {
        clip,
        loop: options.loop,
        gain: options.gain,
        stopped: false,
        ended: false,
        paused: false,
        end() {
          voice.ended = true
          options.onEnded()
        },
      }
      voices.push(voice)
      return {
        setGain(gain) {
          voice.gain = gain
        },
        stop() {
          voice.stopped = true
        },
        pause() {
          voice.paused = true
        },
        resume() {
          voice.paused = false
        },
      }
    },
    resume() {
      resumed++
    },
  }
  return {
    out,
    voices,
    get resumed() {
      return resumed
    },
    at(i: number): FakeVoice {
      const voice = voices[i]
      if (!voice) throw new Error(`no voice ${i}`)
      return voice
    },
    alive: () => voices.filter((v) => !v.stopped && !v.ended),
  }
}

const clip: Clip = { duration: 1 }

function setup(unlocked = true) {
  const fake = fakeOut()
  const mixer = createMixer(fake.out)
  if (unlocked) mixer.unlock()
  const sound = mixer.sound()
  sound.setClip(clip)
  return { fake, mixer, sound }
}

describe('one-off copies', () => {
  it('overlap, and are forgotten when they play out', () => {
    const { fake, sound } = setup()
    sound.play()
    sound.play()
    expect(fake.alive()).toHaveLength(2)
    expect(sound.playing).toBe(true)
    fake.at(0).end()
    expect(sound.playing).toBe(true)
    fake.at(1).end()
    expect(sound.playing).toBe(false)
  })

  it('all stop on stop()', () => {
    const { fake, sound } = setup()
    sound.play()
    sound.play()
    sound.stop()
    expect(fake.alive()).toHaveLength(0)
    expect(sound.playing).toBe(false)
  })

  it('play nothing without a clip', () => {
    const fake = fakeOut()
    const mixer = createMixer(fake.out)
    mixer.unlock()
    const sound = mixer.sound()
    sound.play()
    expect(fake.voices).toHaveLength(0)
    expect(sound.playing).toBe(false)
  })

  it('keep playing when the clip is swapped', () => {
    const { fake, sound } = setup()
    sound.play()
    sound.setClip({ duration: 2 })
    expect(fake.alive()).toHaveLength(1)
    sound.play()
    expect(fake.at(1).clip.duration).toBe(2)
  })
})

describe('loops', () => {
  it('have one copy, taking only the new volume when played again', () => {
    const { fake, sound } = setup()
    sound.play({ loop: true, volume: 0.5 })
    sound.play({ loop: true, volume: 0.25 })
    expect(fake.voices).toHaveLength(1)
    expect(fake.at(0).loop).toBe(true)
    expect(fake.at(0).gain).toBe(0.25)
  })

  it('sit beside a one-off play of the same sound', () => {
    const { fake, sound } = setup()
    sound.play({ loop: true })
    sound.play()
    expect(fake.alive()).toHaveLength(2)
  })

  it('stop on stop(), and can start again', () => {
    const { fake, sound } = setup()
    sound.play({ loop: true })
    sound.stop()
    expect(fake.alive()).toHaveLength(0)
    expect(sound.playing).toBe(false)
    sound.play({ loop: true })
    expect(fake.alive()).toHaveLength(1)
  })

  it('start again with a new clip at the same gain', () => {
    const { fake, sound } = setup()
    sound.play({ loop: true, volume: 0.5 })
    sound.setClip({ duration: 3 })
    expect(fake.at(0).stopped).toBe(true)
    expect(fake.alive()).toHaveLength(1)
    expect(fake.alive()[0]?.clip.duration).toBe(3)
    expect(fake.alive()[0]?.gain).toBe(0.5)
  })

  it('wait for a clip, and start when it comes', () => {
    const fake = fakeOut()
    const mixer = createMixer(fake.out)
    mixer.unlock()
    const sound = mixer.sound()
    sound.play({ loop: true })
    expect(fake.voices).toHaveLength(0)
    expect(sound.playing).toBe(true)
    sound.setClip(clip)
    expect(fake.alive()).toHaveLength(1)
  })
})

describe('volume', () => {
  it('multiplies master, sound and play', () => {
    const { fake, mixer, sound } = setup()
    mixer.volume = 0.5
    sound.volume = 0.5
    sound.play({ volume: 0.5 })
    expect(fake.at(0).gain).toBeCloseTo(0.125)
  })

  it('reaches copies already sounding', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ volume: 0.5 })
    sound.play({ loop: true })
    sound.volume = 0.5
    expect(fake.at(0).gain).toBeCloseTo(0.25)
    expect(fake.at(1).gain).toBeCloseTo(0.5)
    mixer.volume = 0.5
    expect(fake.at(0).gain).toBeCloseTo(0.125)
    expect(fake.at(1).gain).toBeCloseTo(0.25)
  })

  it('is held to 0..1, and a number that is not one is silence', () => {
    const { fake, sound } = setup()
    sound.volume = 3
    expect(sound.volume).toBe(1)
    sound.volume = -1
    expect(sound.volume).toBe(0)
    sound.volume = Number.NaN
    expect(sound.volume).toBe(0)
    sound.volume = 1
    sound.play({ volume: 7 })
    expect(fake.at(0).gain).toBe(1)
  })
})

describe('unlock', () => {
  it('drops one-offs and holds loops until it comes', () => {
    const { fake, mixer, sound } = setup(false)
    expect(mixer.unlocked).toBe(false)
    sound.play()
    expect(fake.voices).toHaveLength(0)
    expect(sound.playing).toBe(false)
    sound.play({ loop: true, volume: 0.5 })
    expect(fake.voices).toHaveLength(0)
    expect(sound.playing).toBe(true)
    mixer.unlock()
    expect(mixer.unlocked).toBe(true)
    expect(fake.resumed).toBe(1)
    expect(fake.alive()).toHaveLength(1)
    expect(fake.at(0).gain).toBe(0.5)
  })

  it('does not start a waiting loop that was stopped', () => {
    const { fake, mixer, sound } = setup(false)
    sound.play({ loop: true })
    sound.stop()
    expect(sound.playing).toBe(false)
    mixer.unlock()
    expect(fake.voices).toHaveLength(0)
  })

  it('twice is harmless', () => {
    const { fake, mixer, sound } = setup(false)
    sound.play({ loop: true })
    mixer.unlock()
    mixer.unlock()
    expect(fake.voices).toHaveLength(1)
  })
})

describe('restart', () => {
  it('stops one-offs and keeps a loop the new game plays again', () => {
    const { fake, mixer, sound } = setup()
    sound.play()
    sound.play({ loop: true })
    mixer.restarting()
    expect(fake.at(0).stopped).toBe(true)
    sound.play({ loop: true })
    mixer.settle()
    expect(fake.voices).toHaveLength(2)
    expect(fake.at(1).stopped).toBe(false)
    expect(sound.playing).toBe(true)
  })

  it('stops a loop the new game did not play', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ loop: true })
    mixer.restarting()
    expect(fake.at(0).stopped).toBe(false)
    mixer.settle()
    expect(fake.at(0).stopped).toBe(true)
    expect(sound.playing).toBe(false)
  })

  it('stops a waiting loop the new game did not play', () => {
    const { fake, mixer, sound } = setup(false)
    sound.play({ loop: true })
    mixer.restarting()
    mixer.settle()
    mixer.unlock()
    expect(fake.voices).toHaveLength(0)
  })

  it('settle without a restart leaves loops alone', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ loop: true })
    mixer.settle()
    expect(fake.alive()).toHaveLength(1)
  })
})

describe('hold', () => {
  it('pauses one-off copies, and release carries them on', () => {
    const { fake, mixer, sound } = setup()
    sound.play()
    sound.play()
    mixer.hold()
    expect(fake.at(0).paused).toBe(true)
    expect(fake.at(1).paused).toBe(true)
    expect(fake.alive()).toHaveLength(2)
    expect(sound.playing).toBe(true)
    mixer.release()
    expect(fake.at(0).paused).toBe(false)
    expect(fake.at(1).paused).toBe(false)
    fake.at(0).end()
    fake.at(1).end()
    expect(sound.playing).toBe(false)
  })

  it('lets loops play through', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ loop: true })
    sound.play()
    mixer.hold()
    expect(fake.at(0).paused).toBe(false)
    expect(fake.at(1).paused).toBe(true)
  })

  it('reaches every sound', () => {
    const { fake, mixer, sound } = setup()
    const other = mixer.sound()
    other.setClip(clip)
    sound.play()
    other.play()
    mixer.hold()
    expect(fake.voices.every((v) => v.paused)).toBe(true)
  })

  it('stops held copies on stop()', () => {
    const { fake, mixer, sound } = setup()
    sound.play()
    mixer.hold()
    sound.stop()
    expect(fake.at(0).stopped).toBe(true)
    expect(sound.playing).toBe(false)
    mixer.release()
    expect(fake.alive()).toHaveLength(0)
  })

  it('stops held copies on restarting()', () => {
    const { fake, mixer, sound } = setup()
    sound.play()
    mixer.hold()
    mixer.restarting()
    expect(fake.at(0).stopped).toBe(true)
    expect(sound.playing).toBe(false)
  })

  it('lets volume changes reach held copies', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ volume: 0.5 })
    sound.play({ loop: true })
    mixer.hold()
    mixer.volume = 0.5
    expect(fake.at(0).gain).toBeCloseTo(0.25)
    expect(fake.at(1).gain).toBeCloseTo(0.5)
    sound.volume = 0.5
    expect(fake.at(0).gain).toBeCloseTo(0.125)
    mixer.release()
    expect(fake.at(0).gain).toBeCloseTo(0.125)
  })

  it('lets a one-off played during it sound', () => {
    const { fake, mixer, sound } = setup()
    mixer.hold()
    sound.play()
    expect(fake.at(0).paused).toBe(false)
    mixer.release()
    expect(fake.at(0).paused).toBe(false)
  })

  it('twice, or a release without one, is harmless', () => {
    const { fake, mixer, sound } = setup()
    sound.play()
    mixer.release()
    expect(fake.at(0).paused).toBe(false)
    mixer.hold()
    mixer.hold()
    expect(fake.at(0).paused).toBe(true)
    mixer.release()
    expect(fake.at(0).paused).toBe(false)
    mixer.release()
    expect(fake.alive()).toHaveLength(1)
  })
})

describe('sound switch', () => {
  it('silences every sound when off, and each carries on when it is back', () => {
    const { fake, mixer, sound } = setup()
    sound.play({ loop: true })
    sound.play()
    mixer.soundOn = false
    expect(fake.at(0).gain).toBe(0)
    expect(fake.at(1).gain).toBe(0)
    // Still going, so the game sees it playing.
    expect(sound.playing).toBe(true)
    expect(fake.at(0).stopped).toBe(false)
    mixer.soundOn = true
    expect(fake.at(0).gain).toBe(1)
    expect(fake.at(1).gain).toBe(1)
  })

  it('starts new plays silent while off, loops and one-offs alike', () => {
    const { fake, mixer, sound } = setup()
    mixer.soundOn = false
    sound.play({ loop: true })
    sound.play()
    expect(fake.at(0).gain).toBe(0)
    expect(fake.at(1).gain).toBe(0)
  })
})
