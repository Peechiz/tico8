import { describe, expect, it } from 'vitest'
import { attachMouse } from './mouse.ts'
import type { Binding, Pad } from './types.ts'

type Listener = (event: unknown) => void

function fakeTarget() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn)
    },
    fire: (type: string, event: object = {}) => {
      for (const fn of listeners.get(type) ?? []) fn(event)
    },
    count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
}

/** A canvas of 160x144 game pixels shown `scale` times as large, at 10, 20. */
function setup(scale = 3) {
  const win = fakeTarget()
  const canvas = fakeTarget()
  const rect = { left: 10, top: 20, width: 160 * scale, height: 144 * scale }
  const el = {
    ...canvas,
    ownerDocument: { defaultView: win },
    getBoundingClientRect: () => rect,
  }
  const calls: unknown[][] = []
  const pad = {
    point: (...a: unknown[]) => calls.push(['point', ...a]),
    set: (...a: [string, Binding, boolean]) => calls.push(['set', ...a]),
    releaseAll: (...a: unknown[]) => calls.push(['releaseAll', ...a]),
  } as unknown as Pad
  const detach = attachMouse(
    el as unknown as HTMLElement,
    { width: 160, height: 144 },
    pad,
  )
  const move = (x: number, y: number) =>
    win.fire('mousemove', { clientX: 10 + x, clientY: 20 + y })
  const down = (button: number, x = 0, y = 0) =>
    canvas.fire('mousedown', { button, clientX: 10 + x, clientY: 20 + y })
  const up = (button: number, x = 0, y = 0) =>
    win.fire('mouseup', { button, clientX: 10 + x, clientY: 20 + y })
  return { win, canvas, rect, calls, detach, move, down, up }
}

describe('attachMouse', () => {
  it('reports a pointer over a canvas shown at three times its size in game pixels', () => {
    const { calls, move } = setup(3)
    move(30, 60)
    move(479, 431)
    expect(calls).toEqual([
      ['point', 10, 20, true],
      ['point', 159, 143, true],
    ])
  })

  it('keeps counting past the edges and says it is outside', () => {
    const { calls, move } = setup(3)
    move(-4, -1)
    move(480, 432)
    expect(calls).toEqual([
      ['point', -2, -1, false],
      ['point', 160, 144, false],
    ])
  })

  it('reads the canvas size at event time', () => {
    const { calls, rect, move } = setup(3)
    rect.width = 160
    rect.height = 144
    move(50, 60)
    expect(calls).toEqual([['point', 50, 60, true]])
  })

  it('maps buttons 0, 1 and 2 and updates the position on press', () => {
    const { calls, down, up } = setup(1)
    down(0, 5, 6)
    down(1, 5, 6)
    down(2, 5, 6)
    up(0, 7, 8)
    up(1)
    up(2)
    const sets = calls.filter((c) => c[0] === 'set')
    expect(sets).toEqual([
      ['set', 'mouse', 'MouseLeft', true],
      ['set', 'mouse', 'MouseMiddle', true],
      ['set', 'mouse', 'MouseRight', true],
      ['set', 'mouse', 'MouseLeft', false],
      ['set', 'mouse', 'MouseMiddle', false],
      ['set', 'mouse', 'MouseRight', false],
    ])
    expect(calls[0]).toEqual(['point', 5, 6, true])
  })

  it('takes a release that happens off the canvas', () => {
    const { calls, down, up } = setup(1)
    down(0, 5, 5)
    up(0, 900, -50)
    expect(calls.at(-1)).toEqual(['set', 'mouse', 'MouseLeft', false])
    expect(calls.at(-2)).toEqual(['point', 900, -50, false])
  })

  it('ignores a release whose press did not start over the canvas', () => {
    const { calls, up } = setup(1)
    up(0, 5, 5)
    expect(calls).toEqual([])
  })

  it('ignores buttons past the third', () => {
    const { calls, down } = setup(1)
    down(3)
    expect(calls).toEqual([])
  })

  it('keeps the right-click menu off the canvas', () => {
    const { canvas } = setup()
    const event = {
      prevented: false,
      preventDefault() {
        event.prevented = true
      },
    }
    canvas.fire('contextmenu', event)
    expect(event.prevented).toBe(true)
  })

  it('lets go of the mouse when the window loses focus', () => {
    const { calls, win, down, up } = setup(1)
    down(0)
    win.fire('blur')
    expect(calls.at(-1)).toEqual(['releaseAll', 'mouse'])
    up(0)
    expect(calls.filter((c) => c[0] === 'set').length).toBe(1)
  })

  it('removes every listener when detached', () => {
    const { win, canvas, detach } = setup()
    expect(win.count() + canvas.count()).toBe(5)
    detach()
    expect(win.count() + canvas.count()).toBe(0)
  })
})
