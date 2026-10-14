import { describe, expect, it } from 'vitest'
import { ConfigError, defineConfig, resolveConfig } from './config.ts'
import { PICO8, PICO8_NAMES } from './palette.ts'

describe('resolveConfig', () => {
  it('makes the standard console from an empty config', () => {
    expect(resolveConfig({})).toEqual({
      palette: PICO8,
      colors: PICO8_NAMES,
      width: 128,
      height: 128,
      rate: 30,
      warnOffPalette: false,
      actions: {},
      extras: false,
      mouse: false,
      save: {},
    })
    expect(resolveConfig()).toEqual(resolveConfig({}))
  })

  it('takes a screen preset, a rate and the warning', () => {
    const settings = resolveConfig({
      screen: '160x144',
      rate: 60,
      warnOffPalette: true,
    })
    expect(settings).toMatchObject({
      width: 160,
      height: 144,
      rate: 60,
      warnOffPalette: true,
    })
    expect(resolveConfig({ screen: '240x136' })).toMatchObject({
      width: 240,
      height: 136,
    })
  })

  it('refuses a setting it cannot use, and names it', () => {
    const bad = (config: unknown) => () => resolveConfig(config as never)
    expect(bad({ screen: '320x240' })).toThrow(
      "tico8.config.ts: screen must be '128x128', '160x144' or '240x136', got '320x240'",
    )
    expect(bad({ rate: 50 })).toThrow('rate must be 30 or 60, got 50')
    expect(bad({ warnOffPalette: 'yes' })).toThrow(
      "warnOffPalette must be true or false, got 'yes'",
    )
    expect(bad({ screeen: '160x144' })).toThrow('"screeen" is not a setting')
    expect(bad({ colours: {} })).toThrow('"colours" is not a setting')
    expect(bad({ palette: {} })).toThrow(
      'tico8.config.ts: a palette needs at least one colour',
    )
    expect(bad({ palette: { ink: 'navy' } })).toThrow(
      'tico8.config.ts: the palette colour "ink" must be a hex colour',
    )
    expect(bad([])).toThrow('must be a config object')
    expect(bad({ rate: 50 })).toThrow(ConfigError)
  })

  it('gives every action a list of what triggers it', () => {
    const settings = resolveConfig({
      extras: true,
      mouse: true,
      actions: { jump: 'a', dash: ['r1', 'ShiftLeft'], fire: ['MouseLeft'] },
    })
    expect(settings.actions).toEqual({
      jump: ['a'],
      dash: ['r1', 'ShiftLeft'],
      fire: ['MouseLeft'],
    })
    expect(settings).toMatchObject({ extras: true, mouse: true })
  })

  it('refuses actions it cannot use, and names them', () => {
    const bad = (config: unknown) => () => resolveConfig(config as never)
    expect(bad({ actions: ['a'] })).toThrow('actions must be an object')
    expect(bad({ actions: { 'jump!': 'a' } })).toThrow(
      'the action "jump!" must be named in letters and digits',
    )
    expect(bad({ actions: { left: 'a' } })).toThrow(
      'an action cannot be called "left": input.left is already taken',
    )
    expect(bad({ actions: { jump: [] } })).toThrow(
      'the action "jump" is bound to nothing',
    )
    expect(bad({ actions: { jump: 'space' } })).toThrow(
      'the action "jump" is bound to \'space\', which is not a pad button',
    )
    expect(bad({ actions: { dash: 'r1' } })).toThrow(
      'the action "dash" is bound to \'r1\', which needs extras: true',
    )
    expect(bad({ mouse: 'yes' })).toThrow('mouse must be true or false')
    expect(bad({ actions: { fire: ['b', 'MouseLeft'] } })).toThrow(
      'which needs mouse: true',
    )
  })

  it('reads a palette into colours and names', () => {
    const settings = resolveConfig({
      palette: { ink: '#1b1b2f', sand: '#fc0' },
    })
    expect(settings.palette).toEqual([
      [27, 27, 47],
      [255, 204, 0],
    ])
    expect(settings.colors).toEqual({ ink: 0, sand: 1 })
  })
})

describe('defineConfig', () => {
  it('hands back the config with its input and its colours', () => {
    const config = defineConfig({
      palette: { ink: '#1b1b2f', sand: '#fc0' },
      actions: { jump: 'a' },
    })
    const { input, COLOR } = config
    expect(COLOR).toEqual({ ink: 0, sand: 1 })
    expect(input.jump.pressed).toBe(false)
    expect(input.left.held).toBe(false)
    // Neither is a setting, so the config still resolves.
    expect(Object.keys(config)).toEqual(['palette', 'actions'])
    expect(resolveConfig(config).actions).toEqual({ jump: ['a'] })
    expect(defineConfig({}).COLOR).toBe(PICO8_NAMES)
  })
})
