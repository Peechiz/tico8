import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { PAGE_STYLE } from './export/page.ts'
import { modulePath } from './module-path.ts'
import { assetsHmr } from './vite/assets-hmr.ts'
import { config } from './vite/config.ts'
import { files } from './vite/files.ts'
import { mapFiles } from './vite/map-files.ts'
import { maps } from './vite/maps.ts'
import { project } from './vite/project.ts'
import { sounds } from './vite/sounds.ts'
import { sprites } from './vite/sprites.ts'

/** The project files that can export `init`, `update` and `draw`, best first. */
const mainFiles = ['main.tsx', 'main.ts']

/** The main file in this folder, or undefined when there is none. */
function findMain(root: string): string | undefined {
  return mainFiles.find((file) => existsSync(join(root, file)))
}

/**
 * The module the page loads. It has no file; `load` below writes it. Its id
 * is its URL, with none of the usual marking of made-up modules, because the
 * page asks for it directly and Vite must fetch it again by the same URL
 * when it restarts the game.
 */
const entryId = '/@tico8/entry.js'

/** The address of the page a game runs in, framed by the dev page. */
const gameUrl = '/@tico8/game'

/** The dev page's module: the tabs and the editors. */
const shellId = '/@tico8/shell.js'

/** The editors' code in the package, as Vite names a file. */
const shellMain = normalizePath(
  modulePath(new URL('./editor/main.tsx', import.meta.url)),
)

/** A page that runs one module, in the style the export shares. */
function pageWith(script: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tico8</title>
    <style>
${PAGE_STYLE}
    </style>
  </head>
  <body>
    <script type="module" src="${script}"></script>
  </body>
</html>
`
}

/** The pages the dev server serves, by address. */
const pages: Record<string, string> = {
  '/': pageWith(shellId),
  '/index.html': pageWith(shellId),
  // The game in a page of its own, so keys pressed in an editor never reach
  // it. The game mounts into `document.body`.
  [gameUrl]: pageWith(entryId),
}

/**
 * Starts the game, and restarts it when its code changes: an edit to the
 * main file or anything it imports re-runs this module, which stops the
 * old game first.
 */
function entry(main: string): string {
  return `import * as game from '/${main}'
import { run } from 'tico8/run'

const stop = run(game)

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(stop)
}
`
}

/** Everything `tico8 dev` adds to Vite for a project folder. */
export function tico8(): Plugin[] {
  return [
    core(),
    config(),
    project(),
    sprites(),
    maps(),
    sounds(),
    assetsHmr(),
    files(),
    mapFiles(),
  ]
}

function core(): Plugin {
  let main = 'main.ts'
  return {
    name: 'tico8',

    config() {
      // The engine is TypeScript source shared with the game, so it must be
      // served as modules rather than bundled ahead of time. Preact, which
      // it imports, is bundled once for the engine and the game alike.
      return {
        optimizeDeps: {
          exclude: ['tico8'],
          include: [
            'tico8 > preact',
            'tico8 > preact/hooks',
            'tico8 > preact/jsx-runtime',
            'tico8 > preact/jsx-dev-runtime',
          ],
        },
        // JSX goes through tico8/ui whatever the project's tsconfig says.
        oxc: { jsx: { runtime: 'automatic', importSource: 'tico8/ui' } },
      }
    },

    configResolved(config) {
      const found = findMain(config.root)
      if (found === undefined) {
        throw new Error(
          `No ${mainFiles.join(' or ')} in ${config.root}. Run tico8 in a ` +
            `project folder: it needs a ${mainFiles.join(' or ')} that ` +
            `exports init, update and draw.`,
        )
      }
      main = found
    },

    resolveId(id) {
      if (id === entryId || id === shellId) return id
    },

    load(id) {
      if (id === entryId) return entry(main)
      if (id === shellId) return `import ${JSON.stringify(shellMain)}\n`
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        const page = pages[path]
        if (page === undefined) return next()
        try {
          const html = await server.transformIndexHtml(req.url ?? '/', page)
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
