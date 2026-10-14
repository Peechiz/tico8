import { KEYS } from './input/keys.ts'
import { createPad } from './input/pad.ts'
import {
  type Actions,
  type Binding,
  type Bindings,
  type Button,
  EXTRAS,
  type ExtrasInput,
  type Input,
  MOUSE_BUTTONS,
  type MouseInput,
  type Pad,
  RESERVED,
  STANDARD,
} from './input/types.ts'

import { PICO8, PICO8_NAMES, type Rgb, readPalette } from './palette.ts'
import type { SaveData, SaveOf } from './save/types.ts'

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
  /**
   * The game's own colours by name, in place of Pico-8's sixteen:
   *
   *     palette: { ink: '#1b1b2f', moss: '#3a5a40' }
   *
   * They are numbered in the order written, so the first is colour 0. A
   * colour is `#rrggbb` or `#rgb`.
   */
  palette?: Readonly<Record<string, string>>
  /**
   * The game's actions by name, each bound to what triggers it: a pad
   * button, a keyboard key, a mouse button, or a list of them.
   *
   *     actions: { jump: 'a', dash: ['r1', 'ShiftLeft'] }
   *
   * A pad button brings its default key with it. A key named here stops
   * being a default key of the pad.
   */
  actions?: Actions
  /**
   * Read the extras: shoulder buttons, triggers, sticks, start and select.
   * Off when left out.
   */
  extras?: boolean
  /** Read the mouse: its position in game pixels and its buttons. Off when left out. */
  mouse?: boolean
  /**
   * The game's save and the values it has before anything is written:
   *
   *     save: { best: 0, level: 1 }
   *
   * Its type is taken from these. It holds numbers, strings, true and
   * false, null, arrays and plain objects.
   */
  save?: SaveData
}

/**
 * The `input` a config gives its game: the standard pad, what `extras`
 * and `mouse` switch on, and a button for each action.
 */
export type InputOf<C extends Config> = Input &
  (C extends { extras: true } ? ExtrasInput : unknown) &
  (C extends { mouse: true } ? MouseInput : unknown) & {
    readonly [Action in keyof C['actions']]: Button
  }

/**
 * The `COLOR` a config gives its game: each name in its palette with its
 * colour number, or Pico-8's sixteen when it has no palette.
 */
export type ColorOf<C extends Config> = C extends { palette: infer Written }
  ? { readonly [Name in keyof Written]: number }
  : typeof PICO8_NAMES

/**
 * A config as `defineConfig` returns it, with the game's names on it. Its
 * `save` is the game's save, made from the `save` setting.
 */
export type Defined<C extends Config> = Omit<C, 'save'> & {
  readonly input: InputOf<C>
  readonly COLOR: ColorOf<C>
  readonly save: SaveOf<C>
}

/** A config with every choice made, as the engine uses it. */
export interface Settings {
  /** The screen's size in game pixels. */
  width: number
  height: number
  /** Updates per second. */
  rate: number
  warnOffPalette: boolean
  /** The game's colours; a colour's number is its place in the list. */
  palette: readonly Rgb[]
  /** Each colour's name with its number. */
  colors: Readonly<Record<string, number>>
  /** Every action with the list of what triggers it. */
  actions: Bindings
  extras: boolean
  mouse: boolean
}

/** Thrown by `resolveConfig` for a config that cannot be used. */
export class ConfigError extends Error {
  constructor(reason: string) {
    super(`${CONFIG_FILE}: ${reason}`)
    this.name = 'ConfigError'
  }
}

/** The pad each defined config made, so the engine reads the same one. */
const pads = new WeakMap<object, Pad>()

/**
 * Wrap a project's config so the editor checks it and offers its settings.
 * It hands back the config with the game's `input` and `COLOR` on it,
 * typed with the actions and colours the config names:
 *
 *     const config = defineConfig({
 *       palette: { ink: '#1b1b2f', moss: '#3a5a40' },
 *       actions: { jump: 'a' },
 *     })
 *     export default config
 *     export const { input, COLOR } = config
 */
export function defineConfig<const C extends Config>(config: C): Defined<C> {
  // A config that cannot be used is refused by `resolveConfig`, with a
  // message. Here it only has to give the game names to read.
  let actions: Bindings = {}
  let colors: Readonly<Record<string, number>> = PICO8_NAMES
  try {
    ;({ actions, colors } = resolveConfig(config))
  } catch {
    const names = Object.keys(Object(config?.palette))
    if (names.length > 0) {
      colors = Object.fromEntries(names.map((name, index) => [name, index]))
    }
    for (const name of Object.keys(Object(config?.actions))) {
      if (!RESERVED.includes(name)) actions = { ...actions, [name]: [] }
    }
  }
  const pad = createPad({ actions })
  const defined = Object.defineProperties(
    { ...config },
    { input: { value: pad.input }, COLOR: { value: colors } },
  ) as unknown as Defined<C>
  pads.set(defined, pad)
  return defined
}

/** The pad `defineConfig` made for a config; undefined for any other object. */
export function padOf(config: object): Pad | undefined {
  return pads.get(config)
}

const settingNames = [
  'screen',
  'rate',
  'warnOffPalette',
  'palette',
  'actions',
  'extras',
  'mouse',
]

/**
 * Fill in what a config leaves out and check what it says. Throws a
 * `ConfigError` naming the setting that is wrong.
 */
export function resolveConfig(given: unknown = {}): Settings {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    throw new ConfigError('the default export must be a config object')
  }
  const config: Config = given
  for (const key of Object.keys(config)) {
    if (!settingNames.includes(key)) {
      throw new ConfigError(
        `"${key}" is not a setting. The settings are ${list(settingNames)}`,
      )
    }
  }

  const { screen = '128x128', rate = 30, warnOffPalette = false } = config
  const { extras = false, mouse = false } = config
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

  if (typeof extras !== 'boolean') {
    throw new ConfigError(`extras must be true or false, got ${show(extras)}`)
  }
  if (typeof mouse !== 'boolean') {
    throw new ConfigError(`mouse must be true or false, got ${show(mouse)}`)
  }
  const actions = readActions(config.actions, extras, mouse)

  let palette: readonly Rgb[] = PICO8
  let colors: Readonly<Record<string, number>> = PICO8_NAMES
  if (config.palette !== undefined) {
    try {
      const read = readPalette(config.palette)
      palette = read.colors
      colors = read.names
    } catch (error) {
      throw new ConfigError((error as Error).message)
    }
  }

  return {
    ...SCREENS[screen],
    rate,
    warnOffPalette,
    palette,
    colors,
    actions,
    extras,
    mouse,
  }
}

const buttons: readonly string[] = [...STANDARD, ...EXTRAS]

/** Check a config's actions and give every one a list of bindings. */
function readActions(
  written: unknown = {},
  extras: boolean,
  mouse: boolean,
): Bindings {
  if (
    typeof written !== 'object' ||
    written === null ||
    Array.isArray(written)
  ) {
    throw new ConfigError(
      `actions must be an object of names, such as { jump: 'a' }, got ${show(written)}`,
    )
  }
  const actions: Record<string, readonly Binding[]> = {}
  for (const [name, bound] of Object.entries(written)) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      throw new ConfigError(
        `the action "${name}" must be named in letters and digits, starting with a letter`,
      )
    }
    if (RESERVED.includes(name)) {
      throw new ConfigError(
        `an action cannot be called "${name}": input.${name} is already taken`,
      )
    }
    const list: readonly unknown[] = Array.isArray(bound) ? bound : [bound]
    if (list.length === 0) {
      throw new ConfigError(`the action "${name}" is bound to nothing`)
    }
    for (const binding of list) {
      const known =
        typeof binding === 'string' &&
        (buttons.includes(binding) ||
          (KEYS as readonly string[]).includes(binding) ||
          (MOUSE_BUTTONS as readonly string[]).includes(binding))
      if (!known) {
        throw new ConfigError(
          `the action "${name}" is bound to ${show(binding)}, which is not ` +
            `a pad button, a key such as 'Space' or 'KeyK', or a mouse button`,
        )
      }
      if (!extras && (EXTRAS as readonly string[]).includes(binding)) {
        throw new ConfigError(
          `the action "${name}" is bound to '${binding}', which needs extras: true`,
        )
      }
      if (!mouse && (MOUSE_BUTTONS as readonly string[]).includes(binding)) {
        throw new ConfigError(
          `the action "${name}" is bound to '${binding}', which needs mouse: true`,
        )
      }
    }
    actions[name] = list as readonly Binding[]
  }
  return actions
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
