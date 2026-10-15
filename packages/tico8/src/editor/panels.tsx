// The panels around the canvas: the tool rail, the colours, the zoom, the
// status line and the shortcut sheet.
import { Fragment } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { Rgb } from '../palette.ts'
import { Icon, type IconName } from './icons.tsx'
import { keyLabel, titled, useStyle } from './theme.ts'
import {
  type ActionName,
  type EditorProps,
  SHORTCUTS,
  type ShortcutSheetProps,
  type StatusProps,
  type ToolName,
  type Zoom,
} from './types.ts'

const CSS = `
.t8p-rail { width: 52px; height: 100%; box-sizing: border-box; background: var(--k0);
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; }
.t8p-rail .t8p-gap { height: 8px; flex: none; }
.t8p-rail button { width: 32px; height: 28px; flex: none; display: grid;
  place-items: center; color: var(--k13); }
.t8p-rail button:hover:not(:disabled) { color: var(--k7); }
.t8p-rail button[aria-pressed="true"] { background: var(--k10); color: var(--k0); }

.t8p-colors { display: flex; flex-direction: column; gap: 10px; }
.t8p-cur { display: flex; align-items: center; gap: 10px; color: var(--k7);
  font: 18px/1 var(--pixel); }
.t8p-cur i { width: 36px; height: 36px; flex: none; box-shadow: 0 0 0 2px var(--k7); }
.t8p-colors h5 { margin: 4px 0 0; font: 12px/1 var(--pixel); color: var(--k13);
  font-weight: 400; }
.t8p-pal { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  box-shadow: 0 0 0 2px var(--k5); }
.t8p-pal button { height: 36px; position: relative; }
.t8p-pal button span { position: absolute; left: 6px; top: 6px; font-size: 12px;
  color: var(--k0); opacity: 0; }
.t8p-pal button.dark span { color: var(--k7); }
.t8p-pal button:hover span, .t8p-pal button[aria-pressed="true"] span { opacity: 1; }
.t8p-pal button[aria-pressed="true"] { z-index: 1;
  box-shadow: inset 0 0 0 2px var(--k7), inset 0 0 0 4px var(--k0); }

.t8p-zoom { display: flex; gap: 2px; margin-top: 8px; }
.t8p-zoom button { flex: 1; padding: 5px 4px; white-space: nowrap; background: var(--k1); color: var(--k13); }
.t8p-zoom button[aria-pressed="true"] { background: var(--k13); color: var(--k7); }

.t8p-status { height: 28px; box-sizing: border-box; display: flex; gap: 20px;
  align-items: center; padding: 0 12px; background: var(--k0); color: var(--k13);
  border-top: 2px solid var(--k1); white-space: nowrap; overflow: hidden; }
.t8p-status b { color: var(--k7); font-weight: 400; }
.t8p-status .t8p-end { margin-left: auto; overflow: hidden; text-overflow: ellipsis; }
.t8p-status .t8p-error { color: var(--k8); }
.t8p-status .t8p-help { width: 20px; height: 20px; flex: none; color: var(--k7);
  background: var(--k1); }
.t8p-status .t8p-help:hover { background: var(--k13); }

.t8e-dialog > .t8p-keys { width: min(440px, calc(100vw - 32px));
  max-height: calc(100vh - 64px); overflow: auto; }
.t8p-keys h3 { margin: 4px 0 0; font: 12px/1 var(--pixel); color: var(--k13);
  font-weight: 400; }
.t8p-keys dl { margin: 0; display: grid; grid-template-columns: 11em 1fr;
  gap: 4px 16px; align-items: baseline; }
.t8p-keys dt { color: var(--k7); } .t8p-keys kbd { font: 600 13px var(--sans); }
.t8p-keys dd { margin: 0; }
.t8p-keys dt kbd + kbd::before { content: ' / '; color: var(--k13); }
`

const useCss = () => useStyle('tico8-editor-panels', CSS)

/** A button on the rail: a tool, one of the rectangles, or an action. */
interface RailButton {
  label: string
  icon: IconName
  /** What the title names the key of. */
  what: ToolName | ActionName
  tool?: ToolName
  /** For the rectangles: which of the pair this is. */
  filled?: boolean
  action?: ActionName
}

const RAIL: readonly (readonly RailButton[])[] = [
  [
    { label: 'Pencil', icon: 'pencil', what: 'pencil', tool: 'pencil' },
    { label: 'Eraser', icon: 'eraser', what: 'eraser', tool: 'eraser' },
    { label: 'Fill', icon: 'fill', what: 'fill', tool: 'fill' },
    { label: 'Pick', icon: 'pick', what: 'pick', tool: 'pick' },
  ],
  [
    { label: 'Line', icon: 'line', what: 'line', tool: 'line' },
    {
      label: 'Rectangle',
      icon: 'rect',
      what: 'rect',
      tool: 'rect',
      filled: false,
    },
    {
      label: 'Filled rectangle',
      icon: 'rectFilled',
      what: 'rect',
      tool: 'rect',
      filled: true,
    },
  ],
  [{ label: 'Select', icon: 'select', what: 'select', tool: 'select' }],
  [
    { label: 'Undo', icon: 'undo', what: 'undo', action: 'undo' },
    { label: 'Redo', icon: 'redo', what: 'redo', action: 'redo' },
  ],
]

/** A rail button's title: the filled rectangle is R pressed again. */
function railTitle({ label, what, filled }: RailButton): string {
  if (!filled) return titled(label, what)
  const key = Object.keys(SHORTCUTS).find((k) => SHORTCUTS[k] === what)
  return key ? `${label} (${keyLabel(key)} again)` : label
}

/** The tools in groups, then undo and redo, as a column of icons. */
export function ToolRail({ editor, state }: EditorProps) {
  useCss()
  const press = (button: RailButton) => {
    if (button.action) return editor.act(button.action)
    if (button.tool) editor.setTool(button.tool)
    if (button.filled !== undefined) editor.setFilled(button.filled)
  }
  const pressed = ({ tool, filled }: RailButton) =>
    tool === undefined
      ? undefined
      : state.tool === tool && (filled === undefined || filled === state.filled)
  const disabled = ({ action }: RailButton) =>
    (action === 'undo' && !state.canUndo) ||
    (action === 'redo' && !state.canRedo)

  return (
    <div
      class="t8p-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Tools"
    >
      {RAIL.map((group, g) => (
        <Fragment key={group[0]?.label}>
          {g > 0 && <span class="t8p-gap" aria-hidden="true" />}
          {group.map((button) => (
            <button
              key={button.label}
              type="button"
              data-tool={button.tool}
              data-filled={button.filled}
              data-action={button.action}
              aria-label={button.label}
              aria-pressed={pressed(button)}
              disabled={disabled(button)}
              title={railTitle(button)}
              onClick={() => press(button)}
            >
              <Icon name={button.icon} />
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

const css = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`
const hex = (color: Rgb) =>
  `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`

/** A colour's relative luminance, as WCAG reckons it. */
function luminance(color: Rgb): number {
  const [r, g, b] = color.map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Whether light text reads better than black on `color`: where black's
 * contrast, (L + 0.05) / 0.05, falls below near-white's.
 */
const dark = (color: Rgb) => luminance(color) < 0.17

/** The colours to paint with: the current one, the palette, the sheet's own. */
export function PalettePanel({ editor, state }: EditorProps) {
  useCss()
  const { doc } = state
  if (!doc) return null
  const current = doc.colors[state.color]

  const swatch = (color: Rgb, index: number) => (
    <button
      key={index}
      type="button"
      class={dark(color) ? 'dark' : undefined}
      data-color={index}
      aria-label={`colour ${index}`}
      aria-pressed={state.color === index}
      title={`colour ${index}: ${hex(color)}`}
      style={{ background: css(color) }}
      onClick={() => editor.setColor(index)}
    >
      <span aria-hidden="true">{index}</span>
    </button>
  )
  const extra = doc.colors.slice(doc.paletteSize)

  return (
    <div class="t8p-colors">
      <div class="t8p-cur">
        <i style={{ background: current ? css(current) : 'none' }} />
        <span>colour {state.color}</span>
      </div>
      <div class="t8p-pal">
        {doc.colors.slice(0, doc.paletteSize).map(swatch)}
      </div>
      {extra.length > 0 && (
        <>
          <h5>from this sheet</h5>
          <div class="t8p-pal t8p-extra">
            {extra.map((color, i) => swatch(color, doc.paletteSize + i))}
          </div>
        </>
      )}
    </div>
  )
}

const ZOOMS: readonly { zoom: Zoom; label: string; name: string }[] = [
  { zoom: 1, label: '1 cell', name: 'Show 1 cell' },
  { zoom: 2, label: '2x2', name: 'Show 2x2 cells' },
  { zoom: 4, label: '4x4', name: 'Show 4x4 cells' },
]

/** How many cells the painting area shows: 1, 2x2 or 4x4. */
export function ZoomPicker({ editor, state }: EditorProps) {
  useCss()
  return (
    <div class="t8p-zoom">
      {ZOOMS.map(({ zoom, label, name }) => (
        <button
          key={zoom}
          type="button"
          data-zoom={zoom}
          aria-pressed={state.zoom === zoom}
          title={titled(name, `zoom${zoom}`)}
          onClick={() => editor.setZoom(zoom)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** x, y and frame under the pointer, or the last error; ? for the keys. */
export function StatusLine({ state, hover, onHelp }: StatusProps) {
  useCss()
  const show = (n: number | undefined) => (n === undefined ? '-' : n)
  return (
    <div class="t8p-status">
      <span>
        x <b data-out="x">{show(hover?.at.x)}</b> y{' '}
        <b data-out="y">{show(hover?.at.y)}</b>
      </span>
      <span>
        frame <b data-out="frame">{show(hover?.frame)}</b>
      </span>
      {state.error ? (
        <span class="t8p-end t8p-error" role="alert">
          {state.error}
        </span>
      ) : (
        <span class="t8p-end">right-click picks a colour</span>
      )}
      <button
        type="button"
        class="t8p-help"
        aria-label="Shortcuts"
        title="Shortcuts (?)"
        onClick={onHelp}
      >
        ?
      </button>
    </div>
  )
}

type Group = 'Tools' | 'Editing' | 'Selection' | 'View'

/** Each tool and action, its group on the sheet and what it does. */
const DESCRIBE: Readonly<Record<ToolName | ActionName, [Group, string]>> = {
  pencil: ['Tools', 'Pencil'],
  eraser: ['Tools', 'Eraser'],
  fill: ['Tools', 'Fill an area'],
  pick: ['Tools', 'Pick a colour'],
  line: ['Tools', 'Line'],
  rect: ['Tools', 'Rectangle; again for filled or outline'],
  select: ['Tools', 'Select'],
  undo: ['Editing', 'Undo'],
  redo: ['Editing', 'Redo'],
  copy: ['Editing', 'Copy'],
  cut: ['Editing', 'Cut'],
  paste: ['Editing', 'Paste'],
  flipX: ['Selection', 'Flip left to right'],
  flipY: ['Selection', 'Flip top to bottom'],
  rotate: ['Selection', 'Rotate a quarter turn'],
  clear: ['Selection', 'Clear the selection'],
  deselect: ['Selection', 'Drop the selection'],
  cellLeft: ['View', 'Move the cells shown left'],
  cellRight: ['View', 'Move the cells shown right'],
  cellUp: ['View', 'Move the cells shown up'],
  cellDown: ['View', 'Move the cells shown down'],
  zoom1: ['View', 'Show 1 cell'],
  zoom2: ['View', 'Show 2x2 cells'],
  zoom4: ['View', 'Show 4x4 cells'],
}

const GROUPS: readonly Group[] = ['Tools', 'Editing', 'Selection', 'View']

/** Lines the keyboard map doesn't hold, by group. */
const EXTRA: Readonly<Partial<Record<Group, [string[], string][]>>> = {
  Tools: [[['Right-click', 'Alt-click'], 'Pick a colour']],
  View: [[['?'], 'This list']],
}

/** A group's lines: the keys of each tool or action, and what it does. */
function lines(group: Group): [string[], string][] {
  const found: [string[], string][] = []
  for (const [what, [g, text]] of Object.entries(DESCRIBE)) {
    if (g !== group) continue
    const keys = Object.keys(SHORTCUTS)
      .filter((key) => SHORTCUTS[key] === what)
      .map((key) => keyLabel(key))
    if (keys.length > 0) found.push([keys, text])
  }
  return [...found, ...(EXTRA[group] ?? [])]
}

/** Every shortcut with its key. */
export function ShortcutSheet({ onClose }: ShortcutSheetProps) {
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
        class="t8p-keys"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t8p-keys-title"
      >
        <h2 id="t8p-keys-title">Shortcuts</h2>
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
