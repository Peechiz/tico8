import type { AttachKeyboard, Binding } from './types.ts'

const DEVICE = 'keyboard'

/** Feed keyboard keys into a pad. Returns a function that stops listening. */
export const attachKeyboard: AttachKeyboard = (target, pad) => {
  const handle = (event: KeyboardEvent, down: boolean) => {
    const code = codeOf(event) as Binding
    if (!code || !pad.wants(code) || isTextField(event.target)) return
    if (
      (event.ctrlKey || event.metaKey || event.altKey) &&
      !isModifierKey(code)
    ) {
      // Leave the browser shortcut alone, but never leave a key stuck down.
      if (!down) pad.set(DEVICE, code, false)
      return
    }
    event.preventDefault()
    pad.set(DEVICE, code, down)
  }
  const onKeyDown = (event: KeyboardEvent) => handle(event, true)
  const onKeyUp = (event: KeyboardEvent) => handle(event, false)
  const onBlur = () => pad.releaseAll(DEVICE)

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('blur', onBlur)
  }
}

/** Keys whose US-layout `code` is not built from the key itself. */
const KEY_CODES: Record<string, string> = {
  ' ': 'Space',
  Shift: 'ShiftLeft',
  Control: 'ControlLeft',
  Alt: 'AltLeft',
  '-': 'Minus',
  '=': 'Equal',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  '`': 'Backquote',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
}

/**
 * The event's `code`, or when it has none (as some test drivers send), the
 * `code` its `key` has on a US layout. '' for a key with neither.
 */
function codeOf(event: KeyboardEvent): string {
  if (event.code) return event.code
  const key = event.key ?? ''
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Digit${key}`
  return Object.hasOwn(KEY_CODES, key) ? (KEY_CODES[key] ?? '') : ''
}

/** Pressing a modifier sets its own flag, so that flag says nothing about a shortcut. */
function isModifierKey(code: string): boolean {
  return /^(Control|Alt|Meta|Shift)(Left|Right)$/.test(code)
}

function isTextField(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (!el) return false
  const tag = el.tagName?.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}
