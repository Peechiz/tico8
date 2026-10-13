import { describe, expect, it, vi } from 'vitest'
import { FLAGS_CHANGED, MAP_CHANGED, SHEET_CHANGED } from '../assets/event.ts'
import { assetsHmr, flagsUrl, mapUrl, sheetUrl } from './assets-hmr.ts'
import { parseSheetFile, renderSprites } from './sprites.ts'

describe('sheetUrl', () => {
  it('gives the address of a PNG in the sprites folder', () => {
    expect(sheetUrl('/game', '/game/sprites/player.16.png')).toBe(
      '/sprites/player.16.png',
    )
    expect(sheetUrl('/game/', '/game/sprites/a.PNG')).toBe('/sprites/a.PNG')
  })

  it('spells the address as the generated sprites.ts does', () => {
    for (const file of ['big boss.png', "it's.16.png", 'caf\u00e9#1.png']) {
      const sheet = parseSheetFile(file)!
      expect(renderSprites([sheet])).toContain(
        `'${sheetUrl('/game', `/game/sprites/${file}`)}'`,
      )
    }
  })

  it('ignores every other file', () => {
    expect(sheetUrl('/game', '/game/main.ts')).toBeUndefined()
    expect(sheetUrl('/game', '/game/sprites/notes.txt')).toBeUndefined()
    expect(sheetUrl('/game', '/game/art/player.png')).toBeUndefined()
    expect(sheetUrl('/game', '/other/sprites/player.png')).toBeUndefined()
    expect(sheetUrl('/game', '/game2/sprites/player.png')).toBeUndefined()
  })
})

describe('mapUrl', () => {
  it('gives the address of a JSON file in the maps folder', () => {
    expect(mapUrl('/game', '/game/maps/room1.json')).toBe('/maps/room1.json')
    expect(mapUrl('/game/', '/game/maps/big boss.json')).toBe(
      '/maps/big%20boss.json',
    )
    expect(mapUrl('/game', "/game/maps/it's#1.json")).toBe(
      '/maps/it%27s%231.json',
    )
  })

  it('ignores every other file', () => {
    expect(mapUrl('/game', '/game/maps/sub/room1.json')).toBeUndefined()
    expect(mapUrl('/game', '/game/maps/.hidden.json')).toBeUndefined()
    expect(mapUrl('/game', '/game/maps/room1.png')).toBeUndefined()
    expect(mapUrl('/game', '/game/sprites/room1.json')).toBeUndefined()
    expect(mapUrl('/game', '/other/maps/room1.json')).toBeUndefined()
    expect(mapUrl('/game', '/game2/maps/room1.json')).toBeUndefined()
  })
})

describe('flagsUrl', () => {
  it('gives the address of a flags file in the sprites folder', () => {
    expect(flagsUrl('/game', '/game/sprites/tiles.16.flags.json')).toBe(
      '/sprites/tiles.16.flags.json',
    )
    expect(flagsUrl('/game/', "/game/sprites/it's.flags.json")).toBe(
      '/sprites/it%27s.flags.json',
    )
  })

  it('ignores every other file', () => {
    expect(flagsUrl('/game', '/game/sprites/sub/a.flags.json')).toBeUndefined()
    expect(flagsUrl('/game', '/game/sprites/tiles.json')).toBeUndefined()
    expect(flagsUrl('/game', '/game/sprites/tiles.png')).toBeUndefined()
    expect(flagsUrl('/game', '/game/maps/tiles.flags.json')).toBeUndefined()
    expect(flagsUrl('/game', '/other/sprites/a.flags.json')).toBeUndefined()
  })
})

describe('assetsHmr', () => {
  function change(type: string, file: string, environment = 'client') {
    const send = vi.fn()
    const hook = assetsHmr().hotUpdate as unknown as (
      this: unknown,
      options: { type: string; file: string },
    ) => unknown
    const result = hook.call(
      {
        environment: {
          name: environment,
          config: { root: '/game' },
          hot: { send },
        },
      },
      { type, file },
    )
    return { send, result }
  }

  it('tells the page and stops Vite when a sheet changes', () => {
    const { send, result } = change('update', '/game/sprites/player.png')
    expect(send).toHaveBeenCalledWith(SHEET_CHANGED, {
      url: '/sprites/player.png',
    })
    expect(result).toEqual([])
  })

  it('tells the page and stops Vite when a map changes', () => {
    const { send, result } = change('update', '/game/maps/room1.json')
    expect(send).toHaveBeenCalledWith(MAP_CHANGED, { url: '/maps/room1.json' })
    expect(result).toEqual([])
  })

  it('tells the page and stops Vite when a flags file changes', () => {
    const { send, result } = change('update', '/game/sprites/t.flags.json')
    expect(send).toHaveBeenCalledWith(FLAGS_CHANGED, {
      url: '/sprites/t.flags.json',
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('tells the page about a replaced map but leaves the rest to others', () => {
    const { send, result } = change('create', '/game/maps/room1.json')
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('tells the page about a replaced file but leaves the rest to others', () => {
    const { send, result } = change('create', '/game/sprites/player.png')
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('stays out of deletions, other files and other environments', () => {
    for (const { send, result } of [
      change('delete', '/game/sprites/player.png'),
      change('update', '/game/main.ts'),
      change('update', '/game/sprites/player.png', 'ssr'),
      change('delete', '/game/maps/room1.json'),
      change('update', '/game/maps/room1.json', 'ssr'),
      change('delete', '/game/sprites/t.flags.json'),
      change('update', '/game/sprites/t.flags.json', 'ssr'),
    ]) {
      expect(send).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    }
  })
})
