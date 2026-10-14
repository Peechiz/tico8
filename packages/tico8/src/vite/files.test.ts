import { EventEmitter } from 'node:events'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHEET_CHANGED, SHEETS_LISTED } from '../assets/event.ts'
import { devHost, fileOfSheetUrl, SHEETS_API } from '../editor/host.ts'
import { files } from './files.ts'
import { SPRITES_DIR } from './sprites.ts'

const roots: string[] = []

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

/** A project folder, with these files in its sprites folder if given. */
function project(sheets?: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'tico8-files-'))
  roots.push(root)
  if (sheets) {
    mkdirSync(join(root, SPRITES_DIR))
    for (const file of sheets) writeFileSync(join(root, SPRITES_DIR, file), '')
  }
  return root
}

type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void

interface Reply {
  status: number
  body: string
  headers: Record<string, string>
  /** Whether the request was passed on to the next middleware. */
  passed: boolean
}

/** The plugin set up on a fake dev server for the project at `root`. */
function serve(root: string) {
  const plugin = files()
  const watcher = new EventEmitter()
  const send = vi.fn()
  let middleware: Middleware | undefined
  const server = {
    middlewares: { use: (fn: Middleware) => (middleware = fn) },
    watcher,
    environments: { client: { hot: { send } } },
    httpServer: undefined,
  }
  ;(plugin.configResolved as (config: unknown) => void)({ root })
  ;(plugin.configureServer as (server: unknown) => void)(server)

  function request(method: string, url: string, body = ''): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const req = Object.assign(Readable.from([Buffer.from(body)]), {
        method,
        url,
      }) as unknown as IncomingMessage
      const headers: Record<string, string> = {}
      const res: { statusCode: number } & Record<string, unknown> = {
        statusCode: 200,
        setHeader: (name: string, value: string) => {
          headers[name.toLowerCase()] = value
        },
        end(text: string) {
          resolve({
            status: res.statusCode,
            body: text,
            headers,
            passed: false,
          })
        },
      }
      middleware?.(req, res as unknown as ServerResponse, (error) => {
        if (error) reject(error)
        else resolve({ status: 0, body: '', headers, passed: true })
      })
    })
  }

  return { request, watcher, send }
}

describe('files', () => {
  it('lists the sheets, sorted by name, with their addresses', async () => {
    const root = project([
      'player.16.png',
      'Big Boss.png',
      '.hidden.png',
      '2bad.png',
      'notes.txt',
    ])
    const { request } = serve(root)
    const reply = await request('GET', SHEETS_API)
    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toBe('application/json')
    expect(JSON.parse(reply.body)).toEqual([
      {
        file: 'Big Boss.png',
        name: 'bigBoss',
        url: '/sprites/Big%20Boss.png',
        cellWidth: 8,
        cellHeight: 8,
      },
      {
        file: 'player.16.png',
        name: 'player',
        url: '/sprites/player.16.png',
        cellWidth: 16,
        cellHeight: 16,
      },
    ])
  })

  it('lists none when there is no sprites folder', async () => {
    const { request } = serve(project())
    expect(JSON.parse((await request('GET', SHEETS_API)).body)).toEqual([])
  })

  it('leaves other addresses alone', async () => {
    const { request } = serve(project())
    expect((await request('GET', '/sprites/player.png')).passed).toBe(true)
    expect((await request('GET', '/@tico8/sheetsx')).passed).toBe(true)
  })

  it('writes a sheet, making the sprites folder', async () => {
    const root = project()
    const { request } = serve(root)
    const reply = await request(
      'PUT',
      `${SHEETS_API}/${encodeURIComponent("Big Boss's.16x24.png")}`,
      'png bytes',
    )
    expect(reply.status).toBe(204)
    const dir = join(root, SPRITES_DIR)
    expect(readFileSync(join(dir, "Big Boss's.16x24.png"), 'utf8')).toBe(
      'png bytes',
    )
    // No temp file is left behind.
    expect(readdirSync(dir)).toEqual(["Big Boss's.16x24.png"])
  })

  it('writes over a sheet that is there', async () => {
    const root = project(['badge.16.png'])
    const { request } = serve(root)
    await request('PUT', `${SHEETS_API}/badge.16.png`, 'new')
    expect(readFileSync(join(root, SPRITES_DIR, 'badge.16.png'), 'utf8')).toBe(
      'new',
    )
  })

  it.each([
    ['notes.txt', 'a sheet must be a PNG'],
    ['.hidden.png', 'a sheet cannot be a hidden file'],
    ['..%2Fescape.png', 'a sheet cannot be in a folder'],
    ['sub%2Fplayer.png', 'a sheet cannot be in a folder'],
    ['..png', 'a sheet name cannot contain ".."'],
    ['a..b.png', 'a sheet name cannot contain ".."'],
    ['player.12.png', 'a cell size of 12 is not a multiple of 8'],
    ['class.png', '"class" is a reserved word, so it cannot be imported'],
    ['%E0%A4%A.png', 'the file name is not a valid address'],
  ])('refuses to write %s', async (name, reason) => {
    const root = project()
    const { request } = serve(root)
    const reply = await request('PUT', `${SHEETS_API}/${name}`, 'x')
    expect(reply.status).toBe(400)
    expect(reply.body).toBe(reason)
    expect(readdirSync(root)).toEqual([])
  })

  it('refuses other methods', async () => {
    const { request } = serve(project())
    expect((await request('POST', SHEETS_API)).status).toBe(405)
    expect((await request('GET', `${SHEETS_API}/a.png`)).status).toBe(405)
  })

  it('tells the page when the list of sheets changes', async () => {
    vi.useFakeTimers()
    const root = project(['player.png'])
    const { request, watcher, send } = serve(root)
    const dir = join(root, SPRITES_DIR)

    await request('PUT', `${SHEETS_API}/badge.16.png`, 'x')
    // A rename: the old name goes and the new one comes, heard once.
    watcher.emit('all', 'add', join(dir, 'badge.16.png'))
    watcher.emit('all', 'unlink', join(dir, '.badge.16.png.tmp'))
    vi.advanceTimersByTime(50)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(SHEETS_LISTED, {
      sheets: [
        {
          file: 'badge.16.png',
          name: 'badge',
          url: '/sprites/badge.16.png',
          cellWidth: 16,
          cellHeight: 16,
        },
        {
          file: 'player.png',
          name: 'player',
          url: '/sprites/player.png',
          cellWidth: 8,
          cellHeight: 8,
        },
      ],
    })
  })

  it('says nothing when the list stays the same', () => {
    vi.useFakeTimers()
    const root = project(['player.png'])
    const { watcher, send } = serve(root)
    const dir = join(root, SPRITES_DIR)
    // New pixels in a sheet, a temp file, a file elsewhere.
    watcher.emit('all', 'change', join(dir, 'player.png'))
    watcher.emit('all', 'add', join(dir, '.player.png.tmp'))
    watcher.emit('all', 'add', join(root, 'main.ts'))
    vi.advanceTimersByTime(50)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('devHost', () => {
  function fakeHot() {
    const listeners = new Map<string, Set<(data: never) => void>>()
    return {
      on(event: string, listener: (data: never) => void): void {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)?.add(listener)
      },
      off(event: string, listener: (data: never) => void) {
        listeners.get(event)?.delete(listener)
      },
      emit(event: string, data: unknown) {
        for (const listener of listeners.get(event) ?? []) {
          listener(data as never)
        }
      },
    }
  }

  it('names the file a changed sheet is at', () => {
    expect(fileOfSheetUrl('/sprites/Big%20Boss%27s.png')).toBe("Big Boss's.png")
    expect(fileOfSheetUrl('/sounds/hit.wav')).toBeUndefined()
  })

  it('hears changes and lists until stopped', () => {
    const hot = fakeHot()
    const host = devHost(hot)
    const changed = vi.fn()
    const listed = vi.fn()
    const stop = host.onChange(changed)
    host.onList(listed)
    hot.emit(SHEET_CHANGED, { url: '/sprites/badge.16.png' })
    hot.emit(SHEETS_LISTED, { sheets: [] })
    stop()
    hot.emit(SHEET_CHANGED, { url: '/sprites/badge.16.png' })
    expect(changed).toHaveBeenCalledExactlyOnceWith('badge.16.png')
    expect(listed).toHaveBeenCalledWith([])
  })

  it('writes with PUT and gives the reason it was refused', async () => {
    const fetch = vi.fn(
      async () => new Response('a sheet must be a PNG', { status: 400 }),
    )
    vi.stubGlobal('fetch', fetch)
    const host = devHost(fakeHot())
    await expect(host.write('a b.txt', new Uint8Array([1]))).rejects.toThrow(
      'could not write a b.txt: a sheet must be a PNG',
    )
    expect(fetch).toHaveBeenCalledWith(
      `${SHEETS_API}/a%20b.txt`,
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})
