// @vitest-environment happy-dom
import { type ComponentChildren, render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import {
  PalettePanel,
  ShortcutSheet,
  StatusLine,
  ToolRail,
  ZoomPicker,
} from './panels.tsx'
import { keyLabel } from './theme.ts'
import type {
  Editor,
  EditorProps,
  EditorState,
  Hover,
  NewSheet,
  SheetDoc,
  SheetInfo,
} from './types.ts'
import { SHORTCUTS } from './types.ts'

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
    pickAt: record('pickAt'),
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
    saving: false,
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

const tool = (root: HTMLElement, label: string) =>
  root.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement

const pressedLabels = (root: HTMLElement) =>
  [...root.querySelectorAll('[aria-pressed="true"]')].map((b) =>
    b.getAttribute('aria-label'),
  )

it('calls setTool for each tool and setFilled for the rectangles', () => {
  const { root, calls } = setup(ToolRail)
  for (const label of ['Pencil', 'Eraser', 'Fill', 'Pick', 'Line', 'Select'])
    act(() => tool(root, label).click())
  act(() => tool(root, 'Rectangle').click())
  act(() => tool(root, 'Filled rectangle').click())
  expect(calls).toEqual([
    ['setTool', 'pencil'],
    ['setTool', 'eraser'],
    ['setTool', 'fill'],
    ['setTool', 'pick'],
    ['setTool', 'line'],
    ['setTool', 'select'],
    ['setTool', 'rect'],
    ['setFilled', false],
    ['setTool', 'rect'],
    ['setFilled', true],
  ])
})

it('presses the current tool, and the rectangle that matches filled', () => {
  expect(pressedLabels(setup(ToolRail, { tool: 'fill' }).root)).toEqual([
    'Fill',
  ])
  expect(
    pressedLabels(setup(ToolRail, { tool: 'rect', filled: false }).root),
  ).toEqual(['Rectangle'])
  expect(
    pressedLabels(setup(ToolRail, { tool: 'rect', filled: true }).root),
  ).toEqual(['Filled rectangle'])
})

it('names each tool’s key in its title', () => {
  const { root } = setup(ToolRail)
  expect(tool(root, 'Pick').title).toMatch(/^Pick \(I\)$/)
  expect(tool(root, 'Rectangle').title).toBe('Rectangle (R)')
})

it('disables undo and redo when there is nothing to do', () => {
  const { $, calls, click } = setup(ToolRail, { canUndo: true, canRedo: false })
  expect(($('[data-action="undo"]') as HTMLButtonElement).disabled).toBe(false)
  expect(($('[data-action="redo"]') as HTMLButtonElement).disabled).toBe(true)
  click('[data-action="undo"]')
  expect(calls).toEqual([['act', 'undo']])
  const other = setup(ToolRail, { canUndo: false, canRedo: true })
  expect((other.$('[data-action="undo"]') as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect((other.$('[data-action="redo"]') as HTMLButtonElement).disabled).toBe(
    false,
  )
})

it('shows the current colour and picks a swatch', () => {
  const { $, root, calls, click } = setup(PalettePanel, { color: 1 })
  expect($('.t8p-cur').textContent).toBe('colour 1')
  const palette = [...$('.t8p-pal').children]
  expect(palette.map((c) => c.getAttribute('data-color'))).toEqual([
    '0',
    '1',
    '2',
  ])
  expect(
    root.querySelector('[aria-pressed="true"]')?.getAttribute('data-color'),
  ).toBe('1')
  click('[data-color="2"]')
  expect(calls).toEqual([['setColor', 2]])
})

it('marks dark swatches so their index shows in light text', () => {
  const { $ } = setup(PalettePanel)
  expect($('[data-color="0"]').classList.contains('dark')).toBe(true)
  expect($('[data-color="1"]').classList.contains('dark')).toBe(false)
})

it('shows the sheet’s own colours under their label', () => {
  const { $, calls, click } = setup(PalettePanel, { color: 3 })
  expect($('.t8p-colors h5').textContent).toBe('from this sheet')
  const extra = [...$('.t8p-extra').children]
  expect(extra.map((c) => c.getAttribute('data-color'))).toEqual(['3'])
  expect(extra[0]?.getAttribute('aria-pressed')).toBe('true')
  click('[data-color="3"]')
  expect(calls).toEqual([['setColor', 3]])
})

it('has no label when the sheet uses only the palette', () => {
  const { root } = setup(PalettePanel, {
    doc: { ...doc, paletteSize: doc.colors.length },
  })
  expect(root.querySelector('h5')).toBeNull()
})

it('shows no palette without a sheet', () => {
  const { root } = setup(PalettePanel, { doc: undefined })
  expect(root.innerHTML).toBe('')
})

it('sets the zoom and marks the current one', () => {
  const { root, calls, click } = setup(ZoomPicker, { zoom: 2 })
  const buttons = [...root.querySelectorAll('[data-zoom]')]
  expect(buttons.map((b) => b.textContent)).toEqual(['1 cell', '2x2', '4x4'])
  expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
    'false',
    'true',
    'false',
  ])
  expect((buttons[2] as HTMLElement).title).toBe('Show 4x4 cells (4)')
  click('[data-zoom="1"]')
  click('[data-zoom="4"]')
  expect(calls).toEqual([
    ['setZoom', 1],
    ['setZoom', 4],
  ])
})

function status(hover: Hover | undefined, over: Partial<EditorState> = {}) {
  let helped = 0
  const state = makeState(over)
  const { editor } = fakeEditor(state)
  const root = mount(
    <StatusLine
      editor={editor}
      state={state}
      hover={hover}
      onHelp={() => helped++}
    />,
  )
  const text = (out: string) =>
    root.querySelector(`[data-out="${out}"]`)?.textContent
  return { root, text, helped: () => helped }
}

it('shows where the pointer is', () => {
  const { text, root } = status({ at: { x: 5, y: 12 }, frame: 3 })
  expect([text('x'), text('y'), text('frame')]).toEqual(['5', '12', '3'])
  expect(root.textContent).toContain('right-click picks a colour')
})

it('shows dashes once the pointer leaves', () => {
  const { text } = status(undefined)
  expect([text('x'), text('y'), text('frame')]).toEqual(['-', '-', '-'])
})

it('shows the error in place of the hint', () => {
  const { root } = status(undefined, { error: 'could not write player.16.png' })
  expect(root.querySelector('.t8p-error')?.textContent).toBe(
    'could not write player.16.png',
  )
  expect(root.textContent).not.toContain('right-click picks a colour')
})

it('opens the shortcuts from ?', () => {
  const { root, helped } = status(undefined)
  const help = root.querySelector('[title="Shortcuts (?)"]') as HTMLElement
  act(() => help.click())
  expect(helped()).toBe(1)
})

function sheet() {
  let closed = 0
  const root = mount(<ShortcutSheet onClose={() => closed++} />)
  return { root, closed: () => closed }
}

it('lists every shortcut with its key label', () => {
  const { root } = sheet()
  const keys = [...root.querySelectorAll('kbd')].map((k) => k.textContent)
  for (const key of Object.keys(SHORTCUTS))
    expect(keys).toContain(keyLabel(key))
  expect(keys).toContain('Right-click')
  expect(keys).toContain('?')
  expect(root.textContent).toContain('Flip left to right')
  expect([...root.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
    'Tools',
    'Editing',
    'Selection',
    'View',
  ])
})

it('focuses Close, and closes on Escape, Close and the backdrop', () => {
  const { root, closed } = sheet()
  const close = [...root.querySelectorAll('button')].find(
    (b) => b.textContent === 'Close',
  ) as HTMLButtonElement
  expect(document.activeElement).toBe(close)
  act(() => {
    close.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
  })
  expect(closed()).toBe(1)
  act(() => close.click())
  expect(closed()).toBe(2)
  act(() => (root.querySelector('[role="dialog"]') as HTMLElement).click())
  expect(closed()).toBe(2)
  act(() => (root.querySelector('.t8e-dialog') as HTMLElement).click())
  expect(closed()).toBe(3)
})
