import { useLayoutEffect, useState } from 'preact/hooks'
import type { Rgb } from '../palette.ts'
import {
  type ActionName,
  type EditorProps,
  SHORTCUTS,
  TOOLS,
  type ToolName,
  type Zoom,
} from './types.ts'

const STYLE_ID = 'tico8-editor-panels'

const CSS = `
.t8p { display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
  font: 12px/1.2 system-ui, sans-serif; color: #ddd; }
.t8p button { font: inherit; color: inherit; background: #2a2a2e;
  border: 1px solid #444; border-radius: 3px; padding: 2px 6px; cursor: pointer; }
.t8p button:hover:not(:disabled) { background: #3a3a40; }
.t8p button:disabled { opacity: 0.4; cursor: default; }
.t8p button[aria-pressed="true"], .t8p button[aria-current="true"] {
  background: #4a5a8a; border-color: #8aa0e0; }
.t8p .t8p-sep { width: 1px; align-self: stretch; background: #444; margin: 0 2px; }
.t8p input { font: inherit; color: inherit; background: #1c1c1f;
  border: 1px solid #444; border-radius: 3px; padding: 2px 4px; width: 4em; }
.t8p input[name="name"] { width: 8em; }
.t8p-palette { gap: 2px; }
.t8p-palette .t8p-sep { background: none; width: 8px; }
.t8p-palette button.t8p-swatch { width: 18px; height: 18px; padding: 0;
  border: 2px solid #1c1c1f; border-radius: 2px; }
.t8p-palette button.t8p-swatch[aria-pressed="true"] { border-color: #fff;
  outline: 1px solid #000; }
.t8p-sheets { flex-direction: column; align-items: stretch; }
.t8p-sheets ul { list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 2px; }
.t8p-sheets ul button { width: 100%; text-align: left; }
.t8p-sheets form { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.t8p-sheets fieldset { border: 1px solid #333; border-radius: 3px;
  padding: 4px; margin: 0; }
.t8p-sheets legend { color: #999; padding: 0 2px; }
.t8p-error { color: #ff7a7a; }
`

/** Put the panels' CSS in the page once. */
function useStyle() {
  useLayoutEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    document.head.append(style)
  }, [])
}

/** The key that does `what`, as a label: `mod+z` reads `Ctrl+Z`. */
function shortcut(what: ToolName | ActionName): string | undefined {
  const key = Object.keys(SHORTCUTS).find((k) => SHORTCUTS[k] === what)
  if (!key) return undefined
  return key
    .split('+')
    .map((part) =>
      part === 'mod' ? 'Ctrl' : part[0]?.toUpperCase() + part.slice(1),
    )
    .join('+')
}

const label = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).replace(/([XY])$/, ' $1')

const titled = (name: string, what: ToolName | ActionName) => {
  const key = shortcut(what)
  return key ? `${name} (${key})` : name
}

const ACTIONS: readonly ActionName[] = [
  'flipX',
  'flipY',
  'rotate',
  'copy',
  'cut',
  'paste',
]

const ZOOMS: readonly Zoom[] = [1, 2, 4]

/** A button per tool and action. */
export function Toolbar({ editor, state }: EditorProps) {
  useStyle()
  return (
    <div class="t8p t8p-toolbar" role="toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool}
          type="button"
          data-tool={tool}
          aria-pressed={state.tool === tool}
          title={titled(label(tool), tool)}
          onClick={() => editor.setTool(tool)}
        >
          {label(tool)} <kbd>{shortcut(tool)}</kbd>
        </button>
      ))}
      <button
        type="button"
        data-filled
        aria-pressed={state.filled}
        title="Fill rectangles"
        onClick={() => editor.setFilled(!state.filled)}
      >
        Filled
      </button>
      <span class="t8p-sep" />
      <button
        type="button"
        data-action="undo"
        disabled={!state.canUndo}
        title={titled('Undo', 'undo')}
        onClick={() => editor.act('undo')}
      >
        Undo
      </button>
      <button
        type="button"
        data-action="redo"
        disabled={!state.canRedo}
        title={titled('Redo', 'redo')}
        onClick={() => editor.act('redo')}
      >
        Redo
      </button>
      <span class="t8p-sep" />
      {ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          data-action={action}
          title={titled(label(action), action)}
          onClick={() => editor.act(action)}
        >
          {label(action)}
        </button>
      ))}
      <span class="t8p-sep" />
      {ZOOMS.map((zoom) => (
        <button
          key={zoom}
          type="button"
          data-zoom={zoom}
          aria-pressed={state.zoom === zoom}
          title={`Show ${zoom}x${zoom} cells`}
          onClick={() => editor.setZoom(zoom)}
        >
          {zoom}x{zoom}
        </button>
      ))}
    </div>
  )
}

const css = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`

/** The colours to paint with: the palette, then the sheet's own. */
export function PalettePanel({ editor, state }: EditorProps) {
  useStyle()
  const { doc } = state
  if (!doc) return null
  const swatch = (color: Rgb, index: number) => (
    <button
      key={index}
      type="button"
      class="t8p-swatch"
      data-color={index}
      aria-pressed={state.color === index}
      title={`${index}: ${css(color)}`}
      style={{ background: css(color) }}
      onClick={() => editor.setColor(index)}
    />
  )
  const palette = doc.colors.slice(0, doc.paletteSize)
  const extra = doc.colors.slice(doc.paletteSize)
  return (
    <div class="t8p t8p-palette">
      {palette.map((color, i) => swatch(color, i))}
      {extra.length > 0 && <span class="t8p-sep" />}
      {extra.map((color, i) => swatch(color, doc.paletteSize + i))}
    </div>
  )
}

/** A whole number from a form field, or the fallback. */
const whole = (form: FormData, name: string, fallback: number) => {
  const n = Number(form.get(name))
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** The sheets to open, and New and Resize. */
export function SheetPicker({ editor, state }: EditorProps) {
  useStyle()
  const [refused, setRefused] = useState<string | undefined>()
  const open = state.doc?.info.file
  const size = state.doc && {
    columns: state.doc.image.width / state.doc.info.cellWidth,
    rows: state.doc.image.height / state.doc.info.cellHeight,
  }

  const onNew = async (event: Event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget as HTMLFormElement)
    const reason = await editor.newSheet({
      name: String(form.get('name') ?? '').trim(),
      cellWidth: whole(form, 'cellWidth', 8),
      cellHeight: whole(form, 'cellHeight', 8),
      columns: whole(form, 'columns', 16),
      rows: whole(form, 'rows', 16),
    })
    setRefused(reason)
  }

  const onResize = (event: Event) => {
    event.preventDefault()
    if (!size) return
    const form = new FormData(event.currentTarget as HTMLFormElement)
    void editor.resize({
      columns: whole(form, 'columns', size.columns),
      rows: whole(form, 'rows', size.rows),
    })
  }

  return (
    <div class="t8p t8p-sheets">
      <ul>
        {state.sheets.map((sheet) => (
          <li key={sheet.file}>
            <button
              type="button"
              data-file={sheet.file}
              aria-current={sheet.file === open}
              title={sheet.file}
              onClick={() => void editor.open(sheet.file)}
            >
              {sheet.name} {sheet.cellWidth}x{sheet.cellHeight}
            </button>
          </li>
        ))}
      </ul>
      <fieldset>
        <legend>New</legend>
        <form class="t8p-new" onSubmit={onNew}>
          <input name="name" placeholder="name" aria-label="Name" required />
          <input
            name="cellWidth"
            type="number"
            min={8}
            step={8}
            defaultValue={8}
            aria-label="Cell width"
            title="Cell width"
          />
          x
          <input
            name="cellHeight"
            type="number"
            min={8}
            step={8}
            defaultValue={8}
            aria-label="Cell height"
            title="Cell height"
          />
          <input
            name="columns"
            type="number"
            min={1}
            defaultValue={16}
            aria-label="Columns"
            title="Columns"
          />
          x
          <input
            name="rows"
            type="number"
            min={1}
            defaultValue={16}
            aria-label="Rows"
            title="Rows"
          />
          cells
          <button type="submit">New</button>
        </form>
        {refused && <p class="t8p-error">{refused}</p>}
      </fieldset>
      {size && (
        <fieldset>
          <legend>Resize</legend>
          <form
            class="t8p-resize"
            key={`${open}:${size.columns}x${size.rows}`}
            onSubmit={onResize}
          >
            <input
              name="columns"
              type="number"
              min={1}
              defaultValue={size.columns}
              aria-label="Columns"
              title="Columns"
            />
            x
            <input
              name="rows"
              type="number"
              min={1}
              defaultValue={size.rows}
              aria-label="Rows"
              title="Rows"
            />
            cells
            <button type="submit">Resize</button>
          </form>
        </fieldset>
      )}
      {state.error && <p class="t8p-error">{state.error}</p>}
    </div>
  )
}
