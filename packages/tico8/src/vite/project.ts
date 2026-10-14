import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Plugin } from 'vite'

/** The project's name: its `package.json` name, else its folder's. */
export function projectName(root: string): string {
  const folder = resolve(root)
  try {
    const { name } = JSON.parse(
      readFileSync(join(folder, 'package.json'), 'utf8'),
    ) as { name?: unknown }
    if (typeof name === 'string' && name !== '') return name
  } catch {
    // No package.json, or one that cannot be read: use the folder.
  }
  return basename(folder)
}

/** Hands the project's name to the page as `__TICO8_PROJECT__`. */
export function project(): Plugin {
  return {
    name: 'tico8:project',
    config(userConfig) {
      const root = resolve(process.cwd(), userConfig.root ?? '.')
      return {
        define: { __TICO8_PROJECT__: JSON.stringify(projectName(root)) },
      }
    },
  }
}
