import { existsSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalizePath, type Plugin } from 'vite'
import { CONFIG_FILE, type Config, resolveConfig } from '../config.ts'
import { modulePath } from '../module-path.ts'

/**
 * The engine module that stands for the project's config, as Vite names it:
 * the real path, since the package is reached through a link.
 */
const projectModule = normalizePath(
  modulePath(new URL('../project.ts', import.meta.url)),
)

/** What the engine module becomes for a project that has a config. */
const reexport = `export { default } from '/${CONFIG_FILE}'\n`

/** Reads a project's config; undefined when the project has none. */
export type LoadConfig = (root: string) => Promise<Config | undefined>

/** Thrown by `loadConfig` for a config file that cannot be read as one. */
export class ConfigLoadError extends Error {
  constructor(reason: string) {
    super(`${CONFIG_FILE} ${reason}`)
    this.name = 'ConfigLoadError'
  }
}

/**
 * Whether a module id is the engine's `project.ts` (`project.js` once built),
 * whatever its query.
 */
export function isProjectModule(id: string): boolean {
  const file = id.split('?')[0]!
  if (file === projectModule) return true
  if (!file.endsWith('/project.ts') && !file.endsWith('/project.js')) {
    return false
  }
  try {
    return normalizePath(realpathSync(file)) === projectModule
  } catch {
    return false
  }
}

/** Each load gets an address of its own, so Node reads the file again. */
let loads = 0

/**
 * Read a project's `tico8.config.ts` in Node. Gives undefined when there is
 * no such file, and throws when it cannot be run or exports no config.
 * Files the config imports are read once and not again.
 */
export async function loadConfig(root: string): Promise<Config | undefined> {
  const path = join(root, CONFIG_FILE)
  if (!existsSync(path)) return undefined
  const url = `${pathToFileURL(path).href}?load=${++loads}`
  let module: { default?: Config }
  try {
    module = await import(/* @vite-ignore */ url)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ConfigLoadError(`could not be loaded: ${reason}`)
  }
  if (!('default' in module)) {
    throw new ConfigLoadError(
      'has no default export. It should end with export default defineConfig({ ... })',
    )
  }
  return module.default
}

/**
 * Read a project's config and say what is wrong with it, if anything: it
 * cannot be loaded, or `resolveConfig` refuses it. A project without a
 * config has nothing wrong.
 */
export async function checkConfig(
  root: string,
  load: LoadConfig = loadConfig,
): Promise<string | undefined> {
  try {
    const config = await load(root)
    if (config !== undefined) resolveConfig(config)
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * Hands the project's `tico8.config.ts` to the engine, says in the terminal
 * when it cannot be used, and restarts the game when it changes.
 */
export function config(): Plugin {
  let root = ''
  let warn: (message: string) => void = () => {}
  /** The warning last shown, so a problem is reported once, not per save. */
  let shown: string | undefined
  /** Checks run one after another, so an older read cannot land last. */
  let queue: Promise<void> = Promise.resolve()

  function check(): Promise<void> {
    queue = queue.then(async () => {
      const problem = await checkConfig(root)
      const message = problem === undefined ? undefined : `[tico8] ${problem}.`
      if (message !== undefined && message !== shown) warn(message)
      shown = message
    })
    return queue
  }

  return {
    name: 'tico8:config',

    async configResolved(resolved) {
      root = resolve(resolved.root)
      warn = (message) => resolved.logger.warn(message, { timestamp: true })
      // Here rather than on the first request, so a bad config is named
      // as the dev tool starts.
      await check()
    },

    load(id) {
      // With no config the real file is served: the empty config.
      if (isProjectModule(id) && existsSync(join(root, CONFIG_FILE))) {
        return reexport
      }
    },

    configureServer(server) {
      const file = join(root, CONFIG_FILE)
      let timer: ReturnType<typeof setTimeout> | undefined

      server.watcher.on('all', (_event, changed) => {
        if (resolve(changed) !== file) return
        // An editor may replace the file, which is a removal and an
        // addition; wait for both.
        clearTimeout(timer)
        timer = setTimeout(check, 50)
      })
      server.httpServer?.once('close', () => clearTimeout(timer))
    },

    hotUpdate({ file }) {
      if (this.environment.name !== 'client') return
      const root = this.environment.config.root.replace(/\/$/, '')
      if (file !== `${root}/${CONFIG_FILE}`) return
      // The engine module is served differently with and without a config,
      // so it is loaded afresh when the file appears or goes.
      const graph = this.environment.moduleGraph
      for (const module of graph.getModulesByFile(projectModule) ?? []) {
        graph.invalidateModule(module)
      }
      // The screen is built once, when the engine loads, so the page
      // starts over rather than the game alone.
      this.environment.hot.send({ type: 'full-reload' })
      return []
    },
  }
}
