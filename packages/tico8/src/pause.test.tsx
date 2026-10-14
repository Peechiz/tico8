// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { createMixer } from './audio/mixer.ts'
import { rememberSound } from './audio/settings.ts'
import type { AudioOut } from './audio/types.ts'
import { createClock } from './clock.ts'
import { createPad } from './input/pad.ts'
import { createLoop, type Game } from './loop.ts'
import { PICO8, PICO8_NAMES } from './palette.ts'
import { createPause } from './pause.ts'
import { memoryStore } from './save/storage.ts'
import { Menu } from './ui/index.ts'
import { createLayer } from './ui/layer.ts'
import { createNav } from './ui/nav.ts'

/** An output that plays nothing, recording what is held. */
function quietOut(): AudioOut {
  return {
    decode: async () => ({ duration: 1 }),
    start: () => ({ setGain() {}, stop() {}, pause() {}, resume() {} }),
    resume() {},
  }
}

/** A game driven through the same steps `run` takes. */
function setup() {
  const pad = createPad({ actions: { jump: ['a'] } })
  const input = pad.input as typeof pad.input & {
    jump: { pressed: boolean }
  }
  const nav = createNav()
  const element = document.createElement('div')
  document.body.append(element)
  const layer = createLayer(element, {
    colors: PICO8_NAMES,
    palette: PICO8,
    nav,
  })
  const mixer = createMixer(quietOut())
  const hold = vi.spyOn(mixer, 'hold')
  const store = memoryStore()
  const time = createClock(30)

  const state = {
    updates: 0,
    draws: 0,
    jumps: 0,
    quits: 0,
    backs: 0,
    // A menu of the game's own on screen: none, one with no way back, or one
    // whose Ⓑ goes back.
    menu: 'none' as 'none' | 'title' | 'over',
  }
  const game: Game = {
    update() {
      state.updates++
      if (input.jump.pressed) state.jumps++
    },
    draw() {
      state.draws++
    },
    ui: () =>
      state.menu !== 'none' && (
        <Menu
          key={state.menu}
          onBack={state.menu === 'over' ? () => state.backs++ : undefined}
        >
          <button type="button">Start</button>
        </Menu>
      ),
    pause: () => (
      <>
        <button type="button" onClick={() => state.quits++}>
          Quit
        </button>
        <button type="button" onClick={(event) => event.preventDefault()}>
          Toggle
        </button>
      </>
    ),
  }
  const pause = createPause({
    game,
    pad,
    nav,
    mixer,
    actions: { jump: ['a'] },
    sound: rememberSound(store),
  })
  const loop = createLoop(game, {
    rate: 30,
    onUpdate() {
      pad.sample()
      pause.step()
    },
    frozen: () => pause.paused,
    afterUpdate() {
      if (!pause.paused) time.step()
      layer.render(pause.ui())
    },
  })
  let now = 0
  // One update per call.
  const tick = () => {
    loop.tick(now)
    now += 1000 / 30
  }
  /** Press and let go of a control over two updates. */
  const tap = (control: Parameters<typeof pad.set>[1]) => {
    pad.set('keyboard', control, true)
    tick()
    pad.set('keyboard', control, false)
    tick()
  }
  const button = (text: string) =>
    [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(text),
    )
  return { pause, state, time, tick, tap, button, element, hold, store }
}

it('freezes update, draw and the clock under the menu, and Ⓑ resumes', () => {
  const { pause, state, time, tick, tap, element, hold } = setup()
  tick()
  tick()
  expect(state).toMatchObject({ updates: 2, draws: 2 })
  const ticks = time.clock.ticks

  tap('Escape')
  expect(pause.paused).toBe(true)
  expect(hold).toHaveBeenCalledOnce()
  expect(element.querySelector('.tico8-pause')).not.toBeNull()
  tick()
  tick()
  expect(state).toMatchObject({ updates: 2, draws: 2 })
  expect(time.clock.ticks).toBe(ticks)

  // Ⓑ is S on the keyboard.
  tap('KeyS')
  expect(pause.paused).toBe(false)
  expect(element.querySelector('.tico8-pause')).toBeNull()
  tick()
  expect(state.updates).toBeGreaterThan(2)
  expect(state.draws).toBeGreaterThan(2)
  expect(time.clock.ticks).toBeGreaterThan(ticks)
})

it('opens and closes on Escape', () => {
  const { pause, tick, tap } = setup()
  tick()
  tap('Escape')
  expect(pause.paused).toBe(true)
  tap('Escape')
  expect(pause.paused).toBe(false)
})

it('keeps the Ⓐ that chose Resume from the game', () => {
  const { pause, state, tick, tap } = setup()
  tick()
  tap('Escape')
  tick()
  // Resume is highlighted first.
  tap('a')
  expect(pause.paused).toBe(false)
  tick()
  expect(state.jumps).toBe(0)
})

it('closes after a game item, but not one that prevents default', () => {
  const { pause, state, tick, tap, button } = setup()
  tick()
  tap('Escape')
  tick()
  button('Toggle')?.click()
  expect(pause.paused).toBe(true)
  button('Quit')?.click()
  expect(state.quits).toBe(1)
  expect(pause.paused).toBe(false)
})

it('keeps the sound settings made in the options', () => {
  const { tick, tap, button, store } = setup()
  tick()
  tap('Escape')
  tick()
  button('Options')?.click()
  tick()
  // A click steps the volume up from full, wrapping to 0.
  button('Volume')?.click()
  button('Sound')?.click()
  expect(rememberSound(store).load()).toEqual({ volume: 0, sound: false })
})

it('takes Enter on a highlighted item as Ⓐ', () => {
  const { pause, state, tick, tap } = setup()
  tick()
  tap('Escape')
  tick()
  // Resume, then the game's Quit.
  tap('ArrowDown')
  tap('Enter')
  expect(state.quits).toBe(1)
  expect(pause.paused).toBe(false)
})

it('backs out of the controls screen on Escape, and resumes on the next', () => {
  const { pause, tick, tap, button, element } = setup()
  tick()
  tap('Escape')
  tick()
  button('Controls')?.click()
  tick()
  expect(element.querySelector('.tico8-controls')).not.toBeNull()
  tap('Escape')
  expect(pause.paused).toBe(true)
  expect(element.querySelector('.tico8-controls')).toBeNull()
  tap('Escape')
  expect(pause.paused).toBe(false)
})

it('pauses on Escape over a game menu with no way back', () => {
  const { pause, state, tick, tap } = setup()
  state.menu = 'title'
  tick()
  tick()
  tap('Escape')
  expect(pause.paused).toBe(true)
})

it('goes back on Escape in a game menu that has an onBack', () => {
  const { pause, state, tick, tap } = setup()
  state.menu = 'over'
  tick()
  tick()
  tap('Escape')
  expect(pause.paused).toBe(false)
  expect(state.backs).toBe(1)
})
