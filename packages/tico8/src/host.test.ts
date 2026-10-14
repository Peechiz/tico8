// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from './host.ts'
import { PICO8 } from './palette.ts'
import { createScreen } from './screen.ts'

/** Give `parent` a laid-out size, which happy-dom does not compute. */
function size(parent: HTMLElement, w: number, h: number): void {
  Object.defineProperty(parent, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(parent, 'clientHeight', {
    value: h,
    configurable: true,
  })
}

describe('host overlay', () => {
  let parent: HTMLElement

  beforeEach(() => {
    // happy-dom has no 2d canvas.
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData() {},
    } as unknown as CanvasRenderingContext2D)
    parent = document.createElement('div')
    size(parent, 400, 300)
    document.body.appendChild(parent)
  })

  afterEach(() => {
    parent.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sizes and scales the overlay with the canvas', () => {
    const host = mount(parent, createScreen(64, 48), PICO8)
    expect(host.overlay.style.width).toBe('64px')
    expect(host.overlay.style.height).toBe('48px')
    expect(host.overlay.style.transform).toBe('scale(6)')
    expect(host.overlay.style.transformOrigin).toBe('0 0')
    expect(host.canvas.style.width).toBe('384px')
    expect(host.canvas.parentElement).toBe(host.overlay.parentElement)
    expect(host.canvas.parentElement?.parentElement).toBe(parent)
  })

  it('follows a resize', () => {
    const host = mount(parent, createScreen(64, 48), PICO8)
    size(parent, 200, 200)
    window.dispatchEvent(new Event('resize'))
    expect(host.overlay.style.transform).toBe('scale(3)')
    expect(host.canvas.style.width).toBe('192px')
  })

  it('ignores the pointer itself', () => {
    const host = mount(parent, createScreen(64, 48), PICO8)
    expect(host.overlay.style.pointerEvents).toBe('none')
  })

  it('removes everything on destroy', () => {
    const host = mount(parent, createScreen(64, 48), PICO8)
    host.destroy()
    expect(parent.children.length).toBe(0)
    expect(parent.style.display).toBe('')
    size(parent, 100, 100)
    window.dispatchEvent(new Event('resize'))
    expect(host.overlay.style.transform).toBe('scale(6)')
  })
})

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
}
