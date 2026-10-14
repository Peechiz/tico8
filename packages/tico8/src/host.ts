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
  /** Remove the canvas, the overlay and every listener. */
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
  canvas.style.display = 'block'

  // The box is what gets centred and sized; the overlay sits on its top-left.
  const box = document.createElement('div')
  box.style.position = 'relative'
  box.style.flexShrink = '0'

  const overlay = document.createElement('div')
  overlay.style.position = 'absolute'
  overlay.style.left = '0'
  overlay.style.top = '0'
  overlay.style.width = `${width}px`
  overlay.style.height = `${height}px`
  overlay.style.transformOrigin = '0 0'
  overlay.style.pointerEvents = 'none'

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
    box.style.width = `${width * scale}px`
    box.style.height = `${height * scale}px`
    overlay.style.transform = `scale(${scale})`
  }

  box.append(canvas, overlay)
  parent.appendChild(box)
  resize()

  const observer = new ResizeObserver(resize)
  observer.observe(parent)
  window.addEventListener('resize', resize)

  return {
    canvas,
    overlay,
    present() {
      toRgba(screen, palette, image.data)
      context.putImageData(image, 0, 0)
    },
    destroy() {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      box.remove()
      for (const key of keys) parent.style[key] = saved[key]
    },
  }
}
