import { createContext } from 'preact'
import type { Nav } from './types.ts'

/**
 * The event a direction is offered to the focused element as, before the
 * highlight moves: a cancellable `CustomEvent` whose `detail` is the
 * `Direction`. Cancelling it keeps the highlight where it is, so an
 * element such as a volume can take ← and → for itself.
 */
export const DIRECTION_EVENT = 'tico8direction'

/** The nav a `<Menu>` opens itself with. A layer provides it. */
export const NavContext = createContext<Nav | null>(null)
