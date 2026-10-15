// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { expect, it } from 'vitest'
import { cellAt, FrameStrip, SheetView, sheetScale } from './sheet-view.tsx'
import type { Editor, EditorState, SheetDoc, Vec, Zoom } from './types.ts'

function fakeDoc(columns: number, rows: number, cell = 8): SheetDoc {
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
    colors: [[0, 0, 0]],
    paletteSize: 1,
  }
}

function fakeState(
  doc: SheetDoc | undefined,
  zoom: Zoom,
  cell: Vec = { x: 0, y: 0 },
): EditorState {
  return {
    sheets: [],
    doc,
    cell,
    zoom,
    tool: 'pencil',
    color: 0,
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: false,
    canRedo: false,
    saving: false,
    error: undefined,
    version: 0,
  }
}

function fakeEditor() {
  const picked: Vec[] = []
  const editor = new Proxy({} as Editor, {
    get: (_, name) =>
      name === 'pickCell'
        ? (cell: Vec) => picked.push(cell)
        : () => {
            throw new Error(`unexpected ${String(name)}`)
          },
  })
  return { editor, picked }
}

function clickAt(doc: SheetDoc, zoom: Zoom, pixel: Vec): Vec[] {
  const { editor, picked } = fakeEditor()
  const root = document.createElement('div')
  document.body.append(root)
  act(() =>
    render(<SheetView editor={editor} state={fakeState(doc, zoom)} />, root),
  )
  const canvas = root.querySelector('canvas')!
  canvas.getBoundingClientRect = () =>
    ({ left: 20, top: 30, x: 20, y: 30, width: 0, height: 0 }) as DOMRect
  const scale = sheetScale(doc)
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 20 + pixel.x * scale + scale / 2,
        clientY: 30 + pixel.y * scale + scale / 2,
        button: 0,
        bubbles: true,
      }),
    )
  })
  act(() => render(null, root))
  return picked
}

it('shows nothing without a sheet', () => {
  const root = document.createElement('div')
  const { editor } = fakeEditor()
  act(() =>
    render(<SheetView editor={editor} state={fakeState(undefined, 1)} />, root),
  )
  expect(root.innerHTML).toBe('')
})

it('draws the whole sheet at a small whole scale', () => {
  expect(sheetScale(fakeDoc(16, 16))).toBe(1)
  expect(sheetScale(fakeDoc(8, 4))).toBe(3)
  expect(sheetScale(fakeDoc(4, 4))).toBe(6)
  expect(sheetScale(fakeDoc(1, 1))).toBe(8)
})

it('picks the cell clicked', () => {
  const doc = fakeDoc(8, 4)
  expect(clickAt(doc, 1, { x: 3 * 8 + 5, y: 2 * 8 + 1 })).toEqual([
    { x: 3, y: 2 },
  ])
  expect(clickAt(doc, 1, { x: 63, y: 31 })).toEqual([{ x: 7, y: 3 }])
})

it('keeps the zoomed cells inside the sheet', () => {
  const doc = fakeDoc(8, 4)
  expect(clickAt(doc, 2, { x: 63, y: 31 })).toEqual([{ x: 6, y: 2 }])
  expect(cellAt(doc, { x: 63, y: 31 }, 4)).toEqual({ x: 4, y: 0 })
  expect(cellAt(fakeDoc(1, 1), { x: 5, y: 5 }, 4)).toEqual({ x: 0, y: 0 })
})

function mountStrip(doc: SheetDoc, zoom: Zoom, cell: Vec) {
  const { editor, picked } = fakeEditor()
  const root = document.createElement('div')
  document.body.append(root)
  act(() =>
    render(
      <FrameStrip editor={editor} state={fakeState(doc, zoom, cell)} />,
      root,
    ),
  )
  return { root, picked, buttons: [...root.querySelectorAll('button')] }
}

it('shows no frame strip without a sheet', () => {
  const root = document.createElement('div')
  const { editor } = fakeEditor()
  act(() =>
    render(
      <FrameStrip editor={editor} state={fakeState(undefined, 1)} />,
      root,
    ),
  )
  expect(root.innerHTML).toBe('')
})

it('has one button per cell, numbered in frame order', () => {
  const { buttons } = mountStrip(fakeDoc(3, 2), 1, { x: 0, y: 0 })
  expect(buttons.map((b) => b.textContent)).toEqual([
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
  ])
  expect(buttons.every((b) => b.querySelector('canvas'))).toBe(true)
})

it('marks the cells the painting area shows', () => {
  const { buttons } = mountStrip(fakeDoc(3, 3), 2, { x: 1, y: 1 })
  const marked = buttons
    .filter((b) => b.getAttribute('aria-current') === 'true')
    .map((b) => b.textContent)
  expect(marked).toEqual(['4', '5', '7', '8'])
})

it('picks the cell of the frame clicked', () => {
  const { buttons, picked } = mountStrip(fakeDoc(3, 2), 1, { x: 0, y: 0 })
  act(() => buttons[4]?.click())
  expect(picked).toEqual([{ x: 1, y: 1 }])
})

it('names the frame under the pointer in the sheet title', () => {
  const { editor } = fakeEditor()
  const root = document.createElement('div')
  document.body.append(root)
  const doc = fakeDoc(4, 2)
  act(() =>
    render(<SheetView editor={editor} state={fakeState(doc, 1)} />, root),
  )
  const canvas = root.querySelector('canvas')!
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, x: 0, y: 0, width: 0, height: 0 }) as DOMRect
  const scale = sheetScale(doc)
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 9 * scale,
        clientY: 9 * scale,
        bubbles: true,
      }),
    )
  })
  expect(canvas.title).toBe('frame 5')
})
