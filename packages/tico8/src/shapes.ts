import type { Screen } from './screen.ts'
import type { Vec } from './vec.ts'

/** A box, placed by its top left corner. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A circle, placed by its centre. */
export interface Circle {
  x: number
  y: number
  radius: number
}

/** An oval, placed by its centre. */
export interface Oval {
  x: number
  y: number
  radiusX: number
  radiusY: number
}

/**
 * Anything that can be filled or outlined. Shapes are told apart by their
 * fields, so a game's own object with the right ones counts: anything with
 * `x`, `y`, `width` and `height` is a rect.
 */
export type Shape = Readonly<Rect> | Readonly<Circle> | Readonly<Oval>

/**
 * Make a rect: plain data, `{ x, y, width, height }`, placed by its top
 * left. The tests live on `rect` itself: `rect.overlaps(a, b)`,
 * `rect.contains(r, point)`.
 */
export const rect = Object.assign(
  ({ x, y, width, height }: Readonly<Rect>): Rect => ({ x, y, width, height }),
  {
    /** Whether two rects share any pixel. Touching edges do not count. */
    overlaps: (a: Readonly<Rect>, b: Readonly<Rect>): boolean =>
      a.width > 0 &&
      a.height > 0 &&
      b.width > 0 &&
      b.height > 0 &&
      a.x < b.x + b.width &&
      b.x < a.x + a.width &&
      a.y < b.y + b.height &&
      b.y < a.y + a.height,

    /** Whether a point is inside a rect. */
    contains: (r: Readonly<Rect>, point: Readonly<Vec>): boolean =>
      point.x >= r.x &&
      point.x < r.x + r.width &&
      point.y >= r.y &&
      point.y < r.y + r.height,
  },
)

/** Make a circle: plain data, `{ x, y, radius }`, placed by its centre. */
export function circle({ x, y, radius }: Readonly<Circle>): Circle {
  return { x, y, radius }
}

/** Make an oval: plain data, `{ x, y, radiusX, radiusY }`, placed by its centre. */
export function oval({ x, y, radiusX, radiusY }: Readonly<Oval>): Oval {
  return { x, y, radiusX, radiusY }
}

type Kind =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'oval'; x: number; y: number; rx: number; ry: number }

/** Tell the shape apart by its fields and floor everything to pixels. */
function classify(shape: Shape): Kind {
  const s = shape as Partial<Rect & Circle & Oval>
  const x = Math.floor(s.x!)
  const y = Math.floor(s.y!)
  if (s.radiusX !== undefined && s.radiusY !== undefined) {
    return {
      kind: 'oval',
      x,
      y,
      rx: Math.floor(s.radiusX),
      ry: Math.floor(s.radiusY),
    }
  }
  if (s.radius !== undefined) {
    const r = Math.floor(s.radius)
    return { kind: 'oval', x, y, rx: r, ry: r }
  }
  return {
    kind: 'rect',
    x,
    y,
    w: Math.floor(s.width!),
    h: Math.floor(s.height!),
  }
}

/**
 * Half the width of an oval's row `dy` rows from its centre: the largest `x`
 * with `x^2/rx^2 + dy^2/ry^2` within one, give or take half a pixel, which
 * is what gives a circle of radius 1 its plus and radius 2 its cut corners.
 * All in whole numbers.
 */
function halfWidth(rx: number, ry: number, dy: number): number {
  const limit =
    4 * rx * rx * ry * ry + rx * ry * (rx + ry) - 4 * dy * dy * rx * rx
  const reach = (x: number) => 4 * x * x * ry * ry <= limit
  let x = Math.floor(Math.sqrt(Math.max(0, limit) / (4 * ry * ry)))
  while (x > 0 && !reach(x)) x--
  while (reach(x + 1)) x++
  return x
}

/** An oval with a radius of 0 is a straight line, or one pixel. */
function ovalLine(screen: Screen, o: Kind & { kind: 'oval' }, color: number) {
  if (o.ry === 0) screen.span(o.x - o.rx, o.y, 2 * o.rx + 1, color)
  else for (let dy = -o.ry; dy <= o.ry; dy++) screen.pixel(o.x, o.y + dy, color)
}

function drawOval(
  screen: Screen,
  o: Kind & { kind: 'oval' },
  color: number,
  solid: boolean,
) {
  const { x, y, rx, ry } = o
  if (rx < 0 || ry < 0) return
  if (rx === 0 || ry === 0) return ovalLine(screen, o, color)
  let outer = halfWidth(rx, ry, 0)
  for (let dy = 0; dy <= ry; dy++) {
    const next = dy < ry ? halfWidth(rx, ry, dy + 1) : -1
    const rows = dy === 0 ? [y] : [y - dy, y + dy]
    for (const row of rows) {
      if (solid || dy === ry) {
        screen.span(x - outer, row, 2 * outer + 1, color)
      } else {
        const inner = Math.min(outer, next + 1)
        const length = outer - inner + 1
        screen.span(x - outer, row, length, color)
        if (inner > 0) screen.span(x + inner, row, length, color)
      }
    }
    outer = next
  }
}

/** Draw a shape solid, in one colour. */
export function fillShape(screen: Screen, shape: Shape, color: number): void {
  const k = classify(shape)
  if (k.kind === 'oval') {
    drawOval(screen, k, color, true)
    return
  }
  for (let row = 0; row < k.h; row++) screen.span(k.x, k.y + row, k.w, color)
}

/** Draw a shape's edge, one pixel thick, in one colour. */
export function outlineShape(
  screen: Screen,
  shape: Shape,
  color: number,
): void {
  const k = classify(shape)
  if (k.kind === 'oval') {
    drawOval(screen, k, color, false)
    return
  }
  const { x, y, w, h } = k
  if (w <= 0 || h <= 0) return
  screen.span(x, y, w, color)
  if (h > 1) screen.span(x, y + h - 1, w, color)
  for (let row = y + 1; row < y + h - 1; row++) {
    screen.pixel(x, row, color)
    if (w > 1) screen.pixel(x + w - 1, row, color)
  }
}

/**
 * Draw a straight line from one point to another, both ends included. The
 * same pixels come out whichever end is given first.
 */
export function drawLine(
  screen: Screen,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
): void {
  x0 = Math.floor(x0)
  y0 = Math.floor(y0)
  x1 = Math.floor(x1)
  y1 = Math.floor(y1)
  if (y0 > y1 || (y0 === y1 && x0 > x1)) {
    ;[x0, y0, x1, y1] = [x1, y1, x0, y0]
  }
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    screen.pixel(x0, y0, color)
    if (x0 === x1 && y0 === y1) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0++
    }
  }
}
