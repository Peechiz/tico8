// The map editor's shared types. The editor reaches files only through a
// `MapHost`, and the UI reaches the map only through a `MapEditor`.
import type { Pixels } from '../assets/sheets.ts'
import type { FlagData, MapData } from '../maps/types.ts'
import type { Rect } from '../shapes.ts'
import type { Vec } from '../vec.ts'
import type { CellCount, FileHost, SheetInfo } from './types.ts'

export type {
  CellCount,
  FileHost,
  FlagData,
  MapData,
  Pixels,
  Rect,
  SheetInfo,
  Vec,
}

/** A map in the project's maps folder. */
export interface MapInfo {
  /** The file name inside the maps folder: `room1.json`. */
  file: string
  /** The name game code imports it by: `room1`. */
  name: string
  /** The tileset, by the name its sheet is imported by: `tiles`. */
  tiles: string
  /** The tileset's flags file inside the sprites folder, if it has one. */
  flags?: string
}

/** Everything the map editor knows of the project's files. */
export interface MapHost {
  /** The sprites folder: tilesets are read, and written by a swap, here. */
  sheets: FileHost
  /** The maps in the maps folder, sorted by name. */
  listMaps(): Promise<MapInfo[]>
  /** A map file's JSON, parsed and not yet checked. */
  readMap(file: string): Promise<unknown>
  /** Write a map file's text, making the file if it is new. */
  writeMap(file: string, text: string): Promise<void>
  /** A flags file's JSON, parsed and not yet checked; undefined if missing. */
  readFlags(file: string): Promise<unknown>
  /** Write a flags file's text, making the file if it is new. */
  writeFlags(file: string, text: string): Promise<void>
  /** Hear of a map file with new content, by the map's name and its JSON. */
  onMapChange(listener: (name: string, data: unknown) => void): () => void
  /** Hear of a flags file with new content, by its tileset's name. */
  onFlagsChange(listener: (tiles: string, data: unknown) => void): () => void
  /** Hear of the maps folder's list of maps changing. */
  onMapList(listener: (maps: MapInfo[]) => void): () => void
}

/**
 * A block of cells, row by row from the top left: a layer, the brush, a
 * clip. A cell is a tile's frame or `EMPTY`.
 */
export interface Cells {
  readonly columns: number
  readonly rows: number
  readonly cells: Int16Array
}

/**
 * A selected area of the current layer, in cells. Once lifted, its cells
 * float over the layer at `rect` until dropped; its empty cells leave what
 * is under them.
 */
export interface LayerSelection {
  rect: Rect
  lifted?: Cells
}

/** An open map. */
export interface MapDoc {
  info: MapInfo
  /** Its cells, layers in the file's order. Replaced, never edited, by undo. */
  data: MapData
}

/** The open map's tileset: its sheet's pixels and its flags. */
export interface Tileset {
  sheet: SheetInfo
  /** The PNG as stored, RGBA. Cells are 8x8; frames count row by row. */
  pixels: Pixels
  /** How many tiles across, and how many in all. */
  columns: number
  frames: number
  /** Its flags file in the sprites folder, whether or not it exists yet. */
  flagsFile: string
  /** Its flags, in the file's order; empty when it has no file. */
  flags: FlagData
}

export type MapToolName =
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'rect'
  | 'pick'
  | 'select'

export const MAP_TOOLS: readonly MapToolName[] = [
  'brush',
  'eraser',
  'fill',
  'rect',
  'pick',
  'select',
]

/** What the map editor does besides choosing a tool. */
export type MapActionName =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'clear'
  | 'deselect'
  | 'prevLayer'
  | 'nextLayer'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'

/** The keyboard, spelled as `SHORTCUTS` spells it (see `keyName`). */
export const MAP_SHORTCUTS: Readonly<
  Record<string, MapToolName | MapActionName>
> = {
  b: 'brush',
  e: 'eraser',
  f: 'fill',
  r: 'rect',
  i: 'pick',
  s: 'select',
  'mod+z': 'undo',
  'mod+shift+z': 'redo',
  'mod+y': 'redo',
  'mod+c': 'copy',
  'mod+x': 'cut',
  'mod+v': 'paste',
  delete: 'clear',
  backspace: 'clear',
  escape: 'deselect',
  '[': 'prevLayer',
  ']': 'nextLayer',
  '=': 'zoomIn',
  '-': 'zoomOut',
  '0': 'zoomFit',
}

/** The zoom steps, in screen pixels per map pixel. */
export const MAP_ZOOMS: readonly number[] = [1, 2, 3, 4, 6, 8]

/** What the UI shows. A new object after every change. */
export interface MapEditorState {
  /** Every map in the maps folder. */
  maps: readonly MapInfo[]
  /** Every sheet in the sprites folder, for a new map's tileset. */
  sheets: readonly SheetInfo[]
  /** The open map, if any. */
  doc: MapDoc | undefined
  /** The open map's tileset, once read. */
  tileset: Tileset | undefined
  /** The layer the tools work on, by name. */
  layer: string | undefined
  /** Layers hidden in the editor, by name. Never saved. */
  hidden: readonly string[]
  tool: MapToolName
  /** The tiles painted with: one tile or a block. */
  brush: Cells
  /** Where the brush came from in the tileset, in tiles, for marking. */
  chosen: Rect
  /** Whether a drag in the tileset swaps tiles instead of picking. */
  arrange: boolean
  /** The flag whose tiles are tinted, if any. */
  shownFlag: string | undefined
  selection: LayerSelection | undefined
  /** A rectangle being dragged out, in cells, for the canvas to preview. */
  drag: { from: Vec; to: Vec } | undefined
  /** Screen pixels per map pixel; undefined fits the map to its space. */
  zoom: number | undefined
  canUndo: boolean
  canRedo: boolean
  /** Whether a write is under way or waiting; false once the queue is empty. */
  saving: boolean
  /** The last thing that went wrong, such as a failed write. */
  error: string | undefined
  /** Counts up on every change to cells, tiles or flags, for redraws. */
  version: number
}

/** A map to make. */
export interface NewMap extends CellCount {
  /** The name game code imports it by; the file is `<name>.json`. */
  name: string
  /** The tileset, by its sheet's name. Its cells must be 8x8. */
  tiles: string
  /** The first layer's name. */
  layer: string
}

/** The map editor: state to show and actions to take. */
export interface MapEditor {
  get(): MapEditorState
  /** Hear of every change to the state. Returns a function that stops. */
  subscribe(listener: () => void): () => void
  /** Open a map by file name. */
  open(file: string): Promise<void>

  setTool(tool: MapToolName): void
  /** Make a layer the current one. */
  setLayer(name: string): void
  /** Show or hide a layer in the editor. */
  toggleLayer(name: string): void
  /** Add an empty layer at the end. Gives the reason when it is refused. */
  addLayer(name: string): string | undefined
  /** Gives the reason when it is refused. */
  renameLayer(from: string, to: string): string | undefined
  /** Remove a layer; the last one cannot go. */
  removeLayer(name: string): void
  /** Move a layer one place earlier (-1) or later (1) in the file. */
  moveLayer(name: string, by: -1 | 1): void

  /** Make the brush the tiles in `rect` of the tileset, in tiles. */
  chooseTiles(rect: Rect): void
  setArrange(arrange: boolean): void
  /** Swap two tiles in the PNG, the flags and every map on the tileset. */
  swapTiles(a: number, b: number): Promise<void>

  /** Tint a flag's tiles, or none. */
  showFlag(flag: string | undefined): void
  /** Give or take a flag from every chosen tile. */
  setFlag(flag: string, on: boolean): void
  /** Gives the reason when it is refused. */
  addFlag(name: string): string | undefined
  /** Gives the reason when it is refused. */
  renameFlag(from: string, to: string): string | undefined
  removeFlag(name: string): void

  /** The pointer, in cells, with the current tool on the current layer. */
  pointerDown(at: Vec): void
  pointerMove(at: Vec): void
  pointerUp(at: Vec): void
  /** Make the brush the tile at `at` on the current layer; empty does nothing. */
  pickAt(at: Vec): void

  /** Screen pixels per map pixel, or undefined to fit. */
  setZoom(zoom: number | undefined): void
  /**
   * The scale at which the map fits its space, from the canvas, so the zoom
   * keys step from the scale shown when the zoom is fit.
   */
  setFit(scale: number): void
  /** Do one of the actions. */
  act(action: MapActionName): void
  /**
   * Handle a key as `MAP_SHORTCUTS` spells it, from `keyName`. True when it
   * was one of them, so the caller can stop the browser's own handling.
   */
  key(name: string): boolean

  /** Make and open a new map. Gives the reason when it is refused. */
  newMap(map: NewMap): Promise<string | undefined>
  /** Resize the open map, keeping its top left. */
  resize(size: CellCount): Promise<void>
  /** Stop listening to the host. */
  destroy(): void
}

/** What the map editor's components are given. */
export interface MapEditorProps {
  editor: MapEditor
  state: MapEditorState
}

/** The cell under the pointer on the map. */
export interface MapHover {
  at: Vec
  /** The current layer's tile there, undefined when empty. */
  frame: number | undefined
}

export interface MapCanvasProps extends MapEditorProps {
  /** The game's screen in pixels, for the screen lines. */
  screen: { width: number; height: number }
  /** Hear where the pointer is; undefined once it leaves. */
  onHover?: (hover: MapHover | undefined) => void
}

export interface MapStatusProps extends MapEditorProps {
  hover: MapHover | undefined
  /** Open the shortcut sheet. */
  onHelp: () => void
}

/** A dialog over the map editor. */
export interface MapDialogProps extends MapEditorProps {
  onClose: () => void
}

export interface NewMapDialogProps extends MapDialogProps {
  /** The size a new map starts at: one screen, in cells. */
  start: CellCount
}

export interface MapTabsProps extends MapEditorProps {
  /** The size a new map starts at: one screen, in cells. */
  start: CellCount
}
