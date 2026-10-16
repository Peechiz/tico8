// @vitest-environment happy-dom
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import { EMPTY } from '../maps/types.ts'
import { MapTabs } from './map-tabs.tsx'
import type {
  MapDoc,
  MapEditor,
  MapEditorState,
  MapInfo,
  NewMap,
  SheetInfo,
} from './map-types.ts'

type Call = [name: string, ...args: unknown[]]

function fakeEditor(refuse?: string) {
  const calls: Call[] = []
  const editor = {
    open: async (file: string) => {
      calls.push(['open', file])
    },
    newMap: async (map: NewMap) => {
      calls.push(['newMap', map])
      return refuse
    },
    resize: async (size: unknown) => {
      calls.push(['resize', size])
    },
  } as unknown as MapEditor
  return { editor, calls }
}

const sheet = (name: string, cell: number): SheetInfo => ({
  file: `${name}.png`,
  name,
  url: `/sprites/${name}.png`,
  cellWidth: cell,
  cellHeight: cell,
})

const room1: MapInfo = { file: 'room1.json', name: 'room1', tiles: 'tiles' }
const room2: MapInfo = { file: 'room2.json', name: 'room2', tiles: 'rocks' }

function makeState(over: Partial<MapEditorState> = {}): MapEditorState {
  // 3x2 cells, tiles at (2,0), (0,1) and (2,1).
  const ground = new Int16Array(6).fill(EMPTY)
  ground[2] = 1
  ground[3] = 2
  ground[5] = 3
  const doc: MapDoc = {
    info: room1,
    data: { tiles: 'tiles', columns: 3, rows: 2, layers: { ground } },
  }
  return {
    maps: [room1, room2],
    sheets: [sheet('badge', 16), sheet('tiles', 8), sheet('rocks', 8)],
    doc,
    saving: false,
    ...over,
  } as MapEditorState
}

const roots: HTMLElement[] = []
afterEach(() => {
  for (const root of roots.splice(0)) act(() => render(null, root))
})

function setup(over: Partial<MapEditorState> = {}, refuse?: string) {
  const state = makeState(over)
  const { editor, calls } = fakeEditor(refuse)
  const root = document.createElement('div')
  root.className = 't8e'
  document.body.append(root)
  roots.push(root)
  act(() =>
    render(
      <MapTabs
        editor={editor}
        state={state}
        start={{ columns: 16, rows: 16 }}
      />,
      root,
    ),
  )
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

it('shows a tab per map, and a click opens it', () => {
  const { root, calls } = setup()
  const tabs = [...root.querySelectorAll<HTMLElement>('.t8m-tab')]
  expect(tabs.map((t) => t.dataset.file)).toEqual(['room1.json', 'room2.json'])
  expect(tabs[0]?.textContent).toContain('tiles')
  expect(tabs[0]?.textContent).toContain('3×2')
  expect(tabs[0]?.getAttribute('aria-current')).toBe('true')
  expect(tabs[1]?.textContent).toContain('rocks')
  expect(tabs[1]?.textContent).not.toContain('×')
  act(() => tabs[1]?.querySelector<HTMLButtonElement>('.t8m-open')?.click())
  expect(calls).toEqual([['open', 'room2.json']])
})

it('shows the save state', () => {
  expect(setup({ saving: true }).$('.t8m-save').textContent).toBe('saving')
  expect(setup().$('.t8m-save').textContent).toBe('saved')
  expect(setup({ doc: undefined }).$('.t8m-save').textContent).toBe('')
})

it('offers only 8x8 sheets, and holds back a bad or taken name', async () => {
  const { $, button } = setup()
  act(() => button('New map').click())
  const options = [...document.querySelectorAll('select option')]
  expect(options.map((o) => o.textContent)).toEqual(['tiles', 'rocks'])
  const make = () => $<HTMLButtonElement>('button[type="submit"]')
  expect(make().disabled).toBe(true)
  await type($('input[name="name"]'), '2 rooms')
  expect(make().disabled).toBe(true)
  expect($('[data-preview]').textContent).toMatch(/starts with a letter/)
  await type($('input[name="name"]'), 'room1')
  expect(make().disabled).toBe(true)
  expect($('[data-preview]').textContent).toMatch(/already exists/)
})

it('says there is no tileset when no sheet is 8x8', () => {
  const { $, button } = setup({ sheets: [sheet('badge', 16)] })
  act(() => button('New map').click())
  expect($('[data-no-tilesets]')).not.toBeNull()
  expect($<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true)
})

it('names the file a new map will write, and makes it', async () => {
  const { root, calls, $, button } = setup()
  act(() => button('New map').click())
  await type($('input[name="name"]'), 'cave')
  expect($('[data-preview]').textContent).toBe(
    'Writes maps/cave.json, 16×16 cells.',
  )
  await type($('input[name="columns"]'), '20')
  await type($('input[name="rows"]'), '5')
  expect($('[data-preview]').textContent).toBe(
    'Writes maps/cave.json, 20×5 cells.',
  )
  await submit($('form'))
  expect(calls).toEqual([
    [
      'newMap',
      { name: 'cave', tiles: 'tiles', columns: 20, rows: 5, layer: 'ground' },
    ],
  ])
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})

it('shows a refused map and stays open', async () => {
  const { root, $, button } = setup({}, 'no such tileset')
  act(() => button('New map').click())
  await type($('input[name="name"]'), 'cave')
  await submit($('form'))
  expect($('.t8e-error').textContent).toBe('no such tileset')
  expect(root.querySelector('.t8e-dialog')).not.toBeNull()
})

it('resizes the open map, warning of tiles it cuts', async () => {
  const { root, calls, $, button } = setup()
  act(() => button('Resize room1').click())
  expect($('.t8e-dialog h2').textContent).toBe('Resize room1')
  expect($<HTMLInputElement>('input[name="columns"]').value).toBe('3')
  expect(root.querySelector('[data-cut]')).toBeNull()
  await type($('input[name="columns"]'), '2')
  expect($('[data-cut]').textContent).toBe('Cuts 2 cells with a tile.')
  await type($('input[name="rows"]'), '1')
  expect($('[data-cut]').textContent).toBe('Cuts 3 cells with a tile.')
  await submit($('form'))
  expect(calls).toEqual([['resize', { columns: 2, rows: 1 }]])
  expect(root.querySelector('.t8e-dialog')).toBeNull()
})
