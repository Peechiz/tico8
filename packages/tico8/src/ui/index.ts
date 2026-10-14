// `tico8/ui`: what a game writes its UI with. Preact runs underneath, but a
// game imports everything from here, so it can be swapped.
export type { ComponentChildren, FunctionComponent, JSX } from 'preact'
export { createContext, Fragment } from 'preact'
export {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks'
export { Menu } from './menu.tsx'
export type { MenuProps, UiNode } from './types.ts'
