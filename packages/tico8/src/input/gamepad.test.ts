import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachGamepads } from './gamepad.ts'
import type { Pad } from './types.ts'

function fakePad() {
  const calls: unknown[][] = []
  const pad = {
    set: (...a: unknown[]) => calls.push(['set', ...a]),
    stick: (...a: unknown[]) => calls.push(['stick', ...a]),
    releaseAll: (...a: unknown[]) => calls.push(['releaseAll', ...a]),
  } as unknown as Pad
  const only = (kind: string) => calls.filter((c) => c[0] === kind)
  return { pad, calls, only }
}

interface Spec {
  index?: number
  mapping?: string
  connected?: boolean
  down?: readonly number[]
  values?: Record<number, number>
  axes?: number[]
  id?: string
}

function gamepad(spec: Spec = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: spec.down?.includes(i) ?? false,
    value: spec.values?.[i] ?? (spec.down?.includes(i) ? 1 : 0),
  }))
  return {
    index: spec.index ?? 0,
    id: spec.id ?? 'fake pad',
    mapping: spec.mapping ?? 'standard',
    connected: spec.connected ?? true,
    buttons,
    axes: spec.axes ?? [0, 0, 0, 0],
  } as unknown as Gamepad
}

function setup(initial: (Gamepad | null)[] = []) {
  let list = initial
  const source = { getGamepads: () => list } as Pick<Navigator, 'getGamepads'>
  const f = fakePad()
  const gamepads = attachGamepads(source, f.pad)
  return { ...f, gamepads, show: (next: (Gamepad | null)[]) => (list = next) }
}

afterEach(() => vi.restoreAllMocks())

describe('attachGamepads', () => {
  it('reports a button going down once, and up once', () => {
    const t = setup([gamepad({ down: [0] })])
    t.gamepads.poll()
    t.gamepads.poll()
    expect(t.only('set')).toEqual([['set', 'gamepad0', 'a', true]])
    t.show([gamepad()])
    t.gamepads.poll()
    expect(t.only('set')).toEqual([
      ['set', 'gamepad0', 'a', true],
      ['set', 'gamepad0', 'a', false],
    ])
  })

  it('maps the standard layout by index', () => {
    const t = setup([gamepad({ down: [1, 2, 3, 9, 12, 15] })])
    t.gamepads.poll()
    expect(t.only('set').map((c) => c[2])).toEqual([
      'b',
      'x',
      'y',
      'start',
      'up',
      'right',
    ])
  })

  it('counts a trigger pulled past half as down', () => {
    const t = setup([gamepad({ values: { 6: 0.4, 7: 0.8 } })])
    t.gamepads.poll()
    expect(t.only('set')).toEqual([['set', 'gamepad0', 'r2', true]])
  })

  it('sends raw stick values for both sticks', () => {
    const t = setup([gamepad({ axes: [0.25, -1, 0.5, 0.75] })])
    t.gamepads.poll()
    expect(t.only('stick')).toEqual([
      ['stick', 'gamepad0', 'left', 0.25, -1],
      ['stick', 'gamepad0', 'right', 0.5, 0.75],
    ])
  })

  it('keeps controllers apart by index', () => {
    const t = setup([null, gamepad({ index: 1, down: [0] })])
    t.gamepads.poll()
    expect(t.only('set')).toEqual([['set', 'gamepad1', 'a', true]])
  })

  it('lets go of a controller that is unplugged, once', () => {
    const t = setup([gamepad({ down: [0] })])
    t.gamepads.poll()
    t.show([null])
    t.gamepads.poll()
    t.gamepads.poll()
    expect(t.only('releaseAll')).toEqual([['releaseAll', 'gamepad0']])
  })

  it('treats connected false as unplugged', () => {
    const t = setup([gamepad({ down: [0] })])
    t.gamepads.poll()
    t.show([gamepad({ connected: false })])
    t.gamepads.poll()
    expect(t.only('releaseAll')).toEqual([['releaseAll', 'gamepad0']])
  })

  it('reads a PS5 controller that Firefox gives no layout', () => {
    const id = '054c-0df2-DualSense Edge Wireless Controller'
    const raw = (down: number[], hat: number) =>
      gamepad({ id, mapping: '', down, axes: [0, 0, 0, 0, 0, 0, hat] })
    const t = setup([raw([1, 0, 5], 1.29)])
    t.gamepads.poll()
    // Cross is button 1 and square button 0.
    expect(t.only('set').map((c) => c[2])).toEqual(['x', 'a', 'r1'])

    // The d-pad is one axis: up, then down and left together, then rest.
    const dpad = (hat: number) => {
      t.calls.length = 0
      t.show([raw([], hat)])
      t.gamepads.poll()
      return t.only('set').map((c) => [c[2], c[3]])
    }
    dpad(1.29)
    expect(dpad(-1)).toEqual([['up', true]])
    expect(dpad(0.43)).toEqual([
      ['down', true],
      ['left', true],
      ['up', false],
    ])
    expect(dpad(0.71)).toEqual([['down', false]])
    expect(dpad(1.29)).toEqual([['left', false]])
  })

  it('ignores a non-standard controller and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = setup([gamepad({ mapping: '', down: [0] })])
    t.gamepads.poll()
    t.gamepads.poll()
    expect(t.calls).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('treats a throwing getGamepads as no controllers', () => {
    const f = fakePad()
    const gamepads = attachGamepads(
      {
        getGamepads: () => {
          throw new Error('blocked')
        },
      },
      f.pad,
    )
    expect(() => gamepads.poll()).not.toThrow()
    expect(f.calls).toEqual([])
  })

  it('detach lets go of what is held and then does nothing', () => {
    const t = setup([gamepad({ down: [0] }), gamepad({ index: 1 })])
    t.gamepads.poll()
    t.gamepads.detach()
    expect(t.only('releaseAll')).toEqual([
      ['releaseAll', 'gamepad0'],
      ['releaseAll', 'gamepad1'],
    ])
    const before = t.calls.length
    t.gamepads.poll()
    expect(t.calls.length).toBe(before)
  })
})
