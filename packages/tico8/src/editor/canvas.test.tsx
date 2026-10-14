// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { expect, it } from 'vitest'
import { TRANSPARENT } from '../sprites.ts'
import { Canvas, canvasArea, canvasScale } from './canvas.tsx'
import type { Editor, EditorState, SheetDoc, Vec } from './types.ts'

function fakeDoc(columns = 4, rows = 2, cell = 8): SheetDoc {
  const width = columns * cell
  const height = rows * cell
  return {
    info: {
      file: 'player.png',
      name: 'player',
      url: '/sprites/player.png',
      cellWidth: cell,
      cellHeight: cell,
    },
    image: { width, height, pixels: new Uint8Array(width * height) },
    colors: [
      [0, 0, 0],
      [255, 255, 255],
    ],
    paletteSize: 2,
  }
}

function fakeState(over: Partial<EditorState> = {}): EditorState {
  return {
    sheets: [],
    doc: fakeDoc(),
    cell: { x: 0, y: 0 },
    zoom: 1,
    tool: 'pencil',
    color: 1,
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: false,
    canRedo: false,
    error: undefined,
    version: 0,
    ...over,
  }
}

/** An editor that records the calls the UI makes. */
function fakeEditor() {
  const calls: [string, unknown][] = []
  const record =
    (name: string) =>
    (arg?: unknown): never => {
      calls.push([name, arg])
      return undefined as never
    }
  const editor = new Proxy({} as Editor, {
    get: (_, name) => record(String(name)),
  })
  return { editor, calls }
}

function mount(state: EditorState, editor: Editor) {
  const root = document.createElement('div')
  document.body.append(root)
  act(() => render(<Canvas editor={editor} state={state} />, root))
  return root
}

function placeAt(el: Element, left: number, top: number) {
  el.getBoundingClientRect = () =>
    ({ left, top, x: left, y: top, width: 0, height: 0 }) as DOMRect
}

function pointer(el: Element, type: string, at: Vec) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        clientX: at.x,
        clientY: at.y,
        button: 0,
        bubbles: true,
      }),
    )
  })
}

it('asks for a sheet when none is open', () => {
  const { editor } = fakeEditor()
  const root = mount(fakeState({ doc: undefined }), editor)
  expect(root.textContent).toBe('Pick or make a sheet')
})

it('sizes the canvas to the zoomed cells at a whole scale', () => {
  const { editor } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const root = mount(state, editor)
  const canvas = root.querySelector('canvas')!
  const scale = canvasScale(state.doc!, 2)
  expect(Number.isInteger(scale)).toBe(true)
  expect(canvas.width).toBe(16 * scale)
  expect(canvas.height).toBe(16 * scale)
})

it('stops the area at the sheet edge', () => {
  const doc = fakeDoc(3, 1)
  expect(canvasArea(doc, { x: 2, y: 0 }, 2)).toEqual({
    x: 16,
    y: 0,
    width: 8,
    height: 8,
  })
})

it('turns a pointer at a screen point into the sheet pixel under it', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ cell: { x: 1, y: 1 }, zoom: 1 })
  const scale = canvasScale(state.doc!, 1)
  const root = mount(state, editor)
  const canvas = root.querySelector('canvas')!
  placeAt(canvas, 100, 50)

  pointer(canvas, 'pointerdown', {
    x: 100 + 3 * scale + 1,
    y: 50 + 5 * scale + scale - 1,
  })
  pointer(canvas, 'pointermove', { x: 100 + 7 * scale, y: 50 })
  pointer(canvas, 'pointerup', { x: 100, y: 50 + 7 * scale + 1 })

  expect(calls).toEqual([
    ['pointerDown', { x: 8 + 3, y: 8 + 5 }],
    ['pointerMove', { x: 8 + 7, y: 8 }],
    ['pointerUp', { x: 8, y: 8 + 7 }],
  ])
})

it('draws a selection and a drag without a 2d context', () => {
  const { editor } = fakeEditor()
  const lifted = {
    width: 2,
    height: 1,
    pixels: new Uint8Array([1, TRANSPARENT]),
  }
  const root = mount(
    fakeState({
      tool: 'line',
      selection: { rect: { x: 1, y: 1, width: 2, height: 1 }, lifted },
      drag: { from: { x: 0, y: 0 }, to: { x: 5, y: 3 } },
    }),
    editor,
  )
  expect(root.querySelector('canvas')).not.toBeNull()
  act(() => render(null, root))
})

it('paints the lifted pixels and the drag over the sheet', () => {
  const fills = new Map<string, string>()
  const ctx = new Proxy({ fillStyle: '' } as Record<string, unknown>, {
    get(target, name) {
      if (name === 'fillRect')
        return (x: number, y: number) =>
          fills.set(`${x},${y}`, String(target.fillStyle))
      if (name in target) return target[name as string]
      return () => {}
    },
    set(target, name, value) {
      target[name as string] = value
      return true
    },
  })
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = (() =>
    ctx) as unknown as typeof original
  try {
    const { editor } = fakeEditor()
    const state = fakeState({
      tool: 'rect',
      color: 1,
      selection: {
        rect: { x: 4, y: 4, width: 1, height: 1 },
        lifted: { width: 1, height: 1, pixels: new Uint8Array([1]) },
      },
      drag: { from: { x: 0, y: 0 }, to: { x: 2, y: 2 } },
    })
    const scale = canvasScale(state.doc!, 1)
    const root = mount(state, editor)
    const white = 'rgb(255, 255, 255)'
    const black = 'rgb(0, 0, 0)'
    expect(fills.get(`${4 * scale},${4 * scale}`)).toBe(white)
    expect(fills.get(`${2 * scale},${1 * scale}`)).toBe(white)
    expect(fills.get(`${1 * scale},${1 * scale}`)).toBe(black)
    act(() => render(null, root))
  } finally {
    HTMLCanvasElement.prototype.getContext = original
  }
})
