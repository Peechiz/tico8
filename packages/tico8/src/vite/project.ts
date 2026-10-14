import type { Plugin } from 'vite'

/** The project's name: its `package.json` name, else its folder's. */
export function projectName(root: string): string {
  throw new Error(`not built yet: ${root}`)
}

/** Hands the project's name to the page as `__TICO8_PROJECT__`. */
export function project(): Plugin {
  throw new Error('not built yet')
}
