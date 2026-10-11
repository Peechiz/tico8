import type { Vec } from './vec.ts'

export interface Button {
  /** Down right now. */
  readonly held: boolean
  /** Went down since the last update: true for one update. */
  readonly pressed: boolean
  /** Came up since the last update: true for one update. */
  readonly released: boolean
}

/** The standard pad: four directions and four buttons. */
export type ButtonName =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'a'
  | 'b'
  | 'x'
  | 'y'

export type Input = { readonly [K in ButtonName]: Button } & {
  /** The held directions as a vector: each of x and y is -1, 0 or 1. */
  readonly dir: Vec
}

/** The pad's inside: devices push presses in, the loop samples them. */
export interface Pad {
  /** What game code reads. It changes only when `sample` is called. */
  readonly input: Input
  press(name: ButtonName): void
  release(name: ButtonName): void
  releaseAll(): void
  /** Called once before each update, so a button is stable within one. */
  sample(): void
}

const NAMES: readonly ButtonName[] = [
  'left',
  'right',
  'up',
  'down',
  'a',
  'b',
  'x',
  'y',
]

/** Provisional key map, by `event.code`. */
const KEY_MAP: Readonly<Record<string, ButtonName>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyZ: 'a',
  KeyX: 'b',
  KeyA: 'x',
  KeyS: 'y',
}

/** One button: `held`, `pressed` and `released` are what game code sees. */
interface Slot {
  held: boolean
  pressed: boolean
  released: boolean
  /** Live device state, ahead of `held` until the next sample. */
  down: boolean
  pendingPress: boolean
  pendingRelease: boolean
}

export function createPad(): Pad {
  const slots = {} as Record<ButtonName, Slot>
  for (const name of NAMES) {
    slots[name] = {
      held: false,
      pressed: false,
      released: false,
      down: false,
      pendingPress: false,
      pendingRelease: false,
    }
  }

  const axis = (neg: Slot, pos: Slot) => (pos.held ? 1 : 0) - (neg.held ? 1 : 0)

  const input = {
    ...slots,
    get dir() {
      return { x: axis(slots.left, slots.right), y: axis(slots.up, slots.down) }
    },
  } as Input

  return {
    input,
    press(name) {
      const slot = slots[name]
      if (slot.down) return
      slot.down = true
      slot.pendingPress = true
    },
    release(name) {
      const slot = slots[name]
      if (!slot.down) return
      slot.down = false
      slot.pendingRelease = true
    },
    releaseAll() {
      for (const name of NAMES) {
        const slot = slots[name]
        slot.down = false
        slot.pendingPress = false
        slot.pendingRelease ||= slot.held
      }
    },
    sample() {
      for (const name of NAMES) {
        const slot = slots[name]
        if (slot.pendingPress && !slot.down) {
          // A tap between samples: show it down now, up at the next sample.
          slot.held = true
          slot.pressed = true
          slot.released = false
          slot.pendingPress = false
        } else {
          slot.held = slot.down
          slot.pressed = slot.pendingPress
          slot.released = slot.pendingRelease
          slot.pendingPress = false
          slot.pendingRelease = false
        }
      }
    },
  }
}

function isTextField(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (!el) return false
  const tag = el.tagName?.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

/** Feed keyboard keys into a pad. Returns a function that stops listening. */
export function attachKeyboard(target: Window, pad: Pad): () => void {
  const handle = (event: KeyboardEvent, down: boolean) => {
    const name = KEY_MAP[event.code]
    if (!name || isTextField(event.target)) return
    if (event.ctrlKey || event.metaKey || event.altKey) {
      // Leave the browser shortcut alone, but never leave a key stuck down.
      if (!down) pad.release(name)
      return
    }
    event.preventDefault()
    if (down) pad.press(name)
    else pad.release(name)
  }
  const onKeyDown = (event: KeyboardEvent) => handle(event, true)
  const onKeyUp = (event: KeyboardEvent) => handle(event, false)
  const onBlur = () => pad.releaseAll()

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('blur', onBlur)
  }
}
