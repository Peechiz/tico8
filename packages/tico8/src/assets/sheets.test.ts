import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_COLORS, PICO8, type Rgb } from '../palette.ts'
import { createScreen } from '../screen.ts'
import { picture, toPicture } from '../testing.ts'
import type { Pixels } from './sheets.ts'
import { createSheets } from './sheets.ts'

/** A picture of one colour, `width` by `height`. */
function solid(color: number, width = 2, height = 2): Pixels {
  const [r, g, b] = PICO8[color]!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i)
  return { data, width, height }
}

/** A load whose every call waits to be settled by the test, in order. */
function manual() {
  const calls: {
    url: string
    resolve(pixels: Pixels): void
    reject(error: Error): void
  }[] = []
  const load = (url: string) =>
    new Promise<Pixels>((resolve, reject) => {
      calls.push({ url, resolve, reject })
    })
  return { calls, load }
}

function setup(load: (url: string) => Promise<Pixels>) {
  const screen = createScreen(2, 2)
  const sheets = createSheets({
    screen,
    colors: [...PICO8],
    paletteSize: PICO8.length,
    load,
    retryDelay: 0,
  })
  const shown = () => toPicture(screen)
  return { screen, sheets, shown }
}

const full = (digit: string) => picture(`${digit}${digit}\n${digit}${digit}`)
const URL = '/sprites/a.2.png'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sheet and ready', () => {
  it('returns at once, draws nothing until loaded, then draws', async () => {
    const { calls, load } = manual()
    const { sheets, shown } = setup(load)
    const sheet = sheets.sheet(URL, 2, 2)
    expect(calls.map((call) => call.url)).toEqual([URL])
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('0'))

    let settled = false
    const ready = sheets.ready().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    calls[0]!.resolve(solid(8))
    await ready
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('8'))
  })

  it('waits for every sheet asked for so far', async () => {
    const { calls, load } = manual()
    const { sheets } = setup(load)
    sheets.sheet('/sprites/a.png', 2, 2)
    sheets.sheet('/sprites/b.png', 2, 2)
    let settled = false
    const ready = sheets.ready().then(() => {
      settled = true
    })
    calls[0]!.resolve(solid(8))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(settled).toBe(false)
    calls[1]!.resolve(solid(9))
    await ready
  })

  it('settles with nothing to load', async () => {
    await setup(manual().load).sheets.ready()
  })

  it('reports a file that will not load and leaves the sheet empty', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const urls: string[] = []
    const { sheets, shown } = setup(async (url) => {
      urls.push(url)
      throw new Error('404 Not Found')
    })
    const sheet = sheets.sheet(URL, 2, 2)
    await sheets.ready()
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('0'))
    expect(sheet.frames).toBe(0)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toContain(URL)
    expect(error.mock.calls[0]![0]).toContain('404 Not Found')
    // Tried twice, the second time past the cache.
    expect(urls).toHaveLength(2)
    expect(urls[0]).toBe(URL)
    expect(urls[1]).toMatch(/^\/sprites\/a\.2\.png\?t=\d+$/)
  })

  it('reports an image that does not fit the cell, without a second try', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const load = vi.fn(async () => solid(8, 3, 2))
    const { sheets } = setup(load)
    const sheet = sheets.sheet(URL, 2, 2)
    await sheets.ready()
    expect(sheet.frames).toBe(0)
    expect(load).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toContain(URL)
    expect(error.mock.calls[0]![0]).toContain('3x2')
  })

  it('says nothing about colours from outside the palette', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pixels = solid(8)
    pixels.data.set([1, 2, 3, 255], 0)
    const { sheets } = setup(async () => pixels)
    sheets.sheet(URL, 2, 2)
    await sheets.ready()
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns once per load when the screen has no colours left', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pixels = solid(8)
    pixels.data.set([1, 2, 3, 255], 0)
    pixels.data.set([4, 5, 6, 255], 4)
    const colors: Rgb[] = Array.from({ length: MAX_COLORS }, (_, i) => [
      i,
      i,
      i,
    ])
    const sheets = createSheets({
      screen: createScreen(2, 2),
      colors,
      paletteSize: 16,
      load: async () => pixels,
      retryDelay: 0,
    })
    sheets.sheet(URL, 2, 2)
    await sheets.ready()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain(URL)
    expect(warn.mock.calls[0]![0]).toContain('4 pixels')
  })

  it('gives a fresh sheet when asked again, and reloads that one', async () => {
    const colors = [8, 9, 10]
    const { sheets, shown } = setup(async () => solid(colors.shift()!))
    const first = sheets.sheet(URL, 2, 2)
    const second = sheets.sheet(URL, 2, 2)
    expect(second).not.toBe(first)
    await sheets.ready()
    await sheets.reload(URL)
    first.draw(0, 0, 0)
    expect(shown()).toBe(full('8'))
    second.draw(0, 0, 0)
    expect(shown()).toBe(full('a'))
  })
})

describe('reload', () => {
  it('swaps new pixels into the same sheet and its sprites', async () => {
    const { calls, load } = manual()
    const { sheets, shown } = setup(load)
    const sprite = sheets.sheet(URL, 2, 2).sprite()
    calls[0]!.resolve(solid(8))
    await sheets.ready()

    const reloaded = sheets.reload(URL)
    expect(calls[1]!.url).toMatch(/^\/sprites\/a\.2\.png\?t=\d+$/)
    sprite.draw(0, 0)
    expect(shown()).toBe(full('8'))
    calls[1]!.resolve(solid(9))
    await reloaded
    sprite.draw(0, 0)
    expect(shown()).toBe(full('9'))
  })

  it('does nothing for a file nobody asked for', async () => {
    const { calls, load } = manual()
    const { sheets } = setup(load)
    await sheets.reload('/sprites/stranger.png')
    expect(calls).toHaveLength(0)
  })

  it('keeps the old picture when the new one fails, and says so', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const answers: (Pixels | Error)[] = [
      solid(8),
      new Error('broken'),
      new Error('still broken'),
      solid(9, 3, 3),
    ]
    const { sheets, shown } = setup(async () => {
      const answer = answers.shift()!
      if (answer instanceof Error) throw answer
      return answer
    })
    const sheet = sheets.sheet(URL, 2, 2)
    await sheets.ready()

    await sheets.reload(URL)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]![0]).toContain('still broken')
    await sheets.reload(URL)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error.mock.calls[1]![0]).toContain('3x3')

    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('8'))
    expect(sheet.frames).toBe(1)
  })

  it('tries once more when a file is caught half written', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const answers: (Pixels | Error)[] = [solid(8), new Error('cut'), solid(9)]
    const { sheets, shown } = setup(async () => {
      const answer = answers.shift()!
      if (answer instanceof Error) throw answer
      return answer
    })
    const sheet = sheets.sheet(URL, 2, 2)
    await sheets.ready()
    await sheets.reload(URL)
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('9'))
    expect(error).not.toHaveBeenCalled()
  })

  it('ends on the last save when an earlier load finishes late', async () => {
    const { calls, load } = manual()
    const { sheets, shown } = setup(load)
    const sheet = sheets.sheet(URL, 2, 2)
    calls[0]!.resolve(solid(8))
    await sheets.ready()

    const first = sheets.reload(URL)
    const second = sheets.reload(URL)
    calls[2]!.resolve(solid(10))
    await second
    calls[1]!.resolve(solid(9))
    await first
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('a'))
  })

  it('drops a failed earlier load without a word or a second try', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls, load } = manual()
    const { sheets, shown } = setup(load)
    const sheet = sheets.sheet(URL, 2, 2)
    calls[0]!.resolve(solid(8))
    await sheets.ready()

    const first = sheets.reload(URL)
    const second = sheets.reload(URL)
    calls[1]!.reject(new Error('cut'))
    await first
    calls[2]!.resolve(solid(10))
    await second
    expect(calls).toHaveLength(3)
    expect(error).not.toHaveBeenCalled()
    sheet.draw(0, 0, 0)
    expect(shown()).toBe(full('a'))
  })
})
