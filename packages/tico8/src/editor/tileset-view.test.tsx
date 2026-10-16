// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import type {
  Cells,
  FlagData,
  MapEditor,
  MapEditorState,
  Rect,
  Tileset,
} from './map-types.ts'
import {
  chosenLabel,
  FlagsPanel,
  TilesetView,
  tilesetScale,
} from './tileset-view.tsx'

function fakeTileset(columns: number, rows: number, flags: FlagData = {}) {
  const width = columns * 8
  const height = rows * 8
  return {
    sheet: {
      file: 'tiles.png',
      name: 'tiles',
      url: '/sprites/tiles.png',
      cellWidth: 8,
      cellHeight: 8,
    },
    pixels: { width, height, data: new Uint8ClampedArray(width * height * 4) },
    columns,
    frames: columns * rows,
    flagsFile: 'tiles.flags.json',
    flags,
  } as Tileset
}

function fakeState(
  tileset: Tileset | undefined,
  more: Partial<MapEditorState> = {},
): MapEditorState {
  return {
    maps: [],
    sheets: [],
    doc: undefined,
    tileset,
    layer: undefined,
    hidden: [],
    tool: 'brush',
    brush: { columns: 1, rows: 1, cells: new Int16Array(1) } as Cells,
    chosen: { x: 0, y: 0, width: 1, height: 1 },
    arrange: false,
    shownFlag: undefined,
    selection: undefined,
    drag: undefined,
    zoom: undefined,
    canUndo: false,
    canRedo: false,
    saving: false,
    error: undefined,
    version: 0,
    ...more,
  }
}

/** A MapEditor that logs each call; `answers` gives return values by name. */
function fakeEditor(answers: Record<string, unknown> = {}) {
  const calls: [string, ...unknown[]][] = []
  const editor = new Proxy({} as MapEditor, {
    get:
      (_, name) =>
      (...args: unknown[]) => {
        calls.push([String(name), ...args])
        return answers[String(name)]
      },
  })
  return { editor, calls }
}

let root = document.createElement('div')
afterEach(() => {
  act(() => render(null, root))
  root.remove()
})

function mount(node: preact.ComponentChild) {
  root = document.createElement('div')
  document.body.append(root)
  act(() => render(node, root))
}

/** Pointer events on the tileset canvas, by tile, at its scale. */
function pointer(tileset: Tileset) {
  const canvas = root.querySelector('canvas')!
  canvas.getBoundingClientRect = () =>
    ({ left: 10, top: 20, x: 10, y: 20, width: 0, height: 0 }) as DOMRect
  const s = 8 * tilesetScale(tileset)
  const send = (type: string, x: number, y: number) =>
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          clientX: 10 + x * s + s / 2,
          clientY: 20 + y * s + s / 2,
          button: 0,
          bubbles: true,
        }),
      )
    })
  return {
    canvas,
    down: (x: number, y: number) => send('pointerdown', x, y),
    move: (x: number, y: number) => send('pointermove', x, y),
    up: (x: number, y: number) => send('pointerup', x, y),
  }
}

const lastChosen = (calls: [string, ...unknown[]][]): Rect | undefined =>
  calls.filter((c) => c[0] === 'chooseTiles').at(-1)?.[1] as Rect | undefined

it('draws at a whole scale of 2 or more about 200px wide', () => {
  expect(tilesetScale(fakeTileset(16, 16))).toBe(2)
  expect(tilesetScale(fakeTileset(8, 4))).toBe(3)
  expect(tilesetScale(fakeTileset(2, 2))).toBe(8)
})

it('shows nothing without a tileset', () => {
  const { editor } = fakeEditor()
  mount(
    <div>
      <TilesetView editor={editor} state={fakeState(undefined)} />
      <FlagsPanel editor={editor} state={fakeState(undefined)} />
    </div>,
  )
  expect(root.innerHTML).toBe('<div></div>')
})

it('picks one tile on a click', () => {
  const tileset = fakeTileset(8, 4)
  const { editor, calls } = fakeEditor()
  mount(<TilesetView editor={editor} state={fakeState(tileset)} />)
  const p = pointer(tileset)
  p.down(3, 2)
  p.up(3, 2)
  expect(lastChosen(calls)).toEqual({ x: 3, y: 2, width: 1, height: 1 })
  expect(calls.some((c) => c[0] === 'swapTiles')).toBe(false)
})

it('picks a block on a drag, either way', () => {
  const tileset = fakeTileset(8, 4)
  const { editor, calls } = fakeEditor()
  mount(<TilesetView editor={editor} state={fakeState(tileset)} />)
  const p = pointer(tileset)
  p.down(5, 3)
  p.move(4, 2)
  p.up(4, 2)
  expect(lastChosen(calls)).toEqual({ x: 4, y: 2, width: 2, height: 2 })
})

it('shows the frame number on hover', () => {
  const tileset = fakeTileset(8, 4)
  const { editor } = fakeEditor()
  mount(<TilesetView editor={editor} state={fakeState(tileset)} />)
  const p = pointer(tileset)
  p.move(2, 1)
  expect(p.canvas.title).toBe('frame 10')
})

it('swaps two tiles on a drag with Arrange on', () => {
  const tileset = fakeTileset(8, 4)
  const { editor, calls } = fakeEditor()
  mount(
    <TilesetView
      editor={editor}
      state={fakeState(tileset, { arrange: true })}
    />,
  )
  const p = pointer(tileset)
  p.down(1, 0)
  p.move(2, 1)
  p.up(2, 1)
  expect(calls).toEqual([['swapTiles', 1, 10]])
})

it('swaps nothing when dropped on the same tile', () => {
  const tileset = fakeTileset(8, 4)
  const { editor, calls } = fakeEditor()
  mount(
    <TilesetView
      editor={editor}
      state={fakeState(tileset, { arrange: true })}
    />,
  )
  const p = pointer(tileset)
  p.down(1, 0)
  p.up(1, 0)
  expect(calls).toEqual([])
})

it('toggles Arrange', () => {
  const tileset = fakeTileset(8, 4)
  const { editor, calls } = fakeEditor()
  mount(<TilesetView editor={editor} state={fakeState(tileset)} />)
  const button = root.querySelector('button')!
  expect(button.getAttribute('aria-pressed')).toBe('false')
  act(() => button.click())
  expect(calls).toEqual([['setArrange', true]])
})

const FLAGS: FlagData = {
  wall: new Set([0, 1]),
  water: new Set([1]),
  ice: new Set(),
}

function mountFlags(
  more: Partial<MapEditorState> = {},
  answers: Record<string, unknown> = {},
) {
  const tileset = fakeTileset(8, 4, FLAGS)
  const { editor, calls } = fakeEditor(answers)
  mount(
    <FlagsPanel
      editor={editor}
      state={fakeState(tileset, {
        chosen: { x: 0, y: 0, width: 2, height: 1 },
        ...more,
      })}
    />,
  )
  const box = (flag: string) =>
    root.querySelector<HTMLInputElement>(
      `li[data-flag="${flag}"] input[type="checkbox"]`,
    )!
  return { calls, box }
}

it('lists the flags in order with all, mixed and none checked', () => {
  const { box } = mountFlags()
  expect([...root.querySelectorAll('li')].map((li) => li.dataset.flag)).toEqual(
    ['wall', 'water', 'ice'],
  )
  expect([box('wall').checked, box('wall').indeterminate]).toEqual([
    true,
    false,
  ])
  expect([box('water').checked, box('water').indeterminate]).toEqual([
    false,
    true,
  ])
  expect([box('ice').checked, box('ice').indeterminate]).toEqual([false, false])
  expect(root.querySelector('.t8e-flags-head')!.textContent).toBe(
    'flags of tiles 0–1',
  )
})

it('sets a flag on, or off when every chosen tile has it', () => {
  const { box, calls } = mountFlags()
  act(() => box('water').click())
  act(() => box('ice').click())
  act(() => box('wall').click())
  expect(calls).toEqual([
    ['setFlag', 'water', true],
    ['setFlag', 'ice', true],
    ['setFlag', 'wall', false],
  ])
})

it('shows a flag, and stops showing it', () => {
  const shown = mountFlags({ shownFlag: 'wall' })
  const show = (flag: string) =>
    root.querySelector<HTMLButtonElement>(
      `li[data-flag="${flag}"] .t8e-flag-show`,
    )!
  expect(show('wall').getAttribute('aria-pressed')).toBe('true')
  expect(show('ice').getAttribute('aria-pressed')).toBe('false')
  act(() => show('wall').click())
  act(() => show('ice').click())
  expect(shown.calls).toEqual([
    ['showFlag', undefined],
    ['showFlag', 'ice'],
  ])
})

it('removes a flag', () => {
  const { calls } = mountFlags()
  act(() =>
    root
      .querySelector<HTMLButtonElement>('li[data-flag="ice"] .t8e-flag-remove')!
      .click(),
  )
  expect(calls).toEqual([['removeFlag', 'ice']])
})

function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    input.value = text
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('adds a flag, showing why a name is refused', () => {
  const { calls } = mountFlags({}, { addFlag: 'There is a flag wall.' })
  const input = root.querySelector<HTMLInputElement>(
    'input[aria-label="New flag"]',
  )!
  typeInto(input, 'wall')
  act(() => {
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  expect(calls).toEqual([['addFlag', 'wall']])
  expect(root.querySelector('.t8e-error')!.textContent).toBe(
    'There is a flag wall.',
  )
})

it('renames a flag on double-click and Enter; Escape cancels', () => {
  const { calls } = mountFlags()
  const name = () =>
    root.querySelector<HTMLElement>('li[data-flag="ice"] .t8e-flag-name')
  const field = () =>
    root.querySelector<HTMLInputElement>('input[aria-label="Rename ice"]')
  const key = (key: string) =>
    act(() => {
      field()!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      )
    })

  act(() => {
    name()!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  expect(field()!.value).toBe('ice')
  key('Escape')
  expect(field()).toBeNull()
  expect(calls).toEqual([])

  act(() => {
    name()!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  typeInto(field()!, 'slippery')
  key('Enter')
  expect(calls).toEqual([['renameFlag', 'ice', 'slippery']])
  expect(field()).toBeNull()
})

it('keeps the field and shows the reason when a rename is refused', () => {
  const { calls } = mountFlags({}, { renameFlag: 'There is a flag wall.' })
  act(() => {
    root
      .querySelector('li[data-flag="ice"] .t8e-flag-name')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  const field = root.querySelector<HTMLInputElement>(
    'input[aria-label="Rename ice"]',
  )!
  typeInto(field, 'wall')
  act(() => {
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
  })
  expect(calls).toEqual([['renameFlag', 'ice', 'wall']])
  expect(root.querySelector('.t8e-error')!.textContent).toBe(
    'There is a flag wall.',
  )
})

it('names the chosen tiles', () => {
  const tileset = fakeTileset(8, 4)
  expect(chosenLabel(tileset, { x: 5, y: 0, width: 1, height: 1 })).toBe(
    'tile 5',
  )
  expect(chosenLabel(tileset, { x: 0, y: 1, width: 3, height: 1 })).toBe(
    'tiles 8–10',
  )
  expect(chosenLabel(tileset, { x: 0, y: 0, width: 2, height: 2 })).toBe(
    '4 tiles',
  )
})
