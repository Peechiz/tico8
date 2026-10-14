import { h, render } from 'preact'
import { NavContext } from './context.ts'
import { baseStyle } from './style.ts'
import type { CreateLayer } from './types.ts'

export const createLayer: CreateLayer = (element, { colors, palette, nav }) => {
  element.setAttribute('data-tico8-ui', '')
  const style = document.createElement('style')
  style.textContent = baseStyle(colors, palette)
  // Preact renders into its own container, so a render never clobbers the style.
  const container = document.createElement('div')
  element.append(style, container)

  return {
    render(node) {
      render(h(NavContext.Provider, { value: nav }, node), container)
    },
    destroy() {
      render(null, container)
      style.remove()
      container.remove()
      element.removeAttribute('data-tico8-ui')
    },
  }
}
