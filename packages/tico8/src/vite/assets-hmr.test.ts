import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  FLAGS_CHANGED,
  MAP_CHANGED,
  SHEET_CHANGED,
  SOUND_CHANGED,
} from '../assets/event.ts'
import {
  assetsHmr,
  flagsTileset,
  mapName,
  sheetUrl,
  soundUrl,
} from './assets-hmr.ts'
import { parseSheetFile, renderSprites } from './sprites.ts'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

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

describe('soundUrl', () => {
  it('gives the address of a wav, ogg or mp3 in the sounds folder', () => {
    expect(soundUrl('/game', '/game/sounds/hit.wav')).toBe('/sounds/hit.wav')
    expect(soundUrl('/game/', '/game/sounds/theme.OGG')).toBe(
      '/sounds/theme.OGG',
    )
    expect(soundUrl('/game', '/game/sounds/a.mp3')).toBe('/sounds/a.mp3')
  })

  it('spells the address as sheets are spelled', () => {
    expect(soundUrl('/game', "/game/sounds/big boss's#1.wav")).toBe(
      '/sounds/big%20boss%27s%231.wav',
    )
  })

  it('ignores every other file', () => {
    expect(soundUrl('/game', '/game/sounds/sub/hit.wav')).toBeUndefined()
    expect(soundUrl('/game', '/game/sounds/.hit.wav')).toBeUndefined()
    expect(soundUrl('/game', '/game/sounds/notes.txt')).toBeUndefined()
    expect(soundUrl('/game', '/game/sounds/hit.flac')).toBeUndefined()
    expect(soundUrl('/game', '/game/sprites/hit.wav')).toBeUndefined()
    expect(soundUrl('/game', '/other/sounds/hit.wav')).toBeUndefined()
    expect(soundUrl('/game', '/game2/sounds/hit.wav')).toBeUndefined()
  })
})

describe('mapName', () => {
  it('gives the export name of a JSON file in the maps folder', () => {
    expect(mapName('/game', '/game/maps/room1.json')).toBe('room1')
    expect(mapName('/game/', '/game/maps/big-room.json')).toBe('bigRoom')
    expect(mapName('/game', '/game/maps/big boss.JSON')).toBe('bigBoss')
  })

  it('ignores every other file', () => {
    expect(mapName('/game', '/game/maps/sub/room1.json')).toBeUndefined()
    expect(mapName('/game', '/game/maps/.hidden.json')).toBeUndefined()
    expect(mapName('/game', '/game/maps/room1.png')).toBeUndefined()
    expect(mapName('/game', '/game/maps/---.json')).toBeUndefined()
    expect(mapName('/game', '/game/maps/tiles.flags.json')).toBeUndefined()
    expect(mapName('/game', '/game/sprites/room1.json')).toBeUndefined()
    expect(mapName('/game', '/other/maps/room1.json')).toBeUndefined()
    expect(mapName('/game', '/game2/maps/room1.json')).toBeUndefined()
  })
})

describe('flagsTileset', () => {
  it('gives the sheet name of a flags file in the sprites folder', () => {
    expect(flagsTileset('/game', '/game/sprites/tiles.flags.json')).toBe(
      'tiles',
    )
    expect(flagsTileset('/game/', '/game/sprites/big-tiles.flags.json')).toBe(
      'bigTiles',
    )
  })

  it('ignores every other file', () => {
    expect(
      flagsTileset('/game', '/game/sprites/sub/a.flags.json'),
    ).toBeUndefined()
    expect(flagsTileset('/game', '/game/sprites/tiles.json')).toBeUndefined()
    expect(flagsTileset('/game', '/game/sprites/tiles.png')).toBeUndefined()
    expect(flagsTileset('/game', '/game/sprites/.flags.json')).toBeUndefined()
    expect(flagsTileset('/game', '/game/maps/tiles.flags.json')).toBeUndefined()
    expect(flagsTileset('/game', '/other/sprites/a.flags.json')).toBeUndefined()
  })
})

describe('assetsHmr', () => {
  async function change(
    type: string,
    file: string,
    text = '{}',
    environment = 'client',
  ) {
    const send = vi.fn()
    const warn = vi.fn()
    const hook = assetsHmr(0).hotUpdate as unknown as (
      this: unknown,
      options: { type: string; file: string; read: () => string },
    ) => unknown
    const result = await hook.call(
      {
        environment: {
          name: environment,
          config: { root: '/game' },
          hot: { send },
          logger: { warn },
        },
      },
      { type, file, read: () => text },
    )
    return { send, warn, result }
  }

  it('tells the page and stops Vite when a sheet changes', async () => {
    const { send, result } = await change('update', '/game/sprites/player.png')
    expect(send).toHaveBeenCalledWith(SHEET_CHANGED, {
      url: '/sprites/player.png',
    })
    expect(result).toEqual([])
  })

  it('tells the page and stops Vite when a sound changes', async () => {
    const { send, result } = await change('update', '/game/sounds/hit.wav')
    expect(send).toHaveBeenCalledWith(SOUND_CHANGED, { url: '/sounds/hit.wav' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('tells the page about a replaced sound but leaves the rest to others', async () => {
    const { send, result } = await change('create', '/game/sounds/hit.wav')
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('sends a changed map with its contents and stops Vite', async () => {
    const { send, result } = await change(
      'update',
      '/game/maps/big-room.json',
      '{"width":2}',
    )
    expect(send).toHaveBeenCalledWith(MAP_CHANGED, {
      name: 'bigRoom',
      data: { width: 2 },
    })
    expect(result).toEqual([])
  })

  it('sends changed flags with their contents and stops Vite', async () => {
    const { send, result } = await change(
      'update',
      '/game/sprites/t.flags.json',
      '[1,2]',
    )
    expect(send).toHaveBeenCalledWith(FLAGS_CHANGED, {
      tiles: 't',
      data: [1, 2],
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('reads a half-written map again and sends the second read', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('{"width":3}')
    const { send, warn, result } = await change(
      'update',
      '/game/maps/room1.json',
      '',
    )
    expect(send).toHaveBeenCalledWith(MAP_CHANGED, {
      name: 'room1',
      data: { width: 3 },
    })
    expect(warn).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('sends nothing and warns if the file is still not JSON', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('{"wid')
    const { send, warn, result } = await change(
      'update',
      '/game/maps/room1.json',
      '',
    )
    expect(send).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[tico8] maps/room1.json was not swapped in: it is not valid JSON.',
    )
    expect(result).toEqual([])
  })

  it('tells the page about a replaced map but leaves the rest to others', async () => {
    const { send, result } = await change('create', '/game/maps/room1.json')
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('tells the page about a replaced file but leaves the rest to others', async () => {
    const { send, result } = await change('create', '/game/sprites/player.png')
    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('stays out of deletions, other files and other environments', async () => {
    for (const { send, result } of [
      await change('delete', '/game/sprites/player.png'),
      await change('update', '/game/main.ts'),
      await change('update', '/game/sprites/player.png', '', 'ssr'),
      await change('delete', '/game/sounds/hit.wav'),
      await change('update', '/game/sounds/hit.wav', '', 'ssr'),
      await change('delete', '/game/maps/room1.json'),
      await change('update', '/game/maps/room1.json', '{}', 'ssr'),
      await change('delete', '/game/sprites/t.flags.json'),
      await change('update', '/game/sprites/t.flags.json', '{}', 'ssr'),
    ]) {
      expect(send).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    }
  })
})
