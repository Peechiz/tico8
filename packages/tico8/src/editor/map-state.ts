import { parseMap, writeMap } from '../maps/file.ts'
import { parseFlags } from '../maps/flags.ts'
import {
  addFlag,
  addLayer,
  cloneMap,
  flagNameProblem,
  flagsFileFor,
  layerNameProblem,
  mapFile,
  moveLayer,
  newMapData,
  removeFlag,
  removeLayer,
  renameFlag,
  renameLayer,
  resizeMap,
  sameMap,
  setFlag,
  writeFlags,
} from './map-doc.ts'
import {
  cellsBetween,
  copyCells,
  dropCells,
  eraseLine,
  fillCells,
  layerCells,
  liftCells,
  moveCellSelection,
  pasteCells,
  pickCell,
  rectCells,
  stampLine,
} from './map-tools.ts'
import {
  type CellCount,
  type Cells,
  type FlagData,
  MAP_SHORTCUTS,
  MAP_TOOLS,
  MAP_ZOOMS,
  type MapActionName,
  type MapData,
  type MapDoc,
  type MapEditor,
  type MapEditorState,
  type MapHost,
  type MapInfo,
  type MapToolName,
  type NewMap,
  type Pixels,
  type Rect,
  type SheetInfo,
  type Tileset,
  type Vec,
} from './map-types.ts'
import { encodePng } from './png.ts'
import { swapTiles } from './rearrange.ts'

/** How many recent writes of a file count as its echo. */
const ECHOES = 4

/** How many steps undo goes back. */
const STEPS = 100

/** A tileset's cells are this many pixels across and down. */
const TILE = 8

/** What a map's name must be, as New says it. */
const NAME_RULE =
  'A name starts with a letter and uses letters, digits and dashes.'

/** The rule `isSheetName` in `sheets.tsx` checks; a map is named alike. */
const MAP_NAME = /^[a-z][a-z0-9-]*$/i

function sameBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function samePixels(a: Pixels, b: Pixels): boolean {
  return (
    a.width === b.width && a.height === b.height && sameBytes(a.data, b.data)
  )
}

function sameFlags(a: FlagData, b: FlagData): boolean {
  return writeFlags(a) === writeFlags(b)
}

function inside(rect: Rect, at: Vec): boolean {
  return (
    at.x >= rect.x &&
    at.y >= rect.y &&
    at.x < rect.x + rect.width &&
    at.y < rect.y + rect.height
  )
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cloneCells(cells: Cells): Cells {
  return {
    columns: cells.columns,
    rows: cells.rows,
    cells: cells.cells.slice(),
  }
}

/** One tile as a brush. */
function oneTile(frame: number): Cells {
  return { columns: 1, rows: 1, cells: Int16Array.of(frame) }
}

/** Where a frame sits in a tileset `columns` tiles across, as a 1x1 rect. */
function placeOf(frame: number, columns: number): Rect {
  const across = Math.max(1, columns)
  return {
    x: frame % across,
    y: Math.floor(frame / across),
    width: 1,
    height: 1,
  }
}

/** A tileset from a sheet's pixels and flags. */
function tilesetOf(
  sheet: SheetInfo,
  pixels: Pixels,
  flagsFile: string,
  flags: FlagData,
): Tileset {
  const columns = Math.floor(pixels.width / TILE)
  const rows = Math.floor(pixels.height / TILE)
  return { sheet, pixels, columns, frames: columns * rows, flagsFile, flags }
}

/** A flags file's JSON as flags; a missing file has none. */
function readFlagsData(data: unknown): FlagData {
  return data === undefined || data === null ? {} : parseFlags(data)
}

/** What undo needs to put a step back. */
type Entry =
  | { kind: 'map'; data: MapData }
  | { kind: 'flags'; flags: FlagData }
  | { kind: 'swap'; a: number; b: number }

/** What the pointer is doing between down and up. */
type Gesture =
  | { kind: 'stroke'; last: Vec; anchor: Vec; erase: boolean }
  | { kind: 'rect'; from: Vec }
  | { kind: 'move'; last: Vec }
  | { kind: 'select'; from: Vec; moved: boolean }

/** The map editor over a project's maps, tilesets and flags. */
export function createMapEditor(options: { host: MapHost }): MapEditor {
  const { host } = options
  const listeners = new Set<() => void>()

  let state: MapEditorState = {
    maps: [],
    sheets: [],
    doc: undefined,
    tileset: undefined,
    layer: undefined,
    hidden: [],
    tool: 'brush',
    brush: oneTile(0),
    chosen: { x: 0, y: 0, width: 1, height: 1 },
    arrange: false,
    shownFlag: undefined,
    selection: undefined,
    drag: undefined,
    zoom: undefined,
    canUndo: false,
    canRedo: false,
    saving: false,
    error: undefined,
    version: 0,
  }
  let back: Entry[] = []
  let forward: Entry[] = []
  let gesture: Gesture | undefined
  let clip: Cells | undefined
  /** Bumped on every open, so a slow read for an older one is dropped. */
  let opening = 0
  /** The editor's own recent writes of each map and flags file, newest last. */
  const written = new Map<string, string[]>()
  /** The same for each sheet's pixels. */
  const drawn = new Map<string, Uint8ClampedArray[]>()
  /** What each file is known to hold, so an unchanged one is not written. */
  const onDisk = new Map<string, string>()
  /** Writes run one after another, in order. */
  let writes: Promise<void> = Promise.resolve()
  /** How many writes are queued or running. */
  let pending = 0
  let destroyed = false
  /** The scale the canvas fits the map at, which the zoom keys step from. */
  let fit = 1

  function set(patch: Partial<MapEditorState>, cells = false) {
    state = {
      ...state,
      ...patch,
      canUndo: back.length > 0,
      canRedo: forward.length > 0,
      version: cells ? state.version + 1 : (patch.version ?? state.version),
    }
    for (const listener of listeners) listener()
  }

  /** Remember `entry`, the way back from a step about to be made. */
  function push(entry: Entry) {
    back.push(entry)
    if (back.length > STEPS) back.shift()
    forward = []
  }

  /** Start an undoable step from the map as it is now. */
  function step(doc: MapDoc) {
    push({ kind: 'map', data: cloneMap(doc.data) })
  }

  const mapKey = (file: string) => `map:${file}`
  const flagsKey = (file: string) => `flags:${file}`

  function remember<T>(store: Map<string, T[]>, key: string, value: T) {
    const recent = store.get(key) ?? []
    recent.push(value)
    if (recent.length > ECHOES) recent.shift()
    store.set(key, recent)
  }

  /**
   * Whether `value` is one of the editor's own writes coming back. Writes
   * land in order, so the ones before it are done with too, and the same
   * content arriving later from elsewhere counts as a change.
   */
  function isEcho<T>(
    store: Map<string, T[]>,
    key: string,
    same: (a: T) => boolean,
  ): boolean {
    const recent = store.get(key) ?? []
    const echo = recent.findIndex(same)
    if (echo === -1) return false
    recent.splice(0, echo + 1)
    return true
  }

  /** Queue a write, keeping `saving` true until the queue is empty. */
  function queue(what: string, write: () => Promise<void>): Promise<void> {
    pending++
    if (!state.saving) set({ saving: true })
    writes = writes.then(async () => {
      try {
        await write()
      } catch (error) {
        if (!destroyed)
          set({ error: `could not save ${what}: ${message(error)}` })
      }
      pending--
      if (pending === 0 && !destroyed) set({ saving: false })
    })
    return writes
  }

  /** Write a map's text, unless the file already holds it. */
  function writeMapFile(file: string, data: MapData): Promise<void> {
    const text = writeMap(data)
    const key = mapKey(file)
    if (onDisk.get(key) === text) return writes
    onDisk.set(key, text)
    remember(written, key, text)
    return queue(file, () => host.writeMap(file, text))
  }

  /** Write the tileset's flags, unless the file already holds them. */
  function saveFlags(): Promise<void> {
    const tileset = state.tileset
    if (!tileset) return writes
    const text = writeFlags(tileset.flags)
    const file = tileset.flagsFile
    const key = flagsKey(file)
    if (onDisk.get(key) === text) return writes
    onDisk.set(key, text)
    remember(written, key, text)
    return queue(file, () => host.writeFlags(file, text))
  }

  /** Write the tileset's pixels as a PNG. */
  function savePixels(): Promise<void> {
    const tileset = state.tileset
    if (!tileset) return writes
    const { file } = tileset.sheet
    const pixels = tileset.pixels
    remember(drawn, file, pixels.data)
    return queue(file, async () =>
      host.sheets.write(file, await encodePng(pixels)),
    )
  }

  /** The current layer's cells, sharing the map's array. */
  function current(doc: MapDoc): Cells | undefined {
    const layer = state.layer
    return layer && doc.data.layers[layer]
      ? layerCells(doc.data, layer)
      : undefined
  }

  function mapRect(doc: MapDoc): Rect {
    return { x: 0, y: 0, width: doc.data.columns, height: doc.data.rows }
  }

  /** The map as shown: a lifted selection put down on a copy. */
  function shown(doc: MapDoc): MapData {
    const selection = state.selection
    const layer = state.layer
    if (!selection?.lifted || !layer || !doc.data.layers[layer]) return doc.data
    const data = cloneMap(doc.data)
    dropCells(layerCells(data, layer), selection)
    return data
  }

  /** Write the open map as shown, unless the file already holds it. */
  function save(): Promise<void> {
    const doc = state.doc
    if (!doc) return writes
    return writeMapFile(doc.info.file, shown(doc))
  }

  /** Put a lifted selection down; part of the step that lifted it. */
  function settle(doc: MapDoc) {
    const selection = state.selection
    const layer = current(doc)
    if (!selection?.lifted || !layer) return
    dropCells(layer, selection)
    set({ selection: { rect: selection.rect } }, true)
  }

  /** The layer to keep current in `data`: the same one, or the first. */
  function keepLayer(data: MapData): Partial<MapEditorState> {
    const names = Object.keys(data.layers)
    const layer =
      state.layer && names.includes(state.layer) ? state.layer : names[0]
    return {
      layer,
      hidden: state.hidden.filter((name) => names.includes(name)),
    }
  }

  /** Replace the open map's cells, keeping the current layer if it is there. */
  function replace(doc: MapDoc, data: MapData) {
    set(
      {
        doc: { ...doc, data },
        ...keepLayer(data),
        selection: undefined,
        drag: undefined,
      },
      true,
    )
  }

  // Opening.

  /** Read a tileset by its sheet's name, for a map. */
  async function readTileset(info: MapInfo, tiles: string): Promise<Tileset> {
    const sheet = state.sheets.find((s) => s.name === tiles)
    if (!sheet) throw new Error(`there is no sheet ${tiles} for its tiles`)
    if (sheet.cellWidth !== TILE || sheet.cellHeight !== TILE) {
      throw new Error(`the sheet ${tiles} does not have 8x8 cells`)
    }
    const flagsFile = info.flags ?? flagsFileFor(sheet.file)
    const [pixels, flagsData] = await Promise.all([
      host.sheets.read(sheet.file),
      host.readFlags(flagsFile),
    ])
    const flags = readFlagsData(flagsData)
    if (flagsData !== undefined && flagsData !== null) {
      onDisk.set(flagsKey(flagsFile), writeFlags(flags))
    } else {
      onDisk.delete(flagsKey(flagsFile))
    }
    return tilesetOf(sheet, pixels, flagsFile, flags)
  }

  /** Open `info`, with its cells if already in hand. */
  async function load(info: MapInfo, given?: MapData): Promise<void> {
    const token = ++opening
    const previous = state.doc
    if (previous) {
      settle(previous)
      void save()
    }
    gesture = undefined
    try {
      const data = given ?? parseMap(await host.readMap(info.file))
      if (token !== opening || destroyed) return
      onDisk.set(mapKey(info.file), writeMap(data))
      let tileset: Tileset | undefined
      let error: string | undefined
      try {
        tileset = await readTileset(info, data.tiles)
      } catch (failed) {
        error = `could not read the tileset of ${info.file}: ${message(failed)}`
      }
      if (token !== opening || destroyed) return
      back = []
      forward = []
      // The brush stays when the tileset does; another starts on tile 0.
      const same = tileset?.sheet.file === state.tileset?.sheet.file
      set(
        {
          doc: { info, data },
          tileset,
          layer: Object.keys(data.layers)[0],
          hidden: [],
          selection: undefined,
          drag: undefined,
          shownFlag:
            tileset && state.shownFlag && tileset.flags[state.shownFlag]
              ? state.shownFlag
              : undefined,
          brush: same ? state.brush : oneTile(0),
          chosen: same ? state.chosen : { x: 0, y: 0, width: 1, height: 1 },
          error,
        },
        true,
      )
    } catch (error) {
      if (token === opening && !destroyed) {
        set({ error: `could not open ${info.file}: ${message(error)}` })
      }
    }
  }

  async function open(file: string): Promise<void> {
    const info = state.maps.find((map) => map.file === file)
    if (!info) {
      set({ error: `there is no map ${file}` })
      return
    }
    await load(info)
  }

  function close() {
    opening++
    gesture = undefined
    back = []
    forward = []
    set(
      {
        doc: undefined,
        tileset: undefined,
        layer: undefined,
        hidden: [],
        selection: undefined,
        drag: undefined,
      },
      true,
    )
  }

  function listedMaps(maps: MapInfo[]) {
    set({ maps })
    const doc = state.doc
    if (doc && !maps.some((map) => map.file === doc.info.file)) close()
  }

  function listedSheets(sheets: SheetInfo[]) {
    set({ sheets })
  }

  // Outside changes.

  function mapChanged(name: string, json: unknown) {
    const doc = state.doc
    if (!doc || doc.info.name !== name) return
    let data: MapData
    try {
      data = parseMap(json)
    } catch (error) {
      set({ error: `could not read ${doc.info.file}: ${message(error)}` })
      return
    }
    // A stroke in progress wins: its write replaces the outside change.
    if (gesture) return
    const text = writeMap(data)
    const key = mapKey(doc.info.file)
    onDisk.set(key, text)
    // What the editor already shows needs no step.
    if (sameMap(shown(doc), data)) return
    if (isEcho(written, key, (write) => write === text)) return
    // The file no longer holds any write of ours.
    written.delete(key)
    if (data.tiles !== doc.data.tiles) {
      // Another tileset: start over on it.
      void load(doc.info, data)
      return
    }
    settle(doc)
    step(doc)
    replace(doc, data)
  }

  function flagsChanged(tiles: string, json: unknown) {
    const tileset = state.tileset
    if (!tileset || tileset.sheet.name !== tiles) return
    let flags: FlagData
    try {
      flags = readFlagsData(json)
    } catch (error) {
      set({ error: `could not read ${tileset.flagsFile}: ${message(error)}` })
      return
    }
    if (gesture) return
    const text = writeFlags(flags)
    const key = flagsKey(tileset.flagsFile)
    onDisk.set(key, text)
    if (sameFlags(tileset.flags, flags)) return
    if (isEcho(written, key, (write) => write === text)) return
    written.delete(key)
    push({ kind: 'flags', flags: tileset.flags })
    setFlags(flags)
  }

  async function sheetChanged(file: string) {
    if (state.tileset?.sheet.file !== file) return
    let pixels: Pixels
    try {
      pixels = await host.sheets.read(file)
    } catch (error) {
      if (!destroyed)
        set({ error: `could not read ${file}: ${message(error)}` })
      return
    }
    const tileset = state.tileset
    if (destroyed || tileset?.sheet.file !== file) return
    if (samePixels(tileset.pixels, pixels)) return
    if (isEcho(drawn, file, (data) => sameBytes(data, pixels.data))) return
    drawn.delete(file)
    set(
      {
        tileset: tilesetOf(
          tileset.sheet,
          pixels,
          tileset.flagsFile,
          tileset.flags,
        ),
      },
      true,
    )
  }

  // Pointer.

  function pointerDown(at: Vec) {
    const doc = state.doc
    if (!doc || gesture) return
    const layer = current(doc)
    if (!layer) return
    switch (state.tool) {
      case 'brush':
      case 'eraser': {
        const erase = state.tool === 'eraser'
        step(doc)
        if (erase) eraseLine(layer, { from: at, to: at })
        else
          stampLine(layer, { from: at, to: at, anchor: at, brush: state.brush })
        gesture = { kind: 'stroke', last: at, anchor: at, erase }
        set({}, true)
        return
      }
      case 'fill': {
        const before = cloneMap(doc.data)
        if (!fillCells(layer, { at, brush: state.brush })) return
        push({ kind: 'map', data: before })
        set({}, true)
        void save()
        return
      }
      case 'pick':
        pickAt(at)
        return
      case 'rect':
        gesture = { kind: 'rect', from: at }
        set({ drag: { from: at, to: at } })
        return
      case 'select': {
        const selection = state.selection
        if (selection && inside(selection.rect, at)) {
          if (!selection.lifted) {
            step(doc)
            set({ selection: liftCells(layer, selection.rect) }, true)
          }
          gesture = { kind: 'move', last: at }
          return
        }
        settle(doc)
        void save()
        gesture = { kind: 'select', from: at, moved: false }
        set({ selection: { rect: cellsBetween(at, at, mapRect(doc)) } })
        return
      }
    }
  }

  function pointerMove(at: Vec) {
    const doc = state.doc
    if (!doc || !gesture) return
    switch (gesture.kind) {
      case 'stroke': {
        const layer = current(doc)
        if (!layer) return
        const from = gesture.last
        if (gesture.erase) eraseLine(layer, { from, to: at })
        else
          stampLine(layer, {
            from,
            to: at,
            anchor: gesture.anchor,
            brush: state.brush,
          })
        gesture.last = at
        set({}, true)
        return
      }
      case 'rect':
        set({ drag: { from: gesture.from, to: at } })
        return
      case 'move': {
        const by = { x: at.x - gesture.last.x, y: at.y - gesture.last.y }
        gesture.last = at
        if ((by.x === 0 && by.y === 0) || !state.selection) return
        set({ selection: moveCellSelection(state.selection, by) }, true)
        return
      }
      case 'select':
        if (at.x !== gesture.from.x || at.y !== gesture.from.y) {
          gesture.moved = true
        }
        set({
          selection: { rect: cellsBetween(gesture.from, at, mapRect(doc)) },
        })
        return
    }
  }

  function pointerUp(at: Vec) {
    const doc = state.doc
    if (!doc || !gesture) return
    pointerMove(at)
    const ended = gesture
    gesture = undefined
    switch (ended.kind) {
      case 'stroke':
      case 'move':
        void save()
        return
      case 'rect': {
        const layer = current(doc)
        if (!layer) return
        step(doc)
        rectCells(layer, { from: ended.from, to: at, brush: state.brush })
        set({ drag: undefined }, true)
        void save()
        return
      }
      case 'select': {
        const rect = state.selection?.rect
        // A click with no drag, or a drag off the map, selects nothing.
        if (!ended.moved || !rect || rect.width === 0 || rect.height === 0) {
          set({ selection: undefined })
        }
        return
      }
    }
  }

  function pickAt(at: Vec) {
    const doc = state.doc
    if (!doc || !state.layer || !doc.data.layers[state.layer]) return
    const frame = pickCell(layerCells(shown(doc), state.layer), at)
    if (frame === undefined) return
    set({
      brush: oneTile(frame),
      chosen: placeOf(frame, state.tileset?.columns ?? 1),
    })
  }

  // History.

  function setFlags(flags: FlagData) {
    const tileset = state.tileset
    if (!tileset) return
    const shownFlag =
      state.shownFlag && flags[state.shownFlag] ? state.shownFlag : undefined
    set({ tileset: { ...tileset, flags }, shownFlag }, true)
    void saveFlags()
  }

  function travel(doc: MapDoc, isUndo: boolean) {
    const from = isUndo ? back : forward
    const to = isUndo ? forward : back
    const entry = from.pop()
    if (!entry) return
    settle(doc)
    const open = state.doc ?? doc
    switch (entry.kind) {
      case 'map':
        to.push({ kind: 'map', data: cloneMap(open.data) })
        replace(open, entry.data)
        void save()
        return
      case 'flags': {
        const tileset = state.tileset
        if (!tileset) return
        to.push({ kind: 'flags', flags: tileset.flags })
        setFlags(entry.flags)
        return
      }
      case 'swap':
        to.push(entry)
        set({ selection: undefined })
        void swapEverywhere(entry.a, entry.b)
        return
    }
  }

  /**
   * Swap two tiles in the PNG, the flags, the open map and every other map
   * on the tileset, writing each file that changes. False when it could not.
   */
  async function swapEverywhere(a: number, b: number): Promise<boolean> {
    const doc = state.doc
    const tileset = state.tileset
    if (!doc || !tileset) return false
    const token = opening
    const others = state.maps.filter(
      (map) => map.tiles === tileset.sheet.name && map.file !== doc.info.file,
    )
    let read: MapData[]
    try {
      read = await Promise.all(
        others.map(async (map) => parseMap(await host.readMap(map.file))),
      )
    } catch (error) {
      if (!destroyed)
        set({ error: `could not swap tiles ${a} and ${b}: ${message(error)}` })
      return false
    }
    const open = state.doc
    const now = state.tileset
    if (destroyed || token !== opening || !open || !now) return false
    settle(open)
    let swapped: ReturnType<typeof swapTiles>
    try {
      swapped = swapTiles({
        a,
        b,
        pixels: now.pixels,
        flags: now.flags,
        maps: [open.data, ...read],
      })
    } catch (error) {
      set({ error: `could not swap tiles ${a} and ${b}: ${message(error)}` })
      return false
    }
    const [mine, ...theirs] = swapped.maps
    const flagsChanged = !sameFlags(now.flags, swapped.flags)
    set(
      {
        doc: { ...open, data: mine ?? open.data },
        tileset: { ...now, pixels: swapped.pixels, flags: swapped.flags },
        selection: undefined,
      },
      true,
    )
    void savePixels()
    if (flagsChanged) void saveFlags()
    void save()
    for (const [index, map] of others.entries()) {
      const data = theirs[index]
      if (data && !sameMap(read[index]!, data)) {
        onDisk.set(mapKey(map.file), writeMap(read[index]!))
        void writeMapFile(map.file, data)
      }
    }
    return true
  }

  // Actions.

  function zoomStep(by: 1 | -1) {
    // From fit, step from the scale the canvas fitted.
    const zoom = state.zoom ?? fit
    const next =
      by === 1
        ? (MAP_ZOOMS.find((z) => z > zoom) ?? MAP_ZOOMS[MAP_ZOOMS.length - 1])
        : ([...MAP_ZOOMS].reverse().find((z) => z < zoom) ?? MAP_ZOOMS[0])
    set({ zoom: next })
  }

  function shiftLayer(by: -1 | 1) {
    const doc = state.doc
    if (!doc) return
    const names = Object.keys(doc.data.layers)
    const index = state.layer ? names.indexOf(state.layer) : 0
    const next = names[Math.max(0, Math.min(names.length - 1, index + by))]
    if (next) setLayer(next)
  }

  function act(action: MapActionName) {
    if (gesture) return
    switch (action) {
      case 'zoomIn':
        return zoomStep(1)
      case 'zoomOut':
        return zoomStep(-1)
      case 'zoomFit':
        return set({ zoom: undefined })
    }
    const doc = state.doc
    if (!doc) return
    const selection = state.selection
    switch (action) {
      case 'undo':
        return travel(doc, true)
      case 'redo':
        return travel(doc, false)
      case 'copy': {
        const layer = current(doc)
        if (!selection || !layer) return
        clip = selection.lifted
          ? cloneCells(selection.lifted)
          : copyCells(layer, selection.rect)
        return
      }
      case 'cut':
        act('copy')
        act('clear')
        return
      case 'paste': {
        if (!clip || !current(doc)) return
        settle(doc)
        step(doc)
        set(
          { selection: pasteCells(clip, { x: 0, y: 0 }), tool: 'select' },
          true,
        )
        void save()
        return
      }
      case 'clear': {
        const layer = current(doc)
        if (!selection || !layer) return
        if (selection.lifted) {
          set({ selection: { rect: selection.rect } }, true)
        } else {
          step(doc)
          liftCells(layer, selection.rect)
          set({}, true)
        }
        void save()
        return
      }
      case 'deselect':
        settle(doc)
        set({ selection: undefined })
        void save()
        return
      case 'prevLayer':
        return shiftLayer(-1)
      case 'nextLayer':
        return shiftLayer(1)
    }
  }

  function setTool(tool: MapToolName) {
    if (gesture) return
    if (tool !== 'select' && state.doc) {
      settle(state.doc)
      void save()
      set({ tool, selection: undefined })
      return
    }
    set({ tool })
  }

  function setLayer(name: string) {
    const doc = state.doc
    if (!doc || gesture || name === state.layer || !doc.data.layers[name]) {
      return
    }
    settle(doc)
    void save()
    set({ layer: name, selection: undefined })
  }

  /** A change to the map's layers as one step, then written. */
  function relayer(
    doc: MapDoc,
    change: (data: MapData) => MapData,
    patch: (data: MapData) => Partial<MapEditorState> = () => ({}),
  ) {
    settle(doc)
    const before = state.doc ?? doc
    step(before)
    const data = change(before.data)
    set(
      {
        doc: { ...before, data },
        ...keepLayer(data),
        selection: undefined,
        ...patch(data),
      },
      true,
    )
    void save()
  }

  // Flags.

  /** The frames of the chosen block in the tileset. */
  function chosenFrames(tileset: Tileset): number[] {
    const { x, y, width, height } = state.chosen
    const frames: number[] = []
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) {
        const frame = row * tileset.columns + column
        if (column < tileset.columns && frame < tileset.frames) {
          frames.push(frame)
        }
      }
    }
    return frames
  }

  /** A change to the flags as one step, then written. */
  function reflag(change: (flags: FlagData) => FlagData) {
    const tileset = state.tileset
    if (!tileset || gesture) return
    const flags = change(tileset.flags)
    if (sameFlags(flags, tileset.flags)) return
    push({ kind: 'flags', flags: tileset.flags })
    setFlags(flags)
  }

  // Maps.

  async function newMap(map: NewMap): Promise<string | undefined> {
    const { name, tiles, layer, columns, rows } = map
    if (!MAP_NAME.test(name)) return NAME_RULE
    const file = mapFile(name)
    if (state.maps.some((m) => m.name === name || m.file === file)) {
      return `a map named ${name} already exists`
    }
    if (
      !Number.isInteger(columns) ||
      !Number.isInteger(rows) ||
      columns < 1 ||
      rows < 1
    ) {
      return 'a map is at least one cell across and down'
    }
    const sheet = state.sheets.find((s) => s.name === tiles)
    if (!sheet) return `there is no sheet named ${tiles}`
    if (sheet.cellWidth !== TILE || sheet.cellHeight !== TILE) {
      return `a tileset needs 8x8 cells, and ${tiles} has ${sheet.cellWidth}x${sheet.cellHeight}`
    }
    const problem = layerNameProblem(
      { tiles, columns, rows, layers: {} },
      layer,
    )
    if (problem) return problem
    const data = newMapData({ tiles, layer, columns, rows })
    const text = writeMap(data)
    try {
      await host.writeMap(file, text)
    } catch (error) {
      return message(error)
    }
    if (destroyed) return undefined
    onDisk.set(mapKey(file), text)
    remember(written, mapKey(file), text)
    const flags = state.maps.find((m) => m.tiles === tiles && m.flags)?.flags
    const info: MapInfo = flags
      ? { file, name, tiles, flags }
      : { file, name, tiles }
    const maps = state.maps.some((m) => m.file === file)
      ? state.maps
      : [...state.maps, info].sort((a, b) => a.name.localeCompare(b.name))
    set({ maps })
    await load(info, data)
    return undefined
  }

  async function resize(size: CellCount): Promise<void> {
    const doc = state.doc
    if (!doc || gesture) return
    if (size.columns === doc.data.columns && size.rows === doc.data.rows) return
    relayer(doc, (data) => resizeMap(data, size))
    await writes
  }

  const stops = [
    host.onMapChange(mapChanged),
    host.onFlagsChange(flagsChanged),
    host.onMapList(listedMaps),
    host.sheets.onList(listedSheets),
    host.sheets.onChange((file) => void sheetChanged(file)),
  ]
  void Promise.all([host.listMaps(), host.sheets.list()])
    .then(([maps, sheets]) => {
      if (destroyed) return
      listedSheets(sheets)
      listedMaps(maps)
      // Start on the first map, so the tab is never empty when it need not be.
      const first = maps[0]
      if (!state.doc && first && opening === 0) void load(first)
    })
    .catch((error: unknown) => {
      if (!destroyed)
        set({ error: `could not list the maps: ${message(error)}` })
    })

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    open,
    setTool,
    setLayer,
    toggleLayer(name) {
      const hidden = state.hidden.includes(name)
        ? state.hidden.filter((layer) => layer !== name)
        : [...state.hidden, name]
      set({ hidden })
    },
    addLayer(name) {
      const doc = state.doc
      if (!doc || gesture) return 'there is no map open'
      const problem = layerNameProblem(doc.data, name)
      if (problem) return problem
      relayer(
        doc,
        (data) => addLayer(data, name),
        () => ({ layer: name }),
      )
      return undefined
    },
    renameLayer(from, to) {
      const doc = state.doc
      if (!doc || gesture) return 'there is no map open'
      if (!doc.data.layers[from]) return `there is no layer ${from}`
      if (from === to) return undefined
      const problem = layerNameProblem(doc.data, to, from)
      if (problem) return problem
      const layer = state.layer === from ? to : state.layer
      const hidden = state.hidden.map((name) => (name === from ? to : name))
      relayer(
        doc,
        (data) => renameLayer(data, from, to),
        () => ({ layer, hidden }),
      )
      return undefined
    },
    removeLayer(name) {
      const doc = state.doc
      if (!doc || gesture || !doc.data.layers[name]) return
      const names = Object.keys(doc.data.layers)
      if (names.length < 2) return
      const index = names.indexOf(name)
      relayer(
        doc,
        (data) => removeLayer(data, name),
        (data) => {
          if (state.layer !== name) return {}
          const left = Object.keys(data.layers)
          return { layer: left[Math.min(index, left.length - 1)] }
        },
      )
    },
    moveLayer(name, by) {
      const doc = state.doc
      if (!doc || gesture || !doc.data.layers[name]) return
      const names = Object.keys(doc.data.layers)
      const to = names.indexOf(name) + by
      if (to < 0 || to >= names.length) return
      relayer(doc, (data) => moveLayer(data, name, by))
    },
    chooseTiles(rect) {
      const tileset = state.tileset
      if (!tileset) return
      const rows = Math.ceil(tileset.frames / Math.max(1, tileset.columns))
      const x = Math.max(0, Math.min(rect.x, tileset.columns - 1))
      const y = Math.max(0, Math.min(rect.y, rows - 1))
      const width = Math.max(1, Math.min(rect.width, tileset.columns - x))
      const height = Math.max(1, Math.min(rect.height, rows - y))
      const cells = new Int16Array(width * height)
      for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
          cells[row * width + column] = (y + row) * tileset.columns + x + column
        }
      }
      // Choosing tiles is choosing to paint with them.
      if (state.tool === 'eraser' || state.tool === 'pick') setTool('brush')
      set({
        brush: { columns: width, rows: height, cells },
        chosen: { x, y, width, height },
      })
    },
    setArrange(arrange) {
      set({ arrange })
    },
    async swapTiles(a, b) {
      if (a === b || gesture || !state.doc || !state.tileset) return
      if (await swapEverywhere(a, b)) {
        push({ kind: 'swap', a, b })
        set({})
      }
    },
    showFlag(flag) {
      set({ shownFlag: flag })
    },
    setFlag(flag, on) {
      const tileset = state.tileset
      if (!tileset?.flags[flag]) return
      const frames = chosenFrames(tileset)
      reflag((flags) => setFlag(flags, { flag, frames, on }))
    },
    addFlag(name) {
      const tileset = state.tileset
      if (!tileset) return 'there is no tileset open'
      const problem = flagNameProblem(tileset.flags, name)
      if (problem) return problem
      reflag((flags) => addFlag(flags, name))
      return undefined
    },
    renameFlag(from, to) {
      const tileset = state.tileset
      if (!tileset) return 'there is no tileset open'
      if (!tileset.flags[from]) return `there is no flag ${from}`
      if (from === to) return undefined
      const problem = flagNameProblem(tileset.flags, to, from)
      if (problem) return problem
      const follows = state.shownFlag === from
      reflag((flags) => renameFlag(flags, from, to))
      if (follows) set({ shownFlag: to })
      return undefined
    },
    removeFlag(name) {
      const tileset = state.tileset
      if (!tileset?.flags[name]) return
      reflag((flags) => removeFlag(flags, name))
    },
    pointerDown,
    pointerMove,
    pointerUp,
    pickAt,
    setZoom(zoom) {
      set({ zoom })
    },
    setFit(scale) {
      fit = scale
    },
    act,
    key(name) {
      const command = MAP_SHORTCUTS[name]
      if (!command) return false
      if ((MAP_TOOLS as readonly string[]).includes(command)) {
        setTool(command as MapToolName)
      } else {
        act(command as MapActionName)
      }
      return true
    },
    newMap,
    resize,
    destroy() {
      destroyed = true
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
