// @vitest-environment happy-dom
import { useContext } from 'preact/hooks'
import { expect, it, vi } from 'vitest'
import { NavContext } from './context.ts'
import { createLayer } from './layer.ts'
import type { LayerOptions, Nav } from './types.ts'

vi.mock('./style.ts', () => ({ baseStyle: () => '/* base */' }))

const nav = {} as Nav
const options: LayerOptions = { colors: { black: 0 }, palette: [], nav }

it('marks the element and adds the base style', () => {
  const element = document.createElement('div')
  createLayer(element, options)
  expect(element.hasAttribute('data-tico8-ui')).toBe(true)
  expect(element.querySelector('style')?.textContent).toBe('/* base */')
})

it('patches on a second render, keeping the DOM node', () => {
  const element = document.createElement('div')
  const layer = createLayer(element, options)
  layer.render(<p>one</p>)
  const p = element.querySelector('p')
  layer.render(<p>two</p>)
  expect(element.querySelector('p')).toBe(p)
  expect(p?.textContent).toBe('two')
  expect(element.querySelector('style')).not.toBeNull()
})

it('gives components the nav through NavContext', () => {
  const element = document.createElement('div')
  const layer = createLayer(element, options)
  let seen: Nav | null = null
  function Probe() {
    seen = useContext(NavContext)
    return <span />
  }
  layer.render(<Probe />)
  expect(seen).toBe(nav)
})

it('empties the element on destroy', () => {
  const element = document.createElement('div')
  const layer = createLayer(element, options)
  layer.render(<p>hi</p>)
  layer.destroy()
  expect(element.innerHTML).toBe('')
  expect(element.hasAttribute('data-tico8-ui')).toBe(false)
})
