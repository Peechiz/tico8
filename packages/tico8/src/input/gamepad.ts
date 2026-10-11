import type { AttachGamepads, ButtonName } from './types.ts'

/** The standard layout, by button index. */
const BUTTONS: readonly ButtonName[] = [
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
]

/** How far a trigger is pulled before it counts as down. */
const TRIGGER_DOWN = 0.5

/** Reads every controller with the standard layout into the pad. */
export const attachGamepads: AttachGamepads = (source, pad) => {
  // What each controller last reported, by its index.
  const held = new Map<number, boolean[]>()
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
        if (gp.mapping !== 'standard') {
          if (!warned.has(gp.index)) {
            warned.add(gp.index)
            console.warn(
              `tico8: ignoring controller "${gp.id}", it has no standard layout`,
            )
          }
          continue
        }
        seen.add(gp.index)
        const device = name(gp.index)
        let last = held.get(gp.index)
        if (!last) {
          last = []
          held.set(gp.index, last)
        }
        BUTTONS.forEach((button, i) => {
          const b = gp.buttons[i]
          const down = !!b && (b.pressed || b.value > TRIGGER_DOWN)
          if (down === (last[i] ?? false)) return
          last[i] = down
          pad.set(device, button, down)
        })
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
