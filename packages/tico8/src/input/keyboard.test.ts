import { describe, expect, it } from 'vitest'
import { attachKeyboard } from './keyboard.ts'
import type { Binding, Pad } from './types.ts'

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

/** A pad that records what it is told and wants the keys it is given. */
function fakePad(
  wanted: readonly string[] = ['KeyZ', 'ArrowDown', 'ControlLeft'],
) {
  const calls: string[] = []
  const pad = {
    wants: (control: Binding) => wanted.includes(control),
    set: (device: string, control: Binding, down: boolean) => {
      calls.push(`${device} ${control} ${down ? 'down' : 'up'}`)
    },
    releaseAll: (device?: string) => {
      calls.push(`releaseAll ${device}`)
    },
  }
  return { pad: pad as unknown as Pad, calls }
}

describe('attachKeyboard', () => {
  it('sends wanted keys to the pad on keydown and keyup', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ'))
    fire('keyup', key('KeyZ'))
    expect(calls).toEqual(['keyboard KeyZ down', 'keyboard KeyZ up'])
  })

  it('prevents default for wanted keys only', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const arrow = key('ArrowDown')
    const other = key('KeyQ')
    fire('keydown', arrow)
    fire('keydown', other)
    expect(arrow.prevented).toBe(true)
    expect(other.prevented).toBe(false)
    expect(calls).toEqual(['keyboard ArrowDown down'])
  })

  it('leaves keys alone while Ctrl, Meta or Alt is held', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      const { pad, calls } = fakePad()
      const { win, fire } = fakeWindow()
      attachKeyboard(win, pad)
      const event = key('KeyZ', { [mod]: true })
      fire('keydown', event)
      expect(event.prevented, mod).toBe(false)
      expect(calls, mod).toEqual([])
    }
  })

  it('does not leave a key stuck when a modifier is held at keyup', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const up = key('KeyZ', { ctrlKey: true })
    fire('keyup', up)
    expect(up.prevented).toBe(false)
    expect(calls).toEqual(['keyboard KeyZ up'])
  })

  it('still sends a modifier key itself, which sets its own flag', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const event = key('ControlLeft', { ctrlKey: true })
    fire('keydown', event)
    expect(event.prevented).toBe(true)
    expect(calls).toEqual(['keyboard ControlLeft down'])
  })

  it('ignores text fields', () => {
    const targets = [
      { tagName: 'INPUT' },
      { tagName: 'TEXTAREA' },
      { tagName: 'DIV', isContentEditable: true },
    ]
    for (const target of targets) {
      const { pad, calls } = fakePad()
      const { win, fire } = fakeWindow()
      attachKeyboard(win, pad)
      const event = key('KeyZ', { target })
      fire('keydown', event)
      expect(event.prevented).toBe(false)
      expect(calls).toEqual([])
    }
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ', { target: { tagName: 'CANVAS' } }))
    expect(calls).toEqual(['keyboard KeyZ down'])
  })

  it('releases the keyboard on blur', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('blur')
    expect(calls).toEqual(['releaseAll keyboard'])
  })

  it('removes every listener when detached', () => {
    const { pad, calls } = fakePad()
    const { win, fire, count } = fakeWindow()
    const detach = attachKeyboard(win, pad)
    expect(count()).toBe(3)
    detach()
    expect(count()).toBe(0)
    fire('keydown', key('KeyZ'))
    expect(calls).toEqual([])
  })

  it('reads a key with no code by its key on a US layout', () => {
    const { pad, calls } = fakePad(['KeyZ', 'Space', 'ArrowDown'])
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const down = key('', { key: 'z' })
    fire('keydown', down)
    fire('keyup', key('', { key: 'z' }))
    fire('keydown', key('', { key: 'Z' }))
    fire('keyup', key('', { key: 'Z' }))
    fire('keydown', key('', { key: ' ' }))
    fire('keydown', { key: 'ArrowDown', preventDefault() {} })
    fire('keydown', key('', { key: 'Unidentified' }))
    expect(down.prevented).toBe(true)
    expect(calls).toEqual([
      'keyboard KeyZ down',
      'keyboard KeyZ up',
      'keyboard KeyZ down',
      'keyboard KeyZ up',
      'keyboard Space down',
      'keyboard ArrowDown down',
    ])
  })

  it('reads a modifier with no code as its left key', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    const event = key('', { key: 'Control', ctrlKey: true })
    fire('keydown', event)
    fire('keydown', key('', { key: 'z', ctrlKey: true }))
    expect(event.prevented).toBe(true)
    expect(calls).toEqual(['keyboard ControlLeft down'])
  })

  it('reads an event with a code by its code, not its key', () => {
    const { pad, calls } = fakePad()
    const { win, fire } = fakeWindow()
    attachKeyboard(win, pad)
    fire('keydown', key('KeyZ', { key: 'y' }))
    fire('keydown', key('KeyY', { key: 'z' }))
    expect(calls).toEqual(['keyboard KeyZ down'])
  })
})
