import type { AttachGamepads, ButtonName } from './types.ts'

/** Where a controller keeps each control, as its browser reports it. */
interface Layout {
  /** The button at each index. */
  buttons: readonly (ButtonName | undefined)[]
  /** The axis the d-pad is on, for a controller that has no d-pad buttons. */
  hat?: number
}

/** The browser's standard layout. Both sticks are on axes 0 to 3. */
const STANDARD: Layout = {
  buttons: [
    'a',
    'b',
    'x',
    'y',
    'l1',
    'r1',
    'l2',
    'r2',
    'select',
    'start',
    'l3',
    'r3',
    'up',
    'down',
    'left',
    'right',
  ],
}

/**
 * A PS5 controller as Firefox hands it over, with no layout of its own:
 * square first, and the d-pad as one axis.
 */
const DUALSENSE: Layout = {
  buttons: [
    'x',
    'a',
    'b',
    'y',
    'l1',
    'r1',
    'l2',
    'r2',
    'select',
    'start',
    'l3',
    'r3',
  ],
  hat: 6,
}

/** Layouts for controllers a browser gives no standard layout, by id. */
const KNOWN: readonly (readonly [RegExp, Layout])[] = [
  // Sony's DualSense and DualSense Edge, by vendor and product.
  [/054c\W+(0ce6|0df2)/i, DUALSENSE],
]

function layoutOf(gp: Gamepad): Layout | undefined {
  if (gp.mapping === 'standard') return STANDARD
  return KNOWN.find(([id]) => id.test(gp.id))?.[1]
}

/**
 * The d-pad directions held, from a hat axis. It runs from -1 at up, by
 * sevenths, clockwise through eight positions, and rests past the last.
 */
const HAT: readonly (readonly ButtonName[])[] = [
  ['up'],
  ['up', 'right'],
  ['right'],
  ['right', 'down'],
  ['down'],
  ['down', 'left'],
  ['left'],
  ['left', 'up'],
]

function hatHeld(value: number): readonly ButtonName[] {
  return HAT[Math.round((value + 1) * 3.5)] ?? []
}

/** How far a trigger is pulled before it counts as down. */
const TRIGGER_DOWN = 0.5

/** Reads every controller whose layout is known into the pad. */
export const attachGamepads: AttachGamepads = (source, pad) => {
  // What each controller last reported, by its index.
  const held = new Map<number, Set<ButtonName>>()
  const warned = new Set<number>()
  let attached = true

  const read = (): readonly (Gamepad | null | undefined)[] => {
    try {
      return source.getGamepads() ?? []
    } catch {
      return []
    }
  }

  const name = (index: number) => `gamepad${index}`

  const drop = (index: number) => {
    pad.releaseAll(name(index))
    held.delete(index)
  }

  return {
    poll() {
      if (!attached) return
      const seen = new Set<number>()
      for (const gp of read()) {
        if (!gp?.connected) continue
        const layout = layoutOf(gp)
        if (!layout) {
          if (!warned.has(gp.index)) {
            warned.add(gp.index)
            console.warn(
              `tico8: ignoring controller "${gp.id}", its layout is not known`,
            )
          }
          continue
        }
        seen.add(gp.index)
        const device = name(gp.index)
        let last = held.get(gp.index)
        if (!last) {
          last = new Set()
          held.set(gp.index, last)
        }
        const now = new Set<ButtonName>()
        layout.buttons.forEach((button, i) => {
          const b = gp.buttons[i]
          if (button && b && (b.pressed || b.value > TRIGGER_DOWN)) {
            now.add(button)
          }
        })
        if (layout.hat !== undefined) {
          for (const button of hatHeld(gp.axes[layout.hat] ?? 2))
            now.add(button)
        }
        for (const button of now) {
          if (!last.has(button)) pad.set(device, button, true)
        }
        for (const button of last) {
          if (!now.has(button)) pad.set(device, button, false)
        }
        held.set(gp.index, now)
        const [lx = 0, ly = 0, rx = 0, ry = 0] = gp.axes
        pad.stick(device, 'left', lx, ly)
        pad.stick(device, 'right', rx, ry)
      }
      for (const index of [...held.keys()]) {
        if (!seen.has(index)) drop(index)
      }
    },
    detach() {
      for (const index of [...held.keys()]) drop(index)
      attached = false
    },
  }
}
