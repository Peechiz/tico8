import { resolve } from 'node:path'
import { build, type Rolldown } from 'vite'
import { inlineAssets } from '../vite/inline.ts'
import { tico8 } from '../vite.ts'

export interface BuildOptions {
  /** The project folder. */
  root: string
}

export interface BuiltGame {
  /** The game, engine and assets as one module. */
  js: string
  /** Every stylesheet the game imports, joined. */
  css: string
}

/** The module the page loads; the tico8 plugin writes it. */
const entry = '/@tico8/entry.js'

/** Build a project into one module and its CSS, written nowhere. */
export async function buildGame({ root }: BuildOptions): Promise<BuiltGame> {
  const result = await build({
    root: resolve(root),
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    plugins: [...tico8(), inlineAssets()],
    build: {
      write: false,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: true,
      // Everything the code points at, the UI font among it, goes in as a
      // data URL: a page opened from `file:` can load nothing beside it.
      assetsInlineLimit: () => true,
      cssCodeSplit: false,
      modulePreload: false,
      reportCompressedSize: false,
      rolldownOptions: {
        input: entry,
        // One chunk: dynamic imports are folded in rather than split off.
        output: { codeSplitting: false },
      },
    },
  })

  const outputs = Array.isArray(result) ? result : [result]
  const files: (Rolldown.OutputChunk | Rolldown.OutputAsset)[] = []
  for (const output of outputs) {
    if (!('output' in output)) {
      throw new Error('tico8 export: the build started a watcher')
    }
    files.push(...output.output)
  }

  const chunks = files.filter(
    (file): file is Rolldown.OutputChunk => file.type === 'chunk',
  )
  const assets = files.filter(
    (file): file is Rolldown.OutputAsset => file.type === 'asset',
  )
  const css = assets.filter((file) => file.fileName.endsWith('.css'))
  const others = assets.filter((file) => !file.fileName.endsWith('.css'))
  if (chunks.length !== 1 || !chunks[0]?.isEntry) {
    const names = chunks.map((chunk) => chunk.fileName).join(', ')
    throw new Error(
      `tico8 export: the build made ${chunks.length} chunks (${names}), ` +
        'not one. Every import must be folded into a single module.',
    )
  }
  if (others.length > 0) {
    const names = others.map((file) => file.fileName).join(', ')
    throw new Error(
      `tico8 export: the build left files that could not be inlined: ${names}`,
    )
  }

  return {
    js: chunks[0].code,
    css: css
      .map((file) =>
        typeof file.source === 'string'
          ? file.source
          : new TextDecoder().decode(file.source),
      )
      .join('\n'),
  }
}
