import type { Vec } from '../vec.ts'
import { DEFAULT_KEYS } from './keys.ts'
import {
  type Binding,
  type ButtonName,
  type CreatePad,
  EXTRAS,
  type FullInput,
  MOUSE_BUTTONS,
  STANDARD,
} from './types.ts'

/** How far a stick moves from rest before it counts, as a part of its reach. */
const DEAD_ZONE = 0.2

/** How far the left stick is pushed along an axis before it is a direction. */
const HALFWAY = 0.5

type Side = 'left' | 'right'

/** One button or action: `held`, `pressed` and `released` are what game code sees. */
interface Slot {
  held: boolean
  pressed: boolean
  released: boolean
  /** Live device state, ahead of `held` until the next sample. */
  down: boolean
  pendingPress: boolean
  pendingRelease: boolean
}

function createSlot(): Slot {
  return {
    held: false,
    pressed: false,
    released: false,
    down: false,
    pendingPress: false,
    pendingRelease: false,
  }
}

/** A stick with the dead zone taken out, no longer than 1. */
function settle(x: number, y: number): Vec {
  const length = Math.hypot(x, y)
  if (!(length > DEAD_ZONE)) return { x: 0, y: 0 }
  const scale = Math.min(1, (length - DEAD_ZONE) / (1 - DEAD_ZONE)) / length
  // Adding 0 turns -0 into 0.
  return { x: x * scale + 0, y: y * scale + 0 }
}

/** The directions a left stick gives. */
function tilt(x: number, y: number): ButtonName[] {
  const names: ButtonName[] = []
  if (x < -HALFWAY) names.push('left')
  if (x > HALFWAY) names.push('right')
  if (y < -HALFWAY) names.push('up')
  if (y > HALFWAY) names.push('down')
  return names
}

export const createPad: CreatePad = (options = {}) => {
  const slots: Slot[] = []
  const slot = () => {
    const made = createSlot()
    slots.push(made)
    return made
  }

  /** The slots each control drives. A control that is not here drives nothing. */
  const drives = new Map<string, Slot[]>()

  const actions: Record<string, Slot> = {}
  for (const [name, bindings] of Object.entries(options.actions ?? {})) {
    const action = slot()
    actions[name] = action
    for (const binding of bindings) {
      const driven = drives.get(binding) ?? []
      driven.push(action)
      drives.set(binding, driven)
    }
  }

  // A button or mouse button drives itself, then the actions bound to it.
  const own = (name: string) => {
    const made = slot()
    drives.set(name, [made, ...(drives.get(name) ?? [])])
    return made
  }

  const buttons = {} as Record<ButtonName, Slot>
  for (const name of [...STANDARD, ...EXTRAS]) buttons[name] = own(name)
  const [left, right, middle] = MOUSE_BUTTONS.map(own) as [Slot, Slot, Slot]

  // A default key stands for its button, unless an action took the key.
  for (const [key, name] of Object.entries(DEFAULT_KEYS)) {
    if (!drives.has(key)) drives.set(key, drives.get(name) ?? [])
  }

  /** The controls each device holds down. */
  const holds = new Map<string, Set<string>>()
  /** The directions each device's left stick gives. */
  const tilts = new Map<string, readonly ButtonName[]>()
  /** Where each device's sticks are, ahead of `input` until the next sample. */
  const sticks = new Map<string, Record<Side, Vec>>()
  const stick: Record<Side, Vec> = {
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  }

  const pointer = { x: 0, y: 0, inside: false }
  const mouse = {
    x: 0,
    y: 0,
    inside: false,
    left,
    right,
    middle,
  }

  /** Work out which slots are down from what the devices hold. */
  const refresh = (letGo = false) => {
    const live = new Set<Slot>()
    for (const group of [holds, tilts]) {
      for (const controls of group.values()) {
        for (const control of controls) {
          for (const driven of drives.get(control) ?? []) live.add(driven)
        }
      }
    }
    for (const each of slots) {
      const down = live.has(each)
      if (down === each.down) continue
      each.down = down
      if (down) {
        each.pendingPress = true
      } else if (letGo) {
        // Dropped, not released by hand: no press is owed for it.
        each.pendingPress = false
        each.pendingRelease ||= each.held
      } else {
        each.pendingRelease = true
      }
    }
  }

  const furthest = (side: Side): Vec => {
    let best = { x: 0, y: 0 }
    let reach = 0
    for (const at of sticks.values()) {
      const length = Math.hypot(at[side].x, at[side].y)
      if (length > reach) {
        best = at[side]
        reach = length
      }
    }
    return { x: best.x, y: best.y }
  }

  const axis = (neg: Slot, pos: Slot) => (pos.held ? 1 : 0) - (neg.held ? 1 : 0)

  const input = {
    ...actions,
    ...buttons,
    mouse,
    get dir() {
      return {
        x: axis(buttons.left, buttons.right),
        y: axis(buttons.up, buttons.down),
      }
    },
    get leftStick() {
      return { x: stick.left.x, y: stick.left.y }
    },
    get rightStick() {
      return { x: stick.right.x, y: stick.right.y }
    },
  } as FullInput

  return {
    input,
    get raw(): never {
      throw new Error('not yet')
    },
    mute() {
      throw new Error('not yet')
    },
    wants(control: Binding) {
      return (drives.get(control)?.length ?? 0) > 0
    },
    set(device, control, down) {
      if (!drives.has(control)) return
      let held = holds.get(device)
      if (!held) {
        held = new Set()
        holds.set(device, held)
      }
      if (down) held.add(control)
      else held.delete(control)
      refresh()
    },
    stick(device, side, x, y) {
      let at = sticks.get(device)
      if (!at) {
        at = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }
        sticks.set(device, at)
      }
      at[side] = settle(x, y)
      if (side === 'left') {
        tilts.set(device, tilt(x, y))
        refresh()
      }
    },
    point(x, y, inside) {
      pointer.x = Math.floor(x)
      pointer.y = Math.floor(y)
      pointer.inside = inside
    },
    releaseAll(device) {
      if (device === undefined) {
        holds.clear()
        tilts.clear()
        sticks.clear()
      } else {
        holds.delete(device)
        tilts.delete(device)
        sticks.delete(device)
      }
      refresh(true)
    },
    sample() {
      for (const each of slots) {
        if (each.pendingPress && !each.down) {
          // A tap between samples: show it down now, up at the next sample.
          each.held = true
          each.pressed = true
          each.released = false
          each.pendingPress = false
        } else {
          // Only a button that was seen down can be seen coming up.
          each.released = each.pendingRelease && each.held
          each.held = each.down
          each.pressed = each.pendingPress
          each.pendingPress = false
          each.pendingRelease = false
        }
      }
      stick.left = furthest('left')
      stick.right = furthest('right')
      mouse.x = pointer.x
      mouse.y = pointer.y
      mouse.inside = pointer.inside
    },
  }
}
