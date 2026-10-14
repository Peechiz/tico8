import { createContext } from 'preact'
import type { Nav } from './types.ts'

/** The nav a `<Menu>` opens itself with. A layer provides it. */
export const NavContext = createContext<Nav | null>(null)
