import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE } from '../config.ts'
import { checkConfig, config, isProjectModule, loadConfig } from './config.ts'

const roots: string[] = []

/** A project folder, with this text as its config if any is given. */
function project(source?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'tico8-config-'))
  roots.push(root)
  if (source !== undefined) writeFileSync(join(root, CONFIG_FILE), source)
  return root
}

const gameBoy = `export default { screen: '160x144', rate: 60 }\n`

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('loadConfig', () => {
  it('reads the default export, afresh each time', async () => {
    const root = project(gameBoy)
    expect(await loadConfig(root)).toEqual({ screen: '160x144', rate: 60 })
    writeFileSync(join(root, CONFIG_FILE), 'export default { rate: 30 }\n')
    expect(await loadConfig(root)).toEqual({ rate: 30 })
  })
  it('gives undefined for a project without a config', async () => {
    expect(await loadConfig(project())).toBeUndefined()
  })

  it('refuses a file that cannot be run or exports no config', async () => {
    await expect(loadConfig(project('export default {'))).rejects.toThrow(
      /^tico8\.config\.ts could not be loaded: /,
    )
    await expect(
      loadConfig(project('export const rate = 60\n')),
    ).rejects.toThrow(/^tico8\.config\.ts has no default export/)
  })
})

describe('checkConfig', () => {
  it('finds nothing wrong with a good config, or with none', async () => {
    expect(await checkConfig(project(gameBoy))).toBeUndefined()
    expect(await checkConfig(project('export default {}\n'))).toBeUndefined()
    expect(await checkConfig(project())).toBeUndefined()
  })

  it('names the setting a refused config gets wrong', async () => {
    expect(await checkConfig(project('export default { rate: 45 }\n'))).toBe(
      'tico8.config.ts: rate must be 30 or 60, got 45',
    )
  })

  it('says when the file cannot be loaded', async () => {
    expect(await checkConfig(project('export default {\n'))).toMatch(
      /^tico8\.config\.ts could not be loaded: /,
    )
    expect(await checkConfig(project('export const rate = 60\n'))).toMatch(
      /^tico8\.config\.ts has no default export/,
    )
  })

  it('reads through the loader it is given', async () => {
    const load = vi.fn(async () => ({ screen: '1x1' }) as never)
    expect(await checkConfig('/game', load)).toMatch(/screen must be/)
    expect(load).toHaveBeenCalledWith('/game')
  })
})

describe('config', () => {
  const engineFile = fileURLToPath(new URL('../project.ts', import.meta.url))

  /** The plugin after Vite has handed it a project folder. */
  async function started(root: string) {
    const plugin = config()
    const warn = vi.fn()
    const resolved = plugin.configResolved as unknown as (config: {
      root: string
      logger: { warn: typeof warn }
    }) => Promise<void>
    const start = () => resolved({ root, logger: { warn } })
    await start()
    return { plugin, warn, start }
  }

  function change(type: string, file: string, environment = 'client') {
    const send = vi.fn()
    const invalidateModule = vi.fn()
    const module = { id: engineFile }
    const getModulesByFile = vi.fn(() => new Set([module]))
    const hook = config().hotUpdate as unknown as (
      this: unknown,
      options: { type: string; file: string },
    ) => unknown
    const result = hook.call(
      {
        environment: {
          name: environment,
          config: { root: '/game' },
          hot: { send },
          moduleGraph: { getModulesByFile, invalidateModule },
        },
      },
      { type, file },
    )
    return { send, invalidateModule, module, result }
  }

  it('knows the engine module by its path, whatever the query', () => {
    expect(isProjectModule(engineFile)).toBe(true)
    expect(isProjectModule(`${engineFile}?t=123`)).toBe(true)
    expect(isProjectModule(engineFile.replace('project.ts', 'run.ts'))).toBe(
      false,
    )
    expect(isProjectModule('/game/project.ts')).toBe(false)
    expect(isProjectModule('/game/src/project.ts?v=1')).toBe(false)
  })

  it('serves the project config in place of the engine module', async () => {
    const { plugin } = await started(project(gameBoy))
    const load = plugin.load as unknown as (id: string) => unknown
    expect(load(engineFile)).toBe(
      "export { default } from '/tico8.config.ts'\n",
    )
    expect(load(`${engineFile}?t=123`)).toBe(
      "export { default } from '/tico8.config.ts'\n",
    )
    expect(load(engineFile.replace('project.ts', 'run.ts'))).toBeUndefined()
  })

  it('leaves the engine module alone for a project without a config', async () => {
    const root = project()
    const { plugin } = await started(root)
    const load = plugin.load as unknown as (id: string) => unknown
    expect(load(engineFile)).toBeUndefined()
    // The file may appear while the server runs.
    writeFileSync(join(root, CONFIG_FILE), gameBoy)
    expect(load(engineFile)).toContain('/tico8.config.ts')
  })

  it('says nothing about a good config', async () => {
    const { warn } = await started(project(gameBoy))
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns once about a config that is refused', async () => {
    const root = project(`export default { rate: 45 }\n`)

    const { warn, start } = await started(root)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[tico8] tico8.config.ts: rate must be 30 or 60, got 45.',
      { timestamp: true },
    )

    await start()
    expect(warn).toHaveBeenCalledTimes(1)

    // A different problem is news, and so is the first one coming back.
    writeFileSync(join(root, CONFIG_FILE), `export default { rate: 50 }\n`)
    await start()
    expect(warn).toHaveBeenCalledTimes(2)
    writeFileSync(join(root, CONFIG_FILE), gameBoy)
    await start()
    writeFileSync(join(root, CONFIG_FILE), `export default { rate: 45 }\n`)
    await start()
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('reloads the page when the config changes, appears or goes', () => {
    for (const type of ['update', 'create', 'delete']) {
      const { send, invalidateModule, module, result } = change(
        type,
        '/game/tico8.config.ts',
      )
      expect(send).toHaveBeenCalledWith({ type: 'full-reload' })
      expect(invalidateModule).toHaveBeenCalledWith(module)
      expect(result).toEqual([])
    }
  })

  it('stays out of other files and other environments', () => {
    for (const { send, invalidateModule, result } of [
      change('update', '/game/main.ts'),
      change('update', '/game/sub/tico8.config.ts'),
      change('update', '/other/tico8.config.ts'),
      change('update', '/game/tico8.config.ts', 'ssr'),
    ]) {
      expect(send).not.toHaveBeenCalled()
      expect(invalidateModule).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    }
  })
})
