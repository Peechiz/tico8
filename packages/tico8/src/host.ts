import type { Palette } from './palette.ts'
import type { Screen } from './screen.ts'
import { toRgba } from './screen.ts'

export interface Host {
  /** The element showing the screen, for the mouse to measure. */
  readonly canvas: HTMLCanvasElement
  /**
   * An element over the canvas as many CSS pixels wide and tall as the
   * screen has game pixels, scaled with the canvas, for the UI layer. It
   * ignores the pointer except on what can be pressed.
   */
  readonly overlay: HTMLElement
  /** Copy the screen's pixels to the canvas. */
  present(): void
  /** Remove the canvas and every listener. */
  destroy(): void
}

/** Parent styles the host sets for centring, restored on destroy. */
const PARENT_STYLES = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
} as const

/** Put a canvas showing `screen` inside `parent`, scaled up crisp. */
export function mount(
  parent: HTMLElement,
  screen: Screen,
  palette: Palette,
): Host {
  const { width, height } = screen

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.style.imageRendering = 'pixelated'
  canvas.style.flexShrink = '0'

  const context = canvas.getContext('2d')
  if (!context) throw new Error('2d canvas context unavailable')
  const image = context.createImageData(width, height)

  const keys = Object.keys(PARENT_STYLES) as (keyof typeof PARENT_STYLES)[]
  const saved = {} as Record<keyof typeof PARENT_STYLES, string>
  for (const key of keys) {
    saved[key] = parent.style[key]
    parent.style[key] = PARENT_STYLES[key]
  }

  /** Largest whole multiple of the screen that fits the parent, at least 1. */
  function resize(): void {
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(parent.clientWidth / width, parent.clientHeight / height),
      ),
    )
    canvas.style.width = `${width * scale}px`
    canvas.style.height = `${height * scale}px`
  }

  parent.appendChild(canvas)
  resize()

  const observer = new ResizeObserver(resize)
  observer.observe(parent)
  window.addEventListener('resize', resize)

  return {
    canvas,
    // Task 3 builds the real overlay.
    overlay: document.createElement('div'),
    present() {
      toRgba(screen, palette, image.data)
      context.putImageData(image, 0, 0)
    },
    destroy() {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      canvas.remove()
      for (const key of keys) parent.style[key] = saved[key]
    },
  }
}
