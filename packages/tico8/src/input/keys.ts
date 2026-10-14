import type { ButtonName } from './types.ts'

/**
 * The keyboard keys a binding may name, as the browser's `event.code`: the
 * key's place on the keyboard, not the letter printed on it.
 */
export const KEYS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
  ...'0123456789'.split('').map((digit) => `Digit${digit}`),
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'Comma',
  'Period',
  'Slash',
  'Semicolon',
  'Quote',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Minus',
  'Equal',
  'Backquote',
] as readonly string[] as readonly KeyName[]

type Letter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type KeyName =
  | `Key${Letter}`
  | `Digit${Digit}`
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Space'
  | 'Enter'
  | 'Escape'
  | 'Tab'
  | 'Backspace'
  | 'ShiftLeft'
  | 'ShiftRight'
  | 'ControlLeft'
  | 'ControlRight'
  | 'AltLeft'
  | 'AltRight'
  | 'Comma'
  | 'Period'
  | 'Slash'
  | 'Semicolon'
  | 'Quote'
  | 'BracketLeft'
  | 'BracketRight'
  | 'Backslash'
  | 'Minus'
  | 'Equal'
  | 'Backquote'

/**
 * The keys that are the pad with no setup. A key named in one of the
 * game's actions is taken out of this table for that game.
 */
export const DEFAULT_KEYS: Readonly<Partial<Record<KeyName, ButtonName>>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'a',
  KeyS: 'b',
  KeyW: 'x',
  KeyD: 'y',
  ShiftLeft: 'select',
  ShiftRight: 'select',
}
