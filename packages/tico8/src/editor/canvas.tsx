import { useEffect, useRef, useState } from 'preact/hooks'
import { TRANSPARENT } from '../sprites.ts'
import { Icon, type IconName } from './icons.tsx'
import { frameAt } from './image.ts'
import { CHECKER, GRID, INK, titled, useStyle } from './theme.ts'
import type {
  ActionName,
  CanvasProps,
  Drag,
  IndexedImage,
  Rect,
  Rgb,
  SheetDoc,
  Vec,
} from './types.ts'

/** How big, in screen pixels, the painting area aims to be. */
const CANVAS_TARGET = 512

/** The two rings around the canvas, in screen pixels on each side. */
const RING = 4

/** The space the selection bar needs above the selection to sit there. */
const BAR_ROOM = 36

/** Below this brightness a colour is lost on the dark checker and ground. */
const DIM = 60

const CSS = `
.t8e-canvas { flex: 1; min-width: 0; min-height: 0; display: grid;
  place-items: center; }
.t8e-canvas .frame { position: relative; }
.t8e-canvas canvas { display: block; cursor: crosshair; touch-action: none;
  box-shadow: 0 0 0 2px var(--k0), 0 0 0 4px var(--k13); }
.t8e-canvas .bar { position: absolute; z-index: 1; display: flex; gap: 2px;
  padding: 2px; background: var(--k0); color: var(--k7);
  box-shadow: 0 0 0 2px var(--k13); font: 12px/1 var(--pixel);
  white-space: nowrap; }
.t8e-canvas .bar button { display: flex; align-items: center; gap: 4px;
  padding: 4px 6px; color: var(--k7); }
.t8e-canvas .bar button:hover { background: var(--k1); }
`

/** Screen pixels per sheet pixel in the painting area. */
export function canvasScale(
  doc: SheetDoc,
  zoom: number,
  room = CANVAS_TARGET,
): number {
  // Fit what is shown: a sheet smaller than the zoom shows only itself.
  const width = Math.min(zoom * doc.info.cellWidth, doc.image.width)
  const height = Math.min(zoom * doc.info.cellHeight, doc.image.height)
  return Math.max(2, Math.floor(room / Math.max(width, height)))
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

/** Whether a colour would be lost against the canvas's dark ground. */
function isDim(color: Rgb | undefined): boolean {
  if (!color) return false
  const [r, g, b] = color
  return 0.299 * r + 0.587 * g + 0.114 * b < DIM
}

/**
 * One faint checker over `width` by `height` screen pixels, for see-through,
 * in squares of `size` screen pixels.
 */
export function paintChecker(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  size: number = CHECKER.size,
) {
  const { light, dark } = CHECKER
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = light
  for (let y = 0; y < height; y += size)
    for (let x = (y / size) % 2 === 0 ? 0 : size; x < width; x += 2 * size)
      ctx.fillRect(x, y, size, size)
}

/**
 * Paint `area` of `image` at `scale`, top left at the canvas origin.
 * Transparent pixels show the checker behind the whole area.
 */
export function paintImage(
  ctx: CanvasRenderingContext2D,
  image: IndexedImage,
  colors: readonly Rgb[],
  area: Rect,
  scale: number,
) {
  paintChecker(ctx, area.width * scale, area.height * scale)
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const value = image.pixels[(area.y + y) * image.width + area.x + x]
      if (value === undefined || value === TRANSPARENT) continue
      ctx.fillStyle = css(colors[value])
      ctx.fillRect(x * scale, y * scale, scale, scale)
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

/** What the selection bar offers. */
const BAR: readonly {
  action: ActionName
  icon?: IconName
  label: string
  title: string
}[] = [
  { action: 'flipX', icon: 'flipX', label: 'Flip H', title: 'Flip across' },
  { action: 'flipY', icon: 'flipY', label: 'Flip V', title: 'Flip down' },
  { action: 'rotate', icon: 'rotate', label: 'Rotate', title: 'Rotate' },
  { action: 'deselect', label: 'Done', title: 'Done' },
]

/** The painting area: the zoomed cells, big, taking the pointer. */
export function Canvas({ editor, state, onHover }: CanvasProps) {
  useStyle('tico8-editor-canvas', CSS)
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [march, setMarch] = useState(0)
  // The space the painting area has, so it fits beside the game when split.
  const [room, setRoom] = useState({
    width: CANVAS_TARGET + 2 * RING,
    height: CANVAS_TARGET + 2 * RING,
  })
  // The pixel under the pointer, for the brush outline.
  const [hover, setHover] = useState<Vec | undefined>()
  // Whether a press went to the editor, so its release does too.
  const [held, setHeld] = useState(false)
  const { doc, selection } = state

  useEffect(() => {
    const element = box.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (width > 0 && height > 0) setRoom({ width, height })
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

  const fit = Math.min(room.width, room.height) - 2 * RING
  const dragging = state.drag !== undefined || (held && state.tool === 'select')

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !doc) return
    const scale = canvasScale(doc, state.zoom, fit)
    const area = canvasArea(doc, state.cell, state.zoom)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintImage(ctx, doc.image, doc.colors, area, scale)

    const local = (p: Vec): Vec | undefined => {
      const x = p.x - area.x
      const y = p.y - area.y
      if (x < 0 || y < 0 || x >= area.width || y >= area.height) return
      return { x: x * scale, y: y * scale }
    }
    const plot = (p: Vec, value: number) => {
      const s = local(p)
      if (!s || value === TRANSPARENT) return
      ctx.fillStyle = css(doc.colors[value])
      ctx.fillRect(s.x, s.y, scale, scale)
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
      paintGrid(ctx, area, scale, { x: 1, y: 1 }, { x: 0, y: 0 }, GRID.pixel)
    const { cellWidth, cellHeight } = doc.info
    paintGrid(
      ctx,
      area,
      scale,
      { x: cellWidth, y: cellHeight },
      { x: 0, y: 0 },
      GRID.cell,
    )

    if (selection) {
      const { rect } = selection
      const x = (rect.x - area.x) * scale + 0.5
      const y = (rect.y - area.y) * scale + 0.5
      const w = rect.width * scale - 1
      const h = rect.height * scale - 1
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = INK.well
      ctx.lineDashOffset = -march
      ctx.strokeRect(x, y, w, h)
      ctx.strokeStyle = INK.bright
      ctx.lineDashOffset = -march + 4
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }

    // The brush outline over the pixel under the pointer, in the colour it would paint.
    const under = hover && !dragging ? local(hover) : undefined
    if (under) {
      const color = doc.colors[state.color]
      const tinted = ['pencil', 'fill', 'line', 'rect'].includes(state.tool)
      if (state.tool === 'pencil') {
        ctx.globalAlpha = 0.55
        ctx.fillStyle = css(color)
        ctx.fillRect(under.x, under.y, scale, scale)
        ctx.globalAlpha = 1
      }
      ctx.lineWidth = 2
      ctx.strokeStyle = tinted && !isDim(color) ? css(color) : INK.bright
      ctx.strokeRect(under.x + 1, under.y + 1, scale - 2, scale - 2)
    }
  })

  if (!doc) return null

  const scale = canvasScale(doc, state.zoom, fit)
  const area = canvasArea(doc, state.cell, state.zoom)
  const width = area.width * scale
  const height = area.height * scale

  const at = (e: PointerEvent): Vec => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: area.x + Math.floor((e.clientX - box.left) / scale),
      y: area.y + Math.floor((e.clientY - box.top) / scale),
    }
  }

  const hoverAt = (p: Vec | undefined) => {
    const inside =
      p &&
      p.x >= area.x &&
      p.y >= area.y &&
      p.x < area.x + area.width &&
      p.y < area.y + area.height
    setHover(inside ? p : undefined)
    onHover?.(inside ? { at: p, frame: frameAt(doc, p) } : undefined)
  }

  // The bar sits just above the selection, or below it when there is no room.
  let bar: { left: number; top: number; above: boolean } | undefined
  if (selection && !held) {
    const { rect } = selection
    const left = Math.max(0, (rect.x - area.x) * scale)
    const top = (rect.y - area.y) * scale
    const above = (room.height - height) / 2 + top >= BAR_ROOM
    bar = {
      left,
      top: above ? top - 6 : (rect.y + rect.height - area.y) * scale + 6,
      above,
    }
  }

  return (
    <div ref={box} class="t8e-canvas">
      <div class="frame">
        <canvas
          ref={ref}
          width={width}
          height={height}
          style={{ width: `${width}px`, height: `${height}px` }}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (e.button === 2 || (e.button === 0 && e.altKey)) {
              e.preventDefault()
              editor.pickAt(at(e))
              return
            }
            if (e.button !== 0) return
            e.preventDefault()
            ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
            setHeld(true)
            editor.pointerDown(at(e))
          }}
          onPointerMove={(e) => {
            const p = at(e)
            hoverAt(p)
            editor.pointerMove(p)
          }}
          onPointerUp={(e) => {
            if (e.button !== 0 || !held) return
            ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
            setHeld(false)
            editor.pointerUp(at(e))
          }}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => hoverAt(undefined)}
        />
        {bar && (
          <div
            class="bar"
            style={{
              left: `${bar.left}px`,
              top: `${bar.top}px`,
              transform: bar.above ? 'translateY(-100%)' : undefined,
            }}
          >
            {BAR.map(({ action, icon, label, title }) => (
              <button
                key={action}
                type="button"
                title={titled(title, action)}
                onClick={() => editor.act(action)}
              >
                {icon && <Icon name={icon} />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
