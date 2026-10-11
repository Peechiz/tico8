import type { AttachKeyboard, Binding } from './types.ts'

const DEVICE = 'keyboard'

/** Feed keyboard keys into a pad. Returns a function that stops listening. */
export const attachKeyboard: AttachKeyboard = (target, pad) => {
  const handle = (event: KeyboardEvent, down: boolean) => {
    const code = event.code as Binding
    if (!pad.wants(code) || isTextField(event.target)) return
    if (
      (event.ctrlKey || event.metaKey || event.altKey) &&
      !isModifierKey(event.code)
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
