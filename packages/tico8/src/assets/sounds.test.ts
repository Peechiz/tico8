import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Clip, LoadableSound, Mixer } from '../audio/types.ts'
import { createSounds } from './sounds.ts'

/** A mixer whose sounds only record the clips they were given. */
function fakeMixer() {
  const made: (LoadableSound & { clips: Clip[] })[] = []
  const mixer = {
    sound() {
      const clips: Clip[] = []
      const sound = {
        clips,
        setClip: (clip: Clip) => void clips.push(clip),
      } as unknown as LoadableSound & { clips: Clip[] }
      made.push(sound)
      return sound
    },
  } as unknown as Mixer
  return { mixer, made }
}

const bytes = (n: number) => new Uint8Array([n]).buffer

/** Bytes decode to a clip as long as their first byte is not 0. */
const decode = async (data: ArrayBuffer): Promise<Clip> => {
  const n = new Uint8Array(data)[0]!
  if (n === 0) throw new Error('not a sound')
  return { duration: n }
}

function setup(load: (url: string) => Promise<ArrayBuffer>) {
  const { mixer, made } = fakeMixer()
  const sounds = createSounds({ mixer, decode, load, retryDelay: 0 })
  return { sounds, made }
}

const URL = '/sounds/a.wav'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sound and ready', () => {
  it('gives the same sound and one fetch for the same address', async () => {
    const load = vi.fn(async () => bytes(1))
    const { sounds, made } = setup(load)
    const first = sounds.sound(URL)
    const second = sounds.sound(URL)
    expect(second).toBe(first)
    expect(made).toHaveLength(1)
    await sounds.ready()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('has no clip until loaded, and ready waits for it', async () => {
    let finish!: (data: ArrayBuffer) => void
    const load = () => new Promise<ArrayBuffer>((resolve) => (finish = resolve))
    const { sounds, made } = setup(load)
    sounds.sound(URL)
    expect(made[0]!.clips).toEqual([])

    let settled = false
    const ready = sounds.ready().then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    finish(bytes(3))
    await ready
    expect(made[0]!.clips).toEqual([{ duration: 3 }])
  })

  it('tries once more past the cache when the load fails', async () => {
    const load = vi
      .fn<(url: string) => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(bytes(2))
    const { sounds, made } = setup(load)
    sounds.sound(URL)
    await sounds.ready()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[0]![0]).toBe(URL)
    expect(load.mock.calls[1]![0]).toMatch(/^\/sounds\/a\.wav\?t=\d+$/)
    expect(made[0]!.clips).toEqual([{ duration: 2 }])
  })

  it('warns and plays nothing when the file never loads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const load = vi.fn(async () => {
      throw new Error('404')
    })
    const { sounds, made } = setup(load)
    sounds.sound(URL)
    await expect(sounds.ready()).resolves.toBeUndefined()
    expect(load).toHaveBeenCalledTimes(2)
    expect(made[0]!.clips).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain(`tico8: ${URL}`)
  })

  it('warns and plays nothing when the bytes do not decode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sounds, made } = setup(async () => bytes(0))
    sounds.sound(URL)
    await sounds.ready()
    expect(made[0]!.clips).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('reload', () => {
  it('fetches past the cache and swaps the clip in', async () => {
    const load = vi
      .fn<(url: string) => Promise<ArrayBuffer>>()
      .mockResolvedValueOnce(bytes(1))
      .mockResolvedValueOnce(bytes(5))
    const { sounds, made } = setup(load)
    sounds.sound(URL)
    await sounds.ready()
    await sounds.reload(URL)
    expect(load.mock.calls[1]![0]).toMatch(/^\/sounds\/a\.wav\?t=\d+$/)
    expect(made[0]!.clips).toEqual([{ duration: 1 }, { duration: 5 }])
  })

  it('keeps the old clip and warns when the new bytes do not decode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const load = vi
      .fn<(url: string) => Promise<ArrayBuffer>>()
      .mockResolvedValueOnce(bytes(1))
      .mockResolvedValueOnce(bytes(0))
    const { sounds, made } = setup(load)
    sounds.sound(URL)
    await sounds.ready()
    await sounds.reload(URL)
    expect(made[0]!.clips).toEqual([{ duration: 1 }])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('old sound stays')
  })

  it('ignores an address that was never asked for', async () => {
    const load = vi.fn(async () => bytes(1))
    const { sounds } = setup(load)
    await sounds.reload('/sounds/none.wav')
    expect(load).not.toHaveBeenCalled()
  })
})
