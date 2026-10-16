// The maps: a tab for each, New and Resize, and whether the last change is
// saved.
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from './icons.tsx'
import { mapFile, tilesCut } from './map-doc.ts'
import type {
  MapDialogProps,
  MapInfo,
  MapTabsProps,
  NewMapDialogProps,
} from './map-types.ts'
import { Backdrop, isSheetName } from './sheets.tsx'
import { useStyle } from './theme.ts'

const CSS = `
.t8e .t8m-bar { box-sizing: border-box; height: 36px; display: flex;
  align-items: stretch; gap: 2px; padding: 6px 8px 0; background: var(--k1);
  border-bottom: 2px solid var(--k0); min-width: 0; }
.t8e .t8m-tabs { display: flex; align-items: stretch; gap: 2px; min-width: 0;
  overflow-x: auto; scrollbar-width: none; }
.t8e .t8m-tab { display: flex; align-items: stretch; flex: none;
  background: var(--k0); color: var(--k13); }
.t8e .t8m-tab[aria-current="true"] { background: var(--k13); color: var(--k7); }
.t8e .t8m-open { display: flex; align-items: center; gap: 6px; padding: 0 10px;
  white-space: nowrap; }
.t8e .t8m-open small { font-size: 12px; opacity: 0.7; }
.t8e .t8m-resize { display: flex; align-items: center; padding: 0 8px 0 0; }
.t8e .t8m-add { flex: none; color: var(--k13); padding: 0 10px; font-size: 18px; }
.t8e .t8m-add:hover, .t8e .t8m-resize:hover { color: var(--k7); }
.t8e .t8m-save { flex: none; margin-left: auto; padding-left: 12px;
  align-self: center; color: var(--k13); white-space: nowrap; }
.t8e-dialog .t8m-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t8e-dialog .t8m-pair input { width: 100%; box-sizing: border-box; }
`

const useMapsStyle = () => useStyle('tico8-editor-maps', CSS)

const NAME_RULE =
  'A name starts with a letter and uses letters, digits and dashes.'
const LAYER_RULE =
  'A layer name starts with a letter and uses letters and digits.'
const CELLS_RULE = 'Columns and rows are whole numbers from 1.'

/** A whole number of cells from a field, or 0 when it is not one. */
const cells = (value: string) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

const sizeLabel = (columns: number, rows: number) => `${columns}×${rows}`

/** One map's tab: its name, tileset and, when open, size in cells. */
function Tab({
  map,
  props,
  onResize,
}: {
  map: MapInfo
  props: MapTabsProps
  onResize: () => void
}) {
  const { editor, state } = props
  const doc = state.doc?.info.file === map.file ? state.doc : undefined
  return (
    <div class="t8m-tab" data-file={map.file} aria-current={Boolean(doc)}>
      <button
        type="button"
        class="t8m-open"
        title={map.file}
        onClick={() => void editor.open(map.file)}
      >
        <span>{map.name}</span>
        <small>{map.tiles}</small>
        {doc && <small>{sizeLabel(doc.data.columns, doc.data.rows)}</small>}
      </button>
      {doc && (
        <button
          type="button"
          class="t8m-resize"
          title={`Resize ${map.name}`}
          aria-label={`Resize ${map.name}`}
          onClick={onResize}
        >
          <Icon name="resize" size={14} />
        </button>
      )}
    </div>
  )
}

/** A tab per map, Resize on the open one, New, and the save state. */
export function MapTabs(props: MapTabsProps) {
  useMapsStyle()
  const { state, start } = props
  const [dialog, setDialog] = useState<'new' | 'resize' | undefined>()
  const close = () => setDialog(undefined)
  const saved = state.saving ? 'saving' : state.doc ? 'saved' : ''

  return (
    <div class="t8m-bar">
      <div class="t8m-tabs">
        {state.maps.map((map) => (
          <Tab
            key={map.file}
            map={map}
            props={props}
            onResize={() => setDialog('resize')}
          />
        ))}
      </div>
      <button
        type="button"
        class="t8m-add"
        title="New map"
        aria-label="New map"
        onClick={() => setDialog('new')}
      >
        +
      </button>
      <span class="t8m-save" aria-live="polite">
        {saved}
      </span>
      {dialog === 'new' && (
        <NewMapDialog
          editor={props.editor}
          state={state}
          start={start}
          onClose={close}
        />
      )}
      {dialog === 'resize' && (
        <ResizeMapDialog editor={props.editor} state={state} onClose={close} />
      )}
    </div>
  )
}

/** Name, tileset, size and first layer of a new map. */
export function NewMapDialog({
  editor,
  state,
  start,
  onClose,
}: NewMapDialogProps) {
  useMapsStyle()
  const tilesets = state.sheets.filter(
    (s) => s.cellWidth === 8 && s.cellHeight === 8,
  )
  const [name, setName] = useState('')
  const [tiles, setTiles] = useState(tilesets[0]?.name ?? '')
  const [columns, setColumns] = useState(String(start.columns))
  const [rows, setRows] = useState(String(start.rows))
  const [layer, setLayer] = useState('ground')
  const [refused, setRefused] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => nameRef.current?.focus(), [])

  const trimmed = name.trim()
  const trimmedLayer = layer.trim()
  const across = cells(columns)
  const down = cells(rows)
  const problem = !isSheetName(trimmed)
    ? NAME_RULE
    : state.maps.some((m) => m.name === trimmed)
      ? `A map named ${trimmed} already exists.`
      : !tilesets.some((s) => s.name === tiles)
        ? 'There is no 8×8 sheet to use as a tileset.'
        : !across || !down
          ? CELLS_RULE
          : !/^[a-z][a-z0-9]*$/i.test(trimmedLayer)
            ? LAYER_RULE
            : undefined
  const preview =
    problem ??
    `Writes maps/${mapFile(trimmed)}, ${sizeLabel(across, down)} cells.`

  const onSubmit = async (event: Event) => {
    event.preventDefault()
    if (problem || busy) return
    setBusy(true)
    const reason = await editor.newMap({
      name: trimmed,
      tiles,
      columns: across,
      rows: down,
      layer: trimmedLayer,
    })
    setBusy(false)
    if (reason) setRefused(reason)
    else onClose()
  }

  return (
    <Backdrop onClose={onClose}>
      <form class="t8m-new" onSubmit={onSubmit}>
        <h2>New map</h2>
        <label>
          Name
          <input
            ref={nameRef}
            name="name"
            autocomplete="off"
            spellcheck={false}
            value={name}
            onInput={(e) => {
              setName(e.currentTarget.value)
              setRefused(undefined)
            }}
          />
        </label>
        <label>
          Tileset
          <select
            name="tiles"
            value={tiles}
            disabled={tilesets.length === 0}
            onChange={(e) => setTiles(e.currentTarget.value)}
          >
            {tilesets.map((s) => (
              <option key={s.file} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {tilesets.length === 0 && (
          <p class="t8e-note" data-no-tilesets>
            A tileset is a sheet of 8×8 cells. Make one in the sprite editor
            first.
          </p>
        )}
        <div class="t8m-pair">
          <label>
            Columns
            <input
              name="columns"
              type="number"
              min={1}
              value={columns}
              onInput={(e) => setColumns(e.currentTarget.value)}
            />
          </label>
          <label>
            Rows
            <input
              name="rows"
              type="number"
              min={1}
              value={rows}
              onInput={(e) => setRows(e.currentTarget.value)}
            />
          </label>
        </div>
        <label>
          First layer
          <input
            name="layer"
            autocomplete="off"
            spellcheck={false}
            value={layer}
            onInput={(e) => setLayer(e.currentTarget.value)}
          />
        </label>
        <p class="t8e-note" data-preview>
          {preview}
        </p>
        {refused && <p class="t8e-error">{refused}</p>}
        <div class="t8e-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={Boolean(problem) || busy}>
            Make map
          </button>
        </div>
      </form>
    </Backdrop>
  )
}

/** The open map's new size, and how many tiles a shrink cuts. */
export function ResizeMapDialog({ editor, state, onClose }: MapDialogProps) {
  useMapsStyle()
  const { doc } = state
  const [columns, setColumns] = useState(String(doc?.data.columns ?? 1))
  const [rows, setRows] = useState(String(doc?.data.rows ?? 1))
  const acrossRef = useRef<HTMLInputElement>(null)
  useEffect(() => acrossRef.current?.focus(), [])
  if (!doc) return null

  const size = { columns: cells(columns), rows: cells(rows) }
  const valid = size.columns > 0 && size.rows > 0
  const cut = valid ? tilesCut(doc.data, size) : 0
  const preview = valid
    ? `${sizeLabel(size.columns, size.rows)} cells.`
    : CELLS_RULE

  const onSubmit = (event: Event) => {
    event.preventDefault()
    if (!valid) return
    void editor.resize(size)
    onClose()
  }

  return (
    <Backdrop onClose={onClose}>
      <form class="t8m-resize-form" onSubmit={onSubmit}>
        <h2>Resize {doc.info.name}</h2>
        <div class="t8m-pair">
          <label>
            Columns
            <input
              ref={acrossRef}
              name="columns"
              type="number"
              min={1}
              value={columns}
              onInput={(e) => setColumns(e.currentTarget.value)}
            />
          </label>
          <label>
            Rows
            <input
              name="rows"
              type="number"
              min={1}
              value={rows}
              onInput={(e) => setRows(e.currentTarget.value)}
            />
          </label>
        </div>
        <p class="t8e-note" data-preview>
          {preview}
        </p>
        {cut > 0 && (
          <p class="t8e-error" data-cut>
            Cuts {cut} {cut === 1 ? 'cell' : 'cells'} with a tile.
          </p>
        )}
        <div class="t8e-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!valid}>
            Resize
          </button>
        </div>
      </form>
    </Backdrop>
  )
}
