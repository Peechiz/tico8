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
import { MAPS_LISTED } from '../assets/event.ts'
import { FLAGS_API, MAPS_API } from '../editor/map-host.ts'
import { mapFiles } from './map-files.ts'
import { MAPS_DIR } from './maps.ts'
import { SPRITES_DIR } from './sprites.ts'

const roots: string[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

/** A project folder with these files in its sprites and maps folders. */
function project(
  files: {
    sprites?: Record<string, string>
    maps?: Record<string, string>
  } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), 'tico8-map-files-'))
  roots.push(root)
  for (const [dir, contents] of [
    [SPRITES_DIR, files.sprites],
    [MAPS_DIR, files.maps],
  ] as const) {
    if (!contents) continue
    mkdirSync(join(root, dir))
    for (const [file, text] of Object.entries(contents)) {
      writeFileSync(join(root, dir, file), text)
    }
  }
  return root
}

const map = (tiles: string) => JSON.stringify({ tiles, layers: [] })

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
  const plugin = mapFiles()
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

describe('mapFiles', () => {
  it('lists the maps, sorted by name, with their tilesets and flags', async () => {
    const root = project({
      sprites: { 'tiles.png': '', 'tiles.flags.json': '{}', 'cave.png': '' },
      maps: {
        'room 2.json': map('tiles'),
        'cave.json': map('nowhere'),
        'room1.json': map('cave'),
        '.hidden.json': map('tiles'),
      },
    })
    const { request } = serve(root)
    const reply = await request('GET', MAPS_API)
    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toBe('application/json')
    expect(JSON.parse(reply.body)).toEqual([
      { file: 'room1.json', name: 'room1', tiles: 'cave' },
      {
        file: 'room 2.json',
        name: 'room2',
        tiles: 'tiles',
        flags: 'tiles.flags.json',
      },
    ])
  })

  it('lists none when there is no maps folder', async () => {
    const { request } = serve(project())
    expect(JSON.parse((await request('GET', MAPS_API)).body)).toEqual([])
  })

  it('leaves other addresses alone', async () => {
    const { request } = serve(project())
    expect((await request('GET', '/maps/room1.json')).passed).toBe(true)
    expect((await request('GET', '/@tico8/mapsx')).passed).toBe(true)
    expect((await request('GET', '/@tico8/sheets')).passed).toBe(true)
  })

  it('reads a map and a flags file as they are', async () => {
    const text = '{ "tiles": "tiles" }\n'
    const root = project({
      sprites: { 'tiles.flags.json': '{"solid":[1]}' },
      maps: { 'room 1.json': text },
    })
    const { request } = serve(root)
    const reply = await request('GET', `${MAPS_API}/room%201.json`)
    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toBe('application/json')
    expect(reply.body).toBe(text)
    const flags = await request('GET', `${FLAGS_API}/tiles.flags.json?t=1`)
    expect(flags.body).toBe('{"solid":[1]}')
  })

  it('answers 404 for a file that is not there', async () => {
    const { request } = serve(project())
    expect((await request('GET', `${MAPS_API}/room1.json`)).status).toBe(404)
    expect((await request('GET', `${FLAGS_API}/a.flags.json`)).status).toBe(404)
  })

  it('writes a map and a flags file, making the folders', async () => {
    const root = project()
    const { request } = serve(root)
    const reply = await request('PUT', `${MAPS_API}/room%201.json`, '{"a":1}')
    expect(reply.status).toBe(204)
    expect(
      (await request('PUT', `${FLAGS_API}/tiles.flags.json`, '{}')).status,
    ).toBe(204)
    expect(readFileSync(join(root, MAPS_DIR, 'room 1.json'), 'utf8')).toBe(
      '{"a":1}',
    )
    expect(
      readFileSync(join(root, SPRITES_DIR, 'tiles.flags.json'), 'utf8'),
    ).toBe('{}')
    // No temp file is left behind.
    expect(readdirSync(join(root, MAPS_DIR))).toEqual(['room 1.json'])
    expect(readdirSync(join(root, SPRITES_DIR))).toEqual(['tiles.flags.json'])
  })

  it('writes over a map that is there', async () => {
    const root = project({ maps: { 'room1.json': 'old' } })
    const { request } = serve(root)
    await request('PUT', `${MAPS_API}/room1.json`, 'new')
    expect(readFileSync(join(root, MAPS_DIR, 'room1.json'), 'utf8')).toBe('new')
  })

  it.each([
    ['room1.txt', 'a map must be a .json file'],
    ['.hidden.json', 'a map cannot be a hidden file'],
    ['..%2Fescape.json', 'a map cannot be in a folder'],
    ['sub%5Croom.json', 'a map cannot be in a folder'],
    ['a..b.json', 'a map name cannot contain ".."'],
    [
      'tiles.flags.json',
      'a map cannot end in .flags.json, which is a flags file',
    ],
    [
      '2room.json',
      'the name "2room" starts with a digit, so it cannot be imported',
    ],
    ['class.json', '"class" is a reserved word, so it cannot be imported'],
    ['map.json', 'the name "map" is taken by the function maps.ts imports'],
    ['-.json', 'it has no letters to make a name from'],
    ['%E0%A4%A.json', 'the file name is not a valid address'],
  ])('refuses the map %s', async (name, reason) => {
    const root = project()
    const { request } = serve(root)
    for (const method of ['GET', 'PUT']) {
      const reply = await request(method, `${MAPS_API}/${name}`, 'x')
      expect(reply.status).toBe(400)
      expect(reply.body).toBe(reason)
    }
    expect(readdirSync(root)).toEqual([])
  })

  it.each([
    ['tiles.json', 'a flags file must end in .flags.json'],
    ['.flags.json', 'a flags file cannot be a hidden file'],
    ['sub%2Ftiles.flags.json', 'a flags file cannot be in a folder'],
    ['a..flags.json', 'a flags file name cannot contain ".."'],
  ])('refuses the flags file %s', async (name, reason) => {
    const root = project()
    const { request } = serve(root)
    const reply = await request('PUT', `${FLAGS_API}/${name}`, 'x')
    expect(reply.status).toBe(400)
    expect(reply.body).toBe(reason)
    expect(readdirSync(root)).toEqual([])
  })

  it('refuses other methods', async () => {
    const { request } = serve(project())
    const list = await request('POST', MAPS_API)
    expect(list.status).toBe(405)
    expect(list.headers.allow).toBe('GET')
    const write = await request('POST', `${MAPS_API}/a.json`)
    expect(write.status).toBe(405)
    expect(write.headers.allow).toBe('GET, PUT')
    expect((await request('DELETE', `${FLAGS_API}/a.flags.json`)).status).toBe(
      405,
    )
  })

  it('tells the page when the list of maps changes', async () => {
    vi.useFakeTimers()
    const root = project({
      sprites: { 'tiles.png': '' },
      maps: { 'room1.json': map('tiles') },
    })
    const { request, watcher, send } = serve(root)
    const dir = join(root, MAPS_DIR)

    await request('PUT', `${MAPS_API}/room2.json`, map('tiles'))
    // A rename: the temp name goes and the new one comes, heard once.
    watcher.emit('all', 'add', join(dir, 'room2.json'))
    watcher.emit('all', 'unlink', join(dir, '.room2.json.tmp'))
    vi.advanceTimersByTime(50)
    expect(send).toHaveBeenCalledExactlyOnceWith(MAPS_LISTED, {
      maps: [
        { file: 'room1.json', name: 'room1', tiles: 'tiles' },
        { file: 'room2.json', name: 'room2', tiles: 'tiles' },
      ],
    })

    // A flags file in the sprites folder changes the list too.
    writeFileSync(join(root, SPRITES_DIR, 'tiles.flags.json'), '{}')
    watcher.emit('all', 'add', join(root, SPRITES_DIR, 'tiles.flags.json'))
    vi.advanceTimersByTime(50)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('hears a map naming another tileset', async () => {
    vi.useFakeTimers()
    const root = project({
      sprites: { 'tiles.png': '', 'cave.png': '' },
      maps: { 'room1.json': map('tiles') },
    })
    const { request, watcher, send } = serve(root)
    await request('PUT', `${MAPS_API}/room1.json`, map('cave'))
    watcher.emit('all', 'change', join(root, MAPS_DIR, 'room1.json'))
    vi.advanceTimersByTime(50)
    expect(send).toHaveBeenCalledExactlyOnceWith(MAPS_LISTED, {
      maps: [{ file: 'room1.json', name: 'room1', tiles: 'cave' }],
    })
  })

  it('says nothing when the list stays the same', () => {
    vi.useFakeTimers()
    const root = project({
      sprites: { 'tiles.png': '' },
      maps: { 'room1.json': map('tiles') },
    })
    const { watcher, send } = serve(root)
    // New cells in a map, a temp file, a file elsewhere.
    writeFileSync(
      join(root, MAPS_DIR, 'room1.json'),
      JSON.stringify({ tiles: 'tiles', layers: [{}] }),
    )
    watcher.emit('all', 'change', join(root, MAPS_DIR, 'room1.json'))
    watcher.emit('all', 'add', join(root, MAPS_DIR, '.room1.json.tmp'))
    watcher.emit('all', 'add', join(root, 'main.ts'))
    vi.advanceTimersByTime(50)
    expect(send).not.toHaveBeenCalled()
  })
})
