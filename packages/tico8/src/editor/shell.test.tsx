// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { Shell } from './shell.tsx'

const tabs = [
  { name: 'Sprites', content: <p id="sprites">sprites</p> },
  { name: 'Map', content: <p id="map">map</p> },
]

let root: HTMLElement
function mount() {
  root = document.createElement('div')
  document.body.append(root)
  act(() => render(<Shell gameUrl="/@tico8/game" tabs={tabs} />, root))
}

afterEach(() => {
  act(() => render(null, root))
  root.remove()
  localStorage.clear()
  vi.restoreAllMocks()
})

const button = (name: string) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.textContent === name,
  ) as HTMLButtonElement
const click = (name: string) => act(() => button(name).click())
const frame = () => root.querySelector('iframe') as HTMLIFrameElement
const visible = (el: Element) => !el.closest('[hidden]')

it('shows one tab at a time', () => {
  mount()
  expect(frame().getAttribute('src')).toBe('/@tico8/game')
  expect(visible(frame())).toBe(true)
  expect(visible(root.querySelector('#sprites')!)).toBe(false)
  click('Sprites')
  expect(visible(frame())).toBe(false)
  expect(visible(root.querySelector('#sprites')!)).toBe(true)
  expect(visible(root.querySelector('#map')!)).toBe(false)
  click('Map')
  expect(visible(root.querySelector('#map')!)).toBe(true)
  expect(visible(root.querySelector('#sprites')!)).toBe(false)
  expect(root.querySelector('#sprites')).not.toBeNull()
})

it('shows the game beside an editor when split', () => {
  mount()
  click('Sprites')
  click('Split')
  expect(visible(frame())).toBe(true)
  expect(visible(root.querySelector('#sprites')!)).toBe(true)
  click('Game')
  expect(visible(root.querySelector('#sprites')!)).toBe(false)
})

it('keeps the same iframe node through switches and split', () => {
  mount()
  const first = frame()
  click('Sprites')
  click('Split')
  click('Map')
  click('Split')
  click('Game')
  expect(frame()).toBe(first)
  expect(root.querySelectorAll('iframe')).toHaveLength(1)
})

it('focuses the game when switching to it', () => {
  mount()
  click('Sprites')
  const focus = vi.spyOn(frame(), 'focus')
  click('Game')
  expect(focus).toHaveBeenCalled()
})

it('restores the choice from localStorage', () => {
  mount()
  click('Map')
  click('Split')
  act(() => render(null, root))
  act(() => render(<Shell gameUrl="/g" tabs={tabs} />, root))
  expect(visible(root.querySelector('#map')!)).toBe(true)
  expect(visible(frame())).toBe(true)
  expect(button('Split').getAttribute('aria-pressed')).toBe('true')
})

it('falls back to Game when the stored tab is gone', () => {
  localStorage.setItem('tico8:shell', '{"tab":"Nope","split":false}')
  mount()
  expect(visible(frame())).toBe(true)
})

it('works when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  mount()
  click('Sprites')
  expect(visible(root.querySelector('#sprites')!)).toBe(true)
})

const divider = () => root.querySelector('[role="separator"]') as HTMLElement
const press = (key: string) =>
  act(() => {
    divider().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    )
  })
const saved = () => JSON.parse(localStorage.getItem('tico8:shell') ?? 'null')

it('shows the divider only while split beside an editor', () => {
  mount()
  expect(divider()).toBeNull()
  click('Sprites')
  expect(divider()).toBeNull()
  click('Split')
  expect(divider().getAttribute('aria-orientation')).toBe('vertical')
  expect(divider().getAttribute('aria-valuenow')).toBe('40')
  click('Split')
  expect(divider()).toBeNull()
})

it('moves the divider with the arrow keys and clamps at 20 and 80', () => {
  mount()
  click('Sprites')
  click('Split')
  press('ArrowRight')
  expect(divider().getAttribute('aria-valuenow')).toBe('45')
  press('ArrowLeft')
  press('ArrowLeft')
  expect(divider().getAttribute('aria-valuenow')).toBe('35')
  for (let i = 0; i < 20; i++) press('ArrowLeft')
  expect(divider().getAttribute('aria-valuenow')).toBe('20')
  for (let i = 0; i < 20; i++) press('ArrowRight')
  expect(divider().getAttribute('aria-valuenow')).toBe('80')
})

it('saves and restores the width', () => {
  mount()
  click('Sprites')
  click('Split')
  press('ArrowRight')
  expect(saved().width).toBe(45)
  act(() => render(null, root))
  act(() => render(<Shell gameUrl="/g" tabs={tabs} />, root))
  expect(divider().getAttribute('aria-valuenow')).toBe('45')
})

it('loads 40 when the saved choice has no width', () => {
  localStorage.setItem('tico8:shell', '{"tab":"Sprites","split":true}')
  mount()
  expect(divider().getAttribute('aria-valuenow')).toBe('40')
})
