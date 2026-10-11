/** The project file a config is read from. */
export const CONFIG_FILE = 'tico8.config.ts'

/** The screen sizes a project may pick from. The first is the standard. */
export const SCREENS = {
  '128x128': { width: 128, height: 128 },
  '160x144': { width: 160, height: 144 },
  '240x136': { width: 240, height: 136 },
} as const

export type ScreenPreset = keyof typeof SCREENS

/** Updates per second a project may pick from. The first is the standard. */
export const RATES = [30, 60] as const

export type Rate = (typeof RATES)[number]

/**
 * What a project's `tico8.config.ts` may set. Everything can be left out,
 * and an empty config is the standard console.
 */
export interface Config {
  /** The screen's size in game pixels. `'128x128'` when left out. */
  screen?: ScreenPreset
  /** Updates per second. 30 when left out. */
  rate?: Rate
  /**
   * Say in the browser's console when a sprite PNG uses a colour that is
   * not in the palette. Off when left out; the art is shown as painted
   * either way.
   */
  warnOffPalette?: boolean
}

/** A config with every choice made, as the engine uses it. */
export interface Settings {
  /** The screen's size in game pixels. */
  width: number
  height: number
  /** Updates per second. */
  rate: number
  warnOffPalette: boolean
}

/** Thrown by `resolveConfig` for a config that cannot be used. */
export class ConfigError extends Error {
  constructor(reason: string) {
    super(`${CONFIG_FILE}: ${reason}`)
    this.name = 'ConfigError'
  }
}

/**
 * Wrap a project's config so the editor checks it and offers its settings:
 *
 *     export default defineConfig({ screen: '160x144', rate: 60 })
 */
export function defineConfig(config: Config): Config {
  return config
}

const settingNames = ['screen', 'rate', 'warnOffPalette']

/**
 * Fill in what a config leaves out and check what it says. Throws a
 * `ConfigError` naming the setting that is wrong.
 */
export function resolveConfig(config: Config = {}): Settings {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new ConfigError('the default export must be a config object')
  }
  for (const key of Object.keys(config)) {
    if (!settingNames.includes(key)) {
      throw new ConfigError(
        `"${key}" is not a setting. The settings are ${list(settingNames)}`,
      )
    }
  }

  const { screen = '128x128', rate = 30, warnOffPalette = false } = config
  if (!Object.hasOwn(SCREENS, screen)) {
    throw new ConfigError(
      `screen must be ${list(Object.keys(SCREENS).map(quote))}, ` +
        `got ${show(screen)}`,
    )
  }
  if (!RATES.includes(rate)) {
    throw new ConfigError(`rate must be ${list(RATES)}, got ${show(rate)}`)
  }
  if (typeof warnOffPalette !== 'boolean') {
    throw new ConfigError(
      `warnOffPalette must be true or false, got ${show(warnOffPalette)}`,
    )
  }

  return { ...SCREENS[screen], rate, warnOffPalette }
}

function quote(value: unknown): string {
  return `'${value}'`
}

function show(value: unknown): string {
  return typeof value === 'string' ? quote(value) : String(value)
}

/** `a, b or c`. */
function list(items: readonly unknown[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
}
