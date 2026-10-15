import { useEffect, useRef } from 'preact/hooks'
import { TRANSPARENT } from '../sprites.ts'
import { paintGrid } from './canvas.tsx'
import { frameAt } from './image.ts'
import { CHECKER, GRID, INK, useStyle } from './theme.ts'
import type { EditorProps, Rect, SheetDoc, Vec, Zoom } from './types.ts'

/** How wide, in screen pixels, the sheet view is at most. */
const SHEET_TARGET = 208
/** How big, in screen pixels, a picture in the frame strip aims to be. */
const THUMB_TARGET = 32

const CSS = `
.t8e .t8e-sheet { display: grid; gap: 8px; justify-items: start; }
.t8e .t8e-sheet-label { color: var(--k13); }
.t8e .t8e-sheet canvas { display: block; cursor: pointer; margin: 2px;
  box-shadow: 0 0 0 2px var(--k5); }
.t8e .t8e-strip { display: flex; gap: 8px; align-items: flex-start;
  padding: 8px 12px; overflow-x: auto; background: var(--k0);
  border-top: 2px solid var(--k1); }
.t8e .t8e-strip button { flex: none; display: grid; gap: 4px;
  justify-items: center; color: var(--k13); padding: 2px; }
.t8e .t8e-strip button[aria-current="true"] { color: var(--k7); }
.t8e .t8e-strip canvas { display: block; background: var(--k0);
  box-shadow: 0 0 0 1px var(--k1); }
.t8e .t8e-strip button[aria-current="true"] canvas { box-shadow: 0 0 0 2px var(--k10); }
`

/** Screen pixels per sheet pixel in the sheet view: 1 to 8. */
export function sheetScale(doc: SheetDoc): number {
  const side = Math.max(doc.image.width, doc.image.height)
  return Math.max(1, Math.min(8, Math.floor(SHEET_TARGET / side)))
}

/** Screen pixels per sheet pixel for one cell in the frame strip. */
function thumbScale(doc: SheetDoc): number {
  const side = Math.max(doc.info.cellWidth, doc.info.cellHeight)
  return Math.max(1, Math.floor(THUMB_TARGET / side))
}

/**
 * Paint `area` of the sheet at `scale`: a faint checker with `square`
 * screen pixels to a square, then the solid pixels over it.
 */
function paintArea(
  ctx: CanvasRenderingContext2D,
  doc: SheetDoc,
  area: Rect,
  scale: number,
  square: number,
) {
  const w = area.width * scale
  const h = area.height * scale
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = CHECKER.dark
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = CHECKER.light
  for (let y = 0; y * square < h; y++)
    for (let x = (y + 1) % 2; x * square < w; x += 2)
      ctx.fillRect(
        x * square,
        y * square,
        Math.min(square, w - x * square),
        Math.min(square, h - y * square),
      )
  const { image, colors } = doc
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const value = image.pixels[(area.y + y) * image.width + area.x + x]
      const color = value === undefined ? undefined : colors[value]
      if (value === TRANSPARENT || !color) continue
      ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
}

/**
 * The cell to show from when `pixel` of the sheet is clicked: the cell
 * under it, moved back so the zoomed cells stay inside the sheet.
 */
export function cellAt(doc: SheetDoc, pixel: Vec, zoom: Zoom): Vec {
  const { cellWidth, cellHeight } = doc.info
  const columns = Math.floor(doc.image.width / cellWidth)
  const rows = Math.floor(doc.image.height / cellHeight)
  const clamp = (v: number, count: number) =>
    Math.max(0, Math.min(v, count - zoom))
  return {
    x: clamp(Math.floor(pixel.x / cellWidth), columns),
    y: clamp(Math.floor(pixel.y / cellHeight), rows),
  }
}

/** The whole sheet, small; a click picks the cell to paint. */
export function SheetView({ editor, state }: EditorProps) {
  useStyle('tico8-editor-sheet-view', CSS)
  const ref = useRef<HTMLCanvasElement>(null)
  const { doc } = state

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !doc) return
    const scale = sheetScale(doc)
    const { width, height } = doc.image
    const { cellWidth, cellHeight } = doc.info
    paintArea(ctx, doc, { x: 0, y: 0, width, height }, scale, 4)
    paintGrid(
      ctx,
      { width, height },
      scale,
      { x: cellWidth, y: cellHeight },
      { x: 0, y: 0 },
      GRID.cell,
    )
    const w = Math.min(state.zoom * cellWidth, width - state.cell.x * cellWidth)
    const h = Math.min(
      state.zoom * cellHeight,
      height - state.cell.y * cellHeight,
    )
    ctx.lineWidth = 2
    ctx.strokeStyle = INK.active
    ctx.strokeRect(
      state.cell.x * cellWidth * scale + 1,
      state.cell.y * cellHeight * scale + 1,
      w * scale - 2,
      h * scale - 2,
    )
  })

  if (!doc) return null

  const scale = sheetScale(doc)
  const { width, height } = doc.image
  const pixelAt = (e: PointerEvent): Vec => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: Math.floor((e.clientX - box.left) / scale),
      y: Math.floor((e.clientY - box.top) / scale),
    }
  }

  return (
    <div class="t8e-sheet">
      <span class="t8e-sheet-label">sheet</span>
      <canvas
        ref={ref}
        width={width * scale}
        height={height * scale}
        style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
        onPointerMove={(e) => {
          const at = pixelAt(e)
          const canvas = e.currentTarget as HTMLCanvasElement
          canvas.title =
            at.x >= 0 && at.y >= 0 && at.x < width && at.y < height
              ? `frame ${frameAt(doc, at)}`
              : ''
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          editor.pickCell(cellAt(doc, pixelAt(e), state.zoom))
        }}
      />
    </div>
  )
}

/** One cell's picture; redrawn when the pixels change. */
function Thumb({
  doc,
  cell,
  version,
}: {
  doc: SheetDoc
  cell: Vec
  version: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scale = thumbScale(doc)
  const { cellWidth, cellHeight } = doc.info

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    paintArea(
      ctx,
      doc,
      {
        x: cell.x * cellWidth,
        y: cell.y * cellHeight,
        width: cellWidth,
        height: cellHeight,
      },
      scale,
      4,
    )
  }, [doc, cell.x, cell.y, cellWidth, cellHeight, scale, version])

  return (
    <canvas
      ref={ref}
      width={cellWidth * scale}
      height={cellHeight * scale}
      style={{
        width: `${cellWidth * scale}px`,
        height: `${cellHeight * scale}px`,
      }}
    />
  )
}

/** Every cell of the sheet as a small picture with its frame number. */
export function FrameStrip({ editor, state }: EditorProps) {
  useStyle('tico8-editor-sheet-view', CSS)
  const { doc } = state
  if (!doc) return null

  const { cellWidth, cellHeight } = doc.info
  const columns = Math.floor(doc.image.width / cellWidth)
  const rows = Math.floor(doc.image.height / cellHeight)
  const shown = (x: number, y: number) =>
    x >= state.cell.x &&
    x < state.cell.x + state.zoom &&
    y >= state.cell.y &&
    y < state.cell.y + state.zoom

  const buttons = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const frame = y * columns + x
      buttons.push(
        <button
          key={frame}
          type="button"
          title={`frame ${frame}`}
          aria-current={shown(x, y) ? 'true' : undefined}
          onClick={() => editor.pickCell({ x, y })}
        >
          <Thumb doc={doc} cell={{ x, y }} version={state.version} />
          <span>{frame}</span>
        </button>,
      )
    }
  }
  return <div class="t8e-strip">{buttons}</div>
}
