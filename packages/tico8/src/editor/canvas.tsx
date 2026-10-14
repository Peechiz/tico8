import { useEffect, useRef, useState } from 'preact/hooks'
import { TRANSPARENT } from '../sprites.ts'
import type {
  Drag,
  EditorProps,
  IndexedImage,
  Rect,
  Rgb,
  SheetDoc,
  Vec,
} from './types.ts'

/** How big, in screen pixels, the painting area aims to be. */
const CANVAS_TARGET = 512

const CHECK_LIGHT = '#3a3a44'
const CHECK_DARK = '#2a2a32'
const GRID = 'rgba(255, 255, 255, 0.08)'
const CELL_LINE = 'rgba(255, 255, 255, 0.3)'

/** Screen pixels per sheet pixel in the painting area. */
export function canvasScale(
  doc: SheetDoc,
  zoom: number,
  room = CANVAS_TARGET,
): number {
  const side = zoom * Math.max(doc.info.cellWidth, doc.info.cellHeight)
  return Math.max(2, Math.floor(room / side))
}

/** The part of the sheet the painting area shows, in sheet pixels. */
export function canvasArea(doc: SheetDoc, cell: Vec, zoom: number): Rect {
  const { cellWidth, cellHeight } = doc.info
  const x = cell.x * cellWidth
  const y = cell.y * cellHeight
  return {
    x,
    y,
    width: Math.max(0, Math.min(zoom * cellWidth, doc.image.width - x)),
    height: Math.max(0, Math.min(zoom * cellHeight, doc.image.height - y)),
  }
}

function css(color: Rgb | undefined): string {
  return color ? `rgb(${color[0]}, ${color[1]}, ${color[2]})` : '#f0f'
}

/** One sheet pixel at screen square (sx, sy): its colour or a checker. */
function paintPixel(
  ctx: CanvasRenderingContext2D,
  colors: readonly Rgb[],
  value: number,
  sx: number,
  sy: number,
  scale: number,
) {
  if (value !== TRANSPARENT) {
    ctx.fillStyle = css(colors[value])
    ctx.fillRect(sx, sy, scale, scale)
    return
  }
  const half = scale / 2
  ctx.fillStyle = CHECK_LIGHT
  ctx.fillRect(sx, sy, scale, scale)
  if (scale < 2) return
  ctx.fillStyle = CHECK_DARK
  ctx.fillRect(sx + half, sy, half, half)
  ctx.fillRect(sx, sy + half, half, half)
}

/**
 * Paint `area` of `image` at `scale`, top left at the canvas origin.
 * Transparent pixels show as a checkerboard.
 */
export function paintImage(
  ctx: CanvasRenderingContext2D,
  image: IndexedImage,
  colors: readonly Rgb[],
  area: Rect,
  scale: number,
) {
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const value = image.pixels[(area.y + y) * image.width + area.x + x]
      paintPixel(ctx, colors, value ?? TRANSPARENT, x * scale, y * scale, scale)
    }
  }
}

/** Lines every `step` sheet pixels across `area`, `offset` pixels in. */
export function paintGrid(
  ctx: CanvasRenderingContext2D,
  area: { width: number; height: number },
  scale: number,
  step: { x: number; y: number },
  offset: Vec,
  color: string,
) {
  ctx.fillStyle = color
  const w = area.width * scale
  const h = area.height * scale
  for (let x = offset.x; x <= area.width; x += step.x)
    ctx.fillRect(Math.min(x * scale, w - 1), 0, 1, h)
  for (let y = offset.y; y <= area.height; y += step.y)
    ctx.fillRect(0, Math.min(y * scale, h - 1), w, 1)
}

/** The pixels of a line from `a` to `b`, ends included. */
function linePoints(a: Vec, b: Vec): Vec[] {
  const points: Vec[] = []
  const dx = Math.abs(b.x - a.x)
  const dy = -Math.abs(b.y - a.y)
  const sx = a.x < b.x ? 1 : -1
  const sy = a.y < b.y ? 1 : -1
  let { x, y } = a
  let err = dx + dy
  for (;;) {
    points.push({ x, y })
    if (x === b.x && y === b.y) return points
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** The pixels a line or rectangle drag would paint. */
function dragPoints(drag: Drag, tool: string, filled: boolean): Vec[] {
  if (tool === 'line') return linePoints(drag.from, drag.to)
  if (tool !== 'rect') return []
  const x0 = Math.min(drag.from.x, drag.to.x)
  const x1 = Math.max(drag.from.x, drag.to.x)
  const y0 = Math.min(drag.from.y, drag.to.y)
  const y1 = Math.max(drag.from.y, drag.to.y)
  const points: Vec[] = []
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (filled || x === x0 || x === x1 || y === y0 || y === y1)
        points.push({ x, y })
  return points
}

/** The painting area: the zoomed cells, big, taking the pointer. */
export function Canvas({ editor, state }: EditorProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [march, setMarch] = useState(0)
  // The space the painting area has, so it fits beside the game when split.
  const [room, setRoom] = useState(CANVAS_TARGET)
  const { doc, selection } = state

  useEffect(() => {
    const element = box.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const side = Math.min(element.clientWidth, element.clientHeight)
      if (side > 0) setRoom(side)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [doc !== undefined])

  // March the selection's outline while there is one.
  useEffect(() => {
    if (!selection) return
    const id = setInterval(() => setMarch((m) => (m + 1) % 8), 120)
    return () => clearInterval(id)
  }, [selection !== undefined])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !doc) return
    const scale = canvasScale(doc, state.zoom, room)
    const area = canvasArea(doc, state.cell, state.zoom)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintImage(ctx, doc.image, doc.colors, area, scale)

    const plot = (p: Vec, value: number) => {
      const x = p.x - area.x
      const y = p.y - area.y
      if (x < 0 || y < 0 || x >= area.width || y >= area.height) return
      if (value === TRANSPARENT) return
      paintPixel(ctx, doc.colors, value, x * scale, y * scale, scale)
    }

    const lifted = selection?.lifted
    if (selection && lifted)
      for (let y = 0; y < lifted.height; y++)
        for (let x = 0; x < lifted.width; x++)
          plot(
            { x: selection.rect.x + x, y: selection.rect.y + y },
            lifted.pixels[y * lifted.width + x] ?? TRANSPARENT,
          )

    if (state.drag)
      for (const p of dragPoints(state.drag, state.tool, state.filled))
        plot(p, state.color)

    if (scale >= 6)
      paintGrid(ctx, area, scale, { x: 1, y: 1 }, { x: 0, y: 0 }, GRID)
    const { cellWidth, cellHeight } = doc.info
    paintGrid(
      ctx,
      area,
      scale,
      { x: cellWidth, y: cellHeight },
      { x: 0, y: 0 },
      CELL_LINE,
    )

    if (selection) {
      const { rect } = selection
      const x = (rect.x - area.x) * scale + 0.5
      const y = (rect.y - area.y) * scale + 0.5
      const w = rect.width * scale - 1
      const h = rect.height * scale - 1
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#000'
      ctx.lineDashOffset = -march
      ctx.strokeRect(x, y, w, h)
      ctx.strokeStyle = '#fff'
      ctx.lineDashOffset = -march + 4
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
  })

  if (!doc)
    return (
      <div style={{ padding: '24px', color: '#889', font: '14px sans-serif' }}>
        Pick or make a sheet
      </div>
    )

  const scale = canvasScale(doc, state.zoom, room)
  const area = canvasArea(doc, state.cell, state.zoom)

  const at = (e: PointerEvent): Vec => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: area.x + Math.floor((e.clientX - box.left) / scale),
      y: area.y + Math.floor((e.clientY - box.top) / scale),
    }
  }

  return (
    <div ref={box} style={{ flex: '1', minWidth: 0, minHeight: 0 }}>
      <canvas
        ref={ref}
        width={area.width * scale}
        height={area.height * scale}
        style={{
          display: 'block',
          width: `${area.width * scale}px`,
          height: `${area.height * scale}px`,
          background: '#111',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
          editor.pointerDown(at(e))
        }}
        onPointerMove={(e) => editor.pointerMove(at(e))}
        onPointerUp={(e) => {
          if (e.button !== 0) return
          ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
          editor.pointerUp(at(e))
        }}
      />
    </div>
  )
}
