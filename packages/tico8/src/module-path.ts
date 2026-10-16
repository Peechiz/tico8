import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The file of an engine module, given where its source would be, as in
 * `new URL('../project.ts', import.meta.url)`. The workspace runs the
 * source; the packed package runs the build, where the same module is a
 * `.js` file in the same place. Gives the real path, since the package may
 * be reached through a link, and throws when neither file exists.
 */
export function modulePath(source: URL): string {
  const path = fileURLToPath(source)
  const built = path.replace(/\.tsx?$/, '.js')
  for (const candidate of [path, built]) {
    if (existsSync(candidate)) return realpathSync(candidate)
  }
  throw new Error(`The engine module ${path} (or ${built}) does not exist.`)
}
