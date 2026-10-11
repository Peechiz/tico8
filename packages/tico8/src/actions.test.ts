import { expect, it, vi } from 'vitest'

// Stands in for a project's `tico8.config.ts`, as the dev tool serves it.
vi.mock('./project.ts', async () => {
  const { defineConfig } = await import('./config.ts')
  return {
    default: defineConfig({
      actions: { jump: ['a', 'Space'], crouch: 'KeyS' },
    }),
  }
})

const { default: project } = await import('./project.ts')
const { display, pad } = await import('./console.ts')
const { COLOR, clear, input: plain, pixel } = await import('./index.ts')
const { attachKeyboard } = await import('./input/keyboard.ts')

// What the project's config file exports for its game to import.
const { input } = project as unknown as {
  input: Record<'jump' | 'crouch' | 'a' | 'b', { pressed: boolean }>
}

/** A game that marks the first pixels with what it reads this update. */
function frame(): number[] {
  pad.sample()
  clear()
  if (input.jump.pressed) pixel(0, 0, COLOR.red)
  if (input.crouch.pressed) pixel(1, 0, COLOR.green)
  if (input.b.pressed) pixel(2, 0, COLOR.blue)
  return [...display.pixels.subarray(0, 3)]
}

it("reads the config's actions on the pad the console runs", () => {
  expect(plain).toBe(input)

  pad.set('keyboard', 'Space', true)
  expect(frame()).toEqual([COLOR.red, 0, 0])
  expect(frame()).toEqual([0, 0, 0])

  // Button a brings its own key, and a controller holds it as well.
  pad.set('keyboard', 'Space', false)
  frame()
  pad.set('gamepad0', 'a', true)
  expect(frame()).toEqual([COLOR.red, 0, 0])
  pad.releaseAll()
  frame()
})

it('takes a key named in an action away from the pad', () => {
  const listeners: Record<string, (event: object) => void> = {}
  const target = {
    addEventListener: (type: string, heard: (event: object) => void) => {
      listeners[type] = heard
    },
    removeEventListener: () => {},
  }
  const detach = attachKeyboard(target as unknown as Window, pad)
  const key = (code: string) => ({ code, target: null, preventDefault() {} })

  // S is button b on the standard pad, but this game named it.
  listeners.keydown?.(key('KeyS'))
  expect(frame()).toEqual([0, COLOR.green, 0])
  listeners.keyup?.(key('KeyS'))
  frame()

  listeners.keydown?.(key('KeyA'))
  expect(frame()).toEqual([COLOR.red, 0, 0])
  detach()
})
