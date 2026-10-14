// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Button, Input, StandardName } from '../input/types.ts'
import { DIRECTION_EVENT } from './context.ts'
import { createNav, pick } from './nav.ts'
import type { Box } from './types.ts'

const box = (x: number, y: number, width = 10, height = 10): Box => ({
  x,
  y,
  width,
  height,
})

const idle: Button = { held: false, pressed: false, released: false }
const press: Button = { held: true, pressed: true, released: false }

/** A pad with `names` pressed this update and everything else idle. */
function pad(...names: StandardName[]): Input {
  const buttons = Object.fromEntries(
    (['left', 'right', 'up', 'down', 'a', 'b', 'x', 'y'] as const).map(
      (name) => [name, names.includes(name) ? press : idle],
    ),
  ) as Record<StandardName, Button>
  return { ...buttons, dir: { x: 0, y: 0 } }
}

/** A menu in the document holding `html`. */
function menu(html: string): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = html
  document.body.append(element)
  return element
}

const focused = () => document.activeElement?.id

afterEach(() => {
  document.body.innerHTML = ''
})

describe('pick', () => {
  it('steps down a left-aligned list in order, whatever its widths', () => {
    // Resume, Quit to title, Music: on: a short one, a long one, a middling one.
    const from = box(0, 0, 24, 6)
    const below = [box(0, 9, 52, 6), box(0, 18, 36, 6)]
    expect(pick(from, below, 'down')).toBe(0)
    expect(pick(below[1]!, [from, below[0]!], 'up')).toBe(1)
  })

  const from = box(0, 0)
  // Right, left, below and above the box at 0, 0.
  const around = [box(20, 0), box(-20, 0), box(0, 20), box(0, -20)]

  it('finds the box each way', () => {
    expect(pick(from, around, 'right')).toBe(0)
    expect(pick(from, around, 'left')).toBe(1)
    expect(pick(from, around, 'down')).toBe(2)
    expect(pick(from, around, 'up')).toBe(3)
  })

  it('counts the gap across the direction double', () => {
    // 30 along and no gap beats 10 along with a gap of 15 (10 + 30).
    expect(pick(from, [box(10, 25), box(30, 0)], 'right')).toBe(1)
    // 10 along with a gap of 5 (10 + 10) beats 25 along and no gap.
    expect(pick(from, [box(10, 15), box(25, 0)], 'right')).toBe(0)
  })

  it('takes only boxes wholly past the edge that way', () => {
    // A wide box starting left of `from` but centred right of it is beside
    // it, not to its right.
    expect(pick(from, [box(-5, 0, 40, 10)], 'right')).toBeUndefined()
    expect(pick(from, [box(-5, 0, 40, 10)], 'left')).toBeUndefined()
    // Touching counts.
    expect(pick(from, [box(10, 0)], 'right')).toBe(0)
  })

  it('finds nothing beside a button in a left-aligned column', () => {
    // Effects, with the wider Volume two rows up and the narrower Back below.
    const effects = box(0, 18, 48, 6)
    const column = [box(0, 0, 64, 6), box(0, 9, 40, 6), box(0, 27, 16, 6)]
    expect(pick(effects, column, 'right')).toBeUndefined()
    expect(pick(effects, column, 'left')).toBeUndefined()
    expect(pick(effects, column, 'down')).toBe(2)
    expect(pick(effects, column, 'up')).toBe(1)
  })

  it('takes the first of two as near', () => {
    expect(pick(from, [box(20, 10), box(20, -10)], 'right')).toBe(0)
  })

  it('gives undefined when nothing lies that way', () => {
    expect(pick(from, [box(-20, 0), box(0, 20)], 'right')).toBeUndefined()
    expect(pick(from, [box(0, 0)], 'up')).toBeUndefined()
    expect(pick(from, [], 'down')).toBeUndefined()
  })
})

describe('createNav', () => {
  it('is active while a menu is open', () => {
    const nav = createNav()
    expect(nav.active).toBe(false)
    const close = nav.open({ element: menu('') })
    expect(nav.active).toBe(true)
    close()
    expect(nav.active).toBe(false)
  })

  it('does nothing with no menu open', () => {
    menu('<button id="one">1</button>')
    createNav().step(pad('a', 'down'))
    expect(document.activeElement).toBe(document.body)
  })

  it('focuses the first enabled focusable when focus is outside the menu', () => {
    const element = menu(
      '<button id="off" disabled>0</button><span>x</span><button id="one">1</button>',
    )
    const click = vi.fn()
    element.querySelector('#one')?.addEventListener('click', click)
    const nav = createNav()
    nav.open({ element })
    // Ⓐ and a direction do nothing on the update that takes focus.
    nav.step(pad('a', 'down'))
    expect(focused()).toBe('one')
    expect(click).not.toHaveBeenCalled()
  })

  it('still calls onBack on the update that takes focus', () => {
    const onBack = vi.fn()
    const nav = createNav()
    nav.open({ element: menu('<button id="one">1</button>'), onBack })
    nav.step(pad('b'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('moves by document order when nothing has layout', () => {
    const element = menu(
      '<button id="one">1</button><button disabled>x</button>' +
        '<a id="two" href="#">2</a><div tabindex="-1">x</div>' +
        '<input id="three">',
    )
    const nav = createNav()
    nav.open({ element })
    nav.step(pad())
    expect(focused()).toBe('one')
    nav.step(pad('up'))
    expect(focused()).toBe('one')
    nav.step(pad('down'))
    expect(focused()).toBe('two')
    nav.step(pad('right'))
    expect(focused()).toBe('three')
    nav.step(pad('down'))
    expect(focused()).toBe('three')
    nav.step(pad('left'))
    expect(focused()).toBe('two')
  })

  it('moves only when a direction is pressed, not held', () => {
    const nav = createNav()
    nav.open({
      element: menu('<button id="one">1</button><button id="two">2</button>'),
    })
    nav.step(pad())
    const held = {
      ...pad(),
      down: { held: true, pressed: false, released: false },
    }
    nav.step(held)
    expect(focused()).toBe('one')
  })

  it('moves by the measured boxes', () => {
    // A grid: one two / three four.
    const element = menu(
      '<button id="one">1</button><button id="two">2</button>' +
        '<button id="three">3</button><button id="four">4</button>',
    )
    const places: Record<string, Box> = {
      one: box(0, 0),
      two: box(20, 0),
      three: box(0, 20),
      four: box(20, 20),
    }
    const nav = createNav((element) => places[element.id] ?? box(0, 0))
    nav.open({ element })
    nav.step(pad())
    nav.step(pad('down'))
    expect(focused()).toBe('three')
    nav.step(pad('right'))
    expect(focused()).toBe('four')
    nav.step(pad('up'))
    expect(focused()).toBe('two')
    nav.step(pad('right'))
    expect(focused()).toBe('two')
    nav.step(pad('left'))
    expect(focused()).toBe('one')
  })

  it('clicks the focused element on Ⓐ', () => {
    const element = menu(
      '<button id="one">1</button><button id="two">2</button>',
    )
    const click = vi.fn()
    element.querySelector('#two')?.addEventListener('click', click)
    const nav = createNav()
    nav.open({ element })
    nav.step(pad())
    nav.step(pad('down'))
    nav.step(pad('a'))
    expect(click).toHaveBeenCalledOnce()
  })

  it('calls the top menu’s onBack on Ⓑ', () => {
    const onBack = vi.fn()
    const nav = createNav()
    nav.open({ element: menu('<button id="one">1</button>'), onBack })
    nav.step(pad())
    nav.step(pad('b'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('gives the pad to the top menu, and back when it closes', () => {
    const outerBack = vi.fn()
    const innerBack = vi.fn()
    const nav = createNav()
    nav.open({
      element: menu(
        '<button id="outer1">1</button><button id="outer2">2</button>',
      ),
      onBack: outerBack,
    })
    nav.step(pad())
    nav.step(pad('down'))
    expect(focused()).toBe('outer2')

    const close = nav.open({
      element: menu(
        '<button id="inner1">1</button><button id="inner2">2</button>',
      ),
      onBack: innerBack,
    })
    nav.step(pad())
    expect(focused()).toBe('inner1')
    nav.step(pad('down'))
    expect(focused()).toBe('inner2')
    nav.step(pad('b'))
    expect(innerBack).toHaveBeenCalledOnce()
    expect(outerBack).not.toHaveBeenCalled()

    close()
    nav.step(pad())
    expect(focused()).toBe('outer1')
    nav.step(pad('b'))
    expect(outerBack).toHaveBeenCalledOnce()
  })

  it('closes an entry whatever its place in the stack', () => {
    const nav = createNav()
    const closeOuter = nav.open({
      element: menu('<button id="outer">1</button>'),
    })
    const closeInner = nav.open({
      element: menu('<button id="inner">1</button>'),
    })
    closeOuter()
    nav.step(pad())
    expect(focused()).toBe('inner')
    closeInner()
    expect(nav.active).toBe(false)
  })

  describe('direction event', () => {
    const two = () =>
      menu('<button id="one">1</button><button id="two">2</button>')

    it('keeps the highlight when cancelled, and carries the direction', () => {
      const element = two()
      const seen: unknown[] = []
      element.querySelector('#one')?.addEventListener(DIRECTION_EVENT, (e) => {
        seen.push((e as CustomEvent).detail)
        e.preventDefault()
      })
      const nav = createNav()
      nav.open({ element })
      nav.step(pad())
      nav.step(pad('down'))
      expect(seen).toEqual(['down'])
      expect(focused()).toBe('one')
    })

    it('moves as before when not cancelled', () => {
      const element = two()
      const seen = vi.fn()
      element.addEventListener(DIRECTION_EVENT, seen)
      const nav = createNav()
      nav.open({ element })
      nav.step(pad())
      nav.step(pad('down'))
      expect(seen).toHaveBeenCalledOnce()
      expect(focused()).toBe('two')
    })

    it('is not sent on the update that takes focus', () => {
      const element = two()
      const seen = vi.fn()
      element.addEventListener(DIRECTION_EVENT, seen)
      const nav = createNav()
      nav.open({ element })
      nav.step(pad('down'))
      expect(seen).not.toHaveBeenCalled()
    })
  })
})
