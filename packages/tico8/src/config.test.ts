import { describe, expect, it } from 'vitest'
import { ConfigError, defineConfig, resolveConfig } from './config.ts'

describe('resolveConfig', () => {
  it('makes the standard console from an empty config', () => {
    expect(resolveConfig({})).toEqual({
      width: 128,
      height: 128,
      rate: 30,
      warnOffPalette: false,
    })
    expect(resolveConfig()).toEqual(resolveConfig({}))
  })

  it('takes a screen preset, a rate and the warning', () => {
    const settings = resolveConfig(
      defineConfig({ screen: '160x144', rate: 60, warnOffPalette: true }),
    )
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
    expect(bad({ palette: {} })).toThrow('"palette" is not a setting')
    expect(bad([])).toThrow('must be a config object')
    expect(bad({ rate: 50 })).toThrow(ConfigError)
  })
})
