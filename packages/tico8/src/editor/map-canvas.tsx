import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { EMPTY } from '../maps/types.ts'
import { paintChecker } from './canvas.tsx'
import {
  type Cells,
  MAP_ZOOMS,
  type MapCanvasProps,
  type MapData,
  type Pixels,
  type Vec,
} from './map-types.ts'
import { GRID, INK, k, useStyle } from './theme.ts'

/** A tile's size in map pixels. */
const TILE = 8

/** The space assumed until the element can be measured. */
const ROOM = { width: 512, height: 512 }

/** How much of the map, in screen pixels, stays in view when panned away. */
const KEEP = 32

/** How far a wheel gesture scrolls, in pixels, for each step of the zoom. */
const WHEEL_STEP = 32

/** A pause in wheel events this long, in ms, ends a gesture. */
const GESTURE_GAP = 150

/** The shown flag's tint. */
const TINT = { fill: 'rgb(41 173 255 / 0.35)', line: k(12) } as const

const CSS = `
.t8e-map-canvas { flex: 1; min-width: 0; min-height: 0; overflow: hidden;
  position: relative; }
.t8e-map-canvas canvas { display: block; position: absolute; inset: 0;
  cursor: crosshair; touch-action: none; }
.t8e-map-canvas canvas.grab { cursor: grab; }
.t8e-map-canvas canvas.grabbing { cursor: grabbing; }
.t8e-map-canvas .zoom { position: absolute; right: 8px; bottom: 8px; display: flex;
  align-items: center; gap: 2px; padding: 2px; background: var(--k0);
  box-shadow: 0 0 0 2px var(--k13); color: var(--k6); }
.t8e-map-canvas .zoom button { padding: 4px 8px; color: var(--k7); }
.t8e-map-canvas .zoom button:hover:not(:disabled) { background: var(--k1); }
.t8e-map-canvas .zoom span { min-width: 5ch; text-align: center; color: var(--k7); }
.t8e-map-canvas .zoom .fit[aria-pressed=true] { background: var(--k10); color: var(--k0); }
`

/**
 * A tileset's pixels as a canvas to draw tiles from, a pixel less than half
 * opaque left see-through. Made once per tileset version.
 */
export function tileImage(pixels: Pixels): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(pixels.width, pixels.height)
  image.data.set(pixels.data)
  for (let i = 3; i < image.data.length; i += 4)
    image.data[i] = (image.data[i] ?? 0) < 128 ? 0 : 255
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** The largest whole scale, at least 1, at which `map` fits `room`. */
export function fitScale(
  map: { columns: number; rows: number },
  room: { width: number; height: number },
): number {
  const width = map.columns * TILE
  const height = map.rows * TILE
  return Math.max(
    1,
    Math.floor(Math.min(room.width / width, room.height / height)),
  )
}

/** Where the map's top left starts: centred when it fits, else at the corner. */
export function startOffset(
  map: { columns: number; rows: number },
  room: { width: number; height: number },
  scale: number,
): Vec {
  const width = map.columns * TILE * scale
  const height = map.rows * TILE * scale
  return {
    x: width <= room.width ? Math.floor((room.width - width) / 2) : 0,
    y: height <= room.height ? Math.floor((room.height - height) / 2) : 0,
  }
}

/** The zoom step after `scale`, in (1) or out (-1), if there is one. */
export function stepZoom(scale: number, by: 1 | -1): number | undefined {
  return by > 0
    ? MAP_ZOOMS.find((z) => z > scale)
    : [...MAP_ZOOMS].reverse().find((z) => z < scale)
}

/** Keep part of the map in the room, however far it is panned. */
function clampOffset(
  offset: Vec,
  map: MapData,
  room: { width: number; height: number },
  scale: number,
): Vec {
  const width = map.columns * TILE * scale
  const height = map.rows * TILE * scale
  const keepX = Math.min(KEEP, width)
  const keepY = Math.min(KEEP, height)
  return {
    x: Math.round(
      Math.min(room.width - keepX, Math.max(keepX - width, offset.x)),
    ),
    y: Math.round(
      Math.min(room.height - keepY, Math.max(keepY - height, offset.y)),
    ),
  }
}

/** The cell at `(x, y)` of `cells`, `EMPTY` past its edge. */
function cellAt(cells: Cells, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= cells.columns || y >= cells.rows) return EMPTY
  return cells.cells[y * cells.columns + x] ?? EMPTY
}

/** A pan in progress: where the pointer and the map were when it began. */
interface Pan {
  pointer: Vec
  offset: Vec
}

/**
 * The open map: visible layers in order over the checker, cell and screen
 * lines, the shown flag's tint, the brush ghost, a rectangle being dragged
 * and the selection. Pointer in cells to the editor; wheel zooms, space- or
 * middle-drag pans.
 */
export function MapCanvas({ editor, state, screen, onHover }: MapCanvasProps) {
  useStyle('tico8-editor-map-canvas', CSS)
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(ROOM)
  const [march, setMarch] = useState(0)
  // The cell under the pointer, for the brush ghost.
  const [hover, setHover] = useState<Vec | undefined>()
  // Whether a press went to the editor, so its release does too.
  const [held, setHeld] = useState(false)
  // A wheel gesture: how far it has scrolled since its last step, which way,
  // when it was last heard, and the scale and offset its last step asked
  // for, which the next step goes on from before the canvas redraws.
  const wheeling = useRef<{
    total: number
    way: number
    last: number
    to?: { scale: number; offset: Vec }
  }>({ total: 0, way: 0, last: 0 })
  const [space, setSpace] = useState(false)
  const [pan, setPan] = useState<Pan | undefined>()
  // Where the map was moved to, for the scale and map it was moved at.
  const [moved, setMoved] = useState<
    { scale: number; file: string; offset: Vec } | undefined
  >()
  const { doc, tileset, selection } = state

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

  // Space held turns a left drag into a pan.
  useEffect(() => {
    const editable = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement &&
      (e.target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (editable(e)) return
      setSpace(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') setSpace(false)
    }
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // March the selection's outline while there is one.
  useEffect(() => {
    if (!selection) return
    const id = setInterval(() => setMarch((m) => (m + 1) % 8), 120)
    return () => clearInterval(id)
  }, [selection !== undefined])

  const tiles = useMemo(
    () => (tileset ? tileImage(tileset.pixels) : undefined),
    [tileset?.pixels, state.version],
  )

  const map = doc?.data
  const fit = map ? fitScale(map, room) : 1
  const scale = state.zoom ?? fit

  useEffect(() => editor.setFit(fit), [editor, fit])
  const offset = !map
    ? { x: 0, y: 0 }
    : moved && moved.scale === scale && moved.file === doc.info.file
      ? clampOffset(moved.offset, map, room, scale)
      : startOffset(map, room, scale)
  const dragging = state.drag !== undefined || (held && state.tool === 'select')

  // A stroke or a layer change under a still pointer changes what it is over.
  useEffect(() => {
    if (!hover || !onHover || !map) return
    const current = state.layer ? map.layers[state.layer] : undefined
    const frame = current?.[hover.y * map.columns + hover.x] ?? EMPTY
    onHover({ at: hover, frame: frame === EMPTY ? undefined : frame })
  }, [state.version, state.layer])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !map) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const size = TILE * scale
    const width = map.columns * size
    const height = map.rows * size

    // The cells in view, so a big map draws only what shows.
    const x0 = Math.max(0, Math.floor(-offset.x / size))
    const y0 = Math.max(0, Math.floor(-offset.y / size))
    const x1 = Math.min(map.columns, Math.ceil((room.width - offset.x) / size))
    const y1 = Math.min(map.rows, Math.ceil((room.height - offset.y) / size))

    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()
    // Two squares a tile, so the checker follows the cells at any zoom.
    paintChecker(ctx, width, height, size / 2)

    const tile = (frame: number, x: number, y: number) => {
      if (!tiles || !tileset || frame < 0 || frame >= tileset.frames) return
      const sx = (frame % tileset.columns) * TILE
      const sy = Math.floor(frame / tileset.columns) * TILE
      ctx.drawImage(tiles, sx, sy, TILE, TILE, x * size, y * size, size, size)
    }
    const block = (cells: Cells, at: Vec, alpha: number) => {
      ctx.globalAlpha = alpha
      for (let y = 0; y < cells.rows; y++)
        for (let x = 0; x < cells.columns; x++) {
          const frame = cellAt(cells, x, y)
          if (frame !== EMPTY) tile(frame, at.x + x, at.y + y)
        }
      ctx.globalAlpha = 1
    }
    const outline = (x: number, y: number, w: number, h: number) => {
      ctx.lineWidth = 2
      ctx.strokeStyle = INK.bright
      ctx.strokeRect(x * size + 1, y * size + 1, w * size - 2, h * size - 2)
    }

    for (const [name, cells] of Object.entries(map.layers)) {
      if (state.hidden.includes(name)) continue
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const frame = cells[y * map.columns + x] ?? EMPTY
          if (frame !== EMPTY) tile(frame, x, y)
        }
    }

    // The shown flag's tiles, on every layer shown.
    const flagged = state.shownFlag
      ? tileset?.flags[state.shownFlag]
      : undefined
    if (flagged && flagged.size > 0) {
      ctx.lineWidth = 1
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const has = Object.entries(map.layers).some(
            ([name, cells]) =>
              !state.hidden.includes(name) &&
              flagged.has(cells[y * map.columns + x] ?? EMPTY),
          )
          if (!has) continue
          ctx.fillStyle = TINT.fill
          ctx.fillRect(x * size, y * size, size, size)
          ctx.strokeStyle = TINT.line
          ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1)
        }
    }

    // Lines: faint between cells from 3x, firm at each screen's edge.
    ctx.fillStyle = GRID.pixel
    if (scale >= 3) {
      for (let x = Math.max(1, x0); x < x1; x++)
        ctx.fillRect(x * size, 0, 1, height)
      for (let y = Math.max(1, y0); y < y1; y++)
        ctx.fillRect(0, y * size, width, 1)
    }
    ctx.fillStyle = GRID.cell
    for (let x = screen.width; x < map.columns * TILE; x += screen.width)
      ctx.fillRect(x * scale, 0, 1, height)
    for (let y = screen.height; y < map.rows * TILE; y += screen.height)
      ctx.fillRect(0, y * scale, width, 1)

    // A rectangle being dragged: the brush laid from its top left.
    if (state.drag) {
      const { from, to } = state.drag
      const left = Math.min(from.x, to.x)
      const top = Math.min(from.y, to.y)
      const w = Math.abs(to.x - from.x) + 1
      const h = Math.abs(to.y - from.y) + 1
      if (state.tool === 'rect') {
        const { brush } = state
        ctx.globalAlpha = 0.5
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const frame = cellAt(brush, x % brush.columns, y % brush.rows)
            if (frame !== EMPTY) tile(frame, left + x, top + y)
          }
        ctx.globalAlpha = 1
      }
      outline(left, top, w, h)
    }

    if (selection) {
      const { rect, lifted } = selection
      if (lifted) block(lifted, rect, 1)
      const x = rect.x * size + 0.5
      const y = rect.y * size + 0.5
      const w = rect.width * size - 1
      const h = rect.height * size - 1
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

    // The brush's ghost at the cell under the pointer.
    if (hover && !dragging && !pan && !space) {
      if (['brush', 'rect', 'fill'].includes(state.tool)) {
        block(state.brush, hover, 0.5)
        outline(hover.x, hover.y, state.brush.columns, state.brush.rows)
      } else if (state.tool === 'eraser' || state.tool === 'pick') {
        outline(hover.x, hover.y, 1, 1)
      }
    }
    ctx.restore()
  })

  if (!doc || !map) return <div ref={box} class="t8e-map-canvas" />

  const size = TILE * scale
  const inside = (p: Vec) =>
    p.x >= 0 && p.y >= 0 && p.x < map.columns && p.y < map.rows

  const at = (e: PointerEvent | WheelEvent): { cell: Vec; point: Vec } => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    return {
      point,
      cell: {
        x: Math.floor((point.x - offset.x) / size),
        y: Math.floor((point.y - offset.y) / size),
      },
    }
  }

  const hoverAt = (p: Vec | undefined) => {
    const shown = p && inside(p) ? p : undefined
    setHover(shown)
    if (!onHover) return
    if (!shown) return onHover(undefined)
    const current = state.layer ? map.layers[state.layer] : undefined
    const frame = current?.[shown.y * map.columns + shown.x] ?? EMPTY
    onHover({ at: shown, frame: frame === EMPTY ? undefined : frame })
  }

  const moveTo = (to: Vec) =>
    setMoved({ scale, file: doc.info.file, offset: to })

  const cursor = pan ? 'grabbing' : space ? 'grab' : undefined

  return (
    <div ref={box} class="t8e-map-canvas">
      <canvas
        ref={ref}
        class={cursor}
        width={room.width}
        height={room.height}
        style={{ width: `${room.width}px`, height: `${room.height}px` }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          const target = e.currentTarget as Element
          if (e.button === 1 || (e.button === 0 && space)) {
            e.preventDefault()
            target.setPointerCapture?.(e.pointerId)
            setPan({ pointer: { x: e.clientX, y: e.clientY }, offset })
            return
          }
          if (e.button === 2 || (e.button === 0 && e.altKey)) {
            e.preventDefault()
            editor.pickAt(at(e).cell)
            return
          }
          if (e.button !== 0) return
          e.preventDefault()
          target.setPointerCapture?.(e.pointerId)
          setHeld(true)
          editor.pointerDown(at(e).cell)
        }}
        onPointerMove={(e) => {
          if (pan) {
            moveTo({
              x: pan.offset.x + e.clientX - pan.pointer.x,
              y: pan.offset.y + e.clientY - pan.pointer.y,
            })
            return
          }
          const { cell } = at(e)
          hoverAt(cell)
          editor.pointerMove(cell)
        }}
        onPointerUp={(e) => {
          const target = e.currentTarget as Element
          if (pan) {
            target.releasePointerCapture?.(e.pointerId)
            setPan(undefined)
            return
          }
          if (e.button !== 0 || !held) return
          target.releasePointerCapture?.(e.pointerId)
          setHeld(false)
          editor.pointerUp(at(e).cell)
        }}
        onPointerCancel={() => {
          setHeld(false)
          setPan(undefined)
        }}
        onPointerLeave={() => hoverAt(undefined)}
        onWheel={(e) => {
          e.preventDefault()
          const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
          // A plain scroll, such as a two-finger drag, pans. A pinch arrives
          // as a scroll with Ctrl held, so it zooms, as Ctrl or ⌘ does.
          if (!e.ctrlKey && !e.metaKey) {
            if (e.deltaX === 0 && e.deltaY === 0) return
            moveTo({
              x: offset.x - e.deltaX * lines,
              y: offset.y - e.deltaY * lines,
            })
            return
          }
          if (e.deltaY === 0) return
          // A step for every WHEEL_STEP scrolled, so a long pinch goes
          // through several levels; a mouse notch is one. A pause or a turn
          // starts anew.
          const g = wheeling.current
          const way = Math.sign(e.deltaY)
          const now = e.timeStamp
          if (way !== g.way || now - g.last > GESTURE_GAP) {
            Object.assign(g, { total: 0, way, to: undefined })
          }
          g.last = now
          g.total += Math.abs(e.deltaY) * lines
          if (g.total < WHEEL_STEP) return
          g.total = 0
          const from = g.to ?? { scale, offset }
          const next = stepZoom(from.scale, way < 0 ? 1 : -1)
          if (next === undefined) return
          // Keep the map point under the pointer where it is.
          const { point } = at(e)
          const mapX = (point.x - from.offset.x) / from.scale
          const mapY = (point.y - from.offset.y) / from.scale
          const to = {
            scale: next,
            offset: {
              x: Math.round(point.x - mapX * next),
              y: Math.round(point.y - mapY * next),
            },
          }
          g.to = to
          setMoved({ ...to, file: doc.info.file })
          editor.setZoom(next)
        }}
      />
      <div class="zoom">
        <button
          type="button"
          title="Zoom out (-)"
          disabled={stepZoom(scale, -1) === undefined}
          onClick={() => editor.setZoom(stepZoom(scale, -1))}
        >
          -
        </button>
        <span data-out="zoom">{scale * 100}%</span>
        <button
          type="button"
          title="Zoom in (=)"
          disabled={stepZoom(scale, 1) === undefined}
          onClick={() => editor.setZoom(stepZoom(scale, 1))}
        >
          +
        </button>
        <button
          type="button"
          class="fit"
          title="Fit the map (0)"
          aria-pressed={state.zoom === undefined}
          onClick={() => editor.setZoom(undefined)}
        >
          fit
        </button>
      </div>
    </div>
  )
}
