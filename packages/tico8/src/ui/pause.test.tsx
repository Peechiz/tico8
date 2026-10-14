// @vitest-environment happy-dom
import { act } from 'preact/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import type { Button, Input, StandardName } from '../input/types.ts'
import { createLayer } from './layer.ts'
import { createNav } from './nav.ts'
import { PauseScreen } from './pause.tsx'
import type { PauseControls, UiNode } from './types.ts'

vi.mock('./style.ts', () => ({ baseStyle: () => '' }))

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

function fakeControls(over: Partial<PauseControls> = {}): PauseControls {
  return {
    resume: vi.fn(),
    volume: 0.8,
    sound: true,
    unlocked: true,
    controls: [
      { label: '← ↑ → ↓', bindings: ['←', '↑', '→', '↓'] },
      { label: 'Ⓐ', bindings: ['Z', 'C'] },
    ],
    ...over,
  }
}

/** The pause screen in a layer with a real nav; `step` drives the nav. */
function mount(controls: PauseControls, items?: UiNode) {
  const element = document.createElement('div')
  document.body.append(element)
  const nav = createNav()
  const layer = createLayer(element, { colors: {}, palette: [], nav })
  act(() => layer.render(<PauseScreen controls={controls} items={items} />))
  const step = (...names: StandardName[]) => act(() => nav.step(pad(...names)))
  const find = (selector: string) =>
    element.querySelector(selector) as HTMLElement
  const button = (text: string) =>
    [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith(text),
    ) as HTMLButtonElement
  /** Open the options screen from the pause menu, with no game items. */
  const options = () => {
    step('down')
    step('a')
  }
  return { element, nav, step, find, button, options }
}

const focusedText = () => document.activeElement?.textContent

afterEach(() => {
  document.body.innerHTML = ''
})

it('lists Resume, the game’s items, Options and Controls in order', () => {
  const { find } = mount(
    fakeControls(),
    <>
      <button type="button">Restart level</button>
      <button type="button">Quit to title</button>
    </>,
  )
  expect(find('.tico8-pause')).not.toBeNull()
  const menu = find('.tico8-pause > .tico8-pause-menu')
  expect(menu.querySelector('h2')?.textContent).toBe('Paused')
  const texts = [...menu.querySelectorAll('button')].map((b) => b.textContent)
  expect(texts).toEqual([
    'Resume',
    'Restart level',
    'Quit to title',
    'Options',
    'Controls',
  ])
  expect(find('.tico8-pause-items').querySelectorAll('button')).toHaveLength(2)
  expect(focusedText()).toBe('Resume')
})

it('resumes on Ⓑ and on Resume', () => {
  const controls = fakeControls()
  const { step } = mount(controls)
  step('b')
  expect(controls.resume).toHaveBeenCalledOnce()
  step('a')
  expect(controls.resume).toHaveBeenCalledTimes(2)
})

it('resumes after a game item’s onClick, unless it prevents default', () => {
  const controls = fakeControls()
  const order: string[] = []
  vi.mocked(controls.resume).mockImplementation(() => order.push('resume'))
  const { step } = mount(
    controls,
    <>
      <button type="button" onClick={() => order.push('quit')}>
        Quit
      </button>
      <button
        type="button"
        onClick={(event) => {
          order.push('toggle')
          event.preventDefault()
        }}
      >
        Music
      </button>
    </>,
  )
  step('down')
  expect(focusedText()).toBe('Quit')
  step('a')
  expect(order).toEqual(['quit', 'resume'])
  step('down')
  expect(focusedText()).toBe('Music')
  step('a')
  expect(order).toEqual(['quit', 'resume', 'toggle'])
})

it('opens the options: Volume, Sound and Back, and Ⓑ goes back', () => {
  const controls = fakeControls()
  const { step, find, options } = mount(controls)
  options()
  const screen = find('.tico8-options')
  expect(screen.querySelector('h2')?.textContent).toBe('Options')
  expect(
    [...screen.querySelectorAll('button')].map((b) => b.textContent),
  ).toEqual(['Volume ← 8 →', 'Sound: on', 'Back'])
  expect(find('.tico8-pause-menu').hidden).toBe(true)
  expect(focusedText()).toBe('Volume ← 8 →')
  step('b')
  expect(controls.resume).not.toHaveBeenCalled()
  expect(find('.tico8-options')).toBeNull()
  expect(focusedText()).toBe('Options')
})

it('steps the volume with ← and →, keeping the highlight', () => {
  const controls = fakeControls({ volume: 0.75 })
  const { step, button, options } = mount(controls)
  options()
  const volume = button('Volume')
  expect(document.activeElement).toBe(volume)
  expect(volume.textContent).toBe('Volume ← 8 →')
  step('left')
  expect(controls.volume).toBe(0.7)
  expect(volume.textContent).toBe('Volume ← 7 →')
  step('right')
  step('right')
  expect(controls.volume).toBe(0.9)
  step('right')
  step('right')
  expect(controls.volume).toBe(1)
  expect(volume.textContent).toBe('Volume ← 10 →')
  expect(document.activeElement).toBe(volume)
  // Up and down still move the highlight.
  step('down')
  expect(focusedText()).toBe('Sound: on')
})

it('stops the volume at 0', () => {
  const controls = fakeControls({ volume: 0.1 })
  const { step, options } = mount(controls)
  options()
  step('left')
  step('left')
  expect(controls.volume).toBe(0)
})

it('dims the arrow that can step no further', () => {
  const controls = fakeControls({ volume: 0.9 })
  const { element, step, find, options } = mount(controls)
  options()
  const ends = () =>
    [...element.querySelectorAll('.tico8-pause-end')].map((e) => e.textContent)
  expect(ends()).toEqual([])
  step('right')
  expect(ends()).toEqual(['→'])
  for (let i = 0; i < 10; i++) step('left')
  expect(ends()).toEqual(['←'])
  expect(find('.tico8-pause-level')?.textContent).toBe('0')
})

it('steps the volume up with Ⓐ, wrapping from 10 to 0', () => {
  const controls = fakeControls({ volume: 0.9 })
  const { step, button, options } = mount(controls)
  options()
  step('a')
  expect(controls.volume).toBe(1)
  step('a')
  expect(controls.volume).toBe(0)
  expect(button('Volume').textContent).toBe('Volume ← 0 →')
  expect(controls.resume).not.toHaveBeenCalled()
})

it('switches sound off and on with Ⓐ', () => {
  const controls = fakeControls()
  const { step, button, options } = mount(controls)
  options()
  step('down')
  step('a')
  expect(controls.sound).toBe(false)
  expect(button('Sound').textContent).toBe('Sound: off')
  step('a')
  expect(controls.sound).toBe(true)
  expect(button('Sound').textContent).toBe('Sound: on')
  expect(controls.resume).not.toHaveBeenCalled()
})

it('flips sound with ← and →, keeping the highlight', () => {
  const controls = fakeControls()
  const { step, button, options } = mount(controls)
  options()
  step('down')
  step('right')
  expect(controls.sound).toBe(false)
  expect(button('Sound').textContent).toBe('Sound: off')
  step('left')
  expect(controls.sound).toBe(true)
  expect(document.activeElement).toBe(button('Sound'))
})

it('says to press a key for sound until unlocked', () => {
  const locked = mount(fakeControls({ unlocked: false }))
  locked.options()
  const line = locked.find('.tico8-pause-unlock')
  expect(line.textContent).toBe('Press a key for sound')
  // Not focusable: down from Sound goes to Back.
  locked.step('down')
  locked.step('down')
  expect(focusedText()).toBe('Back')
  document.body.innerHTML = ''
  const unlocked = mount(fakeControls())
  unlocked.options()
  expect(unlocked.find('.tico8-pause-unlock')).toBeNull()
})

it('opens the controls screen, and Ⓑ goes back to the pause menu', () => {
  const controls = fakeControls()
  const { step, find } = mount(controls)
  step('down')
  step('down')
  expect(focusedText()).toBe('Controls')
  step('a')
  const screen = find('.tico8-controls')
  expect(screen).not.toBeNull()
  expect(find('.tico8-pause-menu').hidden).toBe(true)
  const rows = [...screen.querySelectorAll('.tico8-control')].map((row) =>
    [...row.children].map((part) => part.textContent),
  )
  expect(rows).toEqual([
    ['← ↑ → ↓', '← ↑ → ↓'],
    ['Ⓐ', 'Z C'],
  ])
  expect(focusedText()).toBe('Back')
  step('b')
  expect(controls.resume).not.toHaveBeenCalled()
  expect(find('.tico8-controls')).toBeNull()
  expect(find('.tico8-pause-menu').hidden).toBe(false)
  expect(focusedText()).toBe('Controls')
  // The pause menu has the pad again.
  step('b')
  expect(controls.resume).toHaveBeenCalledOnce()
})

it('closes the controls screen with its Back button', () => {
  const { step, find } = mount(fakeControls())
  step('down')
  step('down')
  step('a')
  step('a')
  expect(find('.tico8-controls')).toBeNull()
  expect(focusedText()).toBe('Controls')
})
