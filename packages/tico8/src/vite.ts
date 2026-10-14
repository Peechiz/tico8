import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { assetsHmr } from './vite/assets-hmr.ts'
import { config } from './vite/config.ts'
import { maps } from './vite/maps.ts'
import { sounds } from './vite/sounds.ts'
import { sprites } from './vite/sprites.ts'

/** The project file that exports `init`, `update` and `draw`. */
const mainFile = 'main.ts'

/**
 * The module the page loads. It has no file; `load` below writes it. Its id
 * is its URL, with none of the usual marking of made-up modules, because the
 * page asks for it directly and Vite must fetch it again by the same URL
 * when it restarts the game.
 */
const entryId = '/@tico8/entry.js'

/** The page a game runs in. The game mounts into `document.body`. */
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tico8</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #111;
      }
    </style>
  </head>
  <body>
    <script type="module" src="${entryId}"></script>
  </body>
</html>
`

/**
 * Starts the game, and restarts it when its code changes: an edit to the
 * main file or anything it imports re-runs this module, which stops the
 * old game first.
 */
const entry = `import * as game from '/${mainFile}'
import { run } from 'tico8/run'

const stop = run(game)

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(stop)
}
`

/** Everything `tico8 dev` adds to Vite for a project folder. */
export function tico8(): Plugin[] {
  return [core(), config(), sprites(), maps(), sounds(), assetsHmr()]
}

function core(): Plugin {
  return {
    name: 'tico8',

    config() {
      // The engine is TypeScript source shared with the game, so it must be
      // served as modules rather than bundled ahead of time.
      return { optimizeDeps: { exclude: ['tico8'] } }
    },

    configResolved(config) {
      const main = join(config.root, mainFile)
      if (!existsSync(main)) {
        throw new Error(
          `No ${mainFile} in ${config.root}. Run tico8 in a project folder: ` +
            `it needs a ${mainFile} that exports init, update and draw.`,
        )
      }
    },

    resolveId(id) {
      if (id === entryId) return entryId
    },

    load(id) {
      if (id === entryId) return entry
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/' && path !== '/index.html') return next()
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
