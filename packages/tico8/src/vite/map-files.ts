import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { MapsListed } from '../assets/event.ts'
import { MAPS_LISTED } from '../assets/event.ts'
import { FLAGS_API, MAPS_API } from '../editor/map-host.ts'
import type { MapInfo } from '../editor/map-types.ts'
import { FLAGS_SUFFIX, MAPS_DIR, nameProblem, scanMaps } from './maps.ts'
import { camelCase, SPRITES_DIR } from './sprites.ts'

/** The maps in a project's maps folder, as the map editor sees them. */
export function listMaps(root: string): MapInfo[] {
  return scanMaps(root).maps.map(({ file, name, tiles, flags }) =>
    flags === undefined ? { file, name, tiles } : { file, name, tiles, flags },
  )
}

/** Why a file cannot be directly in a folder, whatever it is. */
function refusePlace(file: string, what: string): string | undefined {
  if (file === '') return 'no file name was given'
  if (file.includes('/') || file.includes('\\')) {
    return `${what} cannot be in a folder`
  }
  if (file.includes('..')) return `${what} name cannot contain ".."`
  if (file.startsWith('.')) return `${what} cannot be a hidden file`
  return undefined
}

/**
 * Why a file name cannot be read or written in the maps folder, or
 * undefined if it can.
 */
export function refuseMapFile(file: string): string | undefined {
  const place = refusePlace(file, 'a map')
  if (place !== undefined) return place
  if (!/\.json$/i.test(file)) return 'a map must be a .json file'
  if (file.endsWith(FLAGS_SUFFIX)) {
    return `a map cannot end in ${FLAGS_SUFFIX}, which is a flags file`
  }
  return nameProblem(camelCase(file.slice(0, -'.json'.length)))
}

/**
 * Why a file name cannot be read or written as a flags file in the sprites
 * folder, or undefined if it can.
 */
export function refuseFlagsFile(file: string): string | undefined {
  const place = refusePlace(file, 'a flags file')
  if (place !== undefined) return place
  if (!file.endsWith(FLAGS_SUFFIX)) {
    return `a flags file must end in ${FLAGS_SUFFIX}`
  }
  if (file.length === FLAGS_SUFFIX.length) {
    return 'a flags file must name its tileset'
  }
  return undefined
}

/**
 * Lets the map editor list, read and write a project's maps and flags
 * files, and tells it when the maps folder's list of maps changes.
 */
export function mapFiles(): Plugin {
  let root = ''

  return {
    name: 'tico8:map-files',

    configResolved(config) {
      root = resolve(config.root)
    },

    configureServer(server) {
      const dirs = [join(root, MAPS_DIR), join(root, SPRITES_DIR)]

      server.middlewares.use((req, res, next) => {
        handle(root, req, res).then((handled) => {
          if (!handled) next()
        }, next)
      })

      // Sent only when the list differs from the last one, so new cells in
      // a map, or a temp file coming and going, say nothing.
      let last = JSON.stringify(listMaps(root))
      let timer: ReturnType<typeof setTimeout> | undefined
      function announce() {
        const maps = listMaps(root)
        const text = JSON.stringify(maps)
        if (text === last) return
        last = text
        const data: MapsListed = { maps }
        server.environments.client.hot.send(MAPS_LISTED, data)
      }

      server.watcher.on('all', (_event, changed) => {
        const path = resolve(changed)
        // A saved map counts too: it may name another tileset.
        if (!dirs.some((dir) => path === dir || dirname(path) === dir)) return
        // A rename arrives as a removal and an addition; wait for both.
        clearTimeout(timer)
        timer = setTimeout(announce, 50)
      })
      server.httpServer?.once('close', () => clearTimeout(timer))
    },
  }
}

/** A folder of files the map editor reads and writes as text. */
interface Folder {
  api: string
  dir: string
  /** What is read and written, for the 405 message: `a map`. */
  what: string
  refuse: (file: string) => string | undefined
}

const folders: readonly Folder[] = [
  { api: MAPS_API, dir: MAPS_DIR, what: 'a map', refuse: refuseMapFile },
  {
    api: FLAGS_API,
    dir: SPRITES_DIR,
    what: 'a flags file',
    refuse: refuseFlagsFile,
  },
]

/** Serve one request if it is for the maps or flags API; false if not. */
async function handle(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const path = (req.url ?? '').split('?')[0] ?? ''
  if (path === MAPS_API || path === `${MAPS_API}/`) {
    if (req.method !== 'GET') {
      send(res, 405, 'list the maps with GET', { Allow: 'GET' })
      return true
    }
    send(res, 200, JSON.stringify(listMaps(root)), {
      'Content-Type': 'application/json',
    })
    return true
  }
  const folder = folders.find(({ api }) => path.startsWith(`${api}/`))
  if (!folder) return false

  if (req.method !== 'GET' && req.method !== 'PUT') {
    send(res, 405, `read ${folder.what} with GET and write it with PUT`, {
      Allow: 'GET, PUT',
    })
    return true
  }
  let file: string
  try {
    file = decodeURIComponent(path.slice(folder.api.length + 1))
  } catch {
    send(res, 400, 'the file name is not a valid address')
    return true
  }
  const reason = folder.refuse(file)
  if (reason !== undefined) {
    send(res, 400, reason)
    return true
  }

  const dir = join(root, folder.dir)
  if (req.method === 'GET') {
    let text: string
    try {
      text = await readFile(join(dir, file), 'utf8')
    } catch (error) {
      if (!isMissing(error)) throw error
      send(res, 404, `${folder.dir}/${file} does not exist`)
      return true
    }
    send(res, 200, text, { 'Content-Type': 'application/json' })
    return true
  }

  const body = await readBody(req)
  await mkdir(dir, { recursive: true })
  // Written beside the file and renamed over it, so nothing ever reads half
  // a file. The temp name is hidden, so the maps and HMR plugins skip it.
  const temp = join(dir, `.${file}.${process.pid}.${Date.now()}.tmp`)
  try {
    await writeFile(temp, body)
    await rename(temp, join(dir, file))
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  send(res, 204, '')
  return true
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(
  res: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
) {
  res.statusCode = status
  if (body !== '' && !headers['Content-Type']) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  }
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value)
  }
  res.end(body)
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}
