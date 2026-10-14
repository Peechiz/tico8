// The sprite editor's shared types. The editor reaches files only through a
// `FileHost`, and the UI reaches the sheet only through an `Editor`.
import type { ComponentChildren } from 'preact'
import type { Pixels } from '../assets/sheets.ts'
import type { Rgb } from '../palette.ts'
import type { Rect } from '../shapes.ts'
import type { IndexedImage } from '../sprites.ts'
import type { Vec } from '../vec.ts'

export type { IndexedImage, Pixels, Rect, Rgb, Vec }

/** A sheet in the project's sprites folder. */
export interface SheetInfo {
  /** The file name inside the sprites folder: `player.16.png`. */
  file: string
  /** The name game code imports it by: `player`. */
  name: string
  /** The address the page loads it from: `/sprites/player.16.png`. */
  url: string
  cellWidth: number
  cellHeight: number
}

/** Everything the editor knows of the project's files. */
export interface FileHost {
  /** The sheets in the sprites folder, sorted by name. */
  list(): Promise<SheetInfo[]>
  /** A sheet's pixels as stored. */
  read(file: string): Promise<Pixels>
  /** Write a sheet's PNG bytes, making the file if it is new. */
  write(file: string, bytes: Uint8Array): Promise<void>
  /** Hear of a sheet whose file has new content, by its file name. */
  onChange(listener: (file: string) => void): () => void
  /** Hear of the sprites folder's list of sheets changing. */
  onList(listener: (sheets: SheetInfo[]) => void): () => void
}

/** An open sheet, as colour indices. */
export interface SheetDoc {
  info: SheetInfo
  /** Pixels as indices into `colors`, or `TRANSPARENT`. Edited in place. */
  image: IndexedImage
  /**
   * Every colour an index can name: the palette, then colours the sheet
   * uses from outside it. Only ever grows while the sheet is open.
   */
  colors: Rgb[]
  /** How many of `colors`, from the start, are the palette. */
  paletteSize: number
}

/** A sheet's size in cells. */
export interface CellCount {
  columns: number
  rows: number
}

/** Undo and redo over whole-image snapshots. */
export interface History {
  /** Remember `before`, the image as it was before a change. Clears redo. */
  push(before: IndexedImage): void
  /** The image to go back to, given the current one; undefined at the start. */
  undo(current: IndexedImage): IndexedImage | undefined
  /** The image to go forward to, given the current one; undefined at the end. */
  redo(current: IndexedImage): IndexedImage | undefined
  readonly canUndo: boolean
  readonly canRedo: boolean
}

/** Copied pixels, ready to paste. */
export type Clip = IndexedImage

/**
 * A selected area of the sheet. Once lifted, its pixels float over the
 * sheet at `rect` until dropped: moved, flipped or rotated without
 * touching what is under them.
 */
export interface Selection {
  rect: Rect
  lifted?: IndexedImage
}

export type ToolName =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'pick'
  | 'line'
  | 'rect'
  | 'select'

export const TOOLS: readonly ToolName[] = [
  'pencil',
  'eraser',
  'fill',
  'pick',
  'line',
  'rect',
  'select',
]

/** What the editor does besides choosing a tool. */
export type ActionName =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'flipX'
  | 'flipY'
  | 'rotate'
  | 'clear'
  | 'deselect'

/**
 * The keyboard. A key is written as `KeyboardEvent.key` in lower case,
 * with `mod+` in front for Ctrl, or Cmd on a Mac, and `shift+` for Shift.
 */
export const SHORTCUTS: Readonly<Record<string, ToolName | ActionName>> = {
  p: 'pencil',
  e: 'eraser',
  f: 'fill',
  i: 'pick',
  l: 'line',
  r: 'rect',
  s: 'select',
  'mod+z': 'undo',
  'mod+shift+z': 'redo',
  'mod+y': 'redo',
  'mod+c': 'copy',
  'mod+x': 'cut',
  'mod+v': 'paste',
  h: 'flipX',
  v: 'flipY',
  t: 'rotate',
  delete: 'clear',
  backspace: 'clear',
  escape: 'deselect',
}

/** How many cells wide and tall the painting area shows. */
export type Zoom = 1 | 2 | 4

/** A line or rectangle being dragged out, before it is drawn. */
export interface Drag {
  from: Vec
  to: Vec
}

/** What the UI shows. A new object after every change. */
export interface EditorState {
  /** Every sheet in the sprites folder. */
  sheets: readonly SheetInfo[]
  /** The open sheet, if any. */
  doc: SheetDoc | undefined
  /** The top left cell of the painting area, in cells. */
  cell: Vec
  zoom: Zoom
  tool: ToolName
  /** The colour index painted with. */
  color: number
  /** Whether the rectangle tool fills. */
  filled: boolean
  selection: Selection | undefined
  /** A line or rectangle being dragged, for the canvas to preview. */
  drag: Drag | undefined
  canUndo: boolean
  canRedo: boolean
  /** The last thing that went wrong, such as a failed write. */
  error: string | undefined
  /** Counts up on every change to the pixels, for canvases to redraw. */
  version: number
}

/** A sheet to make: its name, cell size and size in cells. */
export interface NewSheet extends CellCount {
  name: string
  cellWidth: number
  cellHeight: number
}

/** The editor: state to show and actions to take. */
export interface Editor {
  get(): EditorState
  /** Hear of every change to the state. Returns a function that stops. */
  subscribe(listener: () => void): () => void
  /** Open a sheet by file name. */
  open(file: string): Promise<void>
  /** Show the painting area from this cell. */
  pickCell(cell: Vec): void
  setZoom(zoom: Zoom): void
  setTool(tool: ToolName): void
  setColor(color: number): void
  setFilled(filled: boolean): void
  /** The pointer, in sheet pixels, with the current tool. */
  pointerDown(at: Vec): void
  pointerMove(at: Vec): void
  pointerUp(at: Vec): void
  /** Do one of the actions. */
  act(action: ActionName): void
  /**
   * Handle a key as `SHORTCUTS` spells it, from `keyName`. True when it was
   * one of them, so the caller can stop the browser's own handling.
   */
  key(name: string): boolean
  /** Make and open a new sheet. Gives the reason when it is refused. */
  newSheet(sheet: NewSheet): Promise<string | undefined>
  /** Resize the open sheet, keeping its top left. */
  resize(size: CellCount): Promise<void>
  /** Stop listening to the host. */
  destroy(): void
}

/** What the editor's components are given. */
export interface EditorProps {
  editor: Editor
  state: EditorState
}

/** A tab beside the game. */
export interface EditorTab {
  name: string
  content: ComponentChildren
}

export interface ShellProps {
  /** The page the game runs in. */
  gameUrl: string
  /** The editors, in order after Game. */
  tabs: readonly EditorTab[]
}
