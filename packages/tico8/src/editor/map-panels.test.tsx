// @vitest-environment happy-dom
import { type ComponentChildren, render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, expect, it } from 'vitest'
import {
  LayerList,
  MapShortcutSheet,
  MapStatusLine,
  MapToolRail,
} from './map-panels.tsx'
import {
  MAP_SHORTCUTS,
  type MapEditor,
  type MapEditorProps,
  type MapEditorState,
  type MapHover,
} from './map-types.ts'
import { keyLabel } from './theme.ts'

type Call = [name: string, ...args: unknown[]]

function fakeEditor(refuse?: string) {
  const calls: Call[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
    }
  const reason =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
      return refuse
    }
  const editor = {
    setTool: record('setTool'),
    setLayer: record('setLayer'),
    toggleLayer: record('toggleLayer'),
    addLayer: reason('addLayer'),
    renameLayer: reason('renameLayer'),
    removeLayer: record('removeLayer'),
    moveLayer: record('moveLayer'),
    act: record('act'),
  } as unknown as MapEditor
  return { editor, calls }
}

function makeState(over: Partial<MapEditorState> = {}): MapEditorState {
  return {
    maps: [],
    sheets: [],
    doc: {
      info: { file: 'room.json', name: 'room', tiles: 'tiles' },
      data: {
        tiles: 'tiles',
        columns: 16,
        rows: 12,
        layers: {
          back: new Int16Array(192),
          front: new Int16Array(192),
        },
      },
    },
    tileset: undefined,
    layer: 'back',
    hidden: [],
    tool: 'brush',
    brush: { columns: 1, rows: 1, cells: new Int16Array(1) },
    chosen: { x: 0, y: 0, width: 1, height: 1 },
    arrange: false,
    shownFlag: undefined,
    selection: undefined,
    drag: undefined,
    zoom: undefined,
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
  Panel: (props: MapEditorProps) => ComponentChildren,
  over: Partial<MapEditorState> = {},
  refuse?: string,
) {
  const { editor, calls } = fakeEditor(refuse)
  const root = mount(<Panel editor={editor} state={makeState(over)} />)
  const $ = (selector: string) => root.querySelector(selector) as HTMLElement
  const click = (selector: string) => act(() => $(selector).click())
  return { root, calls, $, click }
}

it('chooses a tool and marks the current one', () => {
  const { root, calls, click, $ } = setup(MapToolRail, { tool: 'fill' })
  const pressed = [...root.querySelectorAll('[aria-pressed="true"]')]
  expect(pressed.map((b) => b.getAttribute('data-tool'))).toEqual(['fill'])
  click('[data-tool="eraser"]')
  expect(calls).toEqual([['setTool', 'eraser']])
  expect($('[data-tool="brush"]').title).toBe('Brush (B)')
  expect($('[data-tool="rect"]').title).toBe('Rectangle (R)')
})

it('disables undo and redo when there is nothing to do', () => {
  const { $, calls, click } = setup(MapToolRail, {
    canUndo: true,
    canRedo: false,
  })
  expect(($('[data-action="undo"]') as HTMLButtonElement).disabled).toBe(false)
  expect(($('[data-action="redo"]') as HTMLButtonElement).disabled).toBe(true)
  click('[data-action="undo"]')
  expect(calls).toEqual([['act', 'undo']])
})

const layer = (name: string) => `[data-layer="${name}"]`

it('lists the layers, marks the current one and chooses on click', () => {
  const { root, calls, click, $ } = setup(LayerList)
  expect(
    [...root.querySelectorAll('li')].map((li) => li.getAttribute('data-layer')),
  ).toEqual(['back', 'front'])
  expect($(layer('back')).getAttribute('aria-current')).toBe('true')
  expect($(layer('front')).getAttribute('aria-current')).toBeNull()
  click(`${layer('front')} [data-act="name"]`)
  expect(calls).toEqual([['setLayer', 'front']])
})

it('shows nothing without a map', () => {
  expect(setup(LayerList, { doc: undefined }).root.innerHTML).toBe('')
})

it('toggles a layer’s eye', () => {
  const { calls, click, $ } = setup(LayerList, { hidden: ['front'] })
  expect(
    $(`${layer('back')} [data-act="eye"]`).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(
    $(`${layer('front')} [data-act="eye"]`).getAttribute('aria-pressed'),
  ).toBe('false')
  click(`${layer('front')} [data-act="eye"]`)
  expect(calls).toEqual([['toggleLayer', 'front']])
})

it('moves layers, but not past the ends', () => {
  const { calls, click, $ } = setup(LayerList)
  const disabled = (s: string) => ($(s) as HTMLButtonElement).disabled
  expect(disabled(`${layer('back')} [data-act="up"]`)).toBe(true)
  expect(disabled(`${layer('front')} [data-act="down"]`)).toBe(true)
  click(`${layer('back')} [data-act="down"]`)
  click(`${layer('front')} [data-act="up"]`)
  expect(calls).toEqual([
    ['moveLayer', 'back', 1],
    ['moveLayer', 'front', -1],
  ])
})

it('removes a layer unless it is the only one', () => {
  const { calls, click } = setup(LayerList)
  click(`${layer('front')} [data-act="remove"]`)
  expect(calls).toEqual([['removeLayer', 'front']])
  const one = setup(LayerList, {
    doc: {
      info: { file: 'a.json', name: 'a', tiles: 'tiles' },
      data: {
        tiles: 'tiles',
        columns: 1,
        rows: 1,
        layers: { only: new Int16Array(1) },
      },
    },
  })
  expect((one.$('[data-act="remove"]') as HTMLButtonElement).disabled).toBe(
    true,
  )
})

function fire(el: HTMLElement, event: Event) {
  act(() => {
    el.dispatchEvent(event)
  })
}

function type(input: HTMLInputElement, value: string) {
  act(() => {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('adds a layer, and shows the reason when refused', () => {
  const ok = setup(LayerList)
  type(ok.$('.t8m-layer-add input') as HTMLInputElement, 'sky')
  fire(ok.$('.t8m-layer-add'), new Event('submit', { cancelable: true }))
  expect(ok.calls).toEqual([['addLayer', 'sky']])
  expect(ok.root.querySelector('.t8m-error')).toBeNull()

  const no = setup(LayerList, {}, 'a layer needs a name')
  type(no.$('.t8m-layer-add input') as HTMLInputElement, '1')
  fire(no.$('.t8m-layer-add'), new Event('submit', { cancelable: true }))
  expect(no.$('.t8m-error').textContent).toBe('a layer needs a name')
})

function key(el: HTMLElement, name: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

it('renames on double-click and Enter, and shows the reason when refused', () => {
  const ok = setup(LayerList)
  fire(
    ok.$(`${layer('front')} [data-act="name"]`),
    new MouseEvent('dblclick', { bubbles: true }),
  )
  const input = ok.$(`${layer('front')} input`) as HTMLInputElement
  type(input, 'top')
  key(input, 'Enter')
  expect(ok.calls).toEqual([['renameLayer', 'front', 'top']])
  expect(ok.root.querySelector(`${layer('front')} input`)).toBeNull()

  const no = setup(LayerList, {}, 'taken')
  fire(
    no.$(`${layer('front')} [data-act="name"]`),
    new MouseEvent('dblclick', { bubbles: true }),
  )
  const again = no.$(`${layer('front')} input`) as HTMLInputElement
  type(again, 'back')
  key(again, 'Enter')
  expect(no.$('.t8m-error').textContent).toBe('taken')
  key(no.$(`${layer('front')} input`), 'Escape')
  expect(no.root.querySelector(`${layer('front')} input`)).toBeNull()
})

function status(
  hover: MapHover | undefined,
  over: Partial<MapEditorState> = {},
) {
  let helped = 0
  const { editor } = fakeEditor()
  const root = mount(
    <MapStatusLine
      editor={editor}
      state={makeState(over)}
      hover={hover}
      onHelp={() => helped++}
    />,
  )
  const text = (out: string) =>
    root.querySelector(`[data-out="${out}"]`)?.textContent
  return { root, text, helped: () => helped }
}

it('shows the cell and tile under the pointer, the size and the layer', () => {
  const { text } = status({ at: { x: 5, y: 12 }, frame: 3 })
  expect([text('at'), text('frame'), text('size'), text('layer')]).toEqual([
    '5, 12',
    'tile 3',
    '16×12',
    'back',
  ])
  expect(status({ at: { x: 0, y: 0 }, frame: undefined }).text('frame')).toBe(
    'empty',
  )
  expect(status(undefined).text('at')).toBe('-')
})

it('shows the error, and opens the shortcuts from ?', () => {
  const { root, helped } = status(undefined, { error: 'could not write' })
  expect(root.querySelector('.t8m-error')?.textContent).toBe('could not write')
  act(() => (root.querySelector('.t8m-help') as HTMLElement).click())
  expect(helped()).toBe(1)
})

function sheet() {
  let closed = 0
  const root = mount(<MapShortcutSheet onClose={() => closed++} />)
  return { root, closed: () => closed }
}

it('lists every shortcut with its key label', () => {
  const { root } = sheet()
  const keys = [...root.querySelectorAll('kbd')].map((k) => k.textContent)
  for (const k of Object.keys(MAP_SHORTCUTS))
    expect(keys).toContain(keyLabel(k))
  for (const extra of [
    'Right-click',
    'Alt-click',
    'Space-drag',
    'Two-finger drag',
    'Pinch',
    '?',
  ])
    expect(keys).toContain(extra)
  expect([...root.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
    'Tools',
    'Editing',
    'Layers',
    'View',
  ])
})

it('focuses Close, and closes on Escape and Close', () => {
  const { root, closed } = sheet()
  const close = [...root.querySelectorAll('button')].find(
    (b) => b.textContent === 'Close',
  ) as HTMLButtonElement
  expect(document.activeElement).toBe(close)
  key(close, 'Escape')
  expect(closed()).toBe(1)
  act(() => close.click())
  expect(closed()).toBe(2)
})
