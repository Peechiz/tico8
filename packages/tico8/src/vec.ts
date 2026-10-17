/** A position or direction. Any object with `x` and `y` counts as one. */
export interface Vec {
  x: number
  y: number
}

type ReadonlyVec = Readonly<Vec>

/** Which axes `vec.step` was stopped on. */
export interface Hit {
  readonly x: boolean
  readonly y: boolean
}

/** One axis of `vec.step`: walk the floored position toward the target. */
function stepAxis(
  pos: Vec,
  axis: 'x' | 'y',
  by: number,
  blocked: (at: Vec) => boolean,
): boolean {
  const target = pos[axis] + by
  const from = Math.floor(pos[axis])
  const to = Math.floor(target)
  const dir = Math.sign(to - from)
  for (let at = from; at !== to; ) {
    at += dir
    const probe = { x: Math.floor(pos.x), y: Math.floor(pos.y) }
    probe[axis] = at
    if (blocked(probe)) {
      pos[axis] = at - dir
      return true
    }
  }
  pos[axis] = target
  return false
}

/**
 * Make a vector: plain data, so it can be saved and compared as is.
 * The maths lives on `vec` itself: `vec.add(a, b)`, `vec.len(a)`, ...
 */
export const vec = Object.assign((x = 0, y = 0): Vec => ({ x, y }), {
  /** A new vector, `a + b`. */
  add: (a: ReadonlyVec, b: ReadonlyVec): Vec => ({
    x: a.x + b.x,
    y: a.y + b.y,
  }),

  /** A new vector, `a - b`: the way from `b` to `a`. */
  sub: (a: ReadonlyVec, b: ReadonlyVec): Vec => ({
    x: a.x - b.x,
    y: a.y - b.y,
  }),

  /** A new vector, `a` made `n` times as long. */
  scale: (a: ReadonlyVec, n: number): Vec => ({ x: a.x * n, y: a.y * n }),

  /** How long `a` is. */
  len: (a: ReadonlyVec): number => Math.hypot(a.x, a.y),

  /** How far apart `a` and `b` are. */
  distance: (a: ReadonlyVec, b: ReadonlyVec): number =>
    Math.hypot(a.x - b.x, a.y - b.y),

  /** A new vector pointing the way `a` does, of length 1. Zero stays zero. */
  normalize: (a: ReadonlyVec): Vec => {
    const n = Math.hypot(a.x, a.y)
    return n === 0 ? { x: 0, y: 0 } : { x: a.x / n, y: a.y / n }
  },

  /** Add `by` to `a` in place, and return `a`. Nothing new is made. */
  move: <T extends Vec>(a: T, by: ReadonlyVec): T => {
    a.x += by.x
    a.y += by.y
    return a
  },

  /**
   * Move `pos` by `vel` in place, in whole pixels: x first, then y, one
   * pixel at a time, asking `blocked` at each floored position. On a hit
   * `pos` stops on the last free whole pixel of that axis and loses its
   * fraction there; otherwise it keeps its fraction for the next step.
   * What a hit means is the game's: stop, bounce, squash.
   *
   *     const hit = vec.step(player.pos, player.vel, (at) =>
   *       walls.overlaps({ ...at, width: 8, height: 8 }, 'solid'))
   *     if (hit.y) player.vel.y = 0
   */
  step: (pos: Vec, vel: ReadonlyVec, blocked: (at: Vec) => boolean): Hit => {
    const x = stepAxis(pos, 'x', vel.x, blocked)
    const y = stepAxis(pos, 'y', vel.y, blocked)
    return { x, y }
  },
})
