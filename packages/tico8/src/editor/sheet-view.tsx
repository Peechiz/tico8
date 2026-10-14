import { useEffect, useRef } from 'preact/hooks'
import { paintGrid, paintImage } from './canvas.tsx'
import type { EditorProps, SheetDoc, Vec, Zoom } from './types.ts'

/** How big, in screen pixels, the sheet view aims to be at most. */
const SHEET_TARGET = 256

const CELL_LINE = 'rgba(255, 255, 255, 0.15)'
const ZOOMED = '#ffd34d'

/** Screen pixels per sheet pixel in the sheet view: 1 to 4. */
export function sheetScale(doc: SheetDoc): number {
  const side = Math.max(doc.image.width, doc.image.height)
  return Math.max(1, Math.min(4, Math.floor(SHEET_TARGET / side)))
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
  const ref = useRef<HTMLCanvasElement>(null)
  const { doc } = state

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !doc) return
    const scale = sheetScale(doc)
    const { width, height } = doc.image
    const { cellWidth, cellHeight } = doc.info
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintImage(ctx, doc.image, doc.colors, { x: 0, y: 0, width, height }, scale)
    paintGrid(
      ctx,
      { width, height },
      scale,
      { x: cellWidth, y: cellHeight },
      { x: 0, y: 0 },
      CELL_LINE,
    )
    ctx.lineWidth = 1
    ctx.strokeStyle = ZOOMED
    const w = Math.min(state.zoom * cellWidth, width - state.cell.x * cellWidth)
    const h = Math.min(
      state.zoom * cellHeight,
      height - state.cell.y * cellHeight,
    )
    ctx.strokeRect(
      state.cell.x * cellWidth * scale + 0.5,
      state.cell.y * cellHeight * scale + 0.5,
      w * scale - 1,
      h * scale - 1,
    )
  })

  if (!doc) return null

  const scale = sheetScale(doc)
  const { width, height } = doc.image

  return (
    <canvas
      ref={ref}
      width={width * scale}
      height={height * scale}
      style={{
        display: 'block',
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        background: '#111',
        cursor: 'pointer',
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const pixel = {
          x: Math.floor((e.clientX - box.left) / scale),
          y: Math.floor((e.clientY - box.top) / scale),
        }
        editor.pickCell(cellAt(doc, pixel, state.zoom))
      }}
    />
  )
}
