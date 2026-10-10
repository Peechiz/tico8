/** What a game's main file exports. */
export interface Game {
  init?(): void
  update?(): void
  draw?(): void
}

export interface LoopOptions {
  /** Updates per second. */
  rate: number
  /** Called after each `draw`, to put the screen in front of the player. */
  onDraw?(): void
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

  function tick(now: number): void {
    if (!started) {
      started = true
      base = now
      game.init?.()
      game.update?.()
      game.draw?.()
      options.onDraw?.()
      return
    }

    // Count from the time base each tick so the remainder never drifts.
    const due = Math.floor(((now - base) * options.rate) / 1000)
    const behind = due - steps
    if (behind <= 0) return

    const run = Math.min(behind, MAX_CATCH_UP)
    steps = due
    for (let i = 0; i < run; i++) game.update?.()
    game.draw?.()
    options.onDraw?.()
  }

  return { tick }
}
