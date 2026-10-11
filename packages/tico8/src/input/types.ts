import type { Vec } from '../vec.ts'
import type { KeyName } from './keys.ts'

export type { KeyName } from './keys.ts'

export interface Button {
  /** Down right now. */
  readonly held: boolean
  /** Went down since the last update: true for one update. */
  readonly pressed: boolean
  /** Came up since the last update: true for one update. */
  readonly released: boolean
}

/** The standard pad: four directions and four buttons. */
export type StandardName =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'a'
  | 'b'
  | 'x'
  | 'y'

/**
 * The extras, read only by a game whose config says `extras: true`:
 * shoulders, triggers, stick clicks, start and select.
 */
export type ExtraName =
  | 'l1'
  | 'r1'
  | 'l2'
  | 'r2'
  | 'l3'
  | 'r3'
  | 'start'
  | 'select'

/** Every button a controller has. */
export type ButtonName = StandardName | ExtraName

export type MouseName = 'MouseLeft' | 'MouseRight' | 'MouseMiddle'

/**
 * What an action can be bound to: a pad button, which brings its default
 * key with it, a keyboard key or a mouse button.
 */
export type Binding = ButtonName | KeyName | MouseName

/** A game's actions as its config writes them: `{ jump: ['a', 'Space'] }`. */
export type Actions = Readonly<Record<string, Binding | readonly Binding[]>>

/** Actions once checked: every action has a list. */
export type Bindings = Readonly<Record<string, readonly Binding[]>>

export const STANDARD: readonly StandardName[] = [
  'left',
  'right',
  'up',
  'down',
  'a',
  'b',
  'x',
  'y',
]

export const EXTRAS: readonly ExtraName[] = [
  'l1',
  'r1',
  'l2',
  'r2',
  'l3',
  'r3',
  'start',
  'select',
]

export const MOUSE_BUTTONS: readonly MouseName[] = [
  'MouseLeft',
  'MouseRight',
  'MouseMiddle',
]

/** Names an action cannot take, since `input` already has them. */
export const RESERVED: readonly string[] = [
  ...STANDARD,
  ...EXTRAS,
  'dir',
  'leftStick',
  'rightStick',
  'mouse',
]

/** The standard pad as a game reads it. */
export type Input = { readonly [K in StandardName]: Button } & {
  /** The held directions as a vector: each of x and y is -1, 0 or 1. */
  readonly dir: Vec
}

/** What `extras: true` adds to `input`. */
export type ExtrasInput = { readonly [K in ExtraName]: Button } & {
  /**
   * Each stick as a vector no longer than 1, and exactly 0, 0 at rest. Up
   * is negative y, as on the screen.
   */
  readonly leftStick: Vec
  readonly rightStick: Vec
}

/**
 * The pointer, in game pixels. It is a position, so it can be handed to
 * anything that takes one: `cursor.draw(input.mouse)`.
 */
export interface Mouse {
  readonly x: number
  readonly y: number
  /** Whether the pointer is over the screen. `x, y` keep counting past its edges. */
  readonly inside: boolean
  readonly left: Button
  readonly right: Button
  readonly middle: Button
}

/** What `mouse: true` adds to `input`. */
export interface MouseInput {
  readonly mouse: Mouse
}

/** Everything a pad holds, whatever the config switches on. */
export type FullInput = Input &
  ExtrasInput &
  MouseInput & { readonly [action: string]: unknown }

/** What a pad is made from. */
export interface PadOptions {
  /** The game's actions. None when left out. */
  actions?: Bindings
}

/**
 * The pad's inside: devices push what they see in, the loop samples it.
 *
 * A device is any name, such as `'keyboard'` or `'gamepad0'`. A button or
 * an action is down while any device holds any control that drives it, so
 * letting go of a key does not release a button a controller still holds.
 *
 * Controls drive buttons and actions like this:
 * - A button name (`'a'`) drives that button, and every action bound to it.
 * - A key (`'KeyA'`) drives every action bound to it. If no action names
 *   it, it drives its button in `DEFAULT_KEYS`, and so that button's actions.
 * - A mouse button (`'MouseLeft'`) drives `input.mouse.left` and every
 *   action bound to it.
 * - The left stick, pushed more than halfway, drives the four directions.
 */
export interface Pad {
  /**
   * What game code reads. It changes only when `sample` is called. It has
   * every button, both sticks, the mouse, and a `Button` for each action.
   */
  readonly input: FullInput
  /** Whether a control drives anything, so a device can leave the rest alone. */
  wants(control: Binding): boolean
  /** A device says one of its controls went down or came up. */
  set(device: string, control: Binding, down: boolean): void
  /** A device says where one of its sticks is, each of x and y from -1 to 1. */
  stick(device: string, side: 'left' | 'right', x: number, y: number): void
  /** Where the pointer is, in game pixels, and whether it is over the screen. */
  point(x: number, y: number, inside: boolean): void
  /** Let go of everything one device holds, or with no device, everything. */
  releaseAll(device?: string): void
  /** Called once before each update, so a button is stable within one. */
  sample(): void
}

/** `src/input/pad.ts` exports `createPad` of this type. */
export type CreatePad = (options?: PadOptions) => Pad

/**
 * `src/input/keyboard.ts` exports `attachKeyboard` of this type. Returns a
 * function that stops listening.
 */
export type AttachKeyboard = (target: Window, pad: Pad) => () => void

/** A connected set of controllers, read by asking. */
export interface Gamepads {
  /** Read every controller and tell the pad. Call once per frame. */
  poll(): void
  /** Stop, letting go of everything the controllers held. */
  detach(): void
}

/**
 * `src/input/gamepad.ts` exports `attachGamepads` of this type. `source` is
 * the browser's `navigator`, or a stand-in with `getGamepads` in a test.
 */
export type AttachGamepads = (
  source: Pick<Navigator, 'getGamepads'>,
  pad: Pad,
) => Gamepads

/**
 * `src/input/mouse.ts` exports `attachMouse` of this type. `canvas` is the
 * element showing the screen, at any scale; `screen` is its size in game
 * pixels. Returns a function that stops listening.
 */
export type AttachMouse = (
  canvas: HTMLElement,
  screen: { readonly width: number; readonly height: number },
  pad: Pad,
) => () => void
