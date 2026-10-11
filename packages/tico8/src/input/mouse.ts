import type { AttachMouse, MouseName } from './types.ts'

const BUTTONS: readonly MouseName[] = ['MouseLeft', 'MouseMiddle', 'MouseRight']

export const attachMouse: AttachMouse = (canvas, screen, pad) => {
  const win = canvas.ownerDocument.defaultView
  if (!win) return () => {}

  // Held buttons whose press began over the canvas, so a release that
  // begins elsewhere in the window is not reported.
  const held = new Set<MouseName>()

  const point = (event: MouseEvent) => {
    // Read at event time: the canvas is resized with the window.
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(
      ((event.clientX - rect.left) * screen.width) / rect.width,
    )
    const y = Math.floor(
      ((event.clientY - rect.top) * screen.height) / rect.height,
    )
    pad.point(x, y, x >= 0 && x < screen.width && y >= 0 && y < screen.height)
  }

  const onMove = (event: MouseEvent) => point(event)
  const onDown = (event: MouseEvent) => {
    const name = BUTTONS[event.button]
    if (!name) return
    point(event)
    held.add(name)
    pad.set('mouse', name, true)
  }
  const onUp = (event: MouseEvent) => {
    const name = BUTTONS[event.button]
    if (!name || !held.delete(name)) return
    point(event)
    pad.set('mouse', name, false)
  }
  const onMenu = (event: Event) => event.preventDefault()
  const onBlur = () => {
    held.clear()
    pad.releaseAll('mouse')
  }

  win.addEventListener('mousemove', onMove)
  win.addEventListener('mouseup', onUp)
  win.addEventListener('blur', onBlur)
  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('contextmenu', onMenu)
  return () => {
    win.removeEventListener('mousemove', onMove)
    win.removeEventListener('mouseup', onUp)
    win.removeEventListener('blur', onBlur)
    canvas.removeEventListener('mousedown', onDown)
    canvas.removeEventListener('contextmenu', onMenu)
  }
}
