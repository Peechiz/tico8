// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { createPad } from './input/pad.ts'
import { createLoop, type Game } from './loop.ts'
import { PICO8, PICO8_NAMES } from './palette.ts'
import { Menu } from './ui/index.ts'
import { createLayer } from './ui/layer.ts'
import { createNav } from './ui/nav.ts'

/** A game with a pause menu, driven through the same steps `run` takes. */
function setup() {
  const pad = createPad({ actions: { jump: ['a'] } })
  const input = pad.input as typeof pad.input & {
    jump: { pressed: boolean; held: boolean }
  }
  const nav = createNav()
  const element = document.createElement('div')
  document.body.append(element)
  const layer = createLayer(element, {
    colors: PICO8_NAMES,
    palette: PICO8,
    nav,
  })

  const state = { paused: true, jumps: 0, restarts: 0, heldDuringMenu: false }
  const resume = () => {
    state.paused = false
  }
  const game: Game = {
    update() {
      if (input.jump.pressed) state.jumps++
      if (state.paused && input.jump.held) state.heldDuringMenu = true
    },
    ui: () =>
      state.paused && (
        <Menu onBack={resume}>
          <button type="button" onClick={resume}>
            Resume
          </button>
          <button type="button" onClick={() => state.restarts++}>
            Restart
          </button>
        </Menu>
      ),
  }

  const loop = createLoop(game, {
    rate: 30,
    onUpdate() {
      pad.sample()
      pad.mute(nav.active)
      nav.step(pad.raw)
    },
    afterUpdate() {
      layer.render(game.ui?.())
    },
  })
  let now = 0
  // One update per call.
  const tick = () => {
    loop.tick(now)
    now += 1000 / 30
  }
  return { pad, state, element, tick }
}

it('gives the pad to a menu, and keeps the press that closes it from the game', () => {
  const { pad, state, element, tick } = setup()
  tick()
  const buttons = element.querySelectorAll('button')
  expect(buttons).toHaveLength(2)
  expect(document.activeElement).toBe(buttons[0])

  // Down moves the highlight; the game hears nothing.
  pad.set('test', 'down', true)
  tick()
  pad.set('test', 'down', false)
  tick()
  expect(document.activeElement).toBe(buttons[1])

  // Ⓐ presses Restart, not the game's jump.
  pad.set('test', 'a', true)
  tick()
  pad.set('test', 'a', false)
  tick()
  expect(state.restarts).toBe(1)
  expect(state.jumps).toBe(0)
  expect(state.heldDuringMenu).toBe(false)

  // Up and Ⓐ: Resume closes the menu. Ⓐ is still down after, but the game
  // never sees it pressed.
  pad.set('test', 'up', true)
  tick()
  pad.set('test', 'up', false)
  pad.set('test', 'a', true)
  tick()
  expect(state.paused).toBe(false)
  tick()
  tick()
  expect(element.querySelector('button')).toBeNull()
  expect(state.jumps).toBe(0)

  // A fresh press reaches the game.
  pad.set('test', 'a', false)
  tick()
  pad.set('test', 'a', true)
  tick()
  expect(state.jumps).toBe(1)
})

it('calls the menu’s onBack on Ⓑ', () => {
  const { pad, state, tick } = setup()
  tick()
  pad.set('test', 'b', true)
  tick()
  expect(state.paused).toBe(false)
})
