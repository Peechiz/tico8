// The sheets: a tab for each, New and Resize, and whether the last change
// is saved.
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { TRANSPARENT } from '../sprites.ts'
import { Icon } from './icons.tsx'
import { toRgba } from './image.ts'
import { sheetFile } from './state.ts'
import { useStyle } from './theme.ts'
import type {
  CellCount,
  DialogProps,
  EditorProps,
  IndexedImage,
  SheetDoc,
  SheetInfo,
} from './types.ts'

const CSS = `
.t8e .t8s-bar { box-sizing: border-box; height: 36px; display: flex;
  align-items: stretch; gap: 2px; padding: 6px 8px 0; background: var(--k1);
  border-bottom: 2px solid var(--k0); min-width: 0; }
.t8e .t8s-tabs { display: flex; align-items: stretch; gap: 2px; min-width: 0;
  overflow-x: auto; scrollbar-width: none; }
.t8e .t8s-tab { display: flex; align-items: stretch; flex: none;
  background: var(--k0); color: var(--k13); }
.t8e .t8s-tab[aria-current="true"] { background: var(--k13); color: var(--k7); }
.t8e .t8s-open { display: flex; align-items: center; gap: 6px; padding: 0 10px;
  white-space: nowrap; }
.t8e .t8s-thumb { display: block; width: 16px; height: 16px; flex: none;
  object-fit: contain; image-rendering: pixelated; }
.t8e .t8s-open small { font-size: 12px; opacity: 0.7; }
.t8e .t8s-resize { display: flex; align-items: center; padding: 0 8px 0 0; }
.t8e .t8s-add { flex: none; color: var(--k13); padding: 0 10px; font-size: 18px; }
.t8e .t8s-add:hover, .t8e .t8s-resize:hover { color: var(--k7); }
.t8e .t8s-save { flex: none; margin-left: auto; padding-left: 12px;
  align-self: center; color: var(--k13); white-space: nowrap; }
.t8e-dialog .t8s-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t8e-dialog .t8s-pair input { width: 100%; box-sizing: border-box; }
`

const useSheetsStyle = () => useStyle('tico8-editor-sheets', CSS)

/** What a sheet's name must be, as the preview says it. */
const NAME_RULE =
  'A name starts with a letter and uses letters, digits and dashes.'

/** Whether `name` can name a sheet. Reserved words are left to the host. */
export function isSheetName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/i.test(name)
}

/** The cell sizes New offers, 8×8 first. */
export const CELL_SIZES: readonly { width: number; height: number }[] = [
  { width: 8, height: 8 },
  { width: 16, height: 16 },
  { width: 32, height: 32 },
  { width: 24, height: 8 },
  { width: 8, height: 16 },
]

const sizeLabel = (width: number, height: number) => `${width}×${height}`

/**
 * How many cells holding art fall outside `size` when the sheet is cut to
 * it from its top left.
 */
export function cellsCut(
  image: IndexedImage,
  cell: { cellWidth: number; cellHeight: number },
  size: CellCount,
): number {
  const { cellWidth, cellHeight } = cell
  const columns = Math.floor(image.width / cellWidth)
  const rows = Math.floor(image.height / cellHeight)
  let cut = 0
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (column < size.columns && row < size.rows) continue
      if (hasArt(image, column * cellWidth, row * cellHeight, cell)) cut++
    }
  }
  return cut
}

function hasArt(
  image: IndexedImage,
  left: number,
  top: number,
  cell: { cellWidth: number; cellHeight: number },
): boolean {
  for (let y = top; y < top + cell.cellHeight; y++) {
    for (let x = left; x < left + cell.cellWidth; x++) {
      if (image.pixels[y * image.width + x] !== TRANSPARENT) return true
    }
  }
  return false
}

/** The open sheet's size in cells. */
const cellCount = (doc: SheetDoc): CellCount => ({
  columns: Math.floor(doc.image.width / doc.info.cellWidth),
  rows: Math.floor(doc.image.height / doc.info.cellHeight),
})

/** A whole number of cells from a field, or 0 when it is not one. */
const cells = (value: string) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** The open sheet as it is now, redrawn on every change to its pixels. */
function DocThumb({ doc, version }: { doc: SheetDoc; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Pixels change in place, so `version` says when to redraw.
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const { width, height, data } = toRgba(doc)
    const picture = ctx.createImageData(width, height)
    picture.data.set(data)
    ctx.putImageData(picture, 0, 0)
  }, [doc, version])
  return (
    <canvas
      ref={ref}
      class="t8s-thumb"
      width={doc.image.width}
      height={doc.image.height}
    />
  )
}

/** One sheet's tab: its picture, name and cell size. */
function Tab({
  sheet,
  props,
  onResize,
}: {
  sheet: SheetInfo
  props: EditorProps
  onResize: () => void
}) {
  const { editor, state } = props
  const doc = state.doc?.info.file === sheet.file ? state.doc : undefined
  return (
    <div class="t8s-tab" data-file={sheet.file} aria-current={Boolean(doc)}>
      <button
        type="button"
        class="t8s-open"
        title={sheet.file}
        onClick={() => void editor.open(sheet.file)}
      >
        {doc ? (
          <DocThumb doc={doc} version={state.version} />
        ) : (
          <img class="t8s-thumb" src={sheet.url} alt="" />
        )}
        <span>{sheet.name}</span>
        <small>{sizeLabel(sheet.cellWidth, sheet.cellHeight)}</small>
      </button>
      {doc && (
        <button
          type="button"
          class="t8s-resize"
          title={`Resize ${sheet.name}`}
          aria-label={`Resize ${sheet.name}`}
          onClick={onResize}
        >
          <Icon name="resize" size={14} />
        </button>
      )}
    </div>
  )
}

/** A tab per sheet with its picture and cell size, New, and save state. */
export function SheetTabs(props: EditorProps) {
  useSheetsStyle()
  const { state } = props
  const [dialog, setDialog] = useState<'new' | 'resize' | undefined>()
  const close = () => setDialog(undefined)
  const saved = state.saving ? 'saving' : state.doc ? 'saved' : ''

  return (
    <div class="t8s-bar">
      <div class="t8s-tabs">
        {state.sheets.map((sheet) => (
          <Tab
            key={sheet.file}
            sheet={sheet}
            props={props}
            onResize={() => setDialog('resize')}
          />
        ))}
      </div>
      <button
        type="button"
        class="t8s-add"
        title="New sheet"
        aria-label="New sheet"
        onClick={() => setDialog('new')}
      >
        +
      </button>
      <span class="t8s-save" aria-live="polite">
        {saved}
      </span>
      {dialog === 'new' && <NewSheetDialog {...props} onClose={close} />}
      {dialog === 'resize' && <ResizeDialog {...props} onClose={close} />}
    </div>
  )
}

/**
 * The dialog's backdrop: a click on it, or Escape anywhere in it, closes.
 * Keys stay in the dialog so the editor's shortcuts do not fire.
 */
export function Backdrop({
  onClose,
  children,
}: {
  onClose: () => void
  children: JSX.Element
}) {
  return (
    <div
      class="t8e-dialog"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {children}
    </div>
  )
}

/** Name, cell size and size in cells, with the file it will write. */
export function NewSheetDialog({ editor, onClose }: DialogProps) {
  useSheetsStyle()
  const [name, setName] = useState('')
  const [size, setSize] = useState(0)
  const [columns, setColumns] = useState('16')
  const [rows, setRows] = useState('16')
  const [refused, setRefused] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => nameRef.current?.focus(), [])

  const cell = CELL_SIZES[size] ?? CELL_SIZES[0]!
  const trimmed = name.trim()
  const across = cells(columns)
  const down = cells(rows)
  const problem = !isSheetName(trimmed)
    ? NAME_RULE
    : !across || !down
      ? 'Cells across and down are whole numbers from 1.'
      : undefined
  const file = sheetFile({
    name: trimmed,
    cellWidth: cell.width,
    cellHeight: cell.height,
  })
  const preview =
    problem ??
    `Writes sprites/${file}, ${sizeLabel(across * cell.width, down * cell.height)} pixels, ${across * down} frames.`

  const onSubmit = async (event: Event) => {
    event.preventDefault()
    if (problem || busy) return
    setBusy(true)
    const reason = await editor.newSheet({
      name: trimmed,
      cellWidth: cell.width,
      cellHeight: cell.height,
      columns: across,
      rows: down,
    })
    setBusy(false)
    if (reason) setRefused(reason)
    else onClose()
  }

  return (
    <Backdrop onClose={onClose}>
      <form class="t8s-new" onSubmit={onSubmit}>
        <h2>New sheet</h2>
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
          Cell size
          <select
            name="cellSize"
            value={String(size)}
            onChange={(e) => setSize(Number(e.currentTarget.value))}
          >
            {CELL_SIZES.map((c, i) => (
              <option key={sizeLabel(c.width, c.height)} value={String(i)}>
                {sizeLabel(c.width, c.height)}
              </option>
            ))}
          </select>
        </label>
        <div class="t8s-pair">
          <label>
            Cells across
            <input
              name="columns"
              type="number"
              min={1}
              value={columns}
              onInput={(e) => setColumns(e.currentTarget.value)}
            />
          </label>
          <label>
            Cells down
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
        {refused && <p class="t8e-error">{refused}</p>}
        <div class="t8e-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={Boolean(problem) || busy}>
            Make sheet
          </button>
        </div>
      </form>
    </Backdrop>
  )
}

/** The open sheet's size in cells, warning of art a shrink would cut. */
export function ResizeDialog({ editor, state, onClose }: DialogProps) {
  useSheetsStyle()
  const { doc } = state
  const start = doc ? cellCount(doc) : { columns: 1, rows: 1 }
  const [columns, setColumns] = useState(String(start.columns))
  const [rows, setRows] = useState(String(start.rows))
  const acrossRef = useRef<HTMLInputElement>(null)
  useEffect(() => acrossRef.current?.focus(), [])
  if (!doc) return null

  const size = { columns: cells(columns), rows: cells(rows) }
  const valid = size.columns > 0 && size.rows > 0
  const cut = valid ? cellsCut(doc.image, doc.info, size) : 0
  const preview = valid
    ? `${sizeLabel(size.columns * doc.info.cellWidth, size.rows * doc.info.cellHeight)} pixels.`
    : 'Cells across and down are whole numbers from 1.'

  const onSubmit = (event: Event) => {
    event.preventDefault()
    if (!valid) return
    void editor.resize(size)
    onClose()
  }

  return (
    <Backdrop onClose={onClose}>
      <form class="t8s-resize-form" onSubmit={onSubmit}>
        <h2>Resize {doc.info.name}</h2>
        <div class="t8s-pair">
          <label>
            Cells across
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
            Cells down
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
            Cuts {cut} {cut === 1 ? 'cell' : 'cells'} with art.
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
