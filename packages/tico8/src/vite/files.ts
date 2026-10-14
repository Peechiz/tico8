import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { SheetsListed } from '../assets/event.ts'
import { SHEETS_LISTED } from '../assets/event.ts'
import { SHEETS_API } from '../editor/host.ts'
import type { SheetInfo } from '../editor/types.ts'
import { sheetUrl } from './assets-hmr.ts'
import {
  parseSheetFile,
  SheetFileError,
  SPRITES_DIR,
  scanSprites,
} from './sprites.ts'

/** The sheets in a project's sprites folder, as the editors see them. */
export function listSheets(root: string): SheetInfo[] {
  const posixRoot = root.replaceAll('\\', '/')
  return scanSprites(root).sheets.map(
    ({ file, name, cellWidth, cellHeight }) => ({
      file,
      name,
      url:
        sheetUrl(
          posixRoot,
          `${posixRoot.replace(/\/$/, '')}/${SPRITES_DIR}/${file}`,
        ) ?? '',
      cellWidth,
      cellHeight,
    }),
  )
}

/**
 * Why a file name cannot be written to the sprites folder, or undefined if it
 * can: it must be a sheet's name, directly in the folder and not hidden.
 */
export function refuseSheetFile(file: string): string | undefined {
  if (file === '') return 'no file name was given'
  if (file.includes('/') || file.includes('\\')) {
    return 'a sheet cannot be in a folder'
  }
  if (file.includes('..')) return 'a sheet name cannot contain ".."'
  if (file.startsWith('.')) return 'a sheet cannot be a hidden file'
  try {
    if (parseSheetFile(file) === undefined) return 'a sheet must be a PNG'
  } catch (error) {
    if (error instanceof SheetFileError) return error.reason
    throw error
  }
  return undefined
}

/**
 * Lets the editors list and write a project's sheets, and tells them when
 * the sprites folder's list of files changes.
 */
export function files(): Plugin {
  let root = ''

  return {
    name: 'tico8:files',

    configResolved(config) {
      root = resolve(config.root)
    },

    configureServer(server) {
      const dir = join(root, SPRITES_DIR)

      server.middlewares.use((req, res, next) => {
        handle(root, req, res).then((handled) => {
          if (!handled) next()
        }, next)
      })

      // Sent only when the list differs from the last one, so a hidden temp
      // file coming and going, or a sheet given new pixels, says nothing.
      let last = JSON.stringify(listSheets(root))
      let timer: ReturnType<typeof setTimeout> | undefined
      function announce() {
        const sheets = listSheets(root)
        const text = JSON.stringify(sheets)
        if (text === last) return
        last = text
        const data: SheetsListed = { sheets }
        server.environments.client.hot.send(SHEETS_LISTED, data)
      }

      server.watcher.on('all', (event, changed) => {
        if (event === 'change') return
        const path = resolve(changed)
        if (path !== dir && dirname(path) !== dir) return
        // A rename arrives as a removal and an addition; wait for both.
        clearTimeout(timer)
        timer = setTimeout(announce, 50)
      })
      server.httpServer?.once('close', () => clearTimeout(timer))
    },
  }
}

/** Serve one request if it is for the sheets API; false if it is not. */
async function handle(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const path = (req.url ?? '').split('?')[0] ?? ''
  if (path === SHEETS_API || path === `${SHEETS_API}/`) {
    if (req.method !== 'GET') {
      send(res, 405, 'list the sheets with GET', { Allow: 'GET' })
      return true
    }
    send(res, 200, JSON.stringify(listSheets(root)), {
      'Content-Type': 'application/json',
    })
    return true
  }
  if (!path.startsWith(`${SHEETS_API}/`)) return false

  if (req.method !== 'PUT') {
    send(res, 405, 'write a sheet with PUT', { Allow: 'PUT' })
    return true
  }
  let file: string
  try {
    file = decodeURIComponent(path.slice(SHEETS_API.length + 1))
  } catch {
    send(res, 400, 'the file name is not a valid address')
    return true
  }
  const reason = refuseSheetFile(file)
  if (reason !== undefined) {
    send(res, 400, reason)
    return true
  }

  const body = await readBody(req)
  const dir = join(root, SPRITES_DIR)
  await mkdir(dir, { recursive: true })
  // Written beside the file and renamed over it, so nothing ever reads half
  // a PNG. The temp name is hidden, so the sprites and HMR plugins skip it.
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
