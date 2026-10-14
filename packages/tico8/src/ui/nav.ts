import type { Input } from '../input/types.ts'
import type { Box, CreateNav, Direction, MenuEntry, Pick } from './types.ts'

/** What can take the highlight, unless it is disabled. */
const FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down']

/** Each direction as a unit step: x right, y down, as on the page. */
const STEP: Record<Direction, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

function centre(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export const pick: Pick = (from, candidates, direction) => {
  const start = centre(from)
  const step = STEP[direction]
  let best: number | undefined
  let bestScore = Number.POSITIVE_INFINITY
  candidates.forEach((box, index) => {
    const end = centre(box)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const along = dx * step.x + dy * step.y
    if (along <= 0) return
    const across = Math.abs(dx * step.y - dy * step.x)
    const score = along + 2 * across
    // Strictly less, so of two as near the first listed wins.
    if (score < bestScore) {
      best = index
      bestScore = score
    }
  })
  return best
}

/** The enabled elements in `menu` that can take the highlight, in document order. */
function focusables(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !('disabled' in element && element.disabled),
  )
}

export const createNav: CreateNav = (
  measure = (element) => element.getBoundingClientRect(),
) => {
  const stack: MenuEntry[] = []

  /** Where focus goes from `index` in `direction`, or undefined to stay. */
  const move = (
    elements: readonly HTMLElement[],
    index: number,
    direction: Direction,
  ) => {
    const boxes = elements.map(measure)
    if (boxes.every((box) => box.width === 0 && box.height === 0)) {
      // No layout to go by: back or forward in document order, no wrap.
      const next =
        direction === 'left' || direction === 'up' ? index - 1 : index + 1
      return next >= 0 && next < elements.length ? next : undefined
    }
    const from = boxes[index]
    if (from === undefined) return undefined
    const others = boxes.filter((_, i) => i !== index)
    const found = pick(from, others, direction)
    if (found === undefined) return undefined
    return found < index ? found : found + 1
  }

  return {
    get active() {
      return stack.length > 0
    },

    open(menu) {
      stack.push(menu)
      return () => {
        const index = stack.indexOf(menu)
        if (index !== -1) stack.splice(index, 1)
      }
    },

    step(pad: Input) {
      // Everything this update acts on the menu on top when it began, even
      // if a click closes it.
      const top = stack.at(-1)
      if (top === undefined) return
      const elements = focusables(top.element)
      const focused = elements.indexOf(
        top.element.ownerDocument.activeElement as HTMLElement,
      )
      if (focused === -1) {
        // Focus is elsewhere: take it, and let only Ⓑ act this update, so
        // nothing is chosen before it is seen.
        elements[0]?.focus()
      } else {
        let index = focused
        for (const direction of DIRECTIONS) {
          if (!pad[direction].pressed) continue
          const next = move(elements, index, direction)
          if (next !== undefined) index = next
        }
        const target = elements[index]
        if (index !== focused) target?.focus()
        if (pad.a.pressed) target?.click()
      }
      if (pad.b.pressed) top.onBack?.()
    },
  }
}
