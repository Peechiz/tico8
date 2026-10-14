// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { expect, it, vi } from 'vitest'
import { NavContext } from './context.ts'
import { Menu } from './menu.tsx'
import type { MenuEntry, Nav } from './types.ts'

function fakeNav() {
  const open: MenuEntry[] = []
  const closed: MenuEntry[] = []
  const nav: Nav = {
    active: false,
    backable: false,
    open(entry) {
      open.push(entry)
      return () => closed.push(entry)
    },
    step() {},
  }
  return { nav, open, closed }
}

function mount(node: preact.ComponentChildren, nav: Nav) {
  const root = document.createElement('div')
  document.body.append(root)
  const show = (n: preact.ComponentChildren) =>
    act(() =>
      render(<NavContext.Provider value={nav}>{n}</NavContext.Provider>, root),
    )
  show(node)
  return { root, show, unmount: () => act(() => render(null, root)) }
}

it('opens on mount with its element and closes on unmount', () => {
  const { nav, open, closed } = fakeNav()
  const { root, unmount } = mount(<Menu />, nav)
  expect(open).toHaveLength(1)
  expect(open[0]?.element).toBe(root.firstElementChild)
  expect(closed).toHaveLength(0)
  unmount()
  expect(closed).toEqual(open)
})

it('passes props on to the div and holds its children', () => {
  const { nav } = fakeNav()
  const { root } = mount(
    <Menu class="pause" id="m">
      <button type="button">Resume</button>
    </Menu>,
    nav,
  )
  const div = root.firstElementChild as HTMLElement
  expect(div.tagName).toBe('DIV')
  expect(div.className).toBe('pause')
  expect(div.id).toBe('m')
  expect(div.querySelector('button')?.textContent).toBe('Resume')
  expect(div.hasAttribute('onback')).toBe(false)
})

it('focuses its first enabled button', () => {
  const { nav } = fakeNav()
  const { root } = mount(
    <Menu>
      <button type="button" disabled>
        Off
      </button>
      <button type="button" id="a">
        A
      </button>
      <button type="button">B</button>
    </Menu>,
    nav,
  )
  expect(document.activeElement).toBe(root.querySelector('#a'))
})

it('leaves focus alone when something inside already has it', () => {
  const { nav } = fakeNav()
  const { root } = mount(
    <Menu>
      <button type="button">A</button>
      <input id="name" ref={(el) => el?.focus()} />
    </Menu>,
    nav,
  )
  expect(document.activeElement).toBe(root.querySelector('#name'))
})

it('keeps the latest onBack without reopening', () => {
  const { nav, open, closed } = fakeNav()
  const first = vi.fn()
  const second = vi.fn()
  const { show } = mount(<Menu onBack={first} />, nav)
  show(<Menu onBack={second} />)
  expect(open).toHaveLength(1)
  expect(closed).toHaveLength(0)
  open[0]?.onBack?.()
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledOnce()
})

it('focuses a button the pointer moves over', () => {
  const { nav } = fakeNav()
  const { root } = mount(
    <Menu>
      <button type="button">A</button>
      <button type="button" id="b">
        B
      </button>
    </Menu>,
    nav,
  )
  const b = root.querySelector('#b') as HTMLElement
  b.dispatchEvent(new Event('pointermove', { bubbles: true }))
  expect(document.activeElement).toBe(b)
})

it('throws outside a layer', () => {
  const root = document.createElement('div')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<Menu />, root)).toThrow(/inside the game/)
})
