// The panels around the map canvas: the tool rail, the layer list, the
// status line and the shortcut sheet.
import { Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon, type IconName } from './icons.tsx'
import {
  MAP_SHORTCUTS,
  MAP_TOOLS,
  type MapActionName,
  type MapEditorProps,
  type MapStatusProps,
  type MapToolName,
} from './map-types.ts'
import { keyLabel, useStyle } from './theme.ts'
import type { ShortcutSheetProps } from './types.ts'

const CSS = `
.t8m-rail { width: 52px; height: 100%; box-sizing: border-box; background: var(--k0);
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; }
.t8m-rail .t8m-gap { height: 8px; flex: none; }
.t8m-rail button { width: 32px; height: 28px; flex: none; display: grid;
  place-items: center; color: var(--k13); }
.t8m-rail button:hover:not(:disabled) { color: var(--k7); }
.t8m-rail button[aria-pressed="true"] { background: var(--k10); color: var(--k0); }

.t8m-layers { display: flex; flex-direction: column; gap: 4px; color: var(--k13); }
.t8m-layers h5 { margin: 0; font: 12px/1 var(--pixel); font-weight: 400; }
.t8m-layers ul { list-style: none; margin: 0; padding: 0; display: flex;
  flex-direction: column; gap: 2px; }
.t8m-layers li { display: flex; align-items: center; gap: 2px; background: var(--k1); }
.t8m-layers li[aria-current="true"] { box-shadow: inset 2px 0 0 var(--k10); }
.t8m-layers li button { width: 24px; height: 24px; flex: none; display: grid;
  place-items: center; color: var(--k13); }
.t8m-layers li button:hover:not(:disabled) { color: var(--k7); }
.t8m-layers li button[aria-pressed="false"] { color: var(--k5); }
.t8m-layers li button:disabled { opacity: 0.3; }
.t8m-layers li button.t8m-name { flex: 1; width: auto; min-width: 0; padding: 0 6px;
  display: block; text-align: left; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--k6); }
.t8m-layers li[aria-current="true"] .t8m-name { color: var(--k7); }
.t8m-layers input { flex: 1; min-width: 0; box-sizing: border-box; font: 14px var(--sans);
  color: var(--k7); background: var(--k0); border: 2px solid var(--k5); padding: 2px 4px; }
.t8m-layers .t8m-layer-add { display: flex; gap: 2px; }
.t8m-layers .t8m-layer-add button { width: 28px; flex: none; display: grid; place-items: center;
  background: var(--k1); color: var(--k7); }
.t8m-layers .t8m-error { color: var(--k8); font: 13px var(--sans); }

.t8m-status { height: 28px; box-sizing: border-box; display: flex; gap: 20px;
  align-items: center; padding: 0 12px; background: var(--k0); color: var(--k13);
  border-top: 2px solid var(--k1); white-space: nowrap; overflow: hidden; }
.t8m-status b { color: var(--k7); font-weight: 400; }
.t8m-status .t8m-end { margin-left: auto; overflow: hidden; text-overflow: ellipsis; }
.t8m-status .t8m-error { color: var(--k8); font-family: var(--sans); }
.t8m-status .t8m-help { width: 20px; height: 20px; flex: none; color: var(--k7);
  background: var(--k1); }
.t8m-status .t8m-help:hover { background: var(--k13); }

.t8e-dialog > .t8m-keys { width: min(440px, calc(100vw - 32px));
  max-height: calc(100vh - 64px); overflow: auto; }
.t8m-keys h3 { margin: 4px 0 0; font: 12px/1 var(--pixel); color: var(--k13);
  font-weight: 400; }
.t8m-keys dl { margin: 0; display: grid; grid-template-columns: 11em 1fr;
  gap: 4px 16px; align-items: baseline; }
.t8m-keys dt { color: var(--k7); } .t8m-keys kbd { font: 600 13px var(--sans); }
.t8m-keys dd { margin: 0; }
.t8m-keys dt kbd + kbd::before { content: ' / '; color: var(--k13); }
`

const useCss = () => useStyle('tico8-map-panels', CSS)

/** The first key that does `what`, as a label. */
function shortcutFor(what: MapToolName | MapActionName): string | undefined {
  const key = Object.keys(MAP_SHORTCUTS).find((k) => MAP_SHORTCUTS[k] === what)
  return key === undefined ? undefined : keyLabel(key)
}

/** `name (key)`, for a button's title. */
function titled(name: string, what: MapToolName | MapActionName): string {
  const key = shortcutFor(what)
  return key ? `${name} (${key})` : name
}

const TOOL_LOOK: Readonly<Record<MapToolName, [string, IconName]>> = {
  brush: ['Brush', 'stamp'],
  eraser: ['Eraser', 'eraser'],
  fill: ['Fill', 'fill'],
  rect: ['Rectangle', 'rectFilled'],
  pick: ['Pick', 'pick'],
  select: ['Select', 'select'],
}

const ACTIONS: readonly {
  action: 'undo' | 'redo'
  label: string
  icon: IconName
}[] = [
  { action: 'undo', label: 'Undo', icon: 'undo' },
  { action: 'redo', label: 'Redo', icon: 'redo' },
]

/** The map tools, then undo and redo, as a column of icons. */
export function MapToolRail({ editor, state }: MapEditorProps) {
  useCss()
  const off = { undo: !state.canUndo, redo: !state.canRedo }
  return (
    <div
      class="t8m-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Tools"
    >
      {MAP_TOOLS.map((tool) => {
        const [label, icon] = TOOL_LOOK[tool]
        return (
          <button
            key={tool}
            type="button"
            data-tool={tool}
            aria-label={label}
            aria-pressed={state.tool === tool}
            title={titled(label, tool)}
            onClick={() => editor.setTool(tool)}
          >
            <Icon name={icon} />
          </button>
        )
      })}
      <span class="t8m-gap" aria-hidden="true" />
      {ACTIONS.map(({ action, label, icon }) => (
        <button
          key={action}
          type="button"
          data-action={action}
          aria-label={label}
          disabled={off[action]}
          title={titled(label, action)}
          onClick={() => editor.act(action)}
        >
          <Icon name={icon} />
        </button>
      ))}
    </div>
  )
}

/** A layer's name as text, or, once renamed by double-click, an input. */
function RenameInput({
  from,
  editor,
  onDone,
}: {
  from: string
  editor: MapEditorProps['editor']
  onDone: () => void
}) {
  const [reason, setReason] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onDone()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const to = input.current?.value ?? from
      if (to === from) return onDone()
      const refused = editor.renameLayer(from, to)
      if (refused) setReason(refused)
      else onDone()
    }
  }
  return (
    <>
      <input
        ref={input}
        type="text"
        aria-label={`Rename ${from}`}
        defaultValue={from}
        onKeyDown={onKey}
        onBlur={onDone}
      />
      {reason && (
        <span class="t8m-error" role="alert">
          {reason}
        </span>
      )}
    </>
  )
}

/** The open map's layers: current, shown, add, rename, remove, reorder. */
export function LayerList({ editor, state }: MapEditorProps) {
  useCss()
  const [renaming, setRenaming] = useState<string>()
  const [adding, setAdding] = useState('')
  const [reason, setReason] = useState<string>()
  const { doc } = state
  if (!doc) return null
  const names = Object.keys(doc.data.layers)

  const add = () => {
    const refused = editor.addLayer(adding)
    setReason(refused)
    if (!refused) setAdding('')
  }

  return (
    <div class="t8m-layers">
      <h5>Layers, drawn in this order</h5>
      <ul>
        {names.map((name, i) => {
          const shown = !state.hidden.includes(name)
          return (
            <li
              key={name}
              data-layer={name}
              aria-current={state.layer === name ? 'true' : undefined}
            >
              <button
                type="button"
                data-act="eye"
                aria-label={`${shown ? 'Hide' : 'Show'} ${name}`}
                aria-pressed={shown}
                title={shown ? 'Hide' : 'Show'}
                onClick={() => editor.toggleLayer(name)}
              >
                <Icon name={shown ? 'eye' : 'hidden'} />
              </button>
              {renaming === name ? (
                <RenameInput
                  from={name}
                  editor={editor}
                  onDone={() => setRenaming(undefined)}
                />
              ) : (
                <button
                  type="button"
                  class="t8m-name"
                  data-act="name"
                  title="Double-click to rename"
                  onClick={() => editor.setLayer(name)}
                  onDblClick={() => setRenaming(name)}
                >
                  {name}
                </button>
              )}
              <button
                type="button"
                data-act="up"
                aria-label={`Move ${name} up`}
                disabled={i === 0}
                onClick={() => editor.moveLayer(name, -1)}
              >
                <Icon name="up" />
              </button>
              <button
                type="button"
                data-act="down"
                aria-label={`Move ${name} down`}
                disabled={i === names.length - 1}
                onClick={() => editor.moveLayer(name, 1)}
              >
                <Icon name="down" />
              </button>
              <button
                type="button"
                data-act="remove"
                aria-label={`Remove ${name}`}
                disabled={names.length <= 1}
                onClick={() => editor.removeLayer(name)}
              >
                <Icon name="close" />
              </button>
            </li>
          )
        })}
      </ul>
      <form
        class="t8m-layer-add"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <input
          type="text"
          aria-label="New layer name"
          placeholder="new layer"
          value={adding}
          onInput={(event) => setAdding(event.currentTarget.value)}
        />
        <button type="submit" aria-label="Add layer" title="Add layer">
          <Icon name="plus" />
        </button>
      </form>
      {reason && (
        <span class="t8m-error" role="alert">
          {reason}
        </span>
      )}
    </div>
  )
}

/** Column, row and frame under the pointer, the map's size, or the error. */
export function MapStatusLine({ state, hover, onHelp }: MapStatusProps) {
  useCss()
  const { doc } = state
  const frame =
    hover === undefined
      ? '-'
      : hover.frame === undefined
        ? 'empty'
        : `tile ${hover.frame}`
  return (
    <div class="t8m-status">
      <span>
        <b data-out="at">{hover ? `${hover.at.x}, ${hover.at.y}` : '-'}</b>
      </span>
      <span data-out="frame">{frame}</span>
      {doc && (
        <span>
          <b data-out="size">
            {doc.data.columns}×{doc.data.rows}
          </b>
        </span>
      )}
      {state.layer !== undefined && (
        <span>
          layer <b data-out="layer">{state.layer}</b>
        </span>
      )}
      {state.error && (
        <span class="t8m-end t8m-error" role="alert">
          {state.error}
        </span>
      )}
      <button
        type="button"
        class={`t8m-help${state.error ? '' : ' t8m-end'}`}
        aria-label="Shortcuts"
        title="Shortcuts (?)"
        onClick={onHelp}
      >
        ?
      </button>
    </div>
  )
}

type Group = 'Tools' | 'Editing' | 'Layers' | 'View'

/** Each tool and action, its group on the sheet and what it does. */
const DESCRIBE: Readonly<Record<MapToolName | MapActionName, [Group, string]>> =
  {
    brush: ['Tools', 'Brush'],
    eraser: ['Tools', 'Eraser'],
    fill: ['Tools', 'Fill an area'],
    rect: ['Tools', 'Rectangle'],
    pick: ['Tools', 'Pick a tile'],
    select: ['Tools', 'Select'],
    undo: ['Editing', 'Undo'],
    redo: ['Editing', 'Redo'],
    copy: ['Editing', 'Copy'],
    cut: ['Editing', 'Cut'],
    paste: ['Editing', 'Paste'],
    clear: ['Editing', 'Clear the selection'],
    deselect: ['Editing', 'Drop the selection'],
    prevLayer: ['Layers', 'Previous layer'],
    nextLayer: ['Layers', 'Next layer'],
    zoomIn: ['View', 'Zoom in'],
    zoomOut: ['View', 'Zoom out'],
    zoomFit: ['View', 'Fit the map to the space'],
  }

const GROUPS: readonly Group[] = ['Tools', 'Editing', 'Layers', 'View']

/** Lines the keyboard map doesn't hold, by group. */
const EXTRA: Readonly<Partial<Record<Group, [string[], string][]>>> = {
  Tools: [[['Right-click', 'Alt-click'], 'Pick a tile']],
  View: [
    [['Space-drag', 'Middle-drag'], 'Pan the map'],
    [['Scroll', 'Two-finger drag'], 'Pan the map'],
    [['Pinch', 'Ctrl-scroll'], 'Zoom'],
    [['?'], 'This list'],
  ],
}

/** A group's lines: the keys of each tool or action, and what it does. */
function lines(group: Group): [string[], string][] {
  const found: [string[], string][] = []
  for (const [what, [g, text]] of Object.entries(DESCRIBE)) {
    if (g !== group) continue
    const keys = Object.keys(MAP_SHORTCUTS)
      .filter((key) => MAP_SHORTCUTS[key] === what)
      .map((key) => keyLabel(key))
    if (keys.length > 0) found.push([keys, text])
  }
  return [...found, ...(EXTRA[group] ?? [])]
}

/** Every map editor key. */
export function MapShortcutSheet({ onClose }: ShortcutSheetProps) {
  useCss()
  const backdrop = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  // The latest onClose, so a new one each render doesn't move the focus.
  const closing = useRef(onClose)
  closing.current = onClose

  useEffect(() => {
    close.current?.focus()
    // Capture, so Escape closes the sheet without also dropping a selection.
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closing.current()
    }
    // A click on the backdrop itself, not the sheet on it.
    function onClick(event: MouseEvent) {
      if (event.target === event.currentTarget) closing.current()
    }
    const outside = backdrop.current
    window.addEventListener('keydown', onKey, true)
    outside?.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      outside?.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <div class="t8e-dialog" ref={backdrop}>
      <div
        class="t8m-keys"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t8m-keys-title"
      >
        <h2 id="t8m-keys-title">Shortcuts</h2>
        {GROUPS.map((group) => (
          <section key={group}>
            <h3>{group}</h3>
            <dl>
              {lines(group).map(([keys, text]) => (
                <Fragment key={text}>
                  <dt>
                    {keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{text}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
        <div class="t8e-actions">
          <button type="button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
