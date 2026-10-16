// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { EMPTY } from '../maps/types.ts'
import {
  fitScale,
  MapCanvas,
  startOffset,
  stepZoom,
  tileImage,
} from './map-canvas.tsx'
import type {
  MapEditor,
  MapEditorState,
  MapHover,
  Tileset,
  Vec,
} from './map-types.ts'

/** The room the canvas assumes when it cannot measure, as in happy-dom. */
const ROOM = { width: 512, height: 512 }

const E = EMPTY

/** A 4x3 map: `ground` with tiles, `sky` with one star. */
function fakeState(over: Partial<MapEditorState> = {}): MapEditorState {
  const columns = 4
  const rows = 3
  const tileset: Tileset = {
    sheet: {
      file: 'tiles.png',
      name: 'tiles',
      url: '/sprites/tiles.png',
      cellWidth: 8,
      cellHeight: 8,
    },
    pixels: { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) },
    columns: 2,
    frames: 4,
    flagsFile: 'tiles.flags.json',
    flags: { wall: new Set([2]) },
  }
  return {
    maps: [],
    sheets: [],
    doc: {
      info: { file: 'night.json', name: 'night', tiles: 'tiles' },
      data: {
        tiles: 'tiles',
        columns,
        rows,
        layers: {
          ground: new Int16Array([0, 1, E, E, E, 2, E, E, 3, 3, 3, 3]),
          sky: new Int16Array([E, E, E, 1, E, E, E, E, E, E, E, E]),
        },
      },
    },
    tileset,
    layer: 'ground',
    hidden: [],
    tool: 'brush',
    brush: { columns: 1, rows: 1, cells: new Int16Array([0]) },
    chosen: { x: 0, y: 0, width: 1, height: 1 },
    arrange: false,
    shownFlag: undefined,
    selection: undefined,
    drag: undefined,
    zoom: 2,
    canUndo: false,
    canRedo: false,
    saving: false,
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
  const editor = new Proxy({} as MapEditor, {
    // The fitted scale is reported on every render; the tests watch actions.
    get: (_, name) => (name === 'setFit' ? () => {} : record(String(name))),
  })
  return { editor, calls }
}

/** A 2d context that records what is drawn. */
function fakeContext() {
  const drawn: { name: string; args: unknown[]; alpha: number }[] = []
  const target: Record<string, unknown> = { globalAlpha: 1, fillStyle: '' }
  const ctx = new Proxy(target, {
    get(t, name) {
      if (name === 'createImageData')
        return (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        })
      if (name in t) return t[name as string]
      return (...args: unknown[]) =>
        drawn.push({
          name: String(name),
          args,
          alpha: Number(t.globalAlpha),
        })
    },
    set(t, name, value) {
      t[name as string] = value
      return true
    },
  })
  return { ctx, drawn }
}

const original = HTMLCanvasElement.prototype.getContext
let drawn: ReturnType<typeof fakeContext>['drawn']

beforeEach(() => {
  const fake = fakeContext()
  drawn = fake.drawn
  HTMLCanvasElement.prototype.getContext = (() =>
    fake.ctx) as unknown as typeof original
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = original
  document.body.innerHTML = ''
})

function mount(
  state: MapEditorState,
  editor: MapEditor,
  onHover?: (hover: MapHover | undefined) => void,
) {
  const root = document.createElement('div')
  document.body.append(root)
  act(() =>
    render(
      <MapCanvas
        editor={editor}
        state={state}
        screen={{ width: 16, height: 16 }}
        onHover={onHover}
      />,
      root,
    ),
  )
  const canvas = root.querySelector('canvas')!
  placeAt(canvas, 0, 0)
  return { root, canvas }
}

function placeAt(el: Element, left: number, top: number) {
  el.getBoundingClientRect = () =>
    ({ left, top, x: left, y: top, width: 0, height: 0 }) as DOMRect
}

function pointer(
  el: Element,
  type: string,
  at: Vec,
  over: PointerEventInit = {},
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        clientX: at.x,
        clientY: at.y,
        button: 0,
        bubbles: true,
        ...over,
      }),
    )
  })
}

/** A wheel turn at a screen point; happy-dom's WheelEvent drops clientX. */
let wheelTime = 0
/** A time well after the last wheel event, so each test starts a gesture. */
function later(): number {
  wheelTime += 1000
  return wheelTime
}
/** A scroll with Ctrl held, as a pinch arrives; `pan` sends a plain one. */
function wheel(
  el: Element,
  deltaY: number,
  at: Vec,
  time = later(),
  pan?: { deltaX: number },
) {
  const event = new WheelEvent('wheel', {
    deltaY,
    deltaX: pan?.deltaX ?? 0,
    ctrlKey: pan === undefined,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'clientX', { value: at.x })
  Object.defineProperty(event, 'clientY', { value: at.y })
  Object.defineProperty(event, 'timeStamp', { value: time })
  Object.defineProperty(event, 'ctrlKey', { value: pan === undefined })
  Object.defineProperty(event, 'deltaX', { value: pan?.deltaX ?? 0 })
  act(() => {
    el.dispatchEvent(event)
  })
  return event
}

/** The screen point inside cell `(x, y)` of the map at `scale`. */
function screenAt(state: MapEditorState, scale: number, x: number, y: number) {
  const offset = startOffset(state.doc!.data, ROOM, scale)
  return { x: offset.x + x * 8 * scale + 3, y: offset.y + y * 8 * scale + 3 }
}

it('fits the map at the largest whole scale', () => {
  expect(fitScale({ columns: 4, rows: 3 }, { width: 100, height: 100 })).toBe(3)
  expect(fitScale({ columns: 64, rows: 64 }, { width: 100, height: 100 })).toBe(
    1,
  )
  expect(startOffset({ columns: 4, rows: 3 }, ROOM, 2)).toEqual({
    x: 224,
    y: 232,
  })
  expect(startOffset({ columns: 64, rows: 3 }, ROOM, 2)).toEqual({
    x: 0,
    y: 232,
  })
})

it('steps through the zoom levels', () => {
  expect(stepZoom(4, 1)).toBe(6)
  expect(stepZoom(5, -1)).toBe(4)
  expect(stepZoom(8, 1)).toBeUndefined()
  expect(stepZoom(1, -1)).toBeUndefined()
})

it('turns a pointer at a screen point into the cell under it', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 3 })
  const { canvas } = mount(state, editor)

  pointer(canvas, 'pointerdown', screenAt(state, 3, 1, 2))
  pointer(canvas, 'pointermove', screenAt(state, 3, 3, 0))
  pointer(canvas, 'pointerup', screenAt(state, 3, -1, 5))

  expect(calls).toEqual([
    ['pointerDown', { x: 1, y: 2 }],
    ['pointerMove', { x: 3, y: 0 }],
    ['pointerUp', { x: -1, y: 5 }],
  ])
})

it('fits the map when no zoom is set', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: undefined })
  const scale = fitScale(state.doc!.data, ROOM)
  const { canvas } = mount(state, editor)
  pointer(canvas, 'pointerdown', screenAt(state, scale, 2, 1))
  expect(calls).toEqual([['pointerDown', { x: 2, y: 1 }]])
})

it('picks on a right-click or Alt-click, and only picks', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState()
  const { canvas } = mount(state, editor)
  const p = screenAt(state, 2, 1, 0)

  pointer(canvas, 'pointerdown', p, { button: 2 })
  pointer(canvas, 'pointerup', p, { button: 2 })
  pointer(canvas, 'pointerdown', p, { altKey: true })
  pointer(canvas, 'pointerup', p, { altKey: true })

  expect(calls).toEqual([
    ['pickAt', { x: 1, y: 0 }],
    ['pickAt', { x: 1, y: 0 }],
  ])
  const menu = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  })
  canvas.dispatchEvent(menu)
  expect(menu.defaultPrevented).toBe(true)
})

it('reports the cell and its frame on the current layer, and leaving', () => {
  const { editor } = fakeEditor()
  const hovers: (MapHover | undefined)[] = []
  const state = fakeState({ layer: 'ground' })
  const { canvas } = mount(state, editor, (h) => hovers.push(h))

  pointer(canvas, 'pointermove', screenAt(state, 2, 1, 1))
  pointer(canvas, 'pointermove', screenAt(state, 2, 3, 0))
  pointer(canvas, 'pointermove', screenAt(state, 2, 9, 0))
  pointer(canvas, 'pointermove', screenAt(state, 2, 0, 0))
  pointer(canvas, 'pointerleave', { x: 0, y: 0 }, { bubbles: false })

  expect(hovers).toEqual([
    { at: { x: 1, y: 1 }, frame: 2 },
    // The star is on the sky layer, not the current one.
    { at: { x: 3, y: 0 }, frame: undefined },
    undefined,
    { at: { x: 0, y: 0 }, frame: 0 },
    undefined,
  ])
})

it('zooms with the wheel, keeping the point under the pointer', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const { root, canvas } = mount(state, editor)
  const p = screenAt(state, 2, 2, 1)

  wheel(canvas, -100, p)
  expect(calls).toEqual([['setZoom', 3]])

  // The store answers with the new zoom: the same point is the same cell.
  calls.length = 0
  act(() =>
    render(
      <MapCanvas
        editor={editor}
        state={{ ...state, zoom: 3 }}
        screen={{ width: 16, height: 16 }}
      />,
      root,
    ),
  )
  pointer(canvas, 'pointerdown', p)
  expect(calls).toEqual([['pointerDown', { x: 2, y: 1 }]])

  calls.length = 0
  wheel(canvas, 100, { x: 0, y: 0 })
  expect(calls).toEqual([['setZoom', 2]])
})

it('pans on a space-drag without painting', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const { canvas } = mount(state, editor)
  const p = screenAt(state, 2, 1, 2)

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
  })
  expect(canvas.className).toBe('grab')
  pointer(canvas, 'pointerdown', p)
  expect(canvas.className).toBe('grabbing')
  pointer(canvas, 'pointermove', { x: p.x + 16, y: p.y + 32 })
  pointer(canvas, 'pointerup', { x: p.x + 16, y: p.y + 32 })
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })
  expect(calls).toEqual([])

  // The map moved one cell right and two down under the pointer.
  pointer(canvas, 'pointerdown', p)
  expect(calls).toEqual([['pointerDown', { x: 0, y: 0 }]])
})

it('pans on a middle-drag', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const { canvas } = mount(state, editor)
  const p = screenAt(state, 2, 2, 2)

  pointer(canvas, 'pointerdown', p, { button: 1 })
  pointer(canvas, 'pointermove', { x: p.x - 16, y: p.y }, { button: 1 })
  pointer(canvas, 'pointerup', { x: p.x - 16, y: p.y }, { button: 1 })
  expect(calls).toEqual([])

  pointer(canvas, 'pointerdown', p)
  expect(calls).toEqual([['pointerDown', { x: 3, y: 2 }]])
})

it('draws the visible layers in order, the flag tint and the brush ghost', () => {
  const { editor } = fakeEditor()
  const state = fakeState({ hidden: ['sky'], shownFlag: 'wall', zoom: 1 })
  const { canvas } = mount(state, editor)
  const tiles = () =>
    drawn
      .filter((d) => d.name === 'drawImage')
      .map((d) => [d.args[1], d.args[2], d.args[5], d.args[6], d.alpha])

  // Ground only: frames 0, 1, 2 and four 3s; frame 2 is (0, 8) in the sheet.
  expect(tiles()).toEqual([
    [0, 0, 0, 0, 1],
    [8, 0, 8, 0, 1],
    [0, 8, 8, 8, 1],
    [8, 8, 0, 16, 1],
    [8, 8, 8, 16, 1],
    [8, 8, 16, 16, 1],
    [8, 8, 24, 16, 1],
  ])
  // The wall tile at (1, 1) is tinted.
  expect(
    drawn.some(
      (d) => d.name === 'fillRect' && d.args[0] === 8 && d.args[1] === 8,
    ),
  ).toBe(true)

  drawn.length = 0
  const p = screenAt(state, 1, 2, 0)
  pointer(canvas, 'pointermove', p)
  // The ghost: the brush's frame 0 at half alpha over the hovered cell.
  expect(tiles()).toContainEqual([0, 0, 16, 0, 0.5])
})

it('draws the rect being dragged and the lifted selection', () => {
  const { editor } = fakeEditor()
  const state = fakeState({
    tool: 'rect',
    zoom: 1,
    brush: { columns: 2, rows: 1, cells: new Int16Array([1, 2]) },
    drag: { from: { x: 2, y: 2 }, to: { x: 0, y: 1 } },
    selection: {
      rect: { x: 3, y: 0, width: 1, height: 1 },
      lifted: { columns: 1, rows: 1, cells: new Int16Array([3]) },
    },
  })
  mount(state, editor)
  const ghosts = drawn
    .filter((d) => d.name === 'drawImage' && d.alpha === 0.5)
    .map((d) => [d.args[1], d.args[5], d.args[6]])
  // Laid from the top left (0, 1): 1 2 1 on both rows.
  expect(ghosts).toEqual([
    [8, 0, 8],
    [0, 8, 8],
    [8, 16, 8],
    [8, 0, 16],
    [0, 8, 16],
    [8, 16, 16],
  ])
  const lifted = drawn.filter(
    (d) =>
      d.name === 'drawImage' &&
      d.alpha === 1 &&
      d.args[5] === 24 &&
      d.args[6] === 0,
  )
  expect(lifted.map((d) => [d.args[1], d.args[2]])).toEqual([
    [8, 0], // the sky's star, drawn with the layers
    [8, 8], // the lifted tile, frame 3
  ])
})

it('makes tiles from RGBA, half-opaque or more solid', () => {
  const data = new Uint8ClampedArray(4 * 4)
  data.set([10, 20, 30, 127, 1, 2, 3, 128, 0, 0, 0, 0, 9, 9, 9, 255])
  let put: Uint8ClampedArray | undefined
  const ctx = {
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      put = image.data
    },
  }
  HTMLCanvasElement.prototype.getContext = (() =>
    ctx) as unknown as typeof original
  const canvas = tileImage({ width: 2, height: 2, data })
  expect([canvas.width, canvas.height]).toEqual([2, 2])
  expect([...put!]).toEqual([
    10, 20, 30, 0, 1, 2, 3, 255, 0, 0, 0, 0, 9, 9, 9, 255,
  ])
})

it('shows an empty space when no map is open', () => {
  const { editor } = fakeEditor()
  const root = document.createElement('div')
  document.body.append(root)
  act(() =>
    render(
      <MapCanvas
        editor={editor}
        state={fakeState({ doc: undefined })}
        screen={{ width: 16, height: 16 }}
      />,
      root,
    ),
  )
  expect(root.querySelector('canvas')).toBeNull()
})

it('steps the zoom as far as a trackpad gesture goes', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const { canvas } = mount(state, editor)
  const p = screenAt(state, 2, 1, 1)
  // A run of small scrolls close together, as a trackpad sends: a step for
  // every 32 pixels, each from the last, up to the largest zoom.
  const start = later()
  for (let i = 0; i < 4; i++) wheel(canvas, -8, p, start + i * 16)
  expect(calls).toEqual([['setZoom', 3]])
  for (let i = 4; i < 30; i++) wheel(canvas, -8, p, start + i * 16)
  expect(calls).toEqual([
    ['setZoom', 3],
    ['setZoom', 4],
    ['setZoom', 6],
    ['setZoom', 8],
  ])
  // After a pause, the next gesture starts from the canvas's zoom again.
  calls.length = 0
  wheel(canvas, -8, p, start + 30 * 16 + 500)
  wheel(canvas, -40, p, start + 31 * 16 + 500)
  expect(calls).toEqual([['setZoom', 3]])
})

it('shows the zoom and fits the map again', () => {
  const { editor, calls } = fakeEditor()
  const { root } = mount(fakeState({ zoom: 3 }), editor)
  expect(root.querySelector('[data-out="zoom"]')!.textContent).toBe('300%')
  const fit = root.querySelector('.zoom .fit') as HTMLButtonElement
  expect(fit.getAttribute('aria-pressed')).toBe('false')
  act(() => fit.click())
  expect(calls).toEqual([['setZoom', undefined]])
  calls.length = 0
  const [out, into] = root.querySelectorAll<HTMLButtonElement>('.zoom button')
  act(() => out!.click())
  act(() => into!.click())
  expect(calls).toEqual([
    ['setZoom', 2],
    ['setZoom', 4],
  ])
})

it('lays the checker two squares to a tile', () => {
  const { editor } = fakeEditor()
  drawn.length = 0
  mount(fakeState({ zoom: 3 }), editor)
  // At 3x a tile is 24 screen pixels, so the squares are 12.
  expect(
    drawn.some(
      (d) => d.name === 'fillRect' && d.args[2] === 12 && d.args[3] === 12,
    ),
  ).toBe(true)
  expect(
    drawn.some(
      (d) => d.name === 'fillRect' && d.args[2] === 16 && d.args[3] === 16,
    ),
  ).toBe(false)
})

it('pans on a plain scroll, as a two-finger drag sends', () => {
  const { editor, calls } = fakeEditor()
  const state = fakeState({ zoom: 2 })
  const { canvas } = mount(state, editor)
  const p = screenAt(state, 2, 2, 2)
  // Scroll one cell (16 screen pixels at 2x) right and down.
  wheel(canvas, 16, p, later(), { deltaX: 16 })
  expect(calls).toEqual([])
  pointer(canvas, 'pointerdown', p)
  expect(calls).toEqual([['pointerDown', { x: 3, y: 3 }]])
})
