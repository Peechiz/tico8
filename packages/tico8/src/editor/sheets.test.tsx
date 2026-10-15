// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import { TRANSPARENT } from '../sprites.ts'
import { cellsCut, SheetTabs } from './sheets.tsx'
import type {
  Editor,
  EditorState,
  IndexedImage,
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

const badge: SheetInfo = {
  file: 'badge.16.png',
  name: 'badge',
  url: '/sprites/badge.16.png',
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

/** A 2x2-cell 8x8 image, see-through but for pixels at `art`. */
function image(art: [x: number, y: number][] = []): IndexedImage {
  const pixels = new Uint8Array(16 * 16).fill(TRANSPARENT)
  for (const [x, y] of art) pixels[y * 16 + x] = 3
  return { width: 16, height: 16, pixels }
}

function makeState(over: Partial<EditorState> = {}): EditorState {
  const doc: SheetDoc = {
    info: { ...tiles },
    image: image([
      [9, 1],
      [2, 12],
      [15, 15],
    ]),
    colors: [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [1, 2, 3],
    ],
    paletteSize: 4,
  }
  return {
    sheets: [badge, tiles],
    doc,
    cell: { x: 0, y: 0 },
    zoom: 1,
    tool: 'pencil',
    color: 1,
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: false,
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

function setup(over: Partial<EditorState> = {}, refuse?: string) {
  const state = makeState(over)
  const { editor, calls } = fakeEditor(state, refuse)
  const root = document.createElement('div')
  root.className = 't8e'
  document.body.append(root)
  roots.push(root)
  act(() => render(<SheetTabs editor={editor} state={state} />, root))
  const $ = <T extends Element = HTMLElement>(selector: string) => {
    const el = root.querySelector<T & Element>(selector)
    if (!el) throw new Error(`no ${selector}`)
    return el as T
  }
  const button = (title: string) => $<HTMLButtonElement>(`[title="${title}"]`)
  return { root, calls, $, button }
}

async function type(input: HTMLInputElement, value: string) {
  await act(() => {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

it('shows a tab per sheet, and a click opens it', () => {
  const { root, calls } = setup()
  const tabs = [...root.querySelectorAll<HTMLElement>('.t8s-tab')]
  expect(tabs.map((t) => t.dataset.file)).toEqual(['badge.16.png', 'tiles.png'])
  expect(tabs[0]?.textContent).toContain('badge')
  expect(tabs[0]?.textContent).toContain('16×16')
  expect(tabs[0]?.querySelector('img')?.getAttribute('src')).toBe(badge.url)
  expect(tabs[1]?.getAttribute('aria-current')).toBe('true')
  expect(tabs[1]?.querySelector('canvas')).not.toBeNull()
  act(() => tabs[0]?.querySelector<HTMLButtonElement>('.t8s-open')?.click())
  expect(calls).toEqual([['open', 'badge.16.png']])
})

it('shows the save state', () => {
  expect(setup({ saving: true }).$('.t8s-save').textContent).toBe('saving')
  expect(setup().$('.t8s-save').textContent).toBe('saved')
  expect(setup({ doc: undefined }).$('.t8s-save').textContent).toBe('')
})

it('names the file a new sheet will write', async () => {
  const { root, $, button } = setup()
  act(() => button('New sheet').click())
  expect($('.t8e-dialog h2').textContent).toBe('New sheet')
  await type($('input[name="name"]'), 'coin')
  await act(() => {
    const select = $<HTMLSelectElement>('select')
    select.value = '1'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect($('[data-preview]').textContent).toBe(
    'Writes sprites/coin.16.png, 256×256 pixels, 256 frames.',
  )
  await type($('input[name="columns"]'), '4')
  await type($('input[name="rows"]'), '2')
  expect($('[data-preview]').textContent).toBe(
    'Writes sprites/coin.16.png, 64×32 pixels, 8 frames.',
  )
  act(() => {
    $('.t8e-dialog').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
  })
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})

it('holds back a bad name and shows a refused one', async () => {
  const { root, calls, $, button } = setup(
    {},
    'a sheet named tiles already exists',
  )
  act(() => button('New sheet').click())
  const make = () => $<HTMLButtonElement>('button[type="submit"]')
  expect(make().disabled).toBe(true)
  await type($('input[name="name"]'), '2 coins')
  expect(make().disabled).toBe(true)
  expect($('[data-preview]').textContent).toMatch(/starts with a letter/)

  await type($('input[name="name"]'), 'tiles')
  expect(make().disabled).toBe(false)
  await submit($('form'))
  expect(calls).toEqual([
    [
      'newSheet',
      { name: 'tiles', cellWidth: 8, cellHeight: 8, columns: 16, rows: 16 },
    ],
  ])
  expect($('.t8e-error').textContent).toBe('a sheet named tiles already exists')
  expect(root.querySelector('.t8e-dialog')).not.toBeNull()
})

it('closes New once the sheet is made', async () => {
  const { root, $, button } = setup()
  act(() => button('New sheet').click())
  await type($('input[name="name"]'), 'coin')
  await submit($('form'))
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})

it('counts the cells with art a shrink cuts', () => {
  const art = image([
    [9, 1],
    [2, 12],
    [15, 15],
  ])
  const cell = { cellWidth: 8, cellHeight: 8 }
  expect(cellsCut(art, cell, { columns: 2, rows: 2 })).toBe(0)
  expect(cellsCut(art, cell, { columns: 1, rows: 2 })).toBe(2)
  expect(cellsCut(art, cell, { columns: 1, rows: 1 })).toBe(3)
  expect(cellsCut(image(), cell, { columns: 1, rows: 1 })).toBe(0)
})

it('resizes the open sheet, warning of art it cuts', async () => {
  const { root, calls, $, button } = setup()
  act(() => button('Resize tiles').click())
  expect($('.t8e-dialog h2').textContent).toBe('Resize tiles')
  expect($<HTMLInputElement>('input[name="columns"]').value).toBe('2')
  expect($('[data-preview]').textContent).toBe('16×16 pixels.')
  expect(root.querySelector('[data-cut]')).toBeNull()

  await type($('input[name="columns"]'), '1')
  expect($('[data-preview]').textContent).toBe('8×16 pixels.')
  expect($('[data-cut]').textContent).toBe('Cuts 2 cells with art.')
  await type($('input[name="rows"]'), '1')
  expect($('[data-cut]').textContent).toBe('Cuts 3 cells with art.')

  await submit($('form'))
  expect(calls).toEqual([['resize', { columns: 1, rows: 1 }]])
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})

it('closes on a backdrop click', () => {
  const { root, $, button } = setup()
  act(() => button('New sheet').click())
  act(() => $('.t8e-dialog').click())
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})
