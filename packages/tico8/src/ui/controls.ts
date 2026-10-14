import { DEFAULT_KEYS } from '../input/keys.ts'
import type { Bindings } from '../input/types.ts'
import type { ControlRow, ControlRows } from './types.ts'

const PAD_LABELS: Readonly<Record<string, string>> = {
  left: '←',
  up: '↑',
  right: '→',
  down: '↓',
  a: 'Ⓐ',
  b: 'Ⓑ',
  x: 'Ⓧ',
  y: 'Ⓨ',
  l1: 'L1',
  r1: 'R1',
  l2: 'L2',
  r2: 'R2',
  l3: 'L3',
  r3: 'R3',
  start: 'Start',
  select: 'Select',
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowRight: '→',
  ArrowDown: '↓',
  Escape: 'Esc',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
}

/** A binding as the player reads it: `a` Ⓐ, `KeyK` K, `MouseLeft` Mouse left. */
function label(binding: string): string {
  const pad = PAD_LABELS[binding]
  if (pad !== undefined) return pad
  const key = KEY_LABELS[binding]
  if (key !== undefined) return key
  if (binding.startsWith('Mouse'))
    return `Mouse ${binding.slice(5).toLowerCase()}`
  if (binding.startsWith('Key')) return binding.slice(3)
  if (binding.startsWith('Digit')) return binding.slice(5)
  return binding
}

/**
 * The controls screen's rows. Every pad row stays, even with no key left
 * to it, since a controller still presses the button its label shows.
 */
export const controlRows: ControlRows = (actions: Bindings) => {
  const named = new Set<string>()
  for (const bindings of Object.values(actions)) {
    for (const binding of bindings) named.add(binding)
  }
  const free = (button: string): string[] =>
    Object.entries(DEFAULT_KEYS)
      .filter(([key, to]) => to === button && !named.has(key))
      .map(([key]) => key)

  const rows: ControlRow[] = []

  const arrows = (['left', 'up', 'right', 'down'] as const).flatMap(free)
  rows.push({
    label: '←↑→↓',
    bindings: arrows.length === 4 ? ['Arrows'] : arrows.map(label),
  })

  for (const button of ['a', 'b', 'x', 'y'] as const) {
    rows.push({ label: label(button), bindings: free(button).map(label) })
  }

  for (const [name, bindings] of Object.entries(actions)) {
    rows.push({ label: name, bindings: bindings.map(label) })
  }

  return rows
}
