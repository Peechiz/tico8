// @vitest-environment happy-dom
import { type ComponentChildren, render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import { PalettePanel, SheetPicker, Toolbar } from './panels.tsx'
import type {
  Editor,
  EditorProps,
  EditorState,
  NewSheet,
  SheetDoc,
  SheetInfo,
} from './types.ts'

type Call = [name: string, ...args: unknown[]]

function fakeEditor(state: EditorState, refuse?: string) {
  const calls: Call[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
    }
  const editor: Editor = {
    get: () => state,
    subscribe: () => () => {},
    open: async (file) => {
      calls.push(['open', file])
    },
    pickCell: record('pickCell'),
    setZoom: record('setZoom'),
    setTool: record('setTool'),
    setColor: record('setColor'),
    setFilled: record('setFilled'),
    pointerDown: record('pointerDown'),
    pointerMove: record('pointerMove'),
    pointerUp: record('pointerUp'),
    act: record('act'),
    key: () => false,
    newSheet: async (sheet: NewSheet) => {
      calls.push(['newSheet', sheet])
      return refuse
    },
    resize: async (size) => {
      calls.push(['resize', size])
    },
    destroy: () => {},
  }
  return { editor, calls }
}

const player: SheetInfo = {
  file: 'player.16.png',
  name: 'player',
  url: '/sprites/player.16.png',
  cellWidth: 16,
  cellHeight: 16,
}
const tiles: SheetInfo = {
  file: 'tiles.png',
  name: 'tiles',
  url: '/sprites/tiles.png',
  cellWidth: 8,
  cellHeight: 8,
}

const doc: SheetDoc = {
  info: player,
  image: { width: 64, height: 32, pixels: new Uint8Array(64 * 32) },
  colors: [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
    [1, 2, 3],
  ],
  paletteSize: 3,
}

function makeState(over: Partial<EditorState> = {}): EditorState {
  return {
    sheets: [player, tiles],
    doc,
    cell: { x: 0, y: 0 },
    zoom: 2,
    tool: 'pencil',
    color: 1,
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: true,
    canRedo: false,
    error: undefined,
    version: 0,
    ...over,
  }
}

const roots: HTMLElement[] = []
afterEach(() => {
  for (const root of roots.splice(0)) act(() => render(null, root))
})

function mount(node: ComponentChildren) {
  const root = document.createElement('div')
  document.body.append(root)
  roots.push(root)
  act(() => render(node, root))
  return root
}

function setup(
  Panel: (props: EditorProps) => ComponentChildren,
  over: Partial<EditorState> = {},
  refuse?: string,
) {
  const state = makeState(over)
  const { editor, calls } = fakeEditor(state, refuse)
  const root = mount(<Panel editor={editor} state={state} />)
  const $ = (selector: string) => {
    const el = root.querySelector(selector)
    if (!el) throw new Error(`no ${selector}`)
    return el as HTMLElement
  }
  const click = (selector: string) => act(() => $(selector).click())
  return { root, calls, $, click }
}

it('marks the current tool and shows each tool’s shortcut', () => {
  const { $, root } = setup(Toolbar, { tool: 'fill' })
  const pressed = [...root.querySelectorAll('[data-tool]')].filter(
    (b) => b.getAttribute('aria-pressed') === 'true',
  )
  expect(pressed.map((b) => b.getAttribute('data-tool'))).toEqual(['fill'])
  expect($('[data-tool="fill"]').textContent).toContain('F')
  expect($('[data-tool="pick"]').title).toBe('Pick (I)')
})

it('calls the toolbar’s actions', () => {
  const { calls, click } = setup(Toolbar)
  click('[data-tool="rect"]')
  click('[data-filled]')
  click('[data-action="undo"]')
  click('[data-action="flipX"]')
  click('[data-action="flipY"]')
  click('[data-action="rotate"]')
  click('[data-action="paste"]')
  click('[data-zoom="4"]')
  expect(calls).toEqual([
    ['setTool', 'rect'],
    ['setFilled', true],
    ['act', 'undo'],
    ['act', 'flipX'],
    ['act', 'flipY'],
    ['act', 'rotate'],
    ['act', 'paste'],
    ['setZoom', 4],
  ])
})

it('disables undo and redo when there is nothing to do', () => {
  const { $ } = setup(Toolbar, { canUndo: false, canRedo: true })
  expect(($('[data-action="undo"]') as HTMLButtonElement).disabled).toBe(true)
  expect(($('[data-action="redo"]') as HTMLButtonElement).disabled).toBe(false)
})

it('shows the palette, then the sheet’s own colours after a gap', () => {
  const { root, calls, click } = setup(PalettePanel, { color: 3 })
  const children = [...(root.firstElementChild?.children ?? [])]
  expect(children.map((c) => c.getAttribute('data-color'))).toEqual([
    '0',
    '1',
    '2',
    null,
    '3',
  ])
  expect(
    root.querySelector('[aria-pressed="true"]')?.getAttribute('data-color'),
  ).toBe('3')
  click('[data-color="2"]')
  expect(calls).toEqual([['setColor', 2]])
})

it('shows no palette without a sheet', () => {
  const { root } = setup(PalettePanel, { doc: undefined })
  expect(root.innerHTML).toBe('')
})

it('lists the sheets with their cell size and opens one', () => {
  const { root, calls, click } = setup(SheetPicker)
  const items = [...root.querySelectorAll('[data-file]')]
  expect(items.map((b) => b.textContent)).toEqual(['player 16x16', 'tiles 8x8'])
  expect(items[0]?.getAttribute('aria-current')).toBe('true')
  expect(items[1]?.getAttribute('aria-current')).not.toBe('true')
  click('[data-file="tiles.png"]')
  expect(calls).toEqual([['open', 'tiles.png']])
})

async function submit(form: HTMLElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function fill(form: HTMLElement, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement
    input.value = value
  }
}

it('makes a new sheet and shows the reason it is refused', async () => {
  const { $, calls } = setup(
    SheetPicker,
    {},
    'a cell size of 12 is not a multiple of 8',
  )
  const form = $('form.t8p-new')
  fill(form, { name: 'hero', cellWidth: '16', cellHeight: '12', columns: '4' })
  await submit(form)
  expect(calls).toEqual([
    [
      'newSheet',
      { name: 'hero', cellWidth: 16, cellHeight: 12, columns: 4, rows: 16 },
    ],
  ])
  expect($('.t8p-error').textContent).toBe(
    'a cell size of 12 is not a multiple of 8',
  )
})

it('shows no reason when a new sheet is made', async () => {
  const { $, root } = setup(SheetPicker)
  const form = $('form.t8p-new')
  fill(form, { name: 'hero' })
  await submit(form)
  expect(root.querySelector('.t8p-error')).toBeNull()
})

it('resizes the open sheet, prefilled with its size', async () => {
  const { $, calls } = setup(SheetPicker)
  const form = $('form.t8p-resize')
  const columns = form.querySelector('[name="columns"]') as HTMLInputElement
  const rows = form.querySelector('[name="rows"]') as HTMLInputElement
  expect([columns.value, rows.value]).toEqual(['4', '2'])
  fill(form, { rows: '3' })
  await submit(form)
  expect(calls).toEqual([['resize', { columns: 4, rows: 3 }]])
})

it('has no resize without a sheet, and shows the editor’s error', () => {
  const { root, $ } = setup(SheetPicker, {
    doc: undefined,
    error: 'could not write player.16.png',
  })
  expect(root.querySelector('form.t8p-resize')).toBeNull()
  expect($('.t8p-error').textContent).toBe('could not write player.16.png')
})
