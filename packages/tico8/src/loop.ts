import type { UiNode } from './ui/types.ts'

/** What a game's main file exports. */
export interface Game {
  init?(): void
  update?(): void
  draw?(): void
  /** The game's UI as JSX, read after every update. */
  ui?(): UiNode
  /**
   * The game's own items for the pause menu, as buttons. Choosing one runs
   * its `onClick` and closes the menu, unless the click calls
   * `event.preventDefault()`.
   */
  pause?(): UiNode
}

export interface LoopOptions {
  /** Updates per second. */
  rate: number
  /** Called before each `update`, to sample input. */
  onUpdate?(): void
  /** Called after each `update` that runs, to count it. */
  afterUpdate?(): void
  /** Called before each `draw`, to start the frame clean. */
  beforeDraw?(): void
  /** Called after each `draw`, to put the screen in front of the player. */
  onDraw?(): void
  /**
   * Whether the game is frozen, read before each update and draw. While it
   * is, an update runs `onUpdate` and `afterUpdate` but not the game's
   * `update`, and no draw runs at all, so the last frame stays shown.
   */
  frozen?(): boolean
}

export interface Loop {
  /**
   * Advance to `now` (milliseconds, from any steady clock). The host calls
   * this once per display frame; tests call it by hand.
   */
  tick(now: number): void
}

/** Most updates one tick may run; any further backlog is dropped. */
export const MAX_CATCH_UP = 5

export function createLoop(game: Game, options: LoopOptions): Loop {
  let started = false
  let base = 0
  // Whole update steps accounted for since `base`, run or dropped.
  let steps = 0

  // `onUpdate` runs first so it can freeze the game (open the pause menu)
  // and have that take effect on this very update.
  function step(): void {
    options.onUpdate?.()
    if (!options.frozen?.()) game.update?.()
    options.afterUpdate?.()
  }

  function draw(): void {
    if (options.frozen?.()) return
    options.beforeDraw?.()
    game.draw?.()
    options.onDraw?.()
  }

  function tick(now: number): void {
    if (!started) {
      started = true
      base = now
      game.init?.()
      step()
      draw()
      return
    }

    // Count from the time base each tick so the remainder never drifts.
    const due = Math.floor(((now - base) * options.rate) / 1000)
    const behind = due - steps
    if (behind <= 0) return

    const run = Math.min(behind, MAX_CATCH_UP)
    steps = due
    for (let i = 0; i < run; i++) step()
    draw()
  }

  return { tick }
}
