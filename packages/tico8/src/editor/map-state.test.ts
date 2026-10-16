import { describe, expect, it, vi } from 'vitest'
import { parseMap, writeMap } from '../maps/file.ts'
import { EMPTY } from '../maps/types.ts'
import { writeFlags } from './map-doc.ts'
import { createMapEditor } from './map-state.ts'
import type {
  FileHost,
  FlagData,
  MapData,
  MapEditor,
  MapHost,
  MapInfo,
  Pixels,
  SheetInfo,
} from './map-types.ts'

function sheet(file: string, name: string, cell = 8): SheetInfo {
  return {
    file,
    name,
    url: `/sprites/${file}`,
    cellWidth: cell,
    cellHeight: cell,
  }
}

/** A 2x2-tile sheet whose tile n is filled with the grey n * 10 + 10. */
function tiles(): Pixels {
  const width = 16
  const data = new Uint8ClampedArray(width * 16 * 4)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const tile = Math.floor(y / 8) * 2 + Math.floor(x / 8)
      const i = (y * width + x) * 4
      data.set([tile * 10 + 10, tile * 10 + 10, tile * 10 + 10, 255], i)
    }
  }
  return { width, height: 16, data }
}

/** A map from rows of text, one layer to an array. */
function map(layers: Record<string, string[]>, tileset = 'tiles'): string {
  return JSON.stringify({ tiles: tileset, layers })
}

/** A MapHost in memory over files of text; writes are logged. */
function memoryHost(options: {
  maps: MapInfo[]
  files: Record<string, string>
  flags?: Record<string, string>
  sheets: SheetInfo[]
  pixels: Record<string, Pixels>
}) {
  const { files, pixels } = options
  const flags = options.flags ?? {}
  const mapChanges = new Set<(name: string, data: unknown) => void>()
  const flagChanges = new Set<(tiles: string, data: unknown) => void>()
  const mapLists = new Set<(maps: MapInfo[]) => void>()
  const sheetChanges = new Set<(file: string) => void>()
  const sheetLists = new Set<(sheets: SheetInfo[]) => void>()
  const writes: { file: string; text?: string; bytes?: Uint8Array }[] = []
  const sheets: FileHost = {
    list: async () => options.sheets,
    read: async (file) => {
      const found = pixels[file]
      if (!found) throw new Error(`no ${file}`)
      return found
    },
    write: async (file, bytes) => {
      writes.push({ file, bytes })
    },
    onChange(listener) {
      sheetChanges.add(listener)
      return () => sheetChanges.delete(listener)
    },
    onList(listener) {
      sheetLists.add(listener)
      return () => sheetLists.delete(listener)
    },
  }
  const host: MapHost = {
    sheets,
    listMaps: async () => options.maps,
    readMap: async (file) => {
      const text = files[file]
      if (text === undefined) throw new Error(`no ${file}`)
      return JSON.parse(text)
    },
    writeMap: async (file, text) => {
      files[file] = text
      writes.push({ file, text })
    },
    readFlags: async (file) => {
      const text = flags[file]
      return text === undefined ? undefined : JSON.parse(text)
    },
    writeFlags: async (file, text) => {
      flags[file] = text
      writes.push({ file, text })
    },
    onMapChange(listener) {
      mapChanges.add(listener)
      return () => mapChanges.delete(listener)
    },
    onFlagsChange(listener) {
      flagChanges.add(listener)
      return () => flagChanges.delete(listener)
    },
    onMapList(listener) {
      mapLists.add(listener)
      return () => mapLists.delete(listener)
    },
  }
  return {
    host,
    files,
    flags,
    writes,
    mapChange(name: string, text: string) {
      for (const listener of mapChanges) listener(name, JSON.parse(text))
    },
    flagsChange(tileset: string, text: string) {
      for (const listener of flagChanges) listener(tileset, JSON.parse(text))
    },
    listMaps(next: MapInfo[]) {
      for (const listener of mapLists) listener(next)
    },
  }
}

/** Long enough for any queued write to finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

const ROOM = map({ ground: ['0 .', '. 1'], front: ['. .', '. .'] })
const HALL = map({ ground: ['1 1', '0 3'] })

async function setup(flags?: Record<string, string>) {
  const fake = memoryHost({
    maps: [
      { file: 'hall.json', name: 'hall', tiles: 'tiles' },
      { file: 'room.json', name: 'room', tiles: 'tiles' },
      { file: 'other.json', name: 'other', tiles: 'big' },
    ],
    files: {
      'hall.json': HALL,
      'room.json': ROOM,
      'other.json': map({ ground: ['0'] }, 'big'),
    },
    flags,
    sheets: [sheet('big.16.png', 'big', 16), sheet('tiles.png', 'tiles')],
    pixels: { 'tiles.png': tiles(), 'big.16.png': tiles() },
  })
  const editor = createMapEditor({ host: fake.host })
  await vi.waitFor(() => expect(editor.get().tileset).toBeDefined())
  return { ...fake, editor }
}

/** Open room.json and forget the writes so far. */
async function room(flags?: Record<string, string>) {
  const fake = await setup(flags)
  await fake.editor.open('room.json')
  await settle()
  fake.writes.length = 0
  return fake
}

/** The rows of a layer as text, `.` for empty. */
function rows(data: MapData, layer: string): string[] {
  const cells = data.layers[layer]!
  const out: string[] = []
  for (let row = 0; row < data.rows; row++) {
    const line: string[] = []
    for (let column = 0; column < data.columns; column++) {
      const cell = cells[row * data.columns + column]!
      line.push(cell === EMPTY ? '.' : String(cell))
    }
    out.push(line.join(' '))
  }
  return out
}

function shown(editor: MapEditor, layer = 'ground'): string[] {
  return rows(editor.get().doc!.data, layer)
}

function flagList(flags: FlagData): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(flags).map(([flag, frames]) => [
      flag,
      [...frames].sort((a, b) => a - b),
    ]),
  )
}

describe('createMapEditor', () => {
  it('lists maps and sheets and opens the first map with its tileset', async () => {
    const { editor } = await setup()
    const state = editor.get()
    expect(state.maps.map((m) => m.name)).toEqual(['hall', 'room', 'other'])
    expect(state.doc?.info.file).toBe('hall.json')
    expect(state.layer).toBe('ground')
    expect(state.tileset?.columns).toBe(2)
    expect(state.tileset?.frames).toBe(4)
    expect(state.tileset?.flagsFile).toBe('tiles.flags.json')
    expect(state.tileset?.flags).toEqual({})
    expect(state.tool).toBe('brush')
    expect([...state.brush.cells]).toEqual([0])
    expect(state.chosen).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(state.zoom).toBeUndefined()
    expect(state.canUndo).toBe(false)
  })

  it('refuses a map whose tileset is not 8x8', async () => {
    const { editor } = await setup()
    await editor.open('other.json')
    expect(editor.get().tileset).toBeUndefined()
    expect(editor.get().error).toMatch(/8x8/)
  })

  it('writes a stroke once, when it ends', async () => {
    const { editor, writes, files } = await room()
    const version = editor.get().version
    editor.chooseTiles({ x: 1, y: 1, width: 1, height: 1 })
    editor.pointerDown({ x: 1, y: 0 })
    editor.pointerMove({ x: 0, y: 1 })
    await settle()
    expect(writes).toHaveLength(0)
    editor.pointerUp({ x: 0, y: 1 })
    await settle()
    expect(writes.map((w) => w.file)).toEqual(['room.json'])
    expect(rows(parseMap(JSON.parse(files['room.json']!)), 'ground')).toEqual([
      '0 3',
      '3 1',
    ])
    expect(editor.get().version).toBeGreaterThan(version)
    expect(editor.get().saving).toBe(false)
  })

  it('lays a block brush as a pattern anchored at the press', async () => {
    const { editor } = await room()
    editor.chooseTiles({ x: 0, y: 0, width: 2, height: 2 })
    expect([...editor.get().brush.cells]).toEqual([0, 1, 2, 3])
    editor.setTool('rect')
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerMove({ x: 1, y: 1 })
    expect(editor.get().drag).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    })
    editor.pointerUp({ x: 1, y: 1 })
    expect(shown(editor)).toEqual(['0 1', '2 3'])
    expect(editor.get().drag).toBeUndefined()
  })

  it('skips the write when nothing changed', async () => {
    const { editor, writes } = await room()
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    await settle()
    expect(writes).toHaveLength(0)
  })

  it('fills, picks and erases', async () => {
    const { editor } = await room()
    editor.chooseTiles({ x: 0, y: 1, width: 1, height: 1 })
    editor.setTool('fill')
    editor.pointerDown({ x: 1, y: 0 })
    expect(shown(editor)).toEqual(['0 2', '. 1'])
    editor.setTool('pick')
    editor.pointerDown({ x: 1, y: 1 })
    expect([...editor.get().brush.cells]).toEqual([1])
    expect(editor.get().chosen).toEqual({ x: 1, y: 0, width: 1, height: 1 })
    editor.setTool('eraser')
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    expect(shown(editor)).toEqual(['. 2', '. 1'])
  })

  it('undo writes the old map and redo the new', async () => {
    const { editor, files } = await room()
    editor.chooseTiles({ x: 1, y: 1, width: 1, height: 1 })
    editor.pointerDown({ x: 1, y: 0 })
    editor.pointerUp({ x: 1, y: 0 })
    editor.act('undo')
    await settle()
    expect(files['room.json']).toBe(writeMap(parseMap(JSON.parse(ROOM))))
    expect(editor.get().canRedo).toBe(true)
    editor.act('redo')
    await settle()
    expect(rows(parseMap(JSON.parse(files['room.json']!)), 'ground')).toEqual([
      '0 3',
      '. 1',
    ])
  })

  it('moves a selection and pastes at the top left', async () => {
    const { editor } = await room()
    editor.setTool('select')
    editor.pointerDown({ x: 1, y: 1 })
    editor.pointerUp({ x: 1, y: 1 })
    expect(editor.get().selection).toBeUndefined()
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerMove({ x: 1, y: 0 })
    editor.pointerUp({ x: 1, y: 0 })
    expect(editor.get().selection?.rect).toEqual({
      x: 0,
      y: 0,
      width: 2,
      height: 1,
    })
    editor.act('copy')
    // Move the row down one.
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 1 })
    editor.act('deselect')
    expect(shown(editor)).toEqual(['. .', '0 1'])
    editor.setTool('brush')
    editor.act('paste')
    expect(editor.get().tool).toBe('select')
    editor.act('deselect')
    expect(shown(editor)).toEqual(['0 .', '0 1'])
  })

  it('takes in an outside map change as one undoable step', async () => {
    const { editor, mapChange } = await room()
    mapChange('room', map({ ground: ['3 3', '3 3'], front: ['. .', '. .'] }))
    expect(shown(editor)).toEqual(['3 3', '3 3'])
    expect(editor.get().canUndo).toBe(true)
    editor.act('undo')
    expect(shown(editor)).toEqual(['0 .', '. 1'])
  })

  it('ignores the echo of its own write, and a change during a stroke', async () => {
    const { editor, mapChange, files } = await room()
    editor.pointerDown({ x: 1, y: 0 })
    mapChange('room', map({ ground: ['3 3', '3 3'], front: ['. .', '. .'] }))
    editor.pointerUp({ x: 1, y: 0 })
    await settle()
    expect(shown(editor)).toEqual(['0 0', '. 1'])
    const written = files['room.json']!
    // Draw again, then hear the first write come back late.
    editor.pointerDown({ x: 0, y: 1 })
    editor.pointerUp({ x: 0, y: 1 })
    await settle()
    const steps = editor.get().canUndo
    mapChange('room', written)
    expect(shown(editor)).toEqual(['0 0', '0 1'])
    expect(editor.get().canUndo).toBe(steps)
  })

  it('keeps the current layer when it is renamed, and refuses a taken name', async () => {
    const { editor, files } = await room()
    editor.setLayer('front')
    editor.toggleLayer('front')
    expect(editor.renameLayer('front', 'ground')).toBeDefined()
    expect(editor.renameLayer('front', 'sky')).toBeUndefined()
    expect(editor.get().layer).toBe('sky')
    expect(editor.get().hidden).toEqual(['sky'])
    await settle()
    expect(Object.keys(JSON.parse(files['room.json']!).layers)).toEqual([
      'ground',
      'sky',
    ])
    editor.act('undo')
    expect(editor.get().layer).toBe('ground')
  })

  it('adds, moves and removes layers, and steps the current one', async () => {
    const { editor } = await room()
    expect(editor.addLayer('top')).toBeUndefined()
    expect(editor.get().layer).toBe('top')
    expect(Object.keys(editor.get().doc!.data.layers)).toEqual([
      'ground',
      'front',
      'top',
    ])
    editor.moveLayer('top', -1)
    expect(Object.keys(editor.get().doc!.data.layers)).toEqual([
      'ground',
      'top',
      'front',
    ])
    editor.key('[')
    expect(editor.get().layer).toBe('ground')
    editor.key('[')
    expect(editor.get().layer).toBe('ground')
    editor.removeLayer('ground')
    expect(editor.get().layer).toBe('top')
    editor.removeLayer('top')
    editor.removeLayer('front')
    expect(Object.keys(editor.get().doc!.data.layers)).toEqual(['front'])
  })

  it('writes a flag toggle, naming the file after the sheet', async () => {
    const { editor, writes, flags } = await room()
    expect(editor.addFlag('frame')).toBeDefined()
    expect(editor.addFlag('wall')).toBeUndefined()
    editor.chooseTiles({ x: 0, y: 0, width: 2, height: 1 })
    editor.setFlag('wall', true)
    await settle()
    expect(writes.every((w) => w.file === 'tiles.flags.json')).toBe(true)
    expect(JSON.parse(flags['tiles.flags.json']!)).toEqual({ wall: [0, 1] })
    editor.showFlag('wall')
    expect(editor.renameFlag('wall', 'solid')).toBeUndefined()
    expect(editor.get().shownFlag).toBe('solid')
    editor.act('undo')
    expect(editor.get().shownFlag).toBeUndefined()
    expect(flagList(editor.get().tileset!.flags)).toEqual({ wall: [0, 1] })
    editor.removeFlag('wall')
    await settle()
    expect(JSON.parse(flags['tiles.flags.json']!)).toEqual({})
  })

  it('takes in an outside flags change, ignoring its own echo', async () => {
    const { editor, flagsChange, flags } = await room({
      'tiles.flags.json': '{"wall": [1]}',
    })
    editor.setFlag('wall', true)
    await settle()
    const written = flags['tiles.flags.json']!
    flagsChange('tiles', written)
    expect(editor.get().canUndo).toBe(true)
    flagsChange('tiles', '{"wall": [3]}')
    expect(flagList(editor.get().tileset!.flags)).toEqual({ wall: [3] })
    editor.act('undo')
    expect(flagList(editor.get().tileset!.flags)).toEqual({ wall: [0, 1] })
  })

  it('swaps tiles in the PNG, flags and both maps, and undo puts them back', async () => {
    const { editor, writes, files, flags } = await room({
      'tiles.flags.json': writeFlags({ wall: new Set([0]) }),
    })
    const before = { ...files }
    await editor.swapTiles(0, 3)
    await settle()
    expect(writes.map((w) => w.file).sort()).toEqual([
      'hall.json',
      'room.json',
      'tiles.flags.json',
      'tiles.png',
    ])
    expect(shown(editor)).toEqual(['3 .', '. 1'])
    expect(rows(parseMap(JSON.parse(files['hall.json']!)), 'ground')).toEqual([
      '1 1',
      '3 0',
    ])
    expect(JSON.parse(flags['tiles.flags.json']!)).toEqual({ wall: [3] })
    const pixels = editor.get().tileset!.pixels
    expect(pixels.data[0]).toBe(40)
    expect(editor.get().canUndo).toBe(true)

    writes.length = 0
    editor.act('undo')
    await vi.waitFor(() => expect(writes).toHaveLength(4))
    await settle()
    expect(files['hall.json']).toBe(
      writeMap(parseMap(JSON.parse(before['hall.json']!))),
    )
    expect(files['room.json']).toBe(
      writeMap(parseMap(JSON.parse(before['room.json']!))),
    )
    expect(JSON.parse(flags['tiles.flags.json']!)).toEqual({ wall: [0] })
    expect(editor.get().tileset!.pixels.data[0]).toBe(10)
  })

  it('closes the open map when its file goes', async () => {
    const { editor, listMaps } = await room()
    listMaps([{ file: 'hall.json', name: 'hall', tiles: 'tiles' }])
    expect(editor.get().doc).toBeUndefined()
    expect(editor.get().maps).toHaveLength(1)
  })

  it('makes a new map, refusing a bad one, and resizes it', async () => {
    const { editor, files } = await room()
    const make = { tiles: 'tiles', layer: 'ground', columns: 3, rows: 2 }
    expect(await editor.newMap({ ...make, name: '1st' })).toBeDefined()
    expect(await editor.newMap({ ...make, name: 'hall' })).toBeDefined()
    expect(
      await editor.newMap({ ...make, name: 'cave', tiles: 'big' }),
    ).toMatch(/8x8/)
    expect(await editor.newMap({ ...make, name: 'cave' })).toBeUndefined()
    expect(editor.get().doc?.info.file).toBe('cave.json')
    expect(editor.get().maps.map((m) => m.name)).toContain('cave')
    expect(shown(editor)).toEqual(['. . .', '. . .'])
    await editor.resize({ columns: 1, rows: 1 })
    expect(rows(parseMap(JSON.parse(files['cave.json']!)), 'ground')).toEqual([
      '.',
    ])
    editor.act('undo')
    expect(editor.get().doc?.data.columns).toBe(3)
  })

  it('steps the zoom through MAP_ZOOMS and back to fit', async () => {
    const { editor } = await room()
    editor.key('=')
    expect(editor.get().zoom).toBe(2)
    editor.key('=')
    expect(editor.get().zoom).toBe(3)
    editor.setZoom(8)
    editor.key('=')
    expect(editor.get().zoom).toBe(8)
    editor.key('-')
    expect(editor.get().zoom).toBe(6)
    editor.key('0')
    expect(editor.get().zoom).toBeUndefined()
    editor.key('-')
    expect(editor.get().zoom).toBe(1)
    expect(editor.key('q')).toBe(false)
  })

  it('steps from the fitted scale when the zoom is fit', async () => {
    const { editor } = await room()
    editor.setFit(4)
    editor.key('=')
    expect(editor.get().zoom).toBe(6)
    editor.key('0')
    editor.key('-')
    expect(editor.get().zoom).toBe(3)
  })
})
