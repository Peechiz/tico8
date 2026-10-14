import { TRANSPARENT } from '../sprites.ts'
import {
  blankImage,
  cloneImage,
  createHistory,
  openSheet,
  resizeImage,
  toRgba,
} from './image.ts'
import { encodePng } from './png.ts'
import {
  copyRect,
  drop,
  flipped,
  lift,
  moveSelection,
  paste,
  rotated,
} from './selection.ts'
import {
  drawRect,
  fillArea,
  pickColor,
  rectBetween,
  strokeLine,
} from './tools.ts'
import {
  type ActionName,
  type CellCount,
  type Clip,
  type Editor,
  type EditorState,
  type FileHost,
  type History,
  type IndexedImage,
  type NewSheet,
  type Pixels,
  type Rect,
  type Rgb,
  SHORTCUTS,
  type SheetDoc,
  type SheetInfo,
  TOOLS,
  type ToolName,
  type Vec,
  type Zoom,
} from './types.ts'

/** A key event as `SHORTCUTS` spells it: `mod+shift+z`, `delete`, `p`. */
export function keyName(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): string {
  let name = event.key.toLowerCase()
  if (event.shiftKey) name = `shift+${name}`
  if (event.ctrlKey || event.metaKey) name = `mod+${name}`
  return name
}

/** The file name a new sheet is saved as: `hero.16.png`, `wall.png`. */
export function sheetFile(sheet: {
  name: string
  cellWidth: number
  cellHeight: number
}): string {
  const { name, cellWidth, cellHeight } = sheet
  if (cellWidth === 8 && cellHeight === 8) return `${name}.png`
  if (cellWidth === cellHeight) return `${name}.${cellWidth}.png`
  return `${name}.${cellWidth}x${cellHeight}.png`
}

/** How many recent writes of a file count as its echo. */
const ECHOES = 4

function sameBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
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

/** What the pointer is doing between down and up. */
type Gesture =
  | { kind: 'stroke'; last: Vec; color: number }
  | { kind: 'shape'; tool: 'line' | 'rect'; from: Vec }
  | { kind: 'move'; last: Vec }
  | { kind: 'select'; from: Vec; moved: boolean }

/** The sprite editor over a project's files, painting in its palette. */
export function createEditor(options: {
  host: FileHost
  palette: readonly Rgb[]
}): Editor {
  const { host, palette } = options
  const listeners = new Set<() => void>()

  let state: EditorState = {
    sheets: [],
    doc: undefined,
    cell: { x: 0, y: 0 },
    zoom: 1,
    tool: 'pencil',
    color: palette.length > 7 ? 7 : Math.max(0, palette.length - 1),
    filled: false,
    selection: undefined,
    drag: undefined,
    canUndo: false,
    canRedo: false,
    error: undefined,
    version: 0,
  }
  let history: History = createHistory()
  let gesture: Gesture | undefined
  let clip: Clip | undefined
  /** Bumped on every open, so a slow read for an older one is dropped. */
  let opening = 0
  /** The editor's own recent writes to each file, newest last: its echoes. */
  const written = new Map<string, Uint8ClampedArray[]>()
  /** What each file is known to hold, so an unchanged sheet is not written. */
  const onDisk = new Map<string, Uint8ClampedArray>()
  /** Writes run one after another, in order. */
  let writes: Promise<void> = Promise.resolve()
  let destroyed = false

  function set(patch: Partial<EditorState>, pixels = false) {
    state = {
      ...state,
      ...patch,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      version: pixels ? state.version + 1 : (patch.version ?? state.version),
    }
    for (const listener of listeners) listener()
  }

  /** The whole sheet as a rect. */
  function sheetRect(doc: SheetDoc): Rect {
    return { x: 0, y: 0, width: doc.image.width, height: doc.image.height }
  }

  /** The cell `cell` moved so the painting area stays inside the sheet. */
  function clampCell(doc: SheetDoc | undefined, cell: Vec, zoom: Zoom): Vec {
    if (!doc) return { x: 0, y: 0 }
    const columns = Math.floor(doc.image.width / doc.info.cellWidth)
    const rows = Math.floor(doc.image.height / doc.info.cellHeight)
    const x = Math.round(cell.x)
    const y = Math.round(cell.y)
    return {
      x: Math.max(0, Math.min(x, columns - zoom)),
      y: Math.max(0, Math.min(y, rows - zoom)),
    }
  }

  /** The painting area in sheet pixels, cut to the sheet. */
  function area(doc: SheetDoc): Rect {
    const { cellWidth, cellHeight } = doc.info
    const x = state.cell.x * cellWidth
    const y = state.cell.y * cellHeight
    return {
      x,
      y,
      width: Math.max(0, Math.min(state.zoom * cellWidth, doc.image.width - x)),
      height: Math.max(
        0,
        Math.min(state.zoom * cellHeight, doc.image.height - y),
      ),
    }
  }

  /** The image as shown: a lifted selection put down on a copy. */
  function shown(doc: SheetDoc): IndexedImage {
    const lifted = state.selection?.lifted
    if (!lifted || !state.selection) return doc.image
    const image = cloneImage(doc.image)
    drop(image, state.selection)
    return image
  }

  /** Write the sheet as shown, unless the file already holds it. */
  function save(): Promise<void> {
    const doc = state.doc
    if (!doc) return writes
    const rgba = toRgba({ ...doc, image: shown(doc) })
    const file = doc.info.file
    const last = onDisk.get(file)
    if (last && sameBytes(last, rgba.data)) return writes
    onDisk.set(file, rgba.data)
    remember(file, rgba.data)
    writes = writes.then(async () => {
      try {
        await host.write(file, await encodePng(rgba))
      } catch (error) {
        if (!destroyed)
          set({ error: `could not save ${file}: ${message(error)}` })
      }
    })
    return writes
  }

  function remember(file: string, data: Uint8ClampedArray) {
    const recent = written.get(file) ?? []
    recent.push(data)
    if (recent.length > ECHOES) recent.shift()
    written.set(file, recent)
  }

  /** Put a lifted selection down; part of the step that lifted it. */
  function settle(doc: SheetDoc) {
    const selection = state.selection
    if (!selection?.lifted) return
    drop(doc.image, selection)
    set({ selection: { rect: selection.rect } }, true)
  }

  /** Start an undoable step from the image as it is now. */
  function step(doc: SheetDoc) {
    history.push(doc.image)
  }

  /** Make `doc` the open sheet, with a fresh history. */
  function show(doc: SheetDoc) {
    history = createHistory()
    gesture = undefined
    const cell = clampCell(doc, { x: 0, y: 0 }, state.zoom)
    set(
      {
        doc,
        cell,
        selection: undefined,
        drag: undefined,
        error: undefined,
      },
      true,
    )
  }

  async function open(file: string): Promise<void> {
    const token = ++opening
    const previous = state.doc
    if (previous) {
      settle(previous)
      void save()
    }
    const info = state.sheets.find((sheet) => sheet.file === file)
    if (!info) {
      set({ error: `there is no sheet ${file}` })
      return
    }
    try {
      const pixels = await host.read(file)
      if (token !== opening || destroyed) return
      const doc = openSheet({ info, pixels, palette })
      onDisk.set(file, toRgba(doc).data)
      show(doc)
    } catch (error) {
      if (token === opening && !destroyed) {
        set({ error: `could not open ${file}: ${message(error)}` })
      }
    }
  }

  function close() {
    opening++
    gesture = undefined
    history = createHistory()
    set(
      {
        doc: undefined,
        selection: undefined,
        drag: undefined,
        cell: { x: 0, y: 0 },
      },
      true,
    )
  }

  function listed(sheets: SheetInfo[]) {
    set({ sheets })
    const doc = state.doc
    if (doc && !sheets.some((sheet) => sheet.file === doc.info.file)) close()
  }

  async function changed(file: string) {
    if (state.doc?.info.file !== file) return
    let pixels: Pixels
    try {
      pixels = await host.read(file)
    } catch (error) {
      if (!destroyed)
        set({ error: `could not read ${file}: ${message(error)}` })
      return
    }
    const doc = state.doc
    // A stroke in progress wins: its write replaces the outside change.
    if (destroyed || doc?.info.file !== file || gesture) return
    onDisk.set(file, pixels.data)
    // What the editor already shows needs no step.
    if (sameBytes(toRgba({ ...doc, image: shown(doc) }).data, pixels.data))
      return
    // One of the editor's own writes coming back. Writes land in order, so
    // the ones before it are done with too, and the same pixels arriving
    // later from elsewhere count as a change.
    const recent = written.get(file) ?? []
    const echo = recent.findIndex((data) => sameBytes(data, pixels.data))
    if (echo !== -1) {
      recent.splice(0, echo + 1)
      return
    }
    settle(doc)
    // The file no longer holds any write of ours.
    written.delete(file)
    // Read with the current colours first, so their indices stay put and
    // the colours only grow.
    const fresh = openSheet({ info: doc.info, pixels, palette: doc.colors })
    step(doc)
    const next: SheetDoc = {
      ...doc,
      image: fresh.image,
      colors: fresh.colors,
    }
    set(
      {
        doc: next,
        selection: undefined,
        cell: clampCell(next, state.cell, state.zoom),
      },
      true,
    )
  }

  // Pointer.

  function pointerDown(at: Vec) {
    const doc = state.doc
    if (!doc || gesture) return
    const clipRect = area(doc)
    switch (state.tool) {
      case 'pencil':
      case 'eraser': {
        const color = state.tool === 'eraser' ? TRANSPARENT : state.color
        step(doc)
        strokeLine(doc.image, { from: at, to: at, color, clip: clipRect })
        gesture = { kind: 'stroke', last: at, color }
        set({}, true)
        return
      }
      case 'fill': {
        if (!inside(clipRect, at)) return
        if (pickColor(doc.image, at) === state.color) return
        step(doc)
        fillArea(doc.image, { at, color: state.color, clip: clipRect })
        set({}, true)
        void save()
        return
      }
      case 'pick': {
        const color = pickColor(doc.image, at)
        if (color !== undefined && color !== TRANSPARENT) set({ color })
        return
      }
      case 'line':
      case 'rect':
        gesture = { kind: 'shape', tool: state.tool, from: at }
        set({ drag: { from: at, to: at } })
        return
      case 'select': {
        const selection = state.selection
        if (selection && inside(selection.rect, at)) {
          if (!selection.lifted) {
            step(doc)
            set({ selection: lift(doc.image, selection.rect) }, true)
          }
          gesture = { kind: 'move', last: at }
          return
        }
        settle(doc)
        void save()
        gesture = { kind: 'select', from: at, moved: false }
        set({ selection: { rect: rectBetween(at, at, sheetRect(doc)) } })
        return
      }
    }
  }

  function pointerMove(at: Vec) {
    const doc = state.doc
    if (!doc || !gesture) return
    switch (gesture.kind) {
      case 'stroke':
        strokeLine(doc.image, {
          from: gesture.last,
          to: at,
          color: gesture.color,
          clip: area(doc),
        })
        gesture.last = at
        set({}, true)
        return
      case 'shape':
        set({ drag: { from: gesture.from, to: at } })
        return
      case 'move': {
        const by = { x: at.x - gesture.last.x, y: at.y - gesture.last.y }
        gesture.last = at
        if ((by.x === 0 && by.y === 0) || !state.selection) return
        set({ selection: moveSelection(state.selection, by) }, true)
        return
      }
      case 'select':
        if (at.x !== gesture.from.x || at.y !== gesture.from.y) {
          gesture.moved = true
        }
        set({
          selection: { rect: rectBetween(gesture.from, at, sheetRect(doc)) },
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
      case 'shape': {
        step(doc)
        const shape = {
          from: ended.from,
          to: at,
          color: state.color,
          clip: area(doc),
        }
        if (ended.tool === 'line') strokeLine(doc.image, shape)
        else drawRect(doc.image, { ...shape, filled: state.filled })
        set({ drag: undefined }, true)
        void save()
        return
      }
      case 'select': {
        const rect = state.selection?.rect
        // A click with no drag, or a drag off the sheet, selects nothing.
        if (!ended.moved || !rect || rect.width === 0 || rect.height === 0) {
          set({ selection: undefined })
        }
        return
      }
    }
  }

  // Actions.

  /** Replace pixels of `rect` in the image with `pixels`. */
  function paint(image: IndexedImage, rect: Rect, pixels: IndexedImage) {
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        image.pixels[(rect.y + y) * image.width + rect.x + x] =
          pixels.pixels[y * pixels.width + x]!
      }
    }
  }

  function turn(
    doc: SheetDoc,
    how: (image: IndexedImage) => IndexedImage | undefined,
  ) {
    const selection = state.selection
    const rect = selection?.rect ?? area(doc)
    const result = how(selection?.lifted ?? copyRect(doc.image, rect))
    if (!result) {
      set({
        error: `only a square ${selection ? 'selection' : 'area'} can rotate`,
      })
      return
    }
    if (selection) {
      // Lifting is the step; turning lifted pixels is part of it.
      if (!selection.lifted) step(doc)
      const lifted = selection.lifted ? selection : lift(doc.image, rect)
      set({ selection: { ...lifted, lifted: result } }, true)
    } else {
      step(doc)
      paint(doc.image, rect, result)
      set({}, true)
    }
    void save()
  }

  function travel(doc: SheetDoc, back: boolean) {
    const current = shown(doc)
    const image = back ? history.undo(current) : history.redo(current)
    if (!image) return
    const next = { ...doc, image }
    set(
      {
        doc: next,
        selection: undefined,
        cell: clampCell(next, state.cell, state.zoom),
      },
      true,
    )
    void save()
  }

  function act(action: ActionName) {
    const doc = state.doc
    if (!doc || gesture) return
    const selection = state.selection
    switch (action) {
      case 'undo':
        return travel(doc, true)
      case 'redo':
        return travel(doc, false)
      case 'copy':
        clip = selection?.lifted
          ? cloneImage(selection.lifted)
          : copyRect(doc.image, selection?.rect ?? area(doc))
        return
      case 'cut':
        act('copy')
        act('clear')
        if (!selection) {
          step(doc)
          const rect = area(doc)
          paint(doc.image, rect, blankImage(rect))
          set({}, true)
          void save()
        }
        return
      case 'paste': {
        if (!clip) return
        settle(doc)
        step(doc)
        const { x, y } = area(doc)
        set({ selection: paste(clip, { x, y }), tool: 'select' }, true)
        void save()
        return
      }
      case 'flipX':
        return turn(doc, (image) => flipped(image, 'x'))
      case 'flipY':
        return turn(doc, (image) => flipped(image, 'y'))
      case 'rotate':
        return turn(doc, rotated)
      case 'clear':
        if (!selection) return
        if (selection.lifted) {
          set({ selection: { rect: selection.rect } }, true)
        } else {
          step(doc)
          lift(doc.image, selection.rect)
          set({}, true)
        }
        void save()
        return
      case 'deselect':
        settle(doc)
        set({ selection: undefined })
        void save()
        return
    }
  }

  function setTool(tool: ToolName) {
    if (gesture) return
    if (tool !== 'select' && state.doc) {
      settle(state.doc)
      void save()
      set({ tool, selection: undefined })
      return
    }
    set({ tool })
  }

  async function newSheet(sheet: NewSheet): Promise<string | undefined> {
    const { name, cellWidth, cellHeight, columns, rows } = sheet
    const file = sheetFile(sheet)
    if (state.sheets.some((s) => s.name === name || s.file === file)) {
      return `a sheet named ${name} already exists`
    }
    const image = blankImage({
      width: columns * cellWidth,
      height: rows * cellHeight,
    })
    const info: SheetInfo = {
      file,
      name,
      url: `/sprites/${encodeURIComponent(file)}`,
      cellWidth,
      cellHeight,
    }
    const doc: SheetDoc = {
      info,
      image,
      colors: [...palette],
      paletteSize: palette.length,
    }
    const rgba = toRgba(doc)
    try {
      await host.write(file, await encodePng(rgba))
    } catch (error) {
      return message(error)
    }
    if (destroyed) return undefined
    onDisk.set(file, rgba.data)
    remember(file, rgba.data)
    if (state.doc) {
      settle(state.doc)
      void save()
    }
    opening++
    const sheets = state.sheets.some((s) => s.file === file)
      ? state.sheets
      : [...state.sheets, info].sort((a, b) => a.name.localeCompare(b.name))
    set({ sheets })
    show(doc)
    return undefined
  }

  async function resize(size: CellCount): Promise<void> {
    const doc = state.doc
    if (!doc || gesture) return
    settle(doc)
    step(doc)
    const image = resizeImage(doc.image, { ...size, ...doc.info })
    const next = { ...doc, image }
    set(
      {
        doc: next,
        selection: undefined,
        cell: clampCell(next, state.cell, state.zoom),
      },
      true,
    )
    await save()
  }

  const stopChange = host.onChange((file) => void changed(file))
  const stopList = host.onList(listed)
  void host
    .list()
    .then((sheets) => {
      if (destroyed) return
      listed(sheets)
      // Start on the first sheet, so the tab is never empty when it need not be.
      const first = sheets[0]
      if (!state.doc && first && opening === 0) void open(first.file)
    })
    .catch((error: unknown) => {
      if (!destroyed)
        set({ error: `could not list the sheets: ${message(error)}` })
    })

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    open,
    pickCell(cell) {
      set({ cell: clampCell(state.doc, cell, state.zoom) })
    },
    setZoom(zoom) {
      set({ zoom, cell: clampCell(state.doc, state.cell, zoom) })
    },
    setTool,
    setColor(color) {
      set({ color })
    },
    setFilled(filled) {
      set({ filled })
    },
    pointerDown,
    pointerMove,
    pointerUp,
    act,
    key(name) {
      const command = SHORTCUTS[name]
      if (!command) return false
      if ((TOOLS as readonly string[]).includes(command)) {
        setTool(command as ToolName)
      } else {
        act(command as ActionName)
      }
      return true
    },
    newSheet,
    resize,
    destroy() {
      destroyed = true
      stopChange()
      stopList()
      listeners.clear()
    },
  }
}
