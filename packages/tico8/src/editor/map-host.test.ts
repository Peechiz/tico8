import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLAGS_CHANGED, MAP_CHANGED, MAPS_LISTED } from '../assets/event.ts'
import { devMapHost, FLAGS_API, MAPS_API } from './map-host.ts'
import type { FileHost } from './types.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeHot() {
  const listeners = new Map<string, Set<(data: never) => void>>()
  return {
    on(event: string, listener: (data: never) => void): void {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)?.add(listener)
    },
    off(event: string, listener: (data: never) => void) {
      listeners.get(event)?.delete(listener)
    },
    emit(event: string, data: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(data as never)
      }
    },
  }
}

const sheets = {} as FileHost

describe('devMapHost', () => {
  it('passes the sprite host through', () => {
    expect(devMapHost(sheets, fakeHot()).sheets).toBe(sheets)
  })

  it('hears map, flags and list changes until stopped', () => {
    const hot = fakeHot()
    const host = devMapHost(sheets, hot)
    const map = vi.fn()
    const flags = vi.fn()
    const list = vi.fn()
    const stop = host.onMapChange(map)
    host.onFlagsChange(flags)
    host.onMapList(list)
    hot.emit(MAP_CHANGED, { name: 'room1', data: { tiles: 'tiles' } })
    hot.emit(FLAGS_CHANGED, { tiles: 'tiles', data: {} })
    hot.emit(MAPS_LISTED, { maps: [] })
    stop()
    hot.emit(MAP_CHANGED, { name: 'room1', data: {} })
    expect(map).toHaveBeenCalledExactlyOnceWith('room1', { tiles: 'tiles' })
    expect(flags).toHaveBeenCalledExactlyOnceWith('tiles', {})
    expect(list).toHaveBeenCalledExactlyOnceWith([])
  })

  it('reads a map, and no flags when the file is missing', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith(MAPS_API)
        ? Response.json({ tiles: 'tiles' })
        : new Response('missing', { status: 404 }),
    )
    vi.stubGlobal('fetch', fetch)
    const host = devMapHost(sheets, fakeHot())
    expect(await host.readMap('room 1.json')).toEqual({ tiles: 'tiles' })
    expect(fetch).toHaveBeenCalledWith(`${MAPS_API}/room%201.json`)
    expect(await host.readFlags('tiles.flags.json')).toBeUndefined()
  })

  it('writes with PUT and gives the reason it was refused', async () => {
    const fetch = vi.fn(
      async () => new Response('a map must be a .json file', { status: 400 }),
    )
    vi.stubGlobal('fetch', fetch)
    const host = devMapHost(sheets, fakeHot())
    await expect(host.writeMap('a b.txt', '{}')).rejects.toThrow(
      'could not write a b.txt: a map must be a .json file',
    )
    expect(fetch).toHaveBeenCalledWith(
      `${MAPS_API}/a%20b.txt`,
      expect.objectContaining({ method: 'PUT', body: '{}' }),
    )
    await expect(host.writeFlags('x.flags.json', '{}')).rejects.toThrow()
    expect(fetch).toHaveBeenLastCalledWith(
      `${FLAGS_API}/x.flags.json`,
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('throws when a map is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('', { status: 404, statusText: 'Not Found' }),
      ),
    )
    await expect(
      devMapHost(sheets, fakeHot()).readMap('room1.json'),
    ).rejects.toThrow('could not read room1.json: 404 Not Found')
  })
})
