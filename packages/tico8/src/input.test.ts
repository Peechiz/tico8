import { describe, expect, it } from 'vitest'
import { attachKeyboard, createPad } from './input.ts'

function state(b: { held: boolean; pressed: boolean; released: boolean }) {
  return [b.held, b.pressed, b.released]
}

describe('createPad', () => {
  it('changes only on sample', () => {
    const pad = createPad()
    pad.press('a')
    expect(state(pad.input.a)).toEqual([false, false, false])
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, true, false])
  })

  it('reports pressed and released for exactly one update each', () => {
    const pad = createPad()
    pad.press('a')
    pad.sample()
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
    pad.release('a')
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, false])
  })

  it('keeps a tap between two samples', () => {
    const pad = createPad()
    pad.press('b')
    pad.release('b')
    pad.sample()
    expect(state(pad.input.b)).toEqual([true, true, false])
    pad.sample()
    expect(state(pad.input.b)).toEqual([false, false, true])
    pad.sample()
    expect(state(pad.input.b)).toEqual([false, false, false])
  })

  it('ignores auto-repeat presses', () => {
    const pad = createPad()
    pad.press('a')
    pad.sample()
    pad.press('a')
    pad.press('a')
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
  })

  it('releaseAll releases held buttons', () => {
    const pad = createPad()
    pad.press('a')
    pad.press('left')
    pad.sample()
    pad.releaseAll()
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
    expect(state(pad.input.left)).toEqual([false, false, true])
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
  })

  it('releaseAll leaves no stale pressed', () => {
    const pad = createPad()
    pad.press('a')
    pad.releaseAll()
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, false])
  })

  it('builds dir from held directions', () => {
    const pad = createPad()
    pad.press('left')
    pad.press('up')
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
    pad.sample()
    expect(pad.input.dir).toEqual({ x: -1, y: -1 })
    pad.press('right')
    pad.release('up')
    pad.press('down')
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 0, y: 1 })
    pad.release('left')
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 1, y: 1 })
  })

  it('gives a fresh dir each read', () => {
    const pad = createPad()
    pad.press('right')
    pad.sample()
    const d = pad.input.dir
    d.x = 9
    expect(pad.input.dir).toEqual({ x: 1, y: 0 })
    expect(pad.input.dir).not.toBe(pad.input.dir)
  })

  it('keeps input and button objects stable', () => {
    const pad = createPad()
    const { input } = pad
    const jump = input.a
    expect(pad.input).toBe(input)
    pad.press('a')
    pad.sample()
    expect(pad.input.a).toBe(jump)
    expect(jump.pressed).toBe(true)
  })

  it('works as a bare function reference', () => {
    const pad = createPad()
    const { sample } = pad
    pad.press('x')
    sample()
    expect(pad.input.x.held).toBe(true)
  })
})

type Listener = (event: unknown) => void

function fakeWindow() {
  const listeners = new Map<string, Set<Listener>>()
  const win = {
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn)
    },
  }
  const fire = (type: string, event: object = {}) => {
    for (const fn of listeners.get(type) ?? []) fn(event)
  }
  const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0)
  return { win: win as unknown as Window, fire, count }
}

function key(code: string, extra: object = {}) {
  const event = {
    code,
    prevented: false,
    preventDefault() {
      event.prevented = true
    },
    ...extra,
  }
  return event
}

describe('attachKeyboard', () => {
  it('maps keys to buttons on keydown and keyup', () => {
    const map = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      KeyZ: 'a',
      KeyX: 'b',
      KeyA: 'x',
      KeyS: 'y',
    } as const
    for (const [code, name] of Object.entries(map)) {
      const pad = createPad()
      const { win, fire } = fakeWindow()
      attachKeyboard(win, pad)
      fire('keydown', key(code))
      pad.sample()
      expect(pad.input[name].held, code).toBe(true)
      fire('keyup', key(code))
      pad.sample()
      expect(pad.input[name].held, code).toBe(false)
    }
  })

  it('prevents default for mapped keys only', () => {
    const pad = createPad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const arrow = key('ArrowDown')
    const other = key('KeyQ')
    fire('keydown', arrow)
    fire('keydown', other)
    expect(arrow.prevented).toBe(true)
    expect(other.prevented).toBe(false)
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 0, y: 1 })
  })

  it('leaves keys alone while Ctrl, Meta or Alt is held', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      const pad = createPad()
      const { win, fire } = fakeWindow()
      attachKeyboard(win, pad)
      const event = key('KeyZ', { [mod]: true })
      fire('keydown', event)
      pad.sample()
      expect(event.prevented, mod).toBe(false)
      expect(pad.input.a.held, mod).toBe(false)
    }
  })

  it('does not leave a key stuck when a modifier is held at keyup', () => {
    const pad = createPad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ'))
    pad.sample()
    const up = key('KeyZ', { ctrlKey: true })
    fire('keyup', up)
    pad.sample()
    expect(up.prevented).toBe(false)
    expect(pad.input.a.held).toBe(false)
  })

  it('ignores text fields', () => {
    const targets = [
      { tagName: 'INPUT' },
      { tagName: 'TEXTAREA' },
      { tagName: 'DIV', isContentEditable: true },
    ]
    for (const target of targets) {
      const pad = createPad()
      const { win, fire } = fakeWindow()
      attachKeyboard(win, pad)
      const event = key('KeyZ', { target })
      fire('keydown', event)
      pad.sample()
      expect(event.prevented).toBe(false)
      expect(pad.input.a.held).toBe(false)
    }
    const pad = createPad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ', { target: { tagName: 'CANVAS' } }))
    pad.sample()
    expect(pad.input.a.held).toBe(true)
  })

  it('releases everything on blur', () => {
    const pad = createPad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ'))
    fire('keydown', key('ArrowLeft'))
    pad.sample()
    fire('blur')
    pad.sample()
    expect(pad.input.a.held).toBe(false)
    expect(pad.input.a.released).toBe(true)
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
  })

  it('removes every listener when detached', () => {
    const pad = createPad()
    const { win, fire, count } = fakeWindow()
    const detach = attachKeyboard(win, pad)
    expect(count()).toBe(3)
    detach()
    expect(count()).toBe(0)
    fire('keydown', key('KeyZ'))
    pad.sample()
    expect(pad.input.a.held).toBe(false)
  })
})
