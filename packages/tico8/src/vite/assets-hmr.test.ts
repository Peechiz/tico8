import { describe, expect, it, vi } from 'vitest'
import { SHEET_CHANGED } from '../assets/event.ts'
import { assetsHmr, sheetUrl } from './assets-hmr.ts'
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
    ]) {
      expect(send).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    }
  })
})
