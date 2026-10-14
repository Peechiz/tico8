/**
 * The engine's count of game time. Both start at 0 and go up by one update
 * after each update runs; an update dropped after a long gap is not
 * counted, so this is game time, not time on the wall.
 */
export interface Clock {
  /** How many updates have run: whole numbers, for flickers every few updates. */
  readonly ticks: number
  /**
   * `ticks` divided by the update rate, for anything that should last a set
   * time: `clock.seconds % 1 < 0.5` blinks once a second at any rate.
   */
  readonly seconds: number
}

/** A clock and the controls the engine keeps to itself. */
export interface RunningClock {
  readonly clock: Clock
  /** Count one more update. */
  step(): void
  /** Back to 0, for a restart. */
  reset(): void
}

/** A clock for a game running `rate` updates a second. */
export function createClock(rate: number): RunningClock {
  // Contract stub: stands still until task 2 builds it.
  const clock = { ticks: 0, seconds: 0 * rate }
  return { clock, step() {}, reset() {} }
}
