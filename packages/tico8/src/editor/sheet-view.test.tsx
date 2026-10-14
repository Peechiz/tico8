// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { expect, it } from 'vitest'
import { cellAt, SheetView, sheetScale } from './sheet-view.tsx'
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

function fakeState(doc: SheetDoc | undefined, zoom: Zoom): EditorState {
  return {
    sheets: [],
    doc,
    cell: { x: 0, y: 0 },
    zoom,
    tool: 'pencil',
    color: 0,
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: false,
    canRedo: false,
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
  expect(sheetScale(fakeDoc(16, 16))).toBe(2)
  expect(sheetScale(fakeDoc(4, 4))).toBe(4)
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
