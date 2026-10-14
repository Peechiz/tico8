import { describe, expect, it } from 'vitest'
import { createPad } from './pad.ts'
import {
  type Button,
  EXTRAS,
  MOUSE_BUTTONS,
  type Pad,
  STANDARD,
} from './types.ts'

function state(b: Button) {
  return [b.held, b.pressed, b.released]
}

function action(pad: Pad, name: string) {
  return pad.input[name] as Button
}

describe('createPad sampling', () => {
  it('changes only on sample', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    expect(state(pad.input.a)).toEqual([false, false, false])
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, true, false])
  })

  it('reports pressed and released for exactly one update each', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.sample()
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
    pad.set('keyboard', 'a', false)
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, false])
  })

  it('keeps a tap between two samples', () => {
    const pad = createPad()
    pad.set('keyboard', 'b', true)
    pad.set('keyboard', 'b', false)
    pad.sample()
    expect(state(pad.input.b)).toEqual([true, true, false])
    pad.sample()
    expect(state(pad.input.b)).toEqual([false, false, true])
    pad.sample()
    expect(state(pad.input.b)).toEqual([false, false, false])
  })

  it('does not report a release for a press that was never seen', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.set('keyboard', 'a', false)
    pad.set('keyboard', 'a', true)
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, true, false])
  })

  it('ignores auto-repeat presses', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.sample()
    pad.set('keyboard', 'a', true)
    pad.set('keyboard', 'a', true)
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
  })

  it('builds dir from held directions', () => {
    const pad = createPad()
    pad.set('keyboard', 'left', true)
    pad.set('keyboard', 'up', true)
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
    pad.sample()
    expect(pad.input.dir).toEqual({ x: -1, y: -1 })
    pad.set('keyboard', 'right', true)
    pad.set('keyboard', 'up', false)
    pad.set('keyboard', 'down', true)
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 0, y: 1 })
    pad.set('keyboard', 'left', false)
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 1, y: 1 })
  })

  it('gives a fresh dir each read', () => {
    const pad = createPad()
    pad.set('keyboard', 'right', true)
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
    pad.set('keyboard', 'a', true)
    pad.sample()
    expect(pad.input.a).toBe(jump)
    expect(jump.pressed).toBe(true)
  })

  it('works as a bare function reference', () => {
    const pad = createPad()
    const { set, sample } = pad
    set('keyboard', 'x', true)
    sample()
    expect(pad.input.x.held).toBe(true)
  })
})

describe('createPad buttons and actions', () => {
  it('has every button, both sticks, the mouse and each action', () => {
    const pad = createPad({ actions: { jump: ['a'], idle: [] } })
    for (const name of [...STANDARD, ...EXTRAS]) {
      expect(state(pad.input[name]), name).toEqual([false, false, false])
    }
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
    expect(pad.input.leftStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.rightStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.mouse.x).toBe(0)
    expect(pad.input.mouse.y).toBe(0)
    expect(pad.input.mouse.inside).toBe(false)
    for (const name of ['left', 'right', 'middle'] as const) {
      expect(state(pad.input.mouse[name]), name).toEqual([false, false, false])
    }
    expect(state(action(pad, 'jump'))).toEqual([false, false, false])
    expect(state(action(pad, 'idle'))).toEqual([false, false, false])
  })

  it('drives the extras by name', () => {
    const pad = createPad()
    for (const name of EXTRAS) pad.set('gamepad0', name, true)
    pad.sample()
    for (const name of EXTRAS) expect(pad.input[name].held, name).toBe(true)
  })

  it('keeps a button down while any device holds it', () => {
    const pad = createPad()
    pad.set('keyboard', 'KeyA', true)
    pad.set('gamepad0', 'a', true)
    pad.sample()
    pad.set('keyboard', 'KeyA', false)
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
    pad.set('gamepad0', 'a', false)
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
  })

  it('keeps an action down until a key and a controller button both let go', () => {
    const pad = createPad({ actions: { jump: ['a', 'Space'] } })
    pad.set('keyboard', 'Space', true)
    pad.set('gamepad0', 'a', true)
    pad.sample()
    expect(state(action(pad, 'jump'))).toEqual([true, true, false])
    pad.set('keyboard', 'Space', false)
    pad.sample()
    expect(state(action(pad, 'jump'))).toEqual([true, false, false])
    pad.set('gamepad0', 'a', false)
    pad.sample()
    expect(state(action(pad, 'jump'))).toEqual([false, false, true])
  })

  it('keeps a button down while two of its keys are held', () => {
    const pad = createPad()
    pad.set('keyboard', 'ShiftLeft', true)
    pad.set('keyboard', 'ShiftRight', true)
    pad.sample()
    pad.set('keyboard', 'ShiftLeft', false)
    pad.sample()
    expect(state(pad.input.select)).toEqual([true, false, false])
  })

  it('maps the default keys to their buttons', () => {
    const keys = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      KeyA: 'a',
      KeyS: 'b',
      KeyW: 'x',
      KeyD: 'y',
      Enter: 'start',
      ShiftLeft: 'select',
      ShiftRight: 'select',
    } as const
    for (const [key, name] of Object.entries(keys)) {
      const pad = createPad()
      pad.set('keyboard', key as keyof typeof keys, true)
      pad.sample()
      expect(pad.input[name].held, key).toBe(true)
    }
  })

  it('a button brings its default key to its actions', () => {
    const pad = createPad({ actions: { jump: ['a'] } })
    pad.set('keyboard', 'KeyA', true)
    pad.sample()
    expect(pad.input.a.held).toBe(true)
    expect(state(action(pad, 'jump'))).toEqual([true, true, false])
  })

  it('a key named in an action no longer presses its default button', () => {
    const pad = createPad({ actions: { jump: ['a'], strafe: ['KeyA'] } })
    pad.set('keyboard', 'KeyA', true)
    pad.sample()
    expect(action(pad, 'strafe').held).toBe(true)
    expect(pad.input.a.held).toBe(false)
    expect(action(pad, 'jump').held).toBe(false)
  })

  it('a control drives every action bound to it', () => {
    const pad = createPad({
      actions: { jump: ['Space', 'r1'], confirm: ['Space', 'r1'] },
    })
    pad.set('keyboard', 'Space', true)
    pad.sample()
    expect(action(pad, 'jump').pressed).toBe(true)
    expect(action(pad, 'confirm').pressed).toBe(true)
    pad.set('gamepad0', 'r1', true)
    pad.set('keyboard', 'Space', false)
    pad.sample()
    expect(pad.input.r1.pressed).toBe(true)
    expect(state(action(pad, 'jump'))).toEqual([true, false, false])
    expect(state(action(pad, 'confirm'))).toEqual([true, false, false])
  })

  it('an action with no bindings never goes down', () => {
    const pad = createPad({ actions: { idle: [] } })
    for (const name of [...STANDARD, ...EXTRAS, ...MOUSE_BUTTONS]) {
      pad.set('any', name, true)
    }
    pad.set('keyboard', 'Space', true)
    pad.sample()
    expect(state(action(pad, 'idle'))).toEqual([false, false, false])
  })

  it('ignores a control that drives nothing', () => {
    const pad = createPad()
    pad.set('keyboard', 'KeyQ', true)
    pad.set('keyboard', 'toString' as 'KeyQ', true)
    pad.sample()
    for (const name of [...STANDARD, ...EXTRAS]) {
      expect(pad.input[name].held, name).toBe(false)
    }
  })

  it('wants what drives something', () => {
    const pad = createPad({ actions: { jump: ['Space'], idle: [] } })
    for (const name of [...STANDARD, ...EXTRAS, ...MOUSE_BUTTONS]) {
      expect(pad.wants(name), name).toBe(true)
    }
    expect(pad.wants('Space')).toBe(true)
    expect(pad.wants('KeyA')).toBe(true)
    expect(pad.wants('ShiftRight')).toBe(true)
    expect(pad.wants('KeyQ')).toBe(false)
    expect(pad.wants('toString' as 'KeyQ')).toBe(false)
    expect(createPad().wants('Space')).toBe(false)
  })
})

describe('createPad mouse', () => {
  it('drives the mouse buttons and the actions bound to them', () => {
    const pad = createPad({ actions: { shoot: ['MouseLeft'] } })
    pad.set('mouse', 'MouseLeft', true)
    pad.set('mouse', 'MouseMiddle', true)
    expect(pad.input.mouse.left.held).toBe(false)
    pad.sample()
    expect(state(pad.input.mouse.left)).toEqual([true, true, false])
    expect(state(pad.input.mouse.middle)).toEqual([true, true, false])
    expect(state(pad.input.mouse.right)).toEqual([false, false, false])
    expect(state(action(pad, 'shoot'))).toEqual([true, true, false])
    pad.set('mouse', 'MouseLeft', false)
    pad.sample()
    expect(state(pad.input.mouse.left)).toEqual([false, false, true])
    expect(state(action(pad, 'shoot'))).toEqual([false, false, true])
  })

  it('moves the pointer on the next sample, in whole pixels', () => {
    const pad = createPad()
    const { mouse } = pad.input
    pad.point(12.9, -0.5, true)
    expect([mouse.x, mouse.y, mouse.inside]).toEqual([0, 0, false])
    pad.sample()
    expect([mouse.x, mouse.y, mouse.inside]).toEqual([12, -1, true])
    expect(pad.input.mouse).toBe(mouse)
    pad.point(200, 3, false)
    pad.sample()
    expect([mouse.x, mouse.y, mouse.inside]).toEqual([200, 3, false])
  })

  it('keeps the pointer where it was through releaseAll', () => {
    const pad = createPad()
    pad.point(5, 6, true)
    pad.sample()
    pad.releaseAll()
    pad.sample()
    expect([pad.input.mouse.x, pad.input.mouse.y]).toEqual([5, 6])
  })
})

describe('createPad sticks', () => {
  it('changes only on sample', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 0)
    pad.stick('gamepad0', 'right', 0, -1)
    expect(pad.input.leftStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.rightStick).toEqual({ x: 0, y: 0 })
    pad.sample()
    expect(pad.input.leftStick).toEqual({ x: 1, y: 0 })
    expect(pad.input.rightStick).toEqual({ x: 0, y: -1 })
  })

  it('is exactly 0, 0 inside the dead zone', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', -0.1, 0.1)
    pad.stick('gamepad0', 'right', 0, -0.2)
    pad.sample()
    expect(pad.input.leftStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.rightStick).toEqual({ x: 0, y: 0 })
  })

  it('starts from 0 at the edge of the dead zone', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 0.6, 0)
    pad.stick('gamepad0', 'right', 0, -0.21)
    pad.sample()
    expect(pad.input.leftStick.x).toBeCloseTo(0.5)
    expect(pad.input.leftStick.y).toBe(0)
    expect(pad.input.rightStick.x).toBe(0)
    expect(pad.input.rightStick.y).toBeCloseTo(-0.0125)
  })

  it('is never longer than 1', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 1)
    pad.sample()
    const { x, y } = pad.input.leftStick
    expect(Math.hypot(x, y)).toBeCloseTo(1)
    expect(x).toBeCloseTo(Math.SQRT1_2)
    expect(y).toBeCloseTo(Math.SQRT1_2)
  })

  it('reports the stick pushed furthest', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 0.4, 0)
    pad.stick('gamepad1', 'left', 0, -1)
    pad.sample()
    expect(pad.input.leftStick).toEqual({ x: 0, y: -1 })
    pad.stick('gamepad1', 'left', 0, 0)
    pad.sample()
    expect(pad.input.leftStick.x).toBeCloseTo(0.25)
    expect(pad.input.leftStick.y).toBe(0)
  })

  it('gives a fresh value each read', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 0)
    pad.sample()
    const s = pad.input.leftStick
    s.x = 9
    expect(pad.input.leftStick).toEqual({ x: 1, y: 0 })
  })

  it('the left stick past halfway gives directions', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', -0.6, 0.5)
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
    pad.sample()
    expect(state(pad.input.left)).toEqual([true, true, false])
    expect(pad.input.down.held).toBe(false)
    expect(pad.input.dir).toEqual({ x: -1, y: 0 })
    pad.stick('gamepad0', 'left', 0.6, -0.9)
    pad.sample()
    expect(state(pad.input.left)).toEqual([false, false, true])
    expect(pad.input.dir).toEqual({ x: 1, y: -1 })
    pad.stick('gamepad0', 'left', 0, 0)
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
  })

  it('the right stick gives no directions', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'right', 1, 1)
    pad.sample()
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
  })

  it('a stick direction drives the actions bound to it', () => {
    const pad = createPad({ actions: { climb: ['up'] } })
    pad.stick('gamepad0', 'left', 0, -1)
    pad.sample()
    expect(state(action(pad, 'climb'))).toEqual([true, true, false])
  })

  it('a stick and a d-pad hold a direction apart', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 0)
    pad.set('gamepad0', 'right', true)
    pad.sample()
    pad.set('gamepad0', 'right', false)
    pad.sample()
    expect(state(pad.input.right)).toEqual([true, false, false])
    pad.stick('gamepad0', 'left', 0, 0)
    pad.sample()
    expect(state(pad.input.right)).toEqual([false, false, true])
  })

  it('keeps a flick between two samples', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 0)
    pad.stick('gamepad0', 'left', 0, 0)
    pad.sample()
    expect(state(pad.input.right)).toEqual([true, true, false])
    pad.sample()
    expect(state(pad.input.right)).toEqual([false, false, true])
  })
})

describe('createPad releaseAll', () => {
  it('releases held buttons', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.set('keyboard', 'left', true)
    pad.sample()
    pad.releaseAll()
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
    expect(state(pad.input.left)).toEqual([false, false, true])
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
  })

  it('leaves no stale pressed', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.releaseAll()
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, false])
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, false])
  })

  it('lets go of one device and leaves the others', () => {
    const pad = createPad({ actions: { jump: ['a', 'Space'] } })
    pad.set('keyboard', 'Space', true)
    pad.set('keyboard', 'ArrowLeft', true)
    pad.set('gamepad0', 'a', true)
    pad.set('mouse', 'MouseLeft', true)
    pad.sample()
    pad.releaseAll('keyboard')
    pad.sample()
    expect(state(pad.input.left)).toEqual([false, false, true])
    expect(state(pad.input.a)).toEqual([true, false, false])
    expect(state(action(pad, 'jump'))).toEqual([true, false, false])
    expect(pad.input.mouse.left.held).toBe(true)
    pad.releaseAll('gamepad0')
    pad.sample()
    expect(state(action(pad, 'jump'))).toEqual([false, false, true])
    expect(pad.input.mouse.left.held).toBe(true)
  })

  it('lets go of a device’s sticks', () => {
    const pad = createPad()
    pad.stick('gamepad0', 'left', 1, 0)
    pad.stick('gamepad0', 'right', 0, 1)
    pad.stick('gamepad1', 'right', 0, -0.6)
    pad.sample()
    pad.releaseAll('gamepad0')
    pad.sample()
    expect(pad.input.leftStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.rightStick.y).toBeCloseTo(-0.5)
    expect(state(pad.input.right)).toEqual([false, false, true])
    pad.releaseAll()
    pad.sample()
    expect(pad.input.rightStick).toEqual({ x: 0, y: 0 })
  })

  it('is harmless for a device that holds nothing', () => {
    const pad = createPad()
    pad.set('keyboard', 'a', true)
    pad.sample()
    pad.releaseAll('gamepad3')
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
  })
})

describe('createPad mute', () => {
  const setup = () => {
    const pad = createPad({ actions: { jump: ['a', 'Space'] } })
    pad.set('keyboard', 'a', true)
    pad.set('keyboard', 'left', true)
    pad.set('keyboard', 'MouseLeft', true)
    pad.stick('gamepad0', 'left', 0, 0.3)
    pad.stick('gamepad0', 'right', 0, 1)
    pad.sample()
    return pad
  }

  it('reads everything idle while on', () => {
    const pad = setup()
    pad.mute(true)
    const idle = [false, false, false]
    expect(state(pad.input.a)).toEqual(idle)
    expect(state(action(pad, 'jump'))).toEqual(idle)
    for (const name of [...STANDARD, ...EXTRAS]) {
      expect(state(pad.input[name] as Button)).toEqual(idle)
    }
    for (const b of [
      pad.input.mouse.left,
      pad.input.mouse.right,
      pad.input.mouse.middle,
    ]) {
      expect(state(b)).toEqual(idle)
    }
    expect(pad.input.dir).toEqual({ x: 0, y: 0 })
    expect(pad.input.leftStick).toEqual({ x: 0, y: 0 })
    expect(pad.input.rightStick).toEqual({ x: 0, y: 0 })
  })

  it('keeps the mouse position moving', () => {
    const pad = createPad()
    pad.mute(true)
    pad.point(12, 34, true)
    pad.sample()
    expect(pad.input.mouse).toMatchObject({ x: 12, y: 34, inside: true })
  })

  it('leaves raw unmuted', () => {
    const pad = setup()
    pad.mute(true)
    expect(state(pad.raw.a)).toEqual([true, true, false])
    expect(pad.raw.dir).toEqual({ x: -1, y: 0 })
    pad.set('keyboard', 'a', false)
    pad.sample()
    expect(state(pad.raw.a)).toEqual([false, false, true])
  })

  it('shows a button held through the mute as held, not pressed', () => {
    const pad = setup()
    pad.mute(true)
    pad.sample()
    pad.mute(false)
    expect(state(pad.input.a)).toEqual([true, false, false])
    expect(state(action(pad, 'jump'))).toEqual([true, false, false])
    expect(pad.input.dir).toEqual({ x: -1, y: 0 })
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, false, false])
    pad.set('keyboard', 'a', false)
    pad.sample()
    expect(state(pad.input.a)).toEqual([false, false, true])
  })

  it('hides a press that began under the mute', () => {
    const pad = createPad()
    pad.mute(true)
    pad.set('keyboard', 'a', true)
    pad.sample()
    pad.mute(false)
    expect(state(pad.input.a)).toEqual([true, false, false])
  })

  it('makes a press after the mute a normal press', () => {
    const pad = setup()
    pad.mute(true)
    pad.sample()
    pad.mute(false)
    pad.set('keyboard', 'a', false)
    pad.sample()
    pad.set('keyboard', 'a', true)
    pad.sample()
    expect(state(pad.input.a)).toEqual([true, true, false])
  })
})
